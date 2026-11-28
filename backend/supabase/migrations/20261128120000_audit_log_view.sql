-- M2 — Audit log read surface for the operations console.
--
-- `audit_log` is append-only and, under RLS, readable only by an admin. The console
-- needs paging, filtering and the actor's name, and `audit_log.actor_id` no longer has
-- a foreign key to `profiles` (20261125160000_audit_log_actor_null.sql keeps history
-- after an account is deleted), so PostgREST cannot embed the actor. Reads therefore go
-- through one capability-checked function that joins the profile itself.

create or replace function public.audit_log_page(
  p_table text default null,
  p_action text default null,
  p_actor text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id bigint,
  actor_id uuid,
  actor_name text,
  actor_role text,
  action text,
  table_name text,
  record_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz,
  total bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 500));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
  v_actor text := nullif(btrim(coalesce(p_actor, '')), '');
begin
  if public.auth_role() is distinct from 'admin' then
    raise exception 'Only an owner can read the audit log' using errcode = '42501';
  end if;

  return query
  with filtered as (
    select a.*, p.full_name, p.role::text as actor_role
    from public.audit_log a
    left join public.profiles p on p.id = a.actor_id
    where (p_table is null or a.table_name = p_table)
      and (p_action is null or a.action = p_action)
      and (p_from is null or a.created_at >= p_from)
      and (p_to is null or a.created_at < p_to)
      and (v_search is null or a.record_id ilike '%' || v_search || '%')
      and (v_actor is null or p.full_name ilike '%' || v_actor || '%')
  )
  select f.id, f.actor_id, f.full_name, f.actor_role, f.action, f.table_name,
         f.record_id, f.old_value, f.new_value, f.created_at,
         count(*) over () as total
  from filtered f
  order by f.created_at desc, f.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.audit_log_page(
  text, text, text, timestamptz, timestamptz, text, integer, integer
) from public;
grant execute on function public.audit_log_page(
  text, text, text, timestamptz, timestamptz, text, integer, integer
) to authenticated;

-- The filter's entity list comes from the log itself so a new audited table shows up
-- without a console release.
create or replace function public.audit_log_tables()
returns table (table_name text, events bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.auth_role() is distinct from 'admin' then
    raise exception 'Only an owner can read the audit log' using errcode = '42501';
  end if;

  return query
  select a.table_name, count(*)::bigint as events
  from public.audit_log a
  group by a.table_name
  order by count(*) desc, a.table_name;
end;
$$;

revoke all on function public.audit_log_tables() from public;
grant execute on function public.audit_log_tables() to authenticated;
