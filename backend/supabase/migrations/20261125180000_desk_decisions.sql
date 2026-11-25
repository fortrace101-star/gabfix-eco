-- Manager decisions for the desk (E3) and the technician inspection report (E2/F3).
--
-- The booking RLS policy lets the desk write `bookings` directly, but status
-- history is only written by `move_booking_status`, so confirm/cancel go through
-- RPCs that keep the trail. Inspection submission is inspector-owned and also
-- moves the quote to `inspected`, which an inspector may not update themselves.

create or replace function public.confirm_booking(p_booking uuid, p_note text default null)
returns public.booking_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.booking_status;
begin
  if not public.has_capability('confirm_bookings') then
    raise exception 'only staff who confirm bookings can do this' using errcode = '42501';
  end if;

  select status into v_status from public.bookings where id = p_booking for update;
  if v_status is null then
    raise exception 'booking % not found', p_booking using errcode = 'P0002';
  end if;
  if v_status not in ('requested', 'awaiting_confirmation') then
    raise exception 'booking is already %', v_status using errcode = '23514';
  end if;

  update public.bookings
  set confirmed_by = public.my_profile_id(),
      confirmed_at = now()
  where id = p_booking;

  perform public.move_booking_status(p_booking, 'confirmed', p_note);
  return 'confirmed';
end;
$$;

create or replace function public.cancel_booking(
  p_booking uuid,
  p_reason text,
  p_note text default null
)
returns public.booking_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.booking_status;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.has_capability('cancel_bookings') then
    raise exception 'only staff who cancel bookings can do this' using errcode = '42501';
  end if;
  if v_reason = '' then
    raise exception 'a cancellation reason is required' using errcode = '23514';
  end if;

  select status into v_status from public.bookings where id = p_booking for update;
  if v_status is null then
    raise exception 'booking % not found', p_booking using errcode = 'P0002';
  end if;
  if v_status in ('completed', 'cancelled') then
    raise exception 'a % booking cannot be cancelled', v_status using errcode = '23514';
  end if;

  update public.bookings set cancel_reason = v_reason where id = p_booking;

  perform public.move_booking_status(p_booking, 'cancelled', coalesce(nullif(btrim(p_note), ''), v_reason));
  return 'cancelled';
end;
$$;

-- Approving cancels the booking; declining leaves it untouched. Both close the
-- request so a new one can be raised for the same booking.
create or replace function public.decide_cancellation_request(
  p_request uuid,
  p_approve boolean,
  p_note text default null
)
returns public.request_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.cancellation_requests;
  v_booking_status public.booking_status;
  v_status public.request_status := case when p_approve then 'approved' else 'declined' end;
begin
  if not public.has_capability('cancel_bookings') then
    raise exception 'only staff who cancel bookings can decide these' using errcode = '42501';
  end if;

  select * into v_request from public.cancellation_requests where id = p_request for update;
  if v_request.id is null then
    raise exception 'cancellation request % not found', p_request using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'this request is already %', v_request.status using errcode = '23514';
  end if;

  if p_approve then
    select status into v_booking_status from public.bookings where id = v_request.booking_id for update;
    if v_booking_status in ('completed', 'cancelled') then
      raise exception 'a % booking cannot be cancelled', v_booking_status using errcode = '23514';
    end if;

    update public.bookings set cancel_reason = v_request.reason where id = v_request.booking_id;
    perform public.move_booking_status(
      v_request.booking_id,
      'cancelled',
      coalesce(nullif(btrim(p_note), ''), v_request.reason)
    );
  end if;

  update public.cancellation_requests
  set status = v_status,
      decided_by = public.my_profile_id(),
      decided_at = now(),
      decision_note = nullif(btrim(p_note), '')
  where id = p_request;

  return v_status;
end;
$$;

-- The inspector on the visit reports what they saw; the quote moves to
-- `inspected` so the desk can price it from the report.
create or replace function public.submit_inspection(
  p_inspection uuid,
  p_checklist jsonb default '[]'::jsonb,
  p_notes text default null,
  p_measurements jsonb default '{}'::jsonb,
  p_recommended_hours numeric default null,
  p_recommended_crew smallint default null
)
returns public.inspection_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inspection public.inspections;
begin
  select * into v_inspection from public.inspections where id = p_inspection for update;
  if v_inspection.id is null then
    raise exception 'inspection % not found', p_inspection using errcode = 'P0002';
  end if;
  if v_inspection.inspector_id is distinct from public.my_profile_id() then
    raise exception 'only the assigned inspector can submit this report' using errcode = '42501';
  end if;
  if v_inspection.status not in ('required', 'scheduled', 'in_progress') then
    raise exception 'this inspection is already %', v_inspection.status using errcode = '23514';
  end if;
  if jsonb_typeof(p_checklist) <> 'array' then
    raise exception 'the checklist must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_typeof(p_measurements) <> 'object' then
    raise exception 'measurements must be a JSON object' using errcode = '22023';
  end if;

  update public.inspections
  set status = 'submitted',
      submitted_at = now(),
      started_at = coalesce(started_at, now()),
      checklist = p_checklist,
      notes = nullif(btrim(p_notes), ''),
      measurements = p_measurements,
      recommended_hours = p_recommended_hours,
      recommended_crew = p_recommended_crew
  where id = p_inspection;

  update public.quotes
  set status = 'inspected'
  where id = v_inspection.quote_id
    and status in ('requested', 'inspection_required', 'inspection_scheduled');

  return 'submitted';
end;
$$;

revoke all on function public.confirm_booking(uuid, text) from public;
revoke all on function public.cancel_booking(uuid, text, text) from public;
revoke all on function public.decide_cancellation_request(uuid, boolean, text) from public;
revoke all on function public.submit_inspection(uuid, jsonb, text, jsonb, numeric, smallint) from public;

grant execute on function public.confirm_booking(uuid, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text, text) to authenticated;
grant execute on function public.decide_cancellation_request(uuid, boolean, text) to authenticated;
grant execute on function public.submit_inspection(uuid, jsonb, text, jsonb, numeric, smallint) to authenticated;
