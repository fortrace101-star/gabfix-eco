-- C2 — permanent customer account deletion (D14).
--
-- Deactivation stays reversible; this is the separate, irreversible customer-only path.
-- A customer confirms with their password (checked in the API against Supabase Auth), the
-- API then calls `finalise_customer_deletion()` with the service role, and finally removes
-- the Auth user so every session ends and the account cannot sign in again.
--
-- Kept: bookings, payments, cash, commission, quotes, inspections, job costs, referrals and
-- the audit trail (financial history). The profile row itself survives, blanked, so those
-- records keep a valid foreign key and render as "Deleted customer".

create table public.account_deletions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id),
  -- HMAC of the phone number: a keyed one-way code that blocks a repeat welcome or
  -- referral claim without retaining the number itself.
  phone_code text not null,
  reason text,
  bookings_kept integer not null default 0,
  deleted_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index account_deletions_code_idx on public.account_deletions (phone_code);
create index account_deletions_profile_idx on public.account_deletions (profile_id);

alter table public.account_deletions enable row level security;

-- Written only by `finalise_customer_deletion()`; the desk may read it when a customer
-- asks why a number is not eligible for a welcome offer again.
create policy "account deletions desk read"
  on public.account_deletions for select to authenticated
  using (public.is_desk());

-- Blockers -------------------------------------------------------------------

create or replace function public.account_deletion_blockers(p_profile uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_upcoming integer;
  v_balance numeric;
  v_disputes integer;
begin
  select count(*) into v_upcoming
  from public.bookings b
  where b.customer_id = p_profile
    and b.status not in ('completed', 'cancelled');

  select coalesce(sum(greatest(b.total_price - coalesce(p.paid, 0), 0)), 0) into v_balance
  from public.bookings b
  left join (
    select booking_id, sum(amount) as paid
    from public.payments
    where status = 'paid'
    group by booking_id
  ) p on p.booking_id = b.id
  where b.customer_id = p_profile
    and b.status not in ('cancelled', 'requested');

  select count(*) into v_disputes
  from public.cash_disputes d
  join public.payments p on p.id = d.payment_id
  join public.bookings b on b.id = p.booking_id
  where b.customer_id = p_profile
    and d.status = 'open';

  return jsonb_build_object(
    'upcomingBookings', v_upcoming,
    'outstandingBalance', v_balance,
    'openDisputes', v_disputes,
    'canDelete', v_upcoming = 0 and v_balance = 0 and v_disputes = 0
  );
end;
$$;

revoke all on function public.account_deletion_blockers(uuid) from public;

-- What the client screen shows before asking for a password.
create or replace function public.account_deletion_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile uuid := public.my_profile_id();
begin
  if v_profile is null then
    raise exception 'Sign in to continue' using errcode = '42501';
  end if;
  if public.auth_role() is distinct from 'customer' then
    raise exception 'Only customer accounts can be permanently deleted' using errcode = '42501';
  end if;

  return public.account_deletion_blockers(v_profile);
end;
$$;

revoke all on function public.account_deletion_status() from public;
grant execute on function public.account_deletion_status() to authenticated;

-- The irreversible step -------------------------------------------------------

create or replace function public.finalise_customer_deletion(
  p_profile uuid,
  p_phone_code text,
  p_reason text default null,
  p_deleted_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_blockers jsonb;
  v_bookings integer;
  v_role public.app_role;
begin
  if not (
    coalesce(auth.role(), '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'Account deletion is finalised by the API only' using errcode = '42501';
  end if;

  select role into v_role from public.profiles where id = p_profile;
  if v_role is null then
    raise exception 'No customer profile to delete' using errcode = 'P0002';
  end if;
  if v_role <> 'customer' then
    raise exception 'Staff accounts are deactivated, never deleted' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_phone_code, '')), '') is null then
    raise exception 'A phone code is required' using errcode = '22023';
  end if;

  -- Re-check inside the transaction: a booking may have been made after the screen
  -- loaded.
  v_blockers := public.account_deletion_blockers(p_profile);
  if not coalesce((v_blockers->>'canDelete')::boolean, false) then
    raise exception 'This account still has work to settle' using errcode = 'P0001';
  end if;

  select count(*) into v_bookings from public.bookings where customer_id = p_profile;

  insert into public.account_deletions (profile_id, phone_code, reason, bookings_kept, deleted_by)
  values (p_profile, p_phone_code, nullif(btrim(coalesce(p_reason, '')), ''), v_bookings, p_deleted_by);

  -- Blank personal identity. `auth_user_id` is nulled so the Auth user (and every
  -- session) can be removed without cascading into the retained bookings.
  update public.profiles
  set full_name = 'Deleted customer',
      phone = null,
      auth_user_id = null,
      status = 'deactivated',
      deactivated_at = now(),
      deactivated_by = p_deleted_by
  where id = p_profile;

  delete from public.addresses where customer_id = p_profile;
  delete from public.booking_drafts where customer_id = p_profile;
  delete from public.notification_preferences where user_id = p_profile;
  delete from public.device_tokens where user_id = p_profile;
  delete from public.notifications where user_id = p_profile;

  -- Chat and ticket text authored by the customer; the other side's replies and the
  -- thread itself stay for support history.
  update public.support_messages
  set body = '[Removed with the deleted account]'
  where sender_id = p_profile;
  update public.support_conversations
  set subject = null
  where customer_id = p_profile;
  update public.booking_messages
  set body = '[Removed with the deleted account]'
  where sender_id = p_profile;

  -- The rating stays for the technician's and service's record; the customer's words go.
  update public.reviews set comment = null where customer_id = p_profile;

  -- Name/phone snapshotted onto old bookings are personal data too.
  update public.bookings
  set customer_name = 'Deleted customer', customer_phone = null
  where customer_id = p_profile;

  update public.referrals
  set invitee_phone = null
  where invitee_id = p_profile;

  return jsonb_build_object(
    'bookingsKept', v_bookings,
    'profileId', p_profile
  );
end;
$$;

revoke all on function public.finalise_customer_deletion(uuid, text, text, uuid) from public;
grant execute on function public.finalise_customer_deletion(uuid, text, text, uuid) to service_role;
