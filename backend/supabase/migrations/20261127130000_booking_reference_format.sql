-- Booking references are `GBX-` plus ten random alphanumerics. The original
-- default used six hex characters; the alphabet here matches the client's
-- `newBookingReference()` (A–Z, 0–9). Existing references are left untouched
-- because they are printed on receipts and referenced by payments.

create or replace function public.new_booking_reference()
returns text
language sql
volatile
as $$
  select 'GBX-' || (
    select string_agg(
      substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 1 + floor(random() * 36)::int, 1),
      ''
      order by position
    )
    from generate_series(1, 10) as position
  );
$$;

alter table public.bookings
  alter column reference set default public.new_booking_reference();
