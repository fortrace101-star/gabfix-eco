-- Local development seed only. Never include this file when pushing to a remote
-- project (supabase-guidelines.md rule 1). Password for every seeded user: gabfix2026.

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('11111111-1111-4111-8111-111111111111', 'admin@gabfix.ug',    'Manuel Admin',    'admin'),
      ('11111111-1111-4111-8111-222222222222', 'manager@gabfix.ug',  'Sarah Manager',   'manager'),
      ('11111111-1111-4111-8111-333333333333', 'desk@gabfix.ug',     'Ruth Desk',       'customer_relations'),
      ('11111111-1111-4111-8111-444444444444', 'sales@gabfix.ug',    'Peter Sales',     'sales_operator'),
      ('11111111-1111-4111-8111-555555555555', 'laundry@gabfix.ug',  'Grace Laundry',   'laundry_operator'),
      ('11111111-1111-4111-8111-666666666666', 'tech1@gabfix.ug',    'Daniel Cleaner',  'technician'),
      ('11111111-1111-4111-8111-777777777777', 'tech2@gabfix.ug',    'Moses Electric',  'technician'),
      ('11111111-1111-4111-8111-888888888888', 'customer@gabfix.ug', 'Alice Customer',  'customer')
    ) as t(uid, email, full_name, role)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', r.uid::uuid, 'authenticated', 'authenticated',
      r.email, crypt('gabfix2026', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', r.full_name),
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), r.uid::uuid, r.uid::text,
      jsonb_build_object('sub', r.uid::text, 'email', r.email),
      'email', now(), now(), now()
    );

    update public.profiles set role = r.role::public.app_role where auth_user_id = r.uid::uuid;
  end loop;
end;
$$;

update public.profiles set phone = '0700000001' where auth_user_id = '11111111-1111-4111-8111-111111111111';
update public.profiles set phone = '0700000002' where auth_user_id = '11111111-1111-4111-8111-222222222222';
update public.profiles set phone = '0700000003' where auth_user_id = '11111111-1111-4111-8111-333333333333';
update public.profiles set phone = '0700000004' where auth_user_id = '11111111-1111-4111-8111-444444444444';
update public.profiles set phone = '0700000005' where auth_user_id = '11111111-1111-4111-8111-555555555555';
update public.profiles set phone = '0700000006' where auth_user_id = '11111111-1111-4111-8111-666666666666';
update public.profiles set phone = '0700000007' where auth_user_id = '11111111-1111-4111-8111-777777777777';
update public.profiles set phone = '0700000008' where auth_user_id = '11111111-1111-4111-8111-888888888888';

-- Offline customer (no auth user), as staff-created bookings allow.
insert into public.profiles (id, full_name, phone, role)
values ('22222222-2222-4222-8222-222222222222', 'Winnie Walk-in', '0772000111', 'customer')
on conflict (id) do nothing;

-- Skills and technicians -----------------------------------------------------

insert into public.skills (name, max_daily_hours) values
  ('cleaning', 8), ('electrical', 6), ('plumbing', 6), ('handyman', 8)
on conflict (name) do nothing;

insert into public.technician_profiles (user_id, display_name, priority_rating)
select id, full_name, case when full_name like 'Daniel%' then 5 else 4 end
from public.profiles where role = 'technician';

insert into public.technician_skills (technician_id, skill_id)
select p.id, s.id
from public.profiles p, public.skills s
where p.auth_user_id = '11111111-1111-4111-8111-666666666666'
  and s.name in ('cleaning', 'handyman');

insert into public.technician_skills (technician_id, skill_id)
select p.id, s.id
from public.profiles p, public.skills s
where p.auth_user_id = '11111111-1111-4111-8111-777777777777'
  and s.name in ('electrical', 'plumbing');

insert into public.technician_availability (technician_id, weekday, start_time, end_time)
select p.id, d, '08:00', '18:00'
from public.profiles p
cross join generate_series(1, 6) as d
where p.role = 'technician';

-- Catalogue ------------------------------------------------------------------

insert into public.categories (name, description, display_order) values
  ('Cleaning', 'Home and office cleaning', 1),
  ('Upholstery and carpets', 'Sofas, mattresses and rugs', 2),
  ('Surface care', 'Tiles, floors and hard surfaces', 3),
  ('Pest control', 'Fumigation and pest removal', 4),
  ('Repairs and installations', 'Electrical, plumbing and fittings', 5),
  ('Building and finishing', 'Painting and small works', 6),
  ('Outdoor and landscaping', 'Gardens and outdoor spaces', 7)
on conflict do nothing;

insert into public.services (category_id, name, description, pricing_type, price, duration_minutes, required_skill_id)
select c.id, s.name, s.description, s.pricing, s.price, s.duration, k.id
from (values
  ('Cleaning', 'Standard home clean', 'Routine clean of living areas and bathrooms', 'hourly'::public.pricing_type, 45000, 120, 'cleaning'),
  ('Cleaning', 'Deep clean', 'Top-to-bottom deep clean', 'fixed'::public.pricing_type, 180000, 240, 'cleaning'),
  ('Upholstery and carpets', 'Sofa deep clean', 'Shampoo and extract one three-seater', 'fixed'::public.pricing_type, 80000, 90, 'cleaning'),
  ('Upholstery and carpets', 'Mattress clean', 'Steam and sanitise one mattress', 'fixed'::public.pricing_type, 60000, 60, 'cleaning'),
  ('Repairs and installations', 'Electrical fault finding', 'Trace and quote a electrical fault', 'hourly'::public.pricing_type, 60000, 60, 'electrical'),
  ('Repairs and installations', 'Leak repair', 'Find and fix a water leak', 'quote'::public.pricing_type, 0, 60, 'plumbing'),
  ('Outdoor and landscaping', 'Lawn mowing', 'Cut and edge a standard plot', 'fixed'::public.pricing_type, 50000, 60, 'handyman')
) as s(category, name, description, pricing, price, duration, skill)
join public.categories c on c.name = s.category
join public.skills k on k.name = s.skill
where not exists (select 1 from public.services x where x.name = s.name);

