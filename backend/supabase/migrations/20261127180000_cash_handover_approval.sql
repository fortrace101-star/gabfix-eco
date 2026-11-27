-- Technician handovers are a claim until the desk checks the cash. Cash due in the
-- console counts only rows with `confirmed_at`, so a handover recorded from the
-- technician app changes nothing until it is approved here. `confirm_cash_handover`
-- still exists for cash the desk receives directly; this RPC settles a handover the
-- technician already recorded instead of inserting a second row for the same money.
create or replace function public.approve_cash_handover(
  p_handover uuid,
  p_note text default null
)
returns public.cash_handovers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.cash_handovers;
begin
  if not public.has_capability('confirm_cash') then
    raise exception 'you cannot confirm cash handovers' using errcode = '42501';
  end if;

  select * into v_row from public.cash_handovers where id = p_handover for update;
  if v_row.id is null then
    raise exception 'handover % not found', p_handover using errcode = 'P0002';
  end if;

  -- Idempotent: a repeated approval (or a second desk user) returns the settled row.
  if v_row.confirmed_at is not null then
    return v_row;
  end if;

  update public.cash_handovers
    set confirmed_by = public.my_profile_id(),
        confirmed_at = now(),
        note = coalesce(nullif(btrim(p_note), ''), note)
    where id = p_handover
    returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.approve_cash_handover(uuid, text) from public;
grant execute on function public.approve_cash_handover(uuid, text) to authenticated;
