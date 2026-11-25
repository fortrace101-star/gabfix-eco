-- G3 follow-up: `job_cost_overview` totals each job, but approving happens line by
-- line. This returns the lines (with who entered them) for the jobs in that overview
-- so the console can approve or reject without the service_role key.
create or replace function public.job_cost_lines(p_booking uuid default null)
returns table (
  id uuid,
  booking_id uuid,
  reference text,
  description text,
  amount numeric,
  status public.cost_status,
  entered_by_name text,
  approved_by_name text,
  approved_at timestamptz,
  decision_note text,
  created_at timestamptz
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
  select c.id,
         c.booking_id,
         b.reference,
         c.description,
         c.amount,
         c.status,
         coalesce(entered.full_name, 'Desk') as entered_by_name,
         appr.full_name as approved_by_name,
         c.approved_at,
         c.decision_note,
         c.created_at
  from public.job_costs c
  join public.bookings b on b.id = c.booking_id
  left join public.profiles entered on entered.id = c.entered_by
  left join public.profiles appr on appr.id = c.approved_by
  where p_booking is null or c.booking_id = p_booking
  order by c.created_at desc
  limit 500;
end;
$$;

revoke all on function public.job_cost_lines(uuid) from public;
grant execute on function public.job_cost_lines(uuid) to authenticated;
