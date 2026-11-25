-- G3: job costs entered by the desk, approved by a manager, and the technician
-- commission that only becomes payable once the job is completed and every cost
-- on it is approved. Commission is computed on the server so reports and any
-- payout screen read the same numbers.
create type public.cost_status as enum ('submitted', 'approved', 'rejected');

alter table public.job_costs
  add column status public.cost_status not null default 'submitted',
  add column approved_by uuid references public.profiles (id),
  add column approved_at timestamptz,
  add column decision_note text;

create index job_costs_status_idx on public.job_costs (status, created_at desc);

alter table public.technician_profiles
  add column commission_rate numeric(5, 2) not null default 40
    check (commission_rate >= 0 and commission_rate <= 100);

insert into public.capabilities (key, description)
values ('approve_job_costs', 'Approve or reject job costs and release commission')
on conflict (key) do nothing;

insert into public.role_capabilities (role, capability)
values ('manager', 'approve_job_costs'), ('admin', 'approve_job_costs')
on conflict (role, capability) do nothing;

-- Managers need to read the costs they approve; entry stays admin-only.
create policy "job costs approve read" on public.job_costs for select to authenticated
  using (public.has_capability('approve_job_costs'));

create or replace function public.add_job_cost(
  p_booking uuid,
  p_description text,
  p_amount numeric
)
returns public.job_costs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.job_costs;
begin
  if not public.has_capability('enter_job_costs') then
    raise exception 'not allowed to enter job costs' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_description)), 0) = 0 then
    raise exception 'describe the cost' using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'cost must be zero or more' using errcode = '22023';
  end if;
  if not exists (select 1 from public.bookings where id = p_booking) then
    raise exception 'booking % not found', p_booking using errcode = 'P0002';
  end if;

  insert into public.job_costs (booking_id, description, amount, entered_by)
  values (p_booking, btrim(p_description), p_amount, public.my_profile_id())
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.decide_job_cost(p_cost uuid, p_approve boolean, p_note text default null)
returns public.job_costs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.job_costs;
begin
  if not public.has_capability('approve_job_costs') then
    raise exception 'not allowed to approve job costs' using errcode = '42501';
  end if;

  update public.job_costs
  set status = (case when p_approve then 'approved' else 'rejected' end)::public.cost_status,
      approved_by = public.my_profile_id(),
      approved_at = now(),
      decision_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_cost
  returning * into v_row;

  if v_row.id is null then
    raise exception 'cost % not found', p_cost using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- One row per booking the desk has to look at: revenue, what it cost, what the
-- technician earns, and whether that commission may be released.
create or replace function public.job_cost_overview(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table (
  booking_id uuid,
  reference text,
  customer_name text,
  status public.booking_status,
  scheduled_start timestamptz,
  revenue numeric,
  costs numeric,
  pending_costs integer,
  technicians text,
  commission_rate numeric,
  commission numeric,
  margin numeric,
  commission_ready boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    public.has_capability('enter_job_costs')
    or public.has_capability('approve_job_costs')
    or public.has_capability('view_reports')
  ) then
    raise exception 'not allowed to read job costs' using errcode = '42501';
  end if;

  return query
  with cost_totals as (
    select c.booking_id,
           sum(c.amount) filter (where c.status = 'approved') as approved,
           count(*) filter (where c.status = 'submitted') as pending
    from public.job_costs c
    group by c.booking_id
  ),
  crew as (
    select a.booking_id,
           string_agg(
             coalesce(tp.display_name, p.full_name, 'Technician'),
             ', ' order by case when a.crew_role = 'lead' then 0 else 1 end, a.created_at
           ) as names,
           max(case when a.crew_role = 'lead' then tp.commission_rate end) as rate,
           (array_agg(case when a.crew_role = 'lead' then tp.user_id end))[1] as lead_id
    from public.job_assignments a
    join public.profiles p on p.id = a.technician_id
    left join public.technician_profiles tp on tp.user_id = a.technician_id
    where a.status <> 'removed'
    group by a.booking_id
  )
  select b.id,
         b.reference,
         coalesce(b.customer_name, pr.full_name) as customer_name,
         b.status,
         b.scheduled_start,
         b.total_price,
         coalesce(ct.approved, 0),
         coalesce(ct.pending, 0)::integer,
         coalesce(cr.names, 'Unassigned'),
         coalesce(cr.rate, 40),
         round(b.total_price * coalesce(cr.rate, 40) / 100, 2),
         b.total_price - coalesce(ct.approved, 0) - round(b.total_price * coalesce(cr.rate, 40) / 100, 2),
         (b.status = 'completed' and coalesce(ct.pending, 0) = 0 and cr.lead_id is not null)
  from public.bookings b
  join public.profiles pr on pr.id = b.customer_id
  left join cost_totals ct on ct.booking_id = b.id
  left join crew cr on cr.booking_id = b.id
  where b.status in ('completed', 'in_progress', 'on_the_way')
    and (p_from is null or b.scheduled_start >= p_from)
    and (p_to is null or b.scheduled_start <= p_to)
  order by b.scheduled_start desc
  limit 200;
end;
$$;

revoke all on function public.add_job_cost(uuid, text, numeric) from public;
revoke all on function public.decide_job_cost(uuid, boolean, text) from public;
revoke all on function public.job_cost_overview(timestamptz, timestamptz) from public;
grant execute on function public.add_job_cost(uuid, text, numeric) to authenticated;
grant execute on function public.decide_job_cost(uuid, boolean, text) to authenticated;
grant execute on function public.job_cost_overview(timestamptz, timestamptz) to authenticated;
