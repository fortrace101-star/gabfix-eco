-- Phone OTP codes for the client's passwordless sign-in (/auth/otp/request and
-- /auth/otp/verify). Supabase Auth still owns the session; this table only holds
-- the short-lived numeric code until an SMS provider is connected (D12).
--
-- The code is stored as a SHA-256 hash (peppered with OTP_PEPPER or the service
-- role key) so a database read cannot reveal a live code. There are no RLS
-- policies: only the service role in the edge function touches this table.

create table public.phone_otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^07[0-9]{8}$'),
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index phone_otp_codes_lookup_idx
  on public.phone_otp_codes (phone, created_at desc);

comment on table public.phone_otp_codes is
  'Short-lived phone login codes for the client app; service role only.';

alter table public.phone_otp_codes enable row level security;

revoke all on public.phone_otp_codes from anon, authenticated;
