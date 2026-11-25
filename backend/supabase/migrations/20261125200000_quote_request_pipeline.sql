-- A quote-priced service creates a booking with status `requested`, but nothing
-- wrote the `quotes` row the desk works from, so the request never reached
-- Quotes & inspections. The row is now created by the database itself, so every
-- path (client app, desk, ERP) lands in the queue.
create or replace function public.open_quote_for_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'requested' then
    insert into public.quotes (booking_id, requested_by, description, status)
    values (new.id, new.customer_id, new.notes, 'requested')
    on conflict (booking_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_open_quote on public.bookings;
create trigger bookings_open_quote
  after insert on public.bookings
  for each row execute function public.open_quote_for_request();

-- Requests created before the trigger existed.
insert into public.quotes (booking_id, requested_by, description, status)
select b.id, b.customer_id, b.notes, 'requested'
from public.bookings b
where b.status = 'requested'
  and not exists (select 1 from public.quotes q where q.booking_id = b.id)
on conflict (booking_id) do nothing;
