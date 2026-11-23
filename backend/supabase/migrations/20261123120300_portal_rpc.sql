-- Capabilities (reference data) and the RPCs the ERP app calls.
-- Technicians never write booking status directly: the RPC records the history,
-- updates the assignment and checks the caller in one transaction.

insert into public.capabilities (key, description) values
  ('assign_jobs', 'Assign technicians to jobs'),
  ('confirm_bookings', 'Confirm staff-created and sales-proposed bookings'),
  ('cancel_bookings', 'Cancel bookings or unconfirm them'),
  ('request_cancellations', 'Raise cancellation requests for confirmed bookings'),
  ('record_payments', 'Record and update payments'),
  ('confirm_cash', 'Confirm cash handovers'),
  ('enter_job_costs', 'Record the cost of operation for a job'),
  ('manage_staff', 'Invite staff and change roles'),
  ('manage_catalogue', 'Edit skills, categories, services and forms'),
  ('create_bookings', 'Create bookings for customers'),
  ('view_customers', 'Read customers, bookings and orders'),
  ('view_reports', 'View sales and operations reports'),
  ('manage_leads', 'Create and follow up sales leads');

insert into public.role_capabilities (role, capability)
select 'admin'::public.app_role, key from public.capabilities;

insert into public.role_capabilities (role, capability) values
  ('manager', 'assign_jobs'),
  ('manager', 'confirm_bookings'),
  ('manager', 'cancel_bookings'),
  ('manager', 'record_payments'),
  ('manager', 'confirm_cash'),
  ('manager', 'create_bookings'),
  ('manager', 'view_customers'),
  ('manager', 'view_reports'),
  ('manager', 'manage_leads'),
  ('customer_relations', 'create_bookings'),
  ('customer_relations', 'request_cancellations'),
  ('customer_relations', 'view_customers'),
  ('sales_operator', 'create_bookings'),
  ('sales_operator', 'request_cancellations'),
  ('sales_operator', 'manage_leads');

-- The daily hours cap is per trade; a technician with two skills gets the
-- stricter cap. Enforced on insert/update of assigned times.
create or replace function public.enforce_daily_hours_cap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cap numeric;
  v_job_hours numeric;
  v_booked numeric;
  v_day_start timestamptz;
begin
  if new.starts_at is null or new.ends_at is null then
    return new;
  end if;

  select min(s.max_daily_hours) into v_cap
  from public.technician_skills ts
  join public.skills s on s.id = ts.skill_id
  where ts.technician_id = new.technician_id;

  if v_cap is null then
    raise exception 'technician % has no skills, so cannot be assigned', new.technician_id
      using errcode = '23514';
  end if;

  select extract(epoch from (b.scheduled_end - b.scheduled_start)) / 3600
    into v_job_hours
  from public.bookings b where b.id = new.booking_id;

  v_day_start := date_trunc('day', new.starts_at);

  select coalesce(sum(extract(epoch from (b.scheduled_end - b.scheduled_start)) / 3600), 0)
    into v_booked
  from public.job_assignments ja
  join public.bookings b on b.id = ja.booking_id
  where ja.technician_id = new.technician_id
    and ja.id <> new.id
    and ja.status <> 'removed'
    and b.scheduled_start >= v_day_start
    and b.scheduled_start < v_day_start + interval '1 day';

  if v_booked + v_job_hours > v_cap then
    raise exception 'daily hours cap exceeded: % booked + % new > % cap',
      round(v_booked, 2), round(v_job_hours, 2), v_cap
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger job_assignments_daily_cap
  before insert or update of starts_at, ends_at, technician_id
  on public.job_assignments
  for each row execute function public.enforce_daily_hours_cap();

-- Internal transition. Only the RPCs below call it.
create or replace function public.move_booking_status(
  p_booking uuid,
  p_to public.booking_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from public.booking_status;
begin
  select status into v_from from public.bookings where id = p_booking for update;
  if v_from is null then
    raise exception 'booking % not found', p_booking using errcode = 'P0002';
  end if;

  if not (public.is_assigned_technician(p_booking) or public.is_desk()) then
    raise exception 'not allowed to move booking %', p_booking using errcode = '42501';
  end if;

  update public.bookings set status = p_to where id = p_booking;
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, note)
  values (p_booking, v_from, p_to, public.my_profile_id(), p_note);
