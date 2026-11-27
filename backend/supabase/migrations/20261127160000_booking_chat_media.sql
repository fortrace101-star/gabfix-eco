-- Chat attachments. A message can now carry one photo or short video, using the
-- same limits as booking media (25 MB, 30 s of video). Files live in a private
-- `chat-media` bucket at `threads/<thread id>/<file>`; only the thread's parties
-- can read or write them.

alter table public.booking_messages
  add column if not exists media_path text,
  add column if not exists media_kind text,
  add column if not exists media_mime text,
  add column if not exists media_bytes bigint,
  add column if not exists media_duration_ms integer;

alter table public.booking_messages drop constraint if exists booking_messages_body_check;
alter table public.booking_messages
  add constraint booking_messages_body_check
  check (length(btrim(body)) > 0 or media_path is not null);

alter table public.booking_messages drop constraint if exists booking_messages_media_kind_check;
alter table public.booking_messages
  add constraint booking_messages_media_kind_check
  check (media_kind is null or media_kind in ('image', 'video'));

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', false)
on conflict (id) do nothing;

-- Path layout: threads/<thread id>/<file>. foldername() drops the file name, so
-- element 2 is the thread id.
drop policy if exists "chat media read" on storage.objects;
create policy "chat media read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.can_view_booking_thread(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "chat media write" on storage.objects;
create policy "chat media write"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.can_view_booking_thread(((storage.foldername(name))[2])::uuid)
  );

-- Push copy for attachment-only messages.
create or replace function public.notify_booking_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_thread public.booking_threads;
  v_reference text;
  v_sender text;
  v_title text;
  v_body text;
  v_recipient uuid;
begin
  select * into v_thread
  from public.booking_threads
  where id = new.thread_id;

  if v_thread.id is null then
    return new;
  end if;

  select b.reference into v_reference
  from public.bookings b
  where b.id = v_thread.booking_id;

  select p.full_name into v_sender
  from public.profiles p
  where p.id = new.sender_id;

  v_title := format('%s · %s', coalesce(v_sender, 'New message'), coalesce(v_reference, 'Gabfix'));
  v_body := coalesce(
    nullif(left(btrim(new.body), 140), ''),
    case new.media_kind when 'video' then 'Video' else 'Photo' end
  );

  -- Chat stays at the chat level: no row in the Alerts list, only a push.
  for v_recipient in
    select distinct recipient
    from (
      select v_thread.customer_id as recipient
      union
      select v_thread.lead_id
      union
      select ja.technician_id
      from public.job_assignments ja
      where ja.booking_id = v_thread.booking_id
        and ja.status <> 'removed'
    ) people
    where recipient is not null
      and recipient <> new.sender_id
  loop
    perform public.queue_expo_push(
      v_recipient,
      v_title,
      v_body,
      jsonb_build_object(
        'type', 'chat',
        'threadId', v_thread.id,
        'bookingId', v_thread.booking_id,
        'reference', v_reference
      )
    );
  end loop;

  return new;
end;
$$;
