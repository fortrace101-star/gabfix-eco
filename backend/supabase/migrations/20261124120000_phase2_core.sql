-- Phase 2 domain: quotes, inspections, support conversations, reviews, drafts,
-- cancellation/reactivation requests, security metadata, job costs, laundry and
-- the append-only audit log. Access rules and storage follow in the next
-- migration. D13 is resolved as one conversation per customer, with ticket
-- metadata (reference, subject, category, status) on the conversation.

create type public.quote_status as enum (
  'requested', 'inspection_required', 'inspection_scheduled', 'inspected',
  'quoted', 'accepted', 'declined', 'expired'
);
create type public.inspection_status as enum (
  'required', 'scheduled', 'in_progress', 'submitted', 'withdrawn'
);
create type public.inspection_media_kind as enum ('photo', 'video');
create type public.support_status as enum ('open', 'waiting_on_customer', 'resolved');
create type public.support_category as enum ('booking', 'payment', 'service', 'account', 'other');
create type public.draft_status as enum ('in_progress', 'abandoned', 'followed_up', 'completed');
create type public.request_status as enum ('pending', 'approved', 'declined');
create type public.review_target as enum ('service', 'technician');
create type public.equipment_status as enum ('available', 'in_use', 'maintenance', 'out_of_service');
create type public.laundry_status as enum ('received', 'washing', 'drying', 'ready', 'delivered');
create type public.referral_status as enum ('invited', 'joined', 'completed', 'rewarded', 'expired');
create type public.wallet_network as enum ('MTN', 'Airtel');

-- Quotes and inspections (D6, D9) --------------------------------------------

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  requested_by uuid references public.profiles (id),
  description text,
  quoted_amount numeric(10, 2) check (quoted_amount is null or quoted_amount >= 0),
  prepared_by uuid references public.profiles (id),
  status public.quote_status not null default 'requested',
  inspection_required boolean not null default false,
  quoted_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_status_idx on public.quotes (status, created_at desc);

-- The client routes services by slug; the catalogue table needs the same key.
alter table public.services add column slug text unique;

-- Retry-safe writes through the Hono function.
create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null,
  method text not null,
  path text not null,
  status int not null,
  response jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  required_by uuid references public.profiles (id),
  required_at timestamptz not null default now(),
  required_note text,
  inspector_id uuid references public.profiles (id),
  scheduled_at timestamptz,
  status public.inspection_status not null default 'required',
  started_at timestamptz,
  submitted_at timestamptz,
  checklist jsonb not null default '[]'::jsonb,
  notes text,
  measurements jsonb not null default '{}'::jsonb,
  recommended_hours numeric(5, 2) check (
    recommended_hours is null or recommended_hours > 0
  ),
  recommended_crew smallint check (recommended_crew is null or recommended_crew > 0),
  withdrawn_by uuid references public.profiles (id),
  withdrawn_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inspections_booking_idx on public.inspections (booking_id);
create index inspections_inspector_idx on public.inspections (inspector_id, scheduled_at);
create unique index inspections_one_active_per_quote
  on public.inspections (quote_id)
  where status <> 'withdrawn'::public.inspection_status;

