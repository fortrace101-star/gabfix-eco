-- The desk cannot insert a handover directly: `handovers insert` only allows the
-- technician's own row (`technician_id = my_profile_id()`), so "mark remitted" in
-- the console was refused by RLS. Confirming on their behalf is a desk action, so
-- it goes through this security-definer RPC with the `confirm_cash` capability,
-- and it records who confirmed it.
create or replace function public.confirm_cash_handover(
  p_technician uuid,
  p_amount numeric,
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
  if p_technician is null then
    raise exception 'choose a technician' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.technician_profiles where user_id = p_technician
  ) then
    raise exception 'technician % not found', p_technician using errcode = 'P0002';
  end if;

  insert into public.cash_handovers (technician_id, amount, confirmed_by, confirmed_at, note)
  values (p_technician, p_amount, public.my_profile_id(), now(), nullif(btrim(p_note), ''))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.confirm_cash_handover(uuid, numeric, text) from public;
grant execute on function public.confirm_cash_handover(uuid, numeric, text) to authenticated;
