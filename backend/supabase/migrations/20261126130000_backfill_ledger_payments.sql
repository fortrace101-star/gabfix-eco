-- Ledger backfill (2026-11-26)
--
-- GBX-988A7A and GBX-6D117E were paid in the customer app before the desk ledger
-- picked the money up, so the admin console showed them with no instalments.
-- Insert the missing rows once, keyed on the booking reference: re-running this
-- migration is a no-op.
--
-- `method` is the enum value `app` (the only enum value for mobile money); the
-- exact provider lives in `provider`, matching POST /bookings/:id/payments.
-- `recorded_by` is the booking's customer, because no staff member took these.

insert into public.payments
  (booking_id, amount, method, status, provider, provider_reference, recorded_by, paid_at, kind)
select
  b.id,
  270000,
  'app',
  'paid',
  'mtn_momo',
  'backfill-2026-11-26-' || b.reference,
  b.customer_id,
  timestamptz '2026-11-26 04:46:05+00',
  'deposit'
from public.bookings b
where b.reference = 'GBX-988A7A'
  and not exists (
    select 1 from public.payments p
    where p.booking_id = b.id
      and p.provider_reference = 'backfill-2026-11-26-GBX-988A7A'
  );

insert into public.payments
  (booking_id, amount, method, status, provider, provider_reference, recorded_by, paid_at, kind)
select
  b.id,
  750000,
  'app',
  'paid',
  'airtel_money',
  'backfill-2026-11-26-' || b.reference,
  b.customer_id,
  timestamptz '2026-11-26 04:46:05+00',
  'balance'
from public.bookings b
where b.reference = 'GBX-6D117E'
  and not exists (
    select 1 from public.payments p
    where p.booking_id = b.id
      and p.provider_reference = 'backfill-2026-11-26-GBX-6D117E'
  );