create table public.inspection_media (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  storage_path text not null,
  kind public.inspection_media_kind not null default 'photo',
  caption text,
  taken_at timestamptz,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index inspection_media_inspection_idx on public.inspection_media (inspection_id);

create table public.inspection_addenda (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  author_id uuid references public.profiles (id),
  note text not null check (length(btrim(note)) > 0),
  created_at timestamptz not null default now()
);

create index inspection_addenda_inspection_idx on public.inspection_addenda (inspection_id);

-- Reviews (one row per rating, so a booking can rate the service and each technician)

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.review_target not null,
  service_id uuid references public.services (id) on delete cascade,
  technician_id uuid references public.technician_profiles (user_id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint reviews_one_target check (
    (target_type = 'service' and service_id is not null and technician_id is null)
    or (target_type = 'technician' and technician_id is not null and service_id is null)
  )
);

create unique index reviews_one_service_rating
  on public.reviews (booking_id, customer_id, service_id)
  where target_type = 'service';
create unique index reviews_one_technician_rating
  on public.reviews (booking_id, customer_id, technician_id)
  where target_type = 'technician';
create index reviews_technician_idx on public.reviews (technician_id, created_at desc);
create index reviews_service_idx on public.reviews (service_id, created_at desc);

-- Communication and account security ----------------------------------------

create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique
    default ('GBT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  customer_id uuid not null unique references public.profiles (id) on delete cascade,
  subject text,
  category public.support_category not null default 'other',
  status public.support_status not null default 'open',
  last_message_at timestamptz not null default now(),
  last_read_by_staff_at timestamptz,
  last_read_by_customer_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_conversations_last_message_idx
  on public.support_conversations (last_message_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  body text not null check (length(btrim(body)) > 0),
  booking_id uuid references public.bookings (id) on delete set null,
  laundry_order_id uuid,
  created_at timestamptz not null default now()
);

create index support_messages_conversation_idx
  on public.support_messages (conversation_id, created_at);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  push_enabled boolean not null default true,
  booking_updates boolean not null default true,
  payment_updates boolean not null default true,
  promotions boolean not null default false,
  quiet_hours_enabled boolean not null default true,
  quiet_start time not null default '21:00',
  quiet_end time not null default '07:00',
  updated_at timestamptz not null default now()
);

create table public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_name text,
  platform text check (platform is null or platform in ('ios', 'android', 'web')),
  location text,
  ip inet,
  created_at timestamptz not null default now()
);

create index login_events_user_idx on public.login_events (user_id, created_at desc);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  number text not null unique,
  amount numeric(10, 2) not null check (amount >= 0),
  storage_path text,
  issued_to uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index receipts_booking_idx on public.receipts (booking_id);

create table public.saved_wallet_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  network public.wallet_network not null,
  phone text not null check (phone ~ '^07[0-9]{8}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, network, phone)
);

-- Drafts and requests ---------------------------------------------------------

create table public.booking_drafts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  selected_services jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  last_step text,
  status public.draft_status not null default 'in_progress',
  abandoned_at timestamptz,
  follow_up_reason text,
  followed_up_by uuid references public.profiles (id),
  followed_up_at timestamptz,
  booking_id uuid unique references public.bookings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index booking_drafts_customer_idx on public.booking_drafts (customer_id, updated_at desc);
create index booking_drafts_abandoned_idx
  on public.booking_drafts (status, abandoned_at)
  where status = 'abandoned';

create table public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  reason text not null check (length(btrim(reason)) > 0),
  status public.request_status not null default 'pending',
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);

create unique index cancellation_requests_one_pending
  on public.cancellation_requests (booking_id)
  where status = 'pending';

create table public.reactivation_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  message text,
  status public.request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz
);

create unique index reactivation_requests_one_pending
  on public.reactivation_requests (profile_id)
  where status = 'pending';

-- Job costs and laundry (D24, architecture section 11) -----------------------

create table public.job_costs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  description text not null check (length(btrim(description)) > 0),
  amount numeric(10, 2) not null check (amount >= 0),
  entered_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_costs_booking_idx on public.job_costs (booking_id);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  location text,
  status public.equipment_status not null default 'available',
  last_service_date date,
  created_at timestamptz not null default now()
);

create table public.laundry_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles (id) on delete set null,
  walk_in_name text,
  walk_in_phone text,
  status public.laundry_status not null default 'received',
  created_by uuid references public.profiles (id),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint laundry_orders_customer_or_walk_in check (
    customer_id is not null or walk_in_name is not null or walk_in_phone is not null
  )
);

create index laundry_orders_status_idx on public.laundry_orders (status, created_at);

