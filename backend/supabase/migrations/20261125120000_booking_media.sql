-- Booking media metadata for the customer scope/media flow (W3).
-- Files live in the private `booking-media` bucket under `<booking_id>/<media_id>.<ext>`;
-- this table records what the client asked to upload so `complete` can verify the
-- object and `refresh` can re-issue an upload URL without creating a duplicate.

create table public.booking_media (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  client_id text,
  storage_path text not null unique,
  kind text not null check (kind in ('image', 'video')),
  mime_type text,
  bytes bigint check (bytes is null or bytes >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  width integer,
  height integer,
  status text not null default 'pending' check (status in ('pending', 'uploaded')),
  uploaded_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index booking_media_booking_idx on public.booking_media (booking_id, created_at);
create index booking_media_client_idx on public.booking_media (booking_id, client_id);

alter table public.booking_media enable row level security;

create policy "booking media metadata read"
  on public.booking_media for select to authenticated
  using (public.can_view_booking(booking_id));

create policy "booking media metadata insert"
  on public.booking_media for insert to authenticated
  with check (
    public.owns_booking(booking_id)
    or public.is_assigned_technician(booking_id)
    or public.is_desk()
  );

create policy "booking media metadata update"
  on public.booking_media for update to authenticated
  using (public.owns_booking(booking_id) or public.is_desk())
  with check (public.owns_booking(booking_id) or public.is_desk());

create policy "booking media metadata delete"
  on public.booking_media for delete to authenticated
  using (
    public.owns_booking(booking_id)
    or created_by = public.my_profile_id()
    or public.is_desk()
  );

create trigger booking_media_audit
  after insert or update or delete on public.booking_media
  for each row execute function public.audit_row();

-- Receipts are issued by the desk for a booking. `issued_to` is the customer the
-- receipt belongs to, not the staff member issuing it, so the old
-- `issued_to = my_profile_id()` check blocked every desk issue.
drop policy if exists "receipts write desk" on public.receipts;

create policy "receipts write desk"
  on public.receipts for insert to authenticated
  with check (
    public.is_desk()
    and public.can_view_booking(booking_id)
    and (
      issued_to is null
      or exists (
        select 1 from public.bookings b
        where b.id = booking_id and b.customer_id = issued_to
      )
    )
  );
