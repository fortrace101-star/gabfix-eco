-- Row level security. Every table created in the core migration gets it here.
-- The client app never uses this directly (it goes through the Hono function);
-- the ERP app and admin-web do, so these policies are the real permission layer.

alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.technician_profiles enable row level security;
alter table public.technician_skills enable row level security;
alter table public.technician_availability enable row level security;
alter table public.technician_overrides enable row level security;
alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.service_form_definitions enable row level security;
alter table public.addresses enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.booking_form_snapshots enable row level security;
alter table public.job_assignments enable row level security;
alter table public.job_photos enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.cash_handovers enable row level security;
alter table public.cash_disputes enable row level security;
alter table public.capabilities enable row level security;
alter table public.role_capabilities enable row level security;
alter table public.staff_invites enable row level security;
alter table public.device_tokens enable row level security;
alter table public.notifications enable row level security;

-- Profiles -------------------------------------------------------------------

create policy "profiles read own or desk"
  on public.profiles for select to authenticated
  using (auth_user_id = auth.uid() or public.is_desk());

create policy "profiles update own"
  on public.profiles for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Catalogue (read for every signed-in user, write by capability) --------------

create policy "skills read" on public.skills for select to authenticated using (true);
create policy "categories read" on public.categories for select to authenticated using (true);
create policy "services read" on public.services for select to authenticated using (true);
create policy "forms read" on public.service_form_definitions for select to authenticated using (true);
create policy "technician profiles read" on public.technician_profiles for select to authenticated using (true);
create policy "technician skills read" on public.technician_skills for select to authenticated using (true);
create policy "technician availability read" on public.technician_availability for select to authenticated using (true);
create policy "technician overrides read" on public.technician_overrides for select to authenticated using (true);

create policy "skills write" on public.skills for all to authenticated
  using (public.has_capability('manage_catalogue'))
  with check (public.has_capability('manage_catalogue'));

create policy "categories write" on public.categories for all to authenticated
  using (public.has_capability('manage_catalogue'))
  with check (public.has_capability('manage_catalogue'));

create policy "services write" on public.services for all to authenticated
  using (public.has_capability('manage_catalogue'))
  with check (public.has_capability('manage_catalogue'));

create policy "forms write" on public.service_form_definitions for all to authenticated
  using (public.has_capability('manage_catalogue'))
  with check (public.has_capability('manage_catalogue'));

create policy "technician profiles write" on public.technician_profiles for all to authenticated
  using (public.has_capability('manage_staff') or user_id = public.my_profile_id())
  with check (public.has_capability('manage_staff') or user_id = public.my_profile_id());

create policy "technician skills write" on public.technician_skills for all to authenticated
  using (public.has_capability('manage_staff'))
  with check (public.has_capability('manage_staff'));

create policy "technician availability write" on public.technician_availability for all to authenticated
  using (public.has_capability('manage_staff') or technician_id = public.my_profile_id())
  with check (public.has_capability('manage_staff') or technician_id = public.my_profile_id());

create policy "technician overrides write" on public.technician_overrides for all to authenticated
  using (public.has_capability('manage_staff') or technician_id = public.my_profile_id())
  with check (public.has_capability('manage_staff') or technician_id = public.my_profile_id());

-- Addresses ------------------------------------------------------------------

create policy "addresses read" on public.addresses for select to authenticated
  using (customer_id = public.my_profile_id() or public.is_desk());

create policy "addresses write" on public.addresses for all to authenticated
  using (customer_id = public.my_profile_id() or public.has_capability('create_bookings'))
  with check (customer_id = public.my_profile_id() or public.has_capability('create_bookings'));

-- Bookings -------------------------------------------------------------------

create policy "bookings read" on public.bookings for select to authenticated
  using (public.can_view_booking(id));

create policy "bookings insert" on public.bookings for insert to authenticated
  with check (
    customer_id = public.my_profile_id()
    or public.has_capability('create_bookings')
  );