create table public.machine_logs (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment (id) on delete cascade,
  laundry_order_id uuid references public.laundry_orders (id) on delete set null,
  operator_id uuid references public.profiles (id),
  action text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint machine_logs_time_order check (ended_at is null or ended_at > started_at)
);

-- Referrals (D11 still governs reward rules; the table only records the link) ---

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  code text not null unique,
  invitee_phone text check (invitee_phone is null or invitee_phone ~ '^07[0-9]{8}$'),
  invitee_id uuid references public.profiles (id) on delete set null,
  status public.referral_status not null default 'invited',
  reward_amount numeric(10, 2) not null default 0 check (reward_amount >= 0),
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  rewarded_at timestamptz,
  constraint referrals_not_self check (invitee_id is null or invitee_id <> referrer_id)
);

create index referrals_referrer_idx on public.referrals (referrer_id, created_at desc);

-- Append-only audit -----------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  table_name text not null,
  record_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_table_idx on public.audit_log (table_name, created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_record_id text;
begin
  v_record_id := coalesce(
    case when tg_op <> 'DELETE' then new.id::text else old.id::text end,
    null
  );
  insert into public.audit_log (actor_id, action, table_name, record_id, old_value, new_value)
  values (
    public.my_profile_id(),
    tg_op,
    tg_table_name,
    v_record_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.audit_log_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append only' using errcode = '42501';
end;
$$;

create trigger audit_log_no_update
  before update or delete on public.audit_log
  for each row execute function public.audit_log_append_only();

create trigger bookings_audit
  after insert or update or delete on public.bookings
  for each row execute function public.audit_row();
create trigger payments_audit
  after insert or update or delete on public.payments
  for each row execute function public.audit_row();
create trigger quotes_audit
  after insert or update or delete on public.quotes
  for each row execute function public.audit_row();
create trigger inspections_audit
  after insert or update or delete on public.inspections
  for each row execute function public.audit_row();
create trigger cancellation_requests_audit
  after insert or update or delete on public.cancellation_requests
  for each row execute function public.audit_row();
create trigger job_costs_audit
  after insert or update or delete on public.job_costs
  for each row execute function public.audit_row();
create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row();
create trigger support_conversations_audit
  after insert or update or delete on public.support_conversations
  for each row execute function public.audit_row();
create trigger reviews_audit
  after insert or update or delete on public.reviews
  for each row execute function public.audit_row();

-- Timestamps -----------------------------------------------------------------

create trigger quotes_touch_updated_at
  before update on public.quotes
  for each row execute function public.touch_updated_at();
create trigger inspections_touch_updated_at
  before update on public.inspections
  for each row execute function public.touch_updated_at();
create trigger support_conversations_touch_updated_at
  before update on public.support_conversations
  for each row execute function public.touch_updated_at();
create trigger booking_drafts_touch_updated_at
  before update on public.booking_drafts
  for each row execute function public.touch_updated_at();
create trigger job_costs_touch_updated_at
  before update on public.job_costs
  for each row execute function public.touch_updated_at();
create trigger laundry_orders_touch_updated_at
  before update on public.laundry_orders
  for each row execute function public.touch_updated_at();

-- A support message bumps its conversation, so the staff inbox orders correctly.

create or replace function public.touch_support_conversation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.support_conversations
  set last_message_at = new.created_at,
      status = case
        when public.is_desk() then 'waiting_on_customer'::public.support_status
        else 'open'::public.support_status
      end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger support_messages_touch_conversation
  after insert on public.support_messages
  for each row execute function public.touch_support_conversation();

-- Payments can now belong to a laundry order (architecture section 11).

alter table public.payments alter column booking_id drop not null;
alter table public.payments add column laundry_order_id uuid
  references public.laundry_orders (id) on delete cascade;
alter table public.payments add constraint payments_one_subject check (
  num_nonnulls(booking_id, laundry_order_id) = 1
);

alter table public.support_messages add constraint support_messages_laundry_order_fk
  foreign key (laundry_order_id) references public.laundry_orders (id) on delete set null;