-- Demo jobs ------------------------------------------------------------------

insert into public.addresses (id, customer_id, label, line1, area, is_default)
values (
  '33333333-3333-4333-8333-333333333333',
  (select id from public.profiles where auth_user_id = '11111111-1111-4111-8111-888888888888'),
  'Home', 'Plot 14, Acacia Avenue', 'Ntinda', true
) on conflict (id) do nothing;

insert into public.bookings (
  id, reference, source, created_by, customer_id, address_id, status,
  technicians_needed, scheduled_start, scheduled_end, total_price, notes
) values
  (
    'aaaaaaaa-0000-4000-8000-000000000001', 'GBX-DUE1', 'app', null,
    (select id from public.profiles where auth_user_id = '11111111-1111-4111-8111-888888888888'),
    '33333333-3333-4333-8333-333333333333', 'scheduled', 1,
    date_trunc('day', now()) + interval '9 hours',
    date_trunc('day', now()) + interval '11 hours',
    90000, 'Gate code 4471. Dog in the yard.'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000002', 'GBX-LEAD', 'staff',
    (select id from public.profiles where auth_user_id = '11111111-1111-4111-8111-333333333333'),
    (select id from public.profiles where auth_user_id = '11111111-1111-4111-8111-888888888888'),
    '33333333-3333-4333-8333-333333333333', 'confirmed', 2,
    date_trunc('day', now()) + interval '14 hours',
    date_trunc('day', now()) + interval '16 hours',
    120000, 'Two cleaners, sofa and mattress.'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000003', 'GBX-DONE', 'app', null,
    (select id from public.profiles where auth_user_id = '11111111-1111-4111-8111-888888888888'),
    '33333333-3333-4333-8333-333333333333', 'completed', 1,
    date_trunc('day', now()) - interval '1 day' + interval '10 hours',
    date_trunc('day', now()) - interval '1 day' + interval '11 hours 30 minutes',
    45000, null
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000004', 'GBX-WAIT', 'staff',
    (select id from public.profiles where auth_user_id = '11111111-1111-4111-8111-333333333333'),
    '22222222-2222-4222-8222-222222222222',
    null, 'awaiting_confirmation', 1,
    date_trunc('day', now()) + interval '2 days 9 hours',
    date_trunc('day', now()) + interval '2 days 11 hours',
    180000, 'Walk-in customer, phone confirmation pending.'
  )
on conflict (id) do nothing;

update public.bookings b
set customer_name = p.full_name, customer_phone = p.phone
from public.profiles p
where p.id = b.customer_id and b.customer_name is null;

insert into public.booking_items (booking_id, service_id, quantity, price)
select b.id, s.id, 1, s.price
from public.bookings b
join public.services s on s.name = case
  when b.reference = 'GBX-DUE1' then 'Standard home clean'
  when b.reference = 'GBX-LEAD' then 'Sofa deep clean'
  when b.reference = 'GBX-DONE' then 'Standard home clean'
  else 'Deep clean'
end
where not exists (select 1 from public.booking_items i where i.booking_id = b.id);

update public.bookings set billed_hours = 1.5 where reference = 'GBX-DONE';

insert into public.job_assignments (
  booking_id, technician_id, crew_role, assigned_by, status, starts_at, ends_at, started_at, completed_at
)
select b.id, t.id, a.crew, m.id, a.state, b.scheduled_start, b.scheduled_end, a.started, a.completed
from (values
  ('GBX-DUE1', '11111111-1111-4111-8111-666666666666', 'lead'::public.crew_role, 'assigned'::public.assignment_status, null::timestamptz, null::timestamptz),
  ('GBX-LEAD', '11111111-1111-4111-8111-666666666666', 'lead'::public.crew_role, 'assigned'::public.assignment_status, null::timestamptz, null::timestamptz),
  ('GBX-DONE', '11111111-1111-4111-8111-666666666666', 'lead'::public.crew_role, 'done'::public.assignment_status,
    date_trunc('day', now()) - interval '1 day' + interval '10 hours',
    date_trunc('day', now()) - interval '1 day' + interval '11 hours 30 minutes')
) as a(reference, technician_uid, crew, state, started, completed)
join public.bookings b on b.reference = a.reference
join public.profiles t on t.auth_user_id = a.technician_uid::uuid
left join public.profiles m on m.auth_user_id = '11111111-1111-4111-8111-222222222222'
where not exists (
  select 1 from public.job_assignments ja where ja.booking_id = b.id and ja.technician_id = t.id
);

insert into public.payments (booking_id, amount, method, status, recorded_by, paid_at)
select b.id, 45000, 'cash', 'paid',
  (select id from public.profiles where auth_user_id = '11111111-1111-4111-8111-666666666666'),
  b.scheduled_end
from public.bookings b
where b.reference = 'GBX-DONE'
  and not exists (select 1 from public.payments p where p.booking_id = b.id);
