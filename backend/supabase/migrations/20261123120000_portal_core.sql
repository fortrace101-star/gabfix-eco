-- Portal core structure: profiles, catalogue, bookings, jobs, cash, notifications.
-- Access rules (RLS), RPCs and storage live in the next migration.
-- First sketch from Full_App_Architecture_2.md sections 10 and 11.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.app_role as enum (
  'customer', 'technician', 'laundry_operator', 'sales_operator',
  'customer_relations', 'manager', 'admin'
);
create type public.profile_status as enum ('active', 'deactivated');
create type public.booking_source as enum ('app', 'staff', 'sales');
create type public.booking_status as enum (
  'requested', 'awaiting_confirmation', 'confirmed', 'scheduled',
  'on_the_way', 'in_progress', 'completed', 'cancelled'
);
create type public.pricing_type as enum ('fixed', 'hourly', 'quote');
create type public.crew_role as enum ('lead', 'helper');
create type public.assignment_status as enum (
  'assigned', 'accepted', 'declined', 'in_progress', 'done', 'removed'
);
create type public.photo_kind as enum ('before', 'after');
create type public.payment_method as enum ('app', 'cash');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.cash_dispute_status as enum ('open', 'resolved');

-- Identity -------------------------------------------------------------------

-- `id` is the profile id used everywhere in the schema; `auth_user_id` links to
-- Supabase Auth and is null for offline customers (walk-ins, staff-created bookings).
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  full_name text not null,
  phone text unique,
  role public.app_role not null default 'customer',
  status public.profile_status not null default 'active',
  deactivated_at timestamptz,
  deactivated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint profiles_phone_format check (phone is null or phone ~ '^07[0-9]{8}$')
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  max_daily_hours numeric(4, 2) not null default 8 check (max_daily_hours > 0)
);

create table public.technician_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  display_name text not null,
  photo_path text,
  priority_rating int not null default 3 check (priority_rating between 1 and 5),
  active boolean not null default true
);

create table public.technician_skills (
  technician_id uuid not null references public.technician_profiles (user_id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  primary key (technician_id, skill_id)
);

create table public.technician_availability (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technician_profiles (user_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  constraint technician_availability_time_order check (end_time > start_time)
);

create table public.technician_overrides (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technician_profiles (user_id) on delete cascade,
  date date not null,
  is_off boolean not null default true,
  start_time time,
  end_time time,
  unique (technician_id, date)
);

-- Catalogue -----------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete set null,
  name text not null,
  description text,
  image_path text,
  display_order int not null default 0,
  active boolean not null default true
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  name text not null,
  description text,
  image_path text,
  pricing_type public.pricing_type not null default 'fixed',
  price numeric(10, 2) not null default 0 check (price >= 0),
  duration_minutes int not null default 60 check (duration_minutes > 0),
  required_skill_id uuid references public.skills (id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.service_form_definitions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  version int not null default 1,
  schema jsonb not null,
  is_current boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint service_form_owner check (num_nonnulls(service_id, category_id) = 1)
);

create unique index service_form_current_service
  on public.service_form_definitions (service_id)
  where is_current and service_id is not null;
create unique index service_form_current_category
  on public.service_form_definitions (category_id)
  where is_current and category_id is not null;

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home',
  line1 text not null,
  line2 text,
  area text,
  latitude double precision,
  longitude double precision,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- Bookings and jobs ----------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('GBX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  source public.booking_source not null default 'app',
  created_by uuid references public.profiles (id),
  customer_id uuid not null references public.profiles (id),
  address_id uuid references public.addresses (id),
  status public.booking_status not null default 'requested',
  technicians_needed int not null default 1 check (technicians_needed > 0),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  billed_hours numeric(5, 2),
  total_price numeric(10, 2) not null default 0 check (total_price >= 0),
  notes text,
  cancel_reason text,
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_order check (scheduled_end > scheduled_start)
);

create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_status_start_idx on public.bookings (status, scheduled_start);

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  service_id uuid not null references public.services (id),
  quantity int not null default 1 check (quantity > 0),
  price numeric(10, 2) not null default 0 check (price >= 0)
);

create index booking_items_booking_idx on public.booking_items (booking_id);

create table public.booking_form_snapshots (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  form_definition_id uuid references public.service_form_definitions (id),
  form_version int not null default 1,
  questions jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  technician_id uuid not null references public.technician_profiles (user_id),
  crew_role public.crew_role not null default 'helper',
  assigned_by uuid references public.profiles (id),
  status public.assignment_status not null default 'assigned',
  starts_at timestamptz,
  ends_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (booking_id, technician_id),
  constraint job_assignments_time_order check (
    starts_at is null or ends_at is null or ends_at > starts_at
  ),
  constraint job_assignments_no_overlap exclude using gist (
    technician_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status <> 'removed'::public.assignment_status)
);

create unique index job_assignments_one_lead
  on public.job_assignments (booking_id)
  where crew_role = 'lead' and status <> 'removed';

create index job_assignments_technician_idx
  on public.job_assignments (technician_id, starts_at);

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  uploaded_by uuid references public.profiles (id),
  storage_path text not null,
  kind public.photo_kind not null default 'after',
  created_at timestamptz not null default now()
);

create index job_photos_booking_idx on public.job_photos (booking_id);

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  changed_by uuid references public.profiles (id),
  note text,
  changed_at timestamptz not null default now()
);

create index booking_status_history_booking_idx
  on public.booking_status_history (booking_id, changed_at);

-- Money ----------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  method public.payment_method not null,
  status public.payment_status not null default 'paid',
  provider text,
  provider_reference text,
  recorded_by uuid references public.profiles (id),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_booking_idx on public.payments (booking_id);

create table public.cash_handovers (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technician_profiles (user_id),
  amount numeric(10, 2) not null check (amount > 0),
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table public.cash_disputes (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id),
  technician_id uuid not null references public.technician_profiles (user_id),
  expected_amount numeric(10, 2) not null,
  received_amount numeric(10, 2) not null,
  technician_note text,
  status public.cash_dispute_status not null default 'open',
  resolved_by uuid references public.profiles (id),
  resolution_reason text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- Access control and communication ------------------------------------------

create table public.capabilities (
  key text primary key,
  description text not null
);

create table public.role_capabilities (
  role public.app_role not null,
  capability text not null references public.capabilities (key) on delete cascade,
  primary key (role, capability)
);

create table public.staff_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  role public.app_role not null,
  created_by uuid references public.profiles (id),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'general',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Identity triggers ----------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (auth_user_id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data ->> 'phone' ~ '^07[0-9]{8}$'
      then new.raw_user_meta_data ->> 'phone'
      else null
    end
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A non-admin must not be able to change their own role or status.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not exists (
       select 1
       from public.profiles p
       join public.role_capabilities rc on rc.role = p.role
       where p.auth_user_id = auth.uid()
         and p.status = 'active'
         and p.role = 'admin'
     ) then
    raise exception 'role and status can only be changed by an admin'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger bookings_touch_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();
