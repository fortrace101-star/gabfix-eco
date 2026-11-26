-- A partial balance payment looks exactly like a deposit if you only read the amount,
-- so the desk cannot tell them apart. The client already says which one it is when it
-- pays; keep that intent on the ledger row and let the admin label it directly.
-- Null on rows written before this column existed; the admin falls back to the old
-- amount heuristic for those.
alter table public.payments
  add column kind text check (kind in ('deposit', 'balance'));

comment on column public.payments.kind is
  'Whether the row settled a deposit or the outstanding balance. Null on legacy rows.';