end;
$$;

create or replace function public.set_booking_on_the_way(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_assigned_technician(p_booking) then
    raise exception 'only an assigned technician can start travel' using errcode = '42501';
  end if;
  if (select status from public.bookings where id = p_booking) not in ('confirmed', 'scheduled') then
    raise exception 'booking is not ready to start travel' using errcode = '23514';
  end if;

  update public.job_assignments set status = 'accepted'
  where booking_id = p_booking
    and technician_id = public.my_profile_id()
    and status = 'assigned';

  perform public.move_booking_status(p_booking, 'on_the_way');
end;
$$;

create or replace function public.start_job(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_assigned_technician(p_booking) then
    raise exception 'only an assigned technician can start the job' using errcode = '42501';
  end if;
  if (select status from public.bookings where id = p_booking) not in ('on_the_way', 'scheduled') then
    raise exception 'booking is not ready to start' using errcode = '23514';
  end if;

  update public.job_assignments
  set status = 'in_progress', started_at = coalesce(started_at, now())
  where booking_id = p_booking and technician_id = public.my_profile_id();

  perform public.move_booking_status(p_booking, 'in_progress');
end;
$$;

create or replace function public.complete_job(p_booking uuid, p_billed_hours numeric default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_assigned_technician(p_booking) then
    raise exception 'only an assigned technician can complete the job' using errcode = '42501';
  end if;
  if (select status from public.bookings where id = p_booking) <> 'in_progress' then
    raise exception 'only an in-progress job can be completed' using errcode = '23514';
  end if;
  if p_billed_hours is not null and p_billed_hours <= 0 then
    raise exception 'billed hours must be positive' using errcode = '23514';
  end if;

  update public.job_assignments
  set status = 'done', completed_at = now()
  where booking_id = p_booking and technician_id = public.my_profile_id();

  if p_billed_hours is not null then
    update public.bookings set billed_hours = p_billed_hours where id = p_booking;
  end if;

  perform public.move_booking_status(p_booking, 'completed');
end;
$$;

create or replace function public.assign_technician(
  p_booking uuid,
  p_technician uuid,
  p_crew_role public.crew_role default 'helper'
)
returns public.job_assignments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings;
  v_row public.job_assignments;
begin
  if not public.has_capability('assign_jobs') then
    raise exception 'not allowed to assign technicians' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking;
  if v_booking.id is null then
    raise exception 'booking % not found', p_booking using errcode = 'P0002';
  end if;

  insert into public.job_assignments (
    booking_id, technician_id, crew_role, assigned_by, starts_at, ends_at
  ) values (
    p_booking, p_technician, p_crew_role, public.my_profile_id(),
    v_booking.scheduled_start, v_booking.scheduled_end
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.record_cash_payment(p_booking uuid, p_amount numeric)
returns public.payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.payments;
begin
  if not (public.is_assigned_technician(p_booking) or public.has_capability('record_payments')) then
    raise exception 'not allowed to record a payment for this booking' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '23514';
  end if;

  insert into public.payments (
    booking_id, amount, method, status, recorded_by, paid_at
  ) values (
    p_booking, p_amount, 'cash', 'paid', public.my_profile_id(), now()
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.record_cash_handover(p_amount numeric, p_note text default null)
returns public.cash_handovers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.cash_handovers;
begin
  if public.auth_role() <> 'technician' then
    raise exception 'only technicians record a handover' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '23514';
  end if;

  insert into public.cash_handovers (technician_id, amount, note)
  values (public.my_profile_id(), p_amount, p_note)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.move_booking_status(uuid, public.booking_status, text) from public;
revoke all on function public.enforce_daily_hours_cap() from public;

grant execute on function public.set_booking_on_the_way(uuid) to authenticated;
grant execute on function public.start_job(uuid) to authenticated;
grant execute on function public.complete_job(uuid, numeric) to authenticated;
grant execute on function public.assign_technician(uuid, uuid, public.crew_role) to authenticated;
grant execute on function public.record_cash_payment(uuid, numeric) to authenticated;
grant execute on function public.record_cash_handover(numeric, text) to authenticated;
