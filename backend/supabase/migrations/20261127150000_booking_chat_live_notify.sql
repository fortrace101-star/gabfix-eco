-- Chat goes live and notifies the other side.
--
-- 1. `booking_threads` / `booking_messages` stream through Realtime so both apps
--    can show a new message without waiting for a refresh.
-- 2. Every message queues an Expo push (and an in-app notification) for the other
--    party, using the existing `queue_expo_push()` helper.
-- 3. The owner-only Chat Archive screen reads the JSONL backups straight from the
--    private `chat-archives` bucket, so admins need a select policy there.

-- Realtime --------------------------------------------------------------------

do $$
declare
  v_table text;
  v_tables text[] := array['booking_threads', 'booking_messages'];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach v_table in array v_tables loop
    execute format('alter table public.%I replica identity full', v_table);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;

-- Push + in-app notification --------------------------------------------------

/**
 * Tells the other side of a booking chat that a message arrived: the customer
 * when crew writes, the lead and assigned crew when the customer writes. The
 * sender never gets their own message back. Best effort — a push failure must
 * not roll back the message insert.
 */
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
  v_body := left(new.body, 140);

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
    insert into public.notifications (user_id, title, body, type)
    values (v_recipient, v_title, v_body, 'chat');

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

revoke all on function public.notify_booking_message() from public;

drop trigger if exists booking_messages_notify on public.booking_messages;
create trigger booking_messages_notify
  after insert on public.booking_messages
  for each row execute function public.notify_booking_message();

-- Owner-only archive downloads ------------------------------------------------

drop policy if exists "chat archives owner read" on storage.objects;
create policy "chat archives owner read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-archives'
    and exists (
      select 1
      from public.profiles p
      where p.auth_user_id = auth.uid()
        and p.role = 'admin'
        and p.status = 'active'
    )
  );
