-- The cleaner's job steps (On the way, Start, Complete) now reach the customer:
-- a push with the same status the tracking screen reads, plus an in-app row.

create or replace function public.notify_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_title text;
  v_body text;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.status not in ('confirmed', 'scheduled', 'on_the_way', 'in_progress', 'completed', 'cancelled') then
    return new;
  end if;

  v_title := case new.status
    when 'confirmed' then 'Booking confirmed'
    when 'scheduled' then 'Booking scheduled'
    when 'on_the_way' then 'Your cleaner is on the way'
    when 'in_progress' then 'Your clean has started'
    when 'completed' then 'Your clean is complete'
    else 'Booking cancelled'
  end;

  v_body := format(
    '%s · %s',
    coalesce(new.reference, 'Your Gabfix booking'),
    case new.status
      when 'on_the_way' then 'Track the journey from your booking.'
      when 'in_progress' then 'The team has started the job.'
      when 'completed' then 'Rate your cleaner from the booking.'
      when 'cancelled' then 'Tap to see the details.'
      when 'confirmed' then 'Your slot is locked in.'
      else 'Your booking has been updated.'
    end
  );

  insert into public.notifications (user_id, title, body, type)
  values (new.customer_id, v_title, v_body, 'booking');

  perform public.queue_expo_push(
    new.customer_id,
    v_title,
    v_body,
    jsonb_build_object(
      'type', 'booking',
      'bookingId', new.id,
      'reference', new.reference,
      'status', new.status
    )
  );

  return new;
end;
$$;

revoke all on function public.notify_booking_status_change() from public;

drop trigger if exists bookings_status_notify on public.bookings;
create trigger bookings_status_notify
  after update of status on public.bookings
  for each row execute function public.notify_booking_status_change();
