-- Row level security for the Phase 2 domain. Reads follow the role matrix in
-- Full_App_Architecture_2.md section 9; rule-bearing writes still go through the
-- Hono function or an RPC, so several policies are deliberately read-only.

alter table public.quotes enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_media enable row level security;
alter table public.inspection_addenda enable row level security;
alter table public.reviews enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.login_events enable row level security;
alter table public.receipts enable row level security;
alter table public.saved_wallet_numbers enable row level security;
alter table public.booking_drafts enable row level security;
alter table public.cancellation_requests enable row level security;
alter table public.reactivation_requests enable row level security;
alter table public.job_costs enable row level security;
alter table public.equipment enable row level security;
alter table public.laundry_orders enable row level security;
alter table public.machine_logs enable row level security;
alter table public.referrals enable row level security;
alter table public.audit_log enable row level security;

-- Helpers ---------------------------------------------------------------------

create or replace function public.can_view_conversation(p_conversation uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.support_conversations c
    where c.id = p_conversation
      and (c.customer_id = public.my_profile_id() or public.is_desk())
  );
$$;

create or replace function public.can_view_inspection(p_inspection uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.inspections i
    where i.id = p_inspection
      and (i.inspector_id = public.my_profile_id() or public.is_desk())
  );
$$;

create or replace function public.is_laundry_staff()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.auth_role() in ('laundry_operator', 'manager', 'admin'),
    false
  );
$$;

revoke all on function public.can_view_conversation(uuid) from public;
revoke all on function public.can_view_inspection(uuid) from public;
revoke all on function public.is_laundry_staff() from public;
grant execute on function public.can_view_conversation(uuid) to authenticated;
grant execute on function public.can_view_inspection(uuid) to authenticated;
grant execute on function public.is_laundry_staff() to authenticated;

-- Quotes and inspections ------------------------------------------------------

create policy "quotes read booking" on public.quotes for select to authenticated
  using (public.can_view_booking(booking_id));

create policy "quotes insert customer" on public.quotes for insert to authenticated
  with check (
    requested_by = public.my_profile_id() and public.owns_booking(booking_id)
  );

create policy "quotes manage" on public.quotes for insert to authenticated
  with check (public.auth_role() in ('manager', 'admin'));

create policy "quotes update manager" on public.quotes for update to authenticated
  using (public.auth_role() in ('manager', 'admin'))
  with check (public.auth_role() in ('manager', 'admin'));

create policy "inspections read inspector or desk"
  on public.inspections for select to authenticated
  using (inspector_id = public.my_profile_id() or public.is_desk());

create policy "inspections manage" on public.inspections for all to authenticated
  using (public.auth_role() in ('manager', 'admin'))
  with check (public.auth_role() in ('manager', 'admin'));

create policy "inspections update inspector"
  on public.inspections for update to authenticated
  using (inspector_id = public.my_profile_id())
  with check (inspector_id = public.my_profile_id());

create policy "inspection media read" on public.inspection_media for select to authenticated
  using (public.can_view_inspection(inspection_id));

create policy "inspection media insert" on public.inspection_media for insert to authenticated
  with check (
    uploaded_by = public.my_profile_id()
    and public.can_view_inspection(inspection_id)
  );

create policy "inspection media delete" on public.inspection_media for delete to authenticated
  using (uploaded_by = public.my_profile_id() or public.auth_role() in ('manager', 'admin'));

create policy "inspection addenda read" on public.inspection_addenda for select to authenticated
  using (public.can_view_inspection(inspection_id));

create policy "inspection addenda write" on public.inspection_addenda for insert to authenticated
  with check (public.auth_role() in ('manager', 'admin') and public.can_view_inspection(inspection_id));

-- Reviews ---------------------------------------------------------------------

create policy "reviews read own or staff" on public.reviews for select to authenticated
  using (
    customer_id = public.my_profile_id()
    or technician_id = public.my_profile_id()
    or public.is_desk()
  );

create policy "reviews insert own" on public.reviews for insert to authenticated
  with check (
    customer_id = public.my_profile_id()
    and public.owns_booking(booking_id)
    and exists (
      select 1 from public.booking_items bi
      where bi.booking_id = reviews.booking_id
        and (reviews.service_id is null or bi.service_id = reviews.service_id)
    )
  );

-- Support (D13) ---------------------------------------------------------------

create policy "conversations read own or desk"
  on public.support_conversations for select to authenticated
  using (customer_id = public.my_profile_id() or public.is_desk());

create policy "conversations create own"
  on public.support_conversations for insert to authenticated
  with check (customer_id = public.my_profile_id() or public.is_desk());

