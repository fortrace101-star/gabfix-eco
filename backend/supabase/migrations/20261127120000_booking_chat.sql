-- Booking chat. One thread per booking, shared by the customer and the crew
-- assigned to it, so a technician can answer "where are you?" from the job and
-- the customer gets the conversation in Messages without asking for it.
--
-- The thread is created by `ensure_booking_thread()` when a technician is
-- assigned. A lead takes ownership of `lead_id`; until a lead exists the first
-- assignee is the contact, so the customer always has someone to write to.

create table public.booking_threads (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  lead_id uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz not null default now(),
  customer_last_read_at timestamptz,
  lead_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index booking_threads_customer_idx
  on public.booking_threads (customer_id, last_message_at desc);
create index booking_threads_lead_idx
  on public.booking_threads (lead_id, last_message_at desc);

create table public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.booking_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index booking_messages_thread_idx
  on public.booking_messages (thread_id, created_at);

-- Access ---------------------------------------------------------------------

alter table public.booking_threads enable row level security;
alter table public.booking_messages enable row level security;

create or replace function public.can_view_booking_thread(p_thread uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.booking_threads t
    where t.id = p_thread
      and (
        t.customer_id = public.my_profile_id()
        or t.lead_id = public.my_profile_id()
        or public.is_assigned_technician(t.booking_id)
        or public.is_desk()
      )
  );
$$;

create policy "booking threads read"
  on public.booking_threads for select to authenticated
  using (
    customer_id = public.my_profile_id()
    or lead_id = public.my_profile_id()
    or public.is_assigned_technician(booking_id)
    or public.is_desk()
  );

-- Read receipts are the only client write to the thread row.
create policy "booking threads read receipt"
  on public.booking_threads for update to authenticated
  using (
    customer_id = public.my_profile_id()
    or lead_id = public.my_profile_id()
    or public.is_assigned_technician(booking_id)
    or public.is_desk()
  )
  with check (
    customer_id = public.my_profile_id()
    or lead_id = public.my_profile_id()
    or public.is_assigned_technician(booking_id)
    or public.is_desk()
  );

create policy "booking messages read"
  on public.booking_messages for select to authenticated
  using (public.can_view_booking_thread(thread_id));

create policy "booking messages send"
  on public.booking_messages for insert to authenticated
  with check (
    sender_id = public.my_profile_id()
    and public.can_view_booking_thread(thread_id)
  );

-- Automatic threads ----------------------------------------------------------

create or replace function public.ensure_booking_thread()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_customer uuid;
  v_thread public.booking_threads;
begin
  if new.status = 'removed' then
    return new;
  end if;

  select b.customer_id into v_customer
  from public.bookings b
  where b.id = new.booking_id;

  if v_customer is null then
    return new;
  end if;

  select * into v_thread
  from public.booking_threads
  where booking_id = new.booking_id;

  if v_thread.id is null then
    insert into public.booking_threads (booking_id, customer_id, lead_id)
    values (new.booking_id, v_customer, new.technician_id)
    returning * into v_thread;
  elsif new.crew_role = 'lead' and v_thread.lead_id is distinct from new.technician_id then
    update public.booking_threads
    set lead_id = new.technician_id
    where id = v_thread.id;
  elsif v_thread.lead_id is null then
    update public.booking_threads
    set lead_id = new.technician_id
    where id = v_thread.id;
  end if;

  return new;
end;
$$;

create trigger job_assignments_ensure_thread
  after insert or update of status, crew_role, technician_id on public.job_assignments
  for each row execute function public.ensure_booking_thread();

-- Existing jobs should not need a re-assignment to get their thread.
insert into public.booking_threads (booking_id, customer_id, lead_id)
select
  b.id,
  b.customer_id,
  (
    select ja.technician_id
    from public.job_assignments ja
    where ja.booking_id = b.id
      and ja.status <> 'removed'
    order by (ja.crew_role = 'lead') desc, ja.created_at
    limit 1
  )
from public.bookings b
where exists (
  select 1
  from public.job_assignments ja
  where ja.booking_id = b.id
    and ja.status <> 'removed'
)
on conflict (booking_id) do nothing;

-- A message bumps its thread so both inboxes sort by the newest reply.
create or replace function public.touch_booking_thread()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.booking_threads
  set last_message_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$;

create trigger booking_messages_touch_thread
  after insert on public.booking_messages
  for each row execute function public.touch_booking_thread();

create trigger booking_threads_touch_updated_at
  before update on public.booking_threads
  for each row execute function public.touch_updated_at();