-- Confirm, cancel and assign happen through RPCs; direct updates are for the desk.
create policy "bookings update desk" on public.bookings for update to authenticated
  using (public.has_capability('confirm_bookings') or public.has_capability('assign_jobs'))
  with check (public.has_capability('confirm_bookings') or public.has_capability('assign_jobs'));

create policy "booking items read" on public.booking_items for select to authenticated
  using (public.can_view_booking(booking_id));

create policy "booking items write" on public.booking_items for all to authenticated
  using (public.has_capability('create_bookings') or public.is_desk())
  with check (public.has_capability('create_bookings') or public.is_desk());

create policy "form snapshots read" on public.booking_form_snapshots for select to authenticated
  using (public.can_view_booking(booking_id));

create policy "form snapshots write" on public.booking_form_snapshots for all to authenticated
  using (public.has_capability('create_bookings') or public.is_desk())
  with check (public.has_capability('create_bookings') or public.is_desk());

-- Jobs -----------------------------------------------------------------------

create policy "assignments read" on public.job_assignments for select to authenticated
  using (public.can_view_booking(booking_id));

create policy "assignments write" on public.job_assignments for all to authenticated
  using (public.has_capability('assign_jobs'))
  with check (public.has_capability('assign_jobs'));

create policy "job photos read" on public.job_photos for select to authenticated
  using (public.can_view_booking(booking_id));

create policy "job photos insert" on public.job_photos for insert to authenticated
  with check (
    uploaded_by = public.my_profile_id()
    and (public.is_assigned_technician(booking_id) or public.is_desk())
  );

create policy "job photos delete" on public.job_photos for delete to authenticated
  using (uploaded_by = public.my_profile_id() or public.has_capability('manage_staff'));

create policy "status history read" on public.booking_status_history for select to authenticated
  using (public.can_view_booking(booking_id));

-- Money ----------------------------------------------------------------------

create policy "payments read" on public.payments for select to authenticated
  using (public.can_view_booking(booking_id));

create policy "payments insert" on public.payments for insert to authenticated
  with check (
    recorded_by = public.my_profile_id()
    and (public.is_assigned_technician(booking_id) or public.has_capability('record_payments'))
  );

create policy "payments update" on public.payments for update to authenticated
  using (public.has_capability('record_payments'))
  with check (public.has_capability('record_payments'));

create policy "handovers read" on public.cash_handovers for select to authenticated
  using (technician_id = public.my_profile_id() or public.is_desk());

create policy "handovers insert" on public.cash_handovers for insert to authenticated
  with check (technician_id = public.my_profile_id());

create policy "handovers confirm" on public.cash_handovers for update to authenticated
  using (public.has_capability('confirm_cash'))
  with check (public.has_capability('confirm_cash'));

create policy "disputes read" on public.cash_disputes for select to authenticated
  using (technician_id = public.my_profile_id() or public.is_desk());

create policy "disputes write" on public.cash_disputes for all to authenticated
  using (technician_id = public.my_profile_id() or public.is_desk())
  with check (technician_id = public.my_profile_id() or public.is_desk());

-- Access control and communication -------------------------------------------

create policy "capabilities read" on public.capabilities for select to authenticated using (true);
create policy "role capabilities read" on public.role_capabilities for select to authenticated using (true);

create policy "staff invites admin" on public.staff_invites for all to authenticated
  using (public.has_capability('manage_staff'))
  with check (public.has_capability('manage_staff'));

create policy "device tokens own" on public.device_tokens for all to authenticated
  using (user_id = public.my_profile_id())
  with check (user_id = public.my_profile_id());

create policy "notifications read own" on public.notifications for select to authenticated
  using (user_id = public.my_profile_id());

create policy "notifications mark read" on public.notifications for update to authenticated
  using (user_id = public.my_profile_id())
  with check (user_id = public.my_profile_id());
