-- Quote lifecycle automation.
--
-- 1. A priced quote carries an `expires_at`, but nothing closed it, so an old
--    offer stayed acceptable forever. `pg_cron` now expires stale quotes every
--    15 minutes.
-- 2. The console writes quotes straight to Postgres (no API call), so the
--    "your quote is ready" event is caught by a trigger: it persists the in-app
--    notification and queues an Expo push to the customer's registered devices.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Push delivery ---------------------------------------------------------------

/**
 * Queues the same message to every device the user has registered. Delivery is
 * best-effort: a missing token or an Expo outage must never fail the transaction
 * that changed the quote. `pg_net` records the request/response for inspection.
 */
create or replace function public.queue_expo_push(
  p_user uuid,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tokens text[];
begin
  if p_user is null then
    return;
  end if;

  select array_agg(t.expo_push_token)
    into tokens
    from public.device_tokens t
   where t.user_id = p_user
     and t.expo_push_token is not null;

  if tokens is null or cardinality(tokens) = 0 then
    return;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := (
      select jsonb_agg(
        jsonb_build_object(
          'to', token,
          'title', p_title,
          'body', p_body,
          'data', p_data,
          'sound', 'default',
          'channelId', 'critical'
        )
      )
      from unnest(tokens) as token
    ),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );
end;
$$;

revoke all on function public.queue_expo_push(uuid, text, text, jsonb) from public;

-- Quote notifications --------------------------------------------------------

create or replace function public.notify_quote_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  customer_id uuid;
  reference text;
  amount_text text;
  title text;
  body text;
begin
  -- Re-sending a quote keeps status `quoted` but refreshes `quoted_at`, so both
  -- a status change and a new price count as "the desk sent you something".
  if new.status = 'quoted' then
    if old.status = 'quoted' and new.quoted_at is not distinct from old.quoted_at then
      return new;
    end if;
  elsif new.status <> 'expired' or old.status = 'expired' then
    return new;
  end if;

  select b.customer_id, b.reference
    into customer_id, reference
    from public.bookings b
   where b.id = new.booking_id;

  customer_id := coalesce(new.requested_by, customer_id);
  if customer_id is null then
    return new;
  end if;

  if new.status = 'quoted' then
    amount_text := case
      when new.quoted_amount is null then 'A new quote'
      else 'UGX ' || to_char(new.quoted_amount, 'FM999,999,999,999')
    end;
    title := 'Your quote is ready';
    body := format(
      '%s for %s%s. Open the app to accept or decline.',
      amount_text,
      coalesce(reference, 'your booking'),
      case
        when new.expires_at is null then ''
        else ' — valid until '
          || to_char(new.expires_at at time zone 'Africa/Kampala', 'DD Mon HH24:MI')
      end
    );
  else
    title := 'Quote expired';
    body := format(
      'The quote for %s expired. Request a new one if you still need the work.',
      coalesce(reference, 'your booking')
    );
  end if;

  insert into public.notifications (user_id, title, body, type)
  values (customer_id, title, body, 'quote');

  perform public.queue_expo_push(
    customer_id,
    title,
    body,
    jsonb_build_object(
      'type', 'quote',
      'quoteId', new.id,
      'bookingId', new.booking_id,
      'reference', reference
    )
  );

  return new;
end;
$$;

drop trigger if exists quotes_notify_customer on public.quotes;
create trigger quotes_notify_customer
  after update on public.quotes
  for each row execute function public.notify_quote_change();

-- Expiry ---------------------------------------------------------------------

/** Marks priced quotes past their response window as expired (the trigger notifies). */
create or replace function public.expire_stale_quotes()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expired_count integer;
begin
  with stale as (
    update public.quotes
       set status = 'expired'
     where status = 'quoted'
       and expires_at is not null
       and expires_at <= now()
    returning 1
  )
  select count(*) into expired_count from stale;

  return coalesce(expired_count, 0);
end;
$$;

revoke all on function public.expire_stale_quotes() from public;

select cron.unschedule(jobid)
  from cron.job
 where jobname = 'expire-stale-quotes';

select cron.schedule(
  'expire-stale-quotes',
  '*/15 * * * *',
  $$select public.expire_stale_quotes();$$
);
