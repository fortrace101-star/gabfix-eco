-- The inspector needs the visit details (address, customer, service) to do the
-- inspection, but `can_view_booking` only covers the desk, the customer and the
-- technicians assigned to the job. Rather than widening the bookings policy,
-- these two security-definer reads scope the payload to the inspector's own
-- inspection.

create or replace function public.my_inspections()
returns table (
  id uuid,
  status public.inspection_status,
  scheduled_at timestamptz,
  required_at timestamptz,
  submitted_at timestamptz,
  required_note text,
  notes text,
  checklist jsonb,
  measurements jsonb,
  recommended_hours numeric,
  recommended_crew smallint,
  booking_id uuid,
  booking_reference text,
  booking_status public.booking_status,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  customer_name text,
  customer_phone text,
  address_line text,
  area text,
  services text,
  quote_description text,
  quote_amount numeric,
  quote_status public.quote_status
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    i.id,
    i.status,
    i.scheduled_at,
    i.required_at,
    i.submitted_at,
    i.required_note,
    i.notes,
    i.checklist,
    i.measurements,
    i.recommended_hours,
    i.recommended_crew,
    b.id,
    b.reference,
    b.status,
    b.scheduled_start,
    b.scheduled_end,
    coalesce(b.customer_name, p.full_name),
    coalesce(b.customer_phone, p.phone),
    a.line1,
    a.area,
    (
      select string_agg(distinct s.name, ', ')
      from public.booking_items bi
      join public.services s on s.id = bi.service_id
      where bi.booking_id = b.id
    ),
    q.description,
    q.quoted_amount,
    q.status
  from public.inspections i
  join public.bookings b on b.id = i.booking_id
  left join public.profiles p on p.id = b.customer_id
  left join public.addresses a on a.id = b.address_id
  left join public.quotes q on q.id = i.quote_id
  where i.inspector_id = public.my_profile_id()
    and i.status <> 'withdrawn'
  order by coalesce(i.scheduled_at, i.required_at) asc;
$$;

create or replace function public.inspection_detail(p_inspection uuid)
returns table (
  id uuid,
  status public.inspection_status,
  scheduled_at timestamptz,
  required_at timestamptz,
  submitted_at timestamptz,
  required_note text,
  notes text,
  checklist jsonb,
  measurements jsonb,
  recommended_hours numeric,
  recommended_crew smallint,
  booking_id uuid,
  booking_reference text,
  booking_status public.booking_status,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  customer_name text,
  customer_phone text,
  address_line text,
  area text,
  services text,
  quote_description text,
  quote_amount numeric,
  quote_status public.quote_status
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    i.id,
    i.status,
    i.scheduled_at,
    i.required_at,
    i.submitted_at,
    i.required_note,
    i.notes,
    i.checklist,
    i.measurements,
    i.recommended_hours,
    i.recommended_crew,
    b.id,
    b.reference,
    b.status,
    b.scheduled_start,
    b.scheduled_end,
    coalesce(b.customer_name, p.full_name),
    coalesce(b.customer_phone, p.phone),
    a.line1,
    a.area,
    (
      select string_agg(distinct s.name, ', ')
      from public.booking_items bi
      join public.services s on s.id = bi.service_id
      where bi.booking_id = b.id
    ),
    q.description,
    q.quoted_amount,
    q.status
  from public.inspections i
  join public.bookings b on b.id = i.booking_id
  left join public.profiles p on p.id = b.customer_id
  left join public.addresses a on a.id = b.address_id
  left join public.quotes q on q.id = i.quote_id
  where i.id = p_inspection
    and (i.inspector_id = public.my_profile_id() or public.is_desk());
$$;

revoke all on function public.my_inspections() from public;
revoke all on function public.inspection_detail(uuid) from public;

grant execute on function public.my_inspections() to authenticated;
grant execute on function public.inspection_detail(uuid) to authenticated;