create policy "conversations update" on public.support_conversations for update to authenticated
  using (customer_id = public.my_profile_id() or public.is_desk())
  with check (customer_id = public.my_profile_id() or public.is_desk());

create policy "support messages read" on public.support_messages for select to authenticated
  using (public.can_view_conversation(conversation_id));

create policy "support messages insert" on public.support_messages for insert to authenticated
  with check (
    sender_id = public.my_profile_id()
    and public.can_view_conversation(conversation_id)
  );

-- Account security and receipts ----------------------------------------------

create policy "notification preferences own"
  on public.notification_preferences for all to authenticated
  using (user_id = public.my_profile_id())
  with check (user_id = public.my_profile_id());

create policy "login events read own" on public.login_events for select to authenticated
  using (user_id = public.my_profile_id());

create policy "login events insert own" on public.login_events for insert to authenticated
  with check (user_id = public.my_profile_id());

create policy "receipts read booking" on public.receipts for select to authenticated
  using (public.can_view_booking(booking_id));

create policy "receipts write desk" on public.receipts for insert to authenticated
  with check (public.is_desk() and issued_to = public.my_profile_id());

create policy "wallet numbers own" on public.saved_wallet_numbers for all to authenticated
  using (user_id = public.my_profile_id())
  with check (user_id = public.my_profile_id());

-- Drafts and requests ---------------------------------------------------------

create policy "drafts own" on public.booking_drafts for all to authenticated
  using (customer_id = public.my_profile_id())
  with check (customer_id = public.my_profile_id());

create policy "drafts desk read" on public.booking_drafts for select to authenticated
  using (public.is_desk());

create policy "drafts desk follow up" on public.booking_drafts for update to authenticated
  using (public.is_desk())
  with check (public.is_desk());

create policy "cancellation requests read" on public.cancellation_requests for select to authenticated
  using (requested_by = public.my_profile_id() or public.is_desk());

create policy "cancellation requests insert" on public.cancellation_requests for insert to authenticated
  with check (
    requested_by = public.my_profile_id()
    and public.auth_role() in ('customer_relations', 'sales_operator', 'manager', 'admin')
    and public.can_view_booking(booking_id)
  );

create policy "cancellation requests decide" on public.cancellation_requests for update to authenticated
  using (public.auth_role() in ('manager', 'admin'))
  with check (public.auth_role() in ('manager', 'admin'));

create policy "reactivation requests read" on public.reactivation_requests for select to authenticated
  using (public.auth_role() in ('manager', 'admin'));

create policy "reactivation requests decide" on public.reactivation_requests for update to authenticated
  using (public.auth_role() in ('manager', 'admin'))
  with check (public.auth_role() in ('manager', 'admin'));

-- Operations ------------------------------------------------------------------

create policy "job costs admin" on public.job_costs for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create policy "equipment read laundry or desk" on public.equipment for select to authenticated
  using (public.is_laundry_staff() or public.is_desk());

create policy "equipment write laundry" on public.equipment for all to authenticated
  using (public.is_laundry_staff())
  with check (public.is_laundry_staff());

create policy "laundry orders read" on public.laundry_orders for select to authenticated
  using (
    customer_id = public.my_profile_id()
    or public.is_laundry_staff()
    or public.is_desk()
  );

create policy "laundry orders write staff" on public.laundry_orders for all to authenticated
  using (public.is_laundry_staff())
  with check (public.is_laundry_staff());

create policy "machine logs read" on public.machine_logs for select to authenticated
  using (public.is_laundry_staff() or public.is_desk());

create policy "machine logs write" on public.machine_logs for all to authenticated
  using (public.is_laundry_staff())
  with check (public.is_laundry_staff());

create policy "referrals read own or desk" on public.referrals for select to authenticated
  using (referrer_id = public.my_profile_id() or public.is_desk());

create policy "referrals create own" on public.referrals for insert to authenticated
  with check (referrer_id = public.my_profile_id());

create policy "referrals manage desk" on public.referrals for update to authenticated
  using (public.is_desk())
  with check (public.is_desk());

create policy "audit log admin read" on public.audit_log for select to authenticated
  using (public.auth_role() = 'admin');

-- Laundry payments: a customer sees their own, laundry staff and desk see all.

create policy "payments read laundry"
  on public.payments for select to authenticated
  using (
    laundry_order_id is not null
    and (
      exists (
        select 1 from public.laundry_orders lo
        where lo.id = payments.laundry_order_id
          and lo.customer_id = public.my_profile_id()
      )
      or public.is_laundry_staff()
      or public.is_desk()
    )
  );

create policy "payments insert laundry"
  on public.payments for insert to authenticated
  with check (
    laundry_order_id is not null
    and recorded_by = public.my_profile_id()
    and public.is_laundry_staff()
  );
