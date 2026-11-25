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
  ('cleaning', 8), ('electrical', 6), ('plumbing', 6), ('handyman', 8),
  ('pest', 6), ('masonry', 8), ('painting', 8)
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

insert into public.categories (slug, name, description, display_order) values
  ('cleaning', 'Cleaning', 'Homes, offices and handovers', 1),
  ('upholstery', 'Upholstery and carpets', 'Carpets, sofas and chairs', 2),
  ('surface-care', 'Surface care', 'Pavers, roofs, terrazzo and tiles', 3),
  ('pest-control', 'Pest control', 'Inspection, treatment and follow-up', 4),
  ('repairs', 'Repairs and installations', 'Electrical, plumbing and handyman work', 5),
  ('building', 'Building and finishing', 'Painting, tiling and small works', 6),
  ('outdoor', 'Outdoor and landscaping', 'Gardens, paving and outdoor spaces', 7)
on conflict (slug) do nothing;

-- Mirrors client-app/src/config/services.ts so the catalogue cutover does not
-- change what customers see. Hourly price is the per-hour base; quote services
-- carry no price.
insert into public.services (category_id, name, description, slug, pricing_type, price, duration_minutes, required_skill_id, popular_rank, tag)
select c.id, s.name, s.description, s.slug, s.pricing, s.price, s.duration, k.id, s.popular_rank, s.tag
from (values
  ('cleaning', 'Basic cleaning', 'Floors, surfaces, bathrooms and kitchens', 'home-clean', 'hourly'::public.pricing_type, 45000, 120, 'cleaning', 1, 'Popular'),
  ('cleaning', 'Deep cleaning', 'A top-to-bottom reset for your home', 'deep-clean', 'hourly'::public.pricing_type, 45000, 240, 'cleaning', 2, null),
  ('cleaning', 'Post-construction cleaning', 'Dust, debris and paint splatter after a build', 'post-construction-clean', 'quote'::public.pricing_type, 0, 240, 'cleaning', null, null),
  ('upholstery', 'Carpet cleaning', 'Deep extraction for rugs and fitted carpet', 'carpet-clean', 'fixed'::public.pricing_type, 85000, 90, 'cleaning', 4, null),
  ('upholstery', 'Sofa sets cleaning', 'Shampoo and extraction for every seat', 'sofa-clean', 'hourly'::public.pricing_type, 45000, 90, 'cleaning', 3, null),
  ('upholstery', 'Dining chairs cleaning', 'Fabric and frame care for dining sets', 'chair-clean', 'hourly'::public.pricing_type, 45000, 60, 'cleaning', null, null),
  ('surface-care', 'Pavers cleaning', 'Pressure washing for driveways and compounds', 'pavers-clean', 'quote'::public.pricing_type, 0, 120, 'handyman', null, null),
  ('surface-care', 'Roof tile cleaning', 'Moss, dust and stain removal from tiles', 'roof-clean', 'quote'::public.pricing_type, 0, 180, 'handyman', null, null),
  ('surface-care', 'Terrazzo and tile polishing', 'Grinding, sealing and shine restoration', 'terrazzo-polish', 'quote'::public.pricing_type, 0, 180, 'handyman', null, null),
  ('pest-control', 'Fumigation', 'Inspection, treatment and a follow-up visit', 'fumigation', 'quote'::public.pricing_type, 0, 120, 'pest', 5, null),
  ('repairs', 'Electrical works', 'Sockets, lighting, wiring and fault-finding', 'electrical-works', 'quote'::public.pricing_type, 0, 90, 'electrical', null, null),
  ('repairs', 'Plumbing works', 'Leaks, fittings, drains and water heaters', 'plumbing-works', 'quote'::public.pricing_type, 0, 90, 'plumbing', null, null),
  ('repairs', 'Handyman works', 'Mounting, repairs and small installations', 'handyman-works', 'quote'::public.pricing_type, 0, 90, 'handyman', null, null),
  ('building', 'Tiling', 'Floor and wall tiling, grouting and repairs', 'tiling', 'quote'::public.pricing_type, 0, 180, 'masonry', null, null),
  ('building', 'Painting', 'Interior and exterior painting and touch-ups', 'painting', 'quote'::public.pricing_type, 0, 180, 'painting', 6, null),
  ('building', 'Renovation works', 'Room refreshes and small building works', 'renovation', 'quote'::public.pricing_type, 0, 240, 'masonry', null, null),
  ('outdoor', 'Pavers laying', 'New paving for driveways and walkways', 'pavers-laying', 'quote'::public.pricing_type, 0, 240, 'masonry', null, null),
  ('outdoor', 'Landscaping and grass cutting', 'Lawns, hedges and garden upkeep', 'landscaping', 'quote'::public.pricing_type, 0, 120, 'handyman', null, null),
  ('cleaning', 'Office cleaning', 'Desks, meeting rooms and shared kitchens', 'office-clean', 'hourly'::public.pricing_type, 45000, 120, 'cleaning', null, null),
  ('cleaning', 'Move-in / move-out', 'Handover-ready cleaning', 'move-out-clean', 'hourly'::public.pricing_type, 45000, 180, 'cleaning', null, null)
) as s(category, name, description, slug, pricing, price, duration, skill, popular_rank, tag)
join public.categories c on c.slug = s.category
join public.skills k on k.name = s.skill
on conflict (slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  description = excluded.description,
  pricing_type = excluded.pricing_type,
  price = excluded.price,
  duration_minutes = excluded.duration_minutes,
  required_skill_id = excluded.required_skill_id,
  popular_rank = excluded.popular_rank,
  tag = excluded.tag;

update public.services set active = false where slug in ('office-clean', 'move-out-clean');

-- Category form definitions seeded from the client's job-detail schemas.
insert into public.service_form_definitions (category_id, version, schema, is_current)
select c.id, 1, v.schema::jsonb, true
from (values
  ('cleaning', $form_cleaning$
{
  "id": "cleaning",
  "version": 1,
  "heading": "About your home",
  "mediaRequired": false,
  "mediaHint": "Add photos of any area that needs extra attention.",
  "sections": [
    {
      "id": "property",
      "title": "The property",
      "fields": [
        {
          "id": "size",
          "type": "select",
          "label": "How big is the place?",
          "required": true,
          "options": [
            {
              "id": "studio",
              "label": "Studio"
            },
            {
              "id": "1-2",
              "label": "1–2 bedrooms"
            },
            {
              "id": "3-4",
              "label": "3–4 bedrooms"
            },
            {
              "id": "5-plus",
              "label": "5 or more bedrooms"
            }
          ]
        },
        {
          "id": "bedrooms",
          "type": "counter",
          "label": "Bedrooms to clean",
          "required": false,
          "min": 0,
          "max": 20,
          "minutesPerUnit": 25
        },
        {
          "id": "bathrooms",
          "type": "counter",
          "label": "Bathrooms to clean",
          "required": false,
          "min": 0,
          "max": 15,
          "minutesPerUnit": 35
        },
        {
          "id": "condition",
          "type": "select",
          "label": "How does it look right now?",
          "required": true,
          "options": [
            {
              "id": "light",
              "label": "Light",
              "hint": "Regular upkeep"
            },
            {
              "id": "typical",
              "label": "Typical",
              "hint": "Some build-up"
            },
            {
              "id": "heavy",
              "label": "Heavy",
              "hint": "Needs extra attention",
              "minutes": 60
            }
          ]
        },
        {
          "id": "focus",
          "type": "multiselect",
          "label": "Anything to focus on?",
          "required": false,
          "options": [
            {
              "id": "kitchen",
              "label": "Kitchen"
            },
            {
              "id": "bathrooms",
              "label": "Bathrooms"
            },
            {
              "id": "floors",
              "label": "Floors"
            },
            {
              "id": "windows",
              "label": "Windows"
            },
            {
              "id": "balcony",
              "label": "Balcony"
            }
          ]
        },
        {
          "id": "photos",
          "type": "media-slot",
          "label": "Photos",
          "required": false,
          "maxMedia": 5
        }
      ]
    }
  ]
}
$form_cleaning$),
  ('upholstery', $form_upholstery$
{
  "id": "upholstery",
  "version": 1,
  "heading": "What are we cleaning?",
  "mediaRequired": false,
  "mediaHint": "A photo of each item helps us bring the right machine.",
  "sections": [
    {
      "id": "items",
      "title": "Items",
      "fields": [
        {
          "id": "sofas",
          "type": "counter",
          "label": "Sofa seats",
          "required": false,
          "min": 0,
          "max": 12,
          "minutesPerUnit": 20
        },
        {
          "id": "chairs",
          "type": "counter",
          "label": "Dining chairs",
          "required": false,
          "min": 0,
          "max": 30,
          "minutesPerUnit": 8
        },
        {
          "id": "rugs",
          "type": "counter",
          "label": "Rugs or carpeted rooms",
          "required": false,
          "min": 0,
          "max": 15,
          "minutesPerUnit": 30
        },
        {
          "id": "material",
          "type": "select",
          "label": "Material",
          "required": true,
          "options": [
            {
              "id": "fabric",
              "label": "Fabric"
            },
            {
              "id": "leather",
              "label": "Leather"
            },
            {
              "id": "mixed",
              "label": "Mixed"
            },
            {
              "id": "unsure",
              "label": "Not sure"
            }
          ]
        },
        {
          "id": "pet-stains",
          "type": "boolean",
          "label": "Pet stains or odours?",
          "required": false
        },
        {
          "id": "photos",
          "type": "media-slot",
          "label": "Photos",
          "required": false,
          "maxMedia": 5
        }
      ]
    }
  ]
}
$form_upholstery$),
  ('surface-care', $form_surface$
{
  "id": "surface",
  "version": 1,
  "heading": "The surface",
  "mediaRequired": true,
  "mediaHint": "Add a photo of the surface so we can pick the right treatment.",
  "sections": [
    {
      "id": "surface",
      "title": "Surface details",
      "fields": [
        {
          "id": "area",
          "type": "measurement",
          "label": "Approximate area",
          "required": true,
          "min": 1,
          "max": 5000,
          "minutesPerUnit": 2
        },
        {
          "id": "surface-type",
          "type": "select",
          "label": "Surface",
          "required": true,
          "options": [
            {
              "id": "pavers",
              "label": "Pavers"
            },
            {
              "id": "roof-tiles",
              "label": "Roof tiles"
            },
            {
              "id": "terrazzo",
              "label": "Terrazzo"
            },
            {
              "id": "ceramic",
              "label": "Ceramic tiles"
            },
            {
              "id": "other",
              "label": "Other"
            }
          ]
        },
        {
          "id": "condition",
          "type": "select",
          "label": "Condition",
          "required": true,
          "options": [
            {
              "id": "light",
              "label": "Light soiling"
            },
            {
              "id": "stained",
              "label": "Stained"
            },
            {
              "id": "heavy",
              "label": "Heavy build-up",
              "minutes": 90
            }
          ]
        },
        {
          "id": "ladder",
          "type": "boolean",
          "label": "Is a ladder or roof access needed?",
          "required": false
        },
        {
          "id": "surface-photo",
          "type": "media-slot",
          "label": "Photo of the surface",
          "required": true,
          "maxMedia": 4
        }
      ]
    }
  ]
}
$form_surface$),
  ('pest-control', $form_pest$
{
  "id": "pest",
  "version": 1,
  "heading": "The pest problem",
  "mediaRequired": false,
  "mediaHint": "Photos of droppings, nests or damage help the technician prepare.",
  "sections": [
    {
      "id": "pest",
      "title": "What are we treating?",
      "fields": [
        {
          "id": "pest-type",
          "type": "select",
          "label": "Pest",
          "required": true,
          "options": [
            {
              "id": "cockroaches",
              "label": "Cockroaches"
            },
            {
              "id": "rodents",
              "label": "Rodents"
            },
            {
              "id": "termites",
              "label": "Termites"
            },
            {
              "id": "mosquitoes",
              "label": "Mosquitoes"
            },
            {
              "id": "other",
              "label": "Other / not sure"
            }
          ]
        },
        {
          "id": "rooms",
          "type": "counter",
          "label": "Rooms affected",
          "required": true,
          "min": 1,
          "max": 40,
          "minutesPerUnit": 15
        },
        {
          "id": "severity",
          "type": "select",
          "label": "How bad is it?",
          "required": true,
          "options": [
            {
              "id": "few",
              "label": "A few sightings"
            },
            {
              "id": "spreading",
              "label": "Spreading"
            },
            {
              "id": "severe",
              "label": "Severe infestation",
              "flagsQuote": true
            }
          ]
        },
        {
          "id": "urgent",
          "type": "boolean",
          "label": "Do you need us today?",
          "required": false
        },
        {
          "id": "photos",
          "type": "media-slot",
          "label": "Photos",
          "required": false,
          "maxMedia": 5
        }
      ]
    }
  ]
}
$form_pest$),
  ('repairs', $form_repairs$
{
  "id": "repairs",
  "version": 1,
  "heading": "What needs fixing?",
  "mediaRequired": false,
  "mediaHint": "A photo of the fault helps us send the right person with the right parts.",
  "sections": [
    {
      "id": "repair",
      "title": "The job",
      "fields": [
        {
          "id": "work",
          "type": "select",
          "label": "What needs attention?",
          "required": true,
          "options": [
            {
              "id": "electrical",
              "label": "Electrical"
            },
            {
              "id": "plumbing",
              "label": "Plumbing"
            },
            {
              "id": "mounting",
              "label": "Mounting or assembly"
            },
            {
              "id": "general",
              "label": "General repairs"
            }
          ]
        },
        {
          "id": "describe",
          "type": "textarea",
          "label": "Describe the problem",
          "helper": "What happens, and when did it start?",
          "required": true
        },
        {
          "id": "emergency",
          "type": "boolean",
          "label": "Is it an emergency?",
          "required": false
        },
        {
          "id": "fault-photo",
          "type": "media-slot",
          "label": "Photo of the fault",
          "required": false,
          "maxMedia": 4
        }
      ]
    }
  ]
}
$form_repairs$),
  ('building', $form_building$
{
  "id": "building",
  "version": 1,
  "heading": "The building work",
  "mediaRequired": false,
  "mediaHint": "Photos of the space and any existing finish help us estimate.",
  "sections": [
    {
      "id": "work",
      "title": "Scope",
      "fields": [
        {
          "id": "area",
          "type": "measurement",
          "label": "Approximate area",
          "required": true,
          "min": 1,
          "max": 5000,
          "minutesPerUnit": 4
        },
        {
          "id": "stage",
          "type": "select",
          "label": "Stage",
          "required": true,
          "options": [
            {
              "id": "new",
              "label": "New work"
            },
            {
              "id": "repair",
              "label": "Repair"
            },
            {
              "id": "finish",
              "label": "Finishing"
            }
          ]
        },
        {
          "id": "materials",
          "type": "select",
          "label": "Materials supplied by",
          "required": true,
          "options": [
            {
              "id": "gabfix",
              "label": "Gabfix",
              "hint": "Included in the quote"
            },
            {
              "id": "customer",
              "label": "Me"
            },
            {
              "id": "split",
              "label": "Split / discuss"
            }
          ]
        },
        {
          "id": "rooms",
          "type": "counter",
          "label": "Rooms involved",
          "required": false,
          "min": 0,
          "max": 20,
          "minutesPerUnit": 60
        },
        {
          "id": "photos",
          "type": "media-slot",
          "label": "Photos",
          "required": false,
          "maxMedia": 5
        }
      ]
    }
  ]
}
$form_building$),
  ('outdoor', $form_outdoor$
{
  "id": "outdoor",
  "version": 1,
  "heading": "The outdoor space",
  "mediaRequired": false,
  "mediaHint": "Photos of the compound help us judge access and clearing.",
  "sections": [
    {
      "id": "outdoor",
      "title": "Land and access",
      "fields": [
        {
          "id": "land",
          "type": "measurement",
          "label": "Land size",
          "required": true,
          "min": 1,
          "max": 100000,
          "minutesPerUnit": 1
        },
        {
          "id": "terrain",
          "type": "select",
          "label": "Terrain",
          "required": true,
          "options": [
            {
              "id": "flat",
              "label": "Flat"
            },
            {
              "id": "sloped",
              "label": "Sloped"
            },
            {
              "id": "mixed",
              "label": "Mixed"
            }
          ]
        },
        {
          "id": "debris",
          "type": "boolean",
          "label": "Is there debris to remove?",
          "required": false
        },
        {
          "id": "photos",
          "type": "media-slot",
          "label": "Photos",
          "required": false,
          "maxMedia": 5
        }
      ]
    }
  ]
}
$form_outdoor$)
) as v(category_slug, schema)
join public.categories c on c.slug = v.category_slug
where not exists (
  select 1 from public.service_form_definitions d
  where d.category_id = c.id and d.is_current
);


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
