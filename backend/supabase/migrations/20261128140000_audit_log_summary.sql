-- M2 — audit totals for the console's KPI strip.
-- `audit_log_page` already returns the filtered total; this adds the whole-log picture
-- so the page does not show the same number twice.

create or replace function public.audit_log_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.auth_role() is distinct from 'admin' then
    raise exception 'Only an owner can read the audit log' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'events', count(*),
      'created', count(*) filter (where action = 'INSERT'),
      'updated', count(*) filter (where action = 'UPDATE'),
      'deleted', count(*) filter (where action = 'DELETE'),
      'tables', count(distinct table_name),
      'newestAt', max(created_at)
    )
    from public.audit_log
  );
end;
$$;

revoke all on function public.audit_log_summary() from public;
grant execute on function public.audit_log_summary() to authenticated;
