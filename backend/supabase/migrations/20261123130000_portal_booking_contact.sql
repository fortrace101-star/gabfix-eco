-- Technicians may only read their own profile under RLS, so the job needs the
-- customer's name and phone on the booking itself. Customer relations staff
-- also need the contact for a booking they did not create (walk-ins).
alter table public.bookings
  add column if not exists customer_name text,
  add column if not exists customer_phone text;

update public.bookings b
set customer_name = p.full_name,
    customer_phone = p.phone
from public.profiles p
where p.id = b.customer_id
  and b.customer_name is null;
