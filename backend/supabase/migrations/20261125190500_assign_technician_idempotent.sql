-- `assign_technician` always inserted, but `job_assignments` is unique per
-- (booking_id, technician_id) and allows one active lead, so re-assigning the same
-- technician (or reviving a removed row) failed with a duplicate key, and swapping
-- the lead failed on `job_assignments_one_lead`. Assignment is now idempotent:
-- an existing row is updated in place, and a new lead replaces the old one.
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

  if not exists (
    select 1
    from public.technician_profiles tp
    join public.profiles p on p.id = tp.user_id
    where tp.user_id = p_technician and p.status = 'active'
  ) then
    raise exception 'technician % is not on the active roster', p_technician
      using errcode = 'P0002';
  end if;

  select * into v_row
  from public.job_assignments
  where booking_id = p_booking and technician_id = p_technician
  for update;

  -- One lead per booking: a new lead takes over from the current one.
  if p_crew_role = 'lead'
    and (v_row.id is null or v_row.crew_role <> 'lead' or v_row.status = 'removed')
  then
    update public.job_assignments
    set crew_role = 'helper',
        status = case
          when status = 'assigned' then 'removed'::public.assignment_status
          else status
        end
    where booking_id = p_booking
      and crew_role = 'lead'
      and status <> 'removed'
      and technician_id <> p_technician;
  end if;

  if v_row.id is null then
    insert into public.job_assignments (
      booking_id, technician_id, crew_role, assigned_by, starts_at, ends_at
    ) values (
      p_booking, p_technician, p_crew_role, public.my_profile_id(),
      v_booking.scheduled_start, v_booking.scheduled_end
    )
    returning * into v_row;
  else
    update public.job_assignments
    set crew_role = p_crew_role,
        status = case
          when status = 'removed' then 'assigned'::public.assignment_status
          else status
        end,
        assigned_by = public.my_profile_id(),
        starts_at = v_booking.scheduled_start,
        ends_at = v_booking.scheduled_end
    where id = v_row.id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke all on function public.assign_technician(uuid, uuid, public.crew_role) from public;
grant execute on function public.assign_technician(uuid, uuid, public.crew_role) to authenticated;
