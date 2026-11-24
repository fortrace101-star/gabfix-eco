// Gabfix API — the single Hono entry point for the client app (D1).
//
// Deploy: supabase functions deploy api
// Local:  supabase functions serve api --env-file supabase/.env.local
// Base URL: <project>/functions/v1/api
//
// RLS is the permission layer. Reads use the caller's JWT; the few writes that
// span tables (booking + items + snapshot) use the service role and re-check
// ownership before writing.

import { Hono, type Context } from 'npm:hono@4';
import { HTTPException } from 'npm:hono@4/http-exception';
import { cors } from 'npm:hono@4/cors';
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('[api] SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required');
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
};

type Session = {
  db: SupabaseClient;
  profile: Profile;
  userId: string;
};

// The edge runtime forwards the function name as a path prefix, so the app sees
// "/api/health" while the public URL is "/functions/v1/api/health".
const app = new Hono().basePath('/api');

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'apikey', 'x-client-info'],
}));

function fail(c: Context, status: number, code: string, message: string) {
  return c.json({ error: { code, message } }, status as 400);
}

async function session(c: Context): Promise<Session> {
  const header = c.req.header('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HTTPException(401, { message: 'Sign in to continue.', cause: 'unauthorized' });

  const db = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new HTTPException(401, { message: 'Your session has expired.', cause: 'unauthorized' });

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id, full_name, phone, role, status')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  if (profileError) throw new HTTPException(500, { message: profileError.message, cause: 'profile_read' });
  if (!profile) throw new HTTPException(403, { message: 'No Gabfix profile is linked to this account.', cause: 'no_profile' });
  if (profile.status !== 'active') throw new HTTPException(403, { message: 'This account is deactivated.', cause: 'deactivated' });

  return { db, profile: profile as Profile, userId: data.user.id };
}

const money = (value: unknown) => Number(value ?? 0);

app.get('/health', (c) => c.json({ ok: true, service: 'gabfix-api' }));

app.get('/me', async (c) => {
  const { profile } = await session(c);
  return c.json({ profile });
});

const cataloguePayload = async () => {
  const db = admin;
  const [categories, services, forms] = await Promise.all([
    db
      .from('categories')
      .select('id, slug, parent_id, name, description, image_path, display_order, active')
      .eq('active', true)
      .order('display_order'),
    db
      .from('services')
      .select('id, category_id, name, description, slug, image_path, pricing_type, price, duration_minutes, popular_rank, tag, active')
      .eq('active', true)
      .order('name'),
    db
      .from('service_form_definitions')
      .select('id, service_id, category_id, version, schema, is_current')
      .eq('is_current', true),
  ]);
  const error = categories.error ?? services.error ?? forms.error;
  if (error) throw new HTTPException(500, { message: error.message, cause: 'catalogue_read' });

  const categoryByUuid = new Map((categories.data ?? []).map((row) => [row.id, row]));

  return {
    categories: (categories.data ?? []).map((row) => ({
      id: row.slug,
      uuid: row.id,
      name: row.name,
      caption: row.description ?? '',
      description: row.description,
      order: row.display_order,
      displayOrder: row.display_order,
      parentId: row.parent_id ? (categoryByUuid.get(row.parent_id)?.slug ?? row.parent_id) : undefined,
      imagePath: row.image_path,
      active: row.active,
    })),
    services: (services.data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.description ?? '',
      description: row.description,
      categoryId: categoryByUuid.get(row.category_id)?.slug ?? row.category_id,
      categoryUuid: row.category_id,
      pricingMode: row.pricing_type,
      pricingType: row.pricing_type,
      fixedPrice: row.pricing_type === 'fixed' ? money(row.price) : undefined,
      basePrice: money(row.price),
      durationMinutes: row.duration_minutes,
      popularRank: row.popular_rank ?? undefined,
      tag: row.tag ?? undefined,
      cardImage: row.image_path ?? undefined,
      imagePath: row.image_path,
      active: row.active,
    })),
    forms: (forms.data ?? []).map((row) => ({
      id: row.id,
      serviceId: row.service_id,
      categoryId: row.category_id
        ? (categoryByUuid.get(row.category_id)?.slug ?? row.category_id)
        : null,
      version: row.version,
      schema: row.schema,
    })),
  };
};

app.get('/catalogue', async (c) => c.json(await cataloguePayload(c)));
// Client discovery currently calls /services; keep it compatible.
app.get('/services', async (c) => c.json(await cataloguePayload(c)));
app.get('/service-categories', async (c) => {
  const payload = await cataloguePayload(c);
  return c.json({ categories: payload.categories });
});

// Public: the schedule step asks for bookable starts before sign-in on some paths.
app.get('/availability', async (c) => {
  const db = admin;
  const slug = (c.req.query('service') ?? '').trim();
  const dateISO = (c.req.query('date') ?? '').trim();
  if (!slug) return fail(c, 400, 'invalid_request', 'Tell us which service you are booking.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return fail(c, 400, 'invalid_request', 'Use a date in YYYY-MM-DD format.');
  }

  const date = new Date(`${dateISO}T12:00:00+03:00`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateISO) {
    return fail(c, 400, 'invalid_request', 'That date does not exist.');
  }

  const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kampala' }).format(new Date());
  if (dateISO < todayISO) return c.json({ slots: [] });

  const { data: service, error: serviceError } = await db
    .from('services')
    .select('id, duration_minutes, required_skill_id')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  if (serviceError) throw new HTTPException(500, { message: serviceError.message, cause: 'service_read' });
  if (!service) return fail(c, 404, 'not_found', 'That service is not available.');

  const weekday = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  const technicianSelect = service.required_skill_id
    ? 'user_id, technician_availability(weekday, start_time, end_time), technician_skills!inner(skill_id)'
    : 'user_id, technician_availability(weekday, start_time, end_time)';
  let techniciansQuery = db
    .from('technician_profiles')
    .select(technicianSelect)
    .eq('active', true);
  if (service.required_skill_id) {
    techniciansQuery = techniciansQuery.eq('technician_skills.skill_id', service.required_skill_id);
  }

  const { data: technicians, error: technicianError } = await techniciansQuery;
  if (technicianError) throw new HTTPException(500, { message: technicianError.message, cause: 'availability_read' });

  const technicianIds = (technicians ?? []).map((row) => row.user_id);
  if (technicianIds.length === 0) return c.json({ slots: [] });

  const dayStart = new Date(`${dateISO}T00:00:00+03:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [{ data: overrides, error: overrideError }, { data: assignments, error: assignmentError }] =
    await Promise.all([
      db
        .from('technician_overrides')
        .select('technician_id, is_off, start_time, end_time')
        .eq('date', dateISO)
        .in('technician_id', technicianIds),
      db
        .from('job_assignments')
        .select('technician_id, bookings!inner(scheduled_start, scheduled_end, status)')
        .in('technician_id', technicianIds)
        .not('status', 'in', '(declined,removed)')
        .gte('bookings.scheduled_start', dayStart.toISOString())
        .lt('bookings.scheduled_start', dayEnd.toISOString()),
    ]);
  const readError = overrideError ?? assignmentError;
  if (readError) throw new HTTPException(500, { message: readError.message, cause: 'availability_read' });

  const overrideByTechnician = new Map((overrides ?? []).map((row) => [row.technician_id, row]));
  const minutes = (value: string) => {
    const [hours, mins] = value.split(':').map(Number);
    return hours * 60 + mins;
  };
  const busyByTechnician = new Map<string, { start: number; end: number }[]>();
  for (const row of assignments ?? []) {
    const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
    if (!booking?.scheduled_start || !booking?.scheduled_end) continue;
    const list = busyByTechnician.get(row.technician_id) ?? [];
    list.push({ start: Date.parse(booking.scheduled_start), end: Date.parse(booking.scheduled_end) });
    busyByTechnician.set(row.technician_id, list);
  }

  const duration = Number(service.duration_minutes ?? 120);
  // Same-day requests need a three-hour lead, matching the schedule screen.
  const earliestStart = Date.now() + 3 * 60 * 60 * 1000;
  const slots = Array.from({ length: 10 }, (_, index) => {
    const hour = 7 + index;
    const label = `${String(hour).padStart(2, '0')}:00`;
    const startMinutes = hour * 60;
    const endMinutes = startMinutes + duration;
    if (endMinutes > 18 * 60) return { time: label, available: false, remaining: 0 };

    const slotStart = new Date(`${dateISO}T${label}:00+03:00`).getTime();
    const slotEnd = slotStart + duration * 60 * 1000;
    if (slotStart < earliestStart) return { time: label, available: false, remaining: 0 };

    const free = (technicians ?? []).filter((row) => {
      const override = overrideByTechnician.get(row.user_id);
      if (override?.is_off) return false;

      const windows = override?.start_time && override?.end_time
        ? [{ start_time: override.start_time, end_time: override.end_time }]
        : (row.technician_availability ?? []).filter(
            (window: { weekday: number }) => Number(window.weekday) === weekday,
          );
      const withinWindow = windows.some(
        (window: { start_time: string; end_time: string }) =>
          startMinutes >= minutes(window.start_time) && endMinutes <= minutes(window.end_time),
      );
      if (!withinWindow) return false;

      return !(busyByTechnician.get(row.user_id) ?? []).some(
        (busy) => busy.start < slotEnd && busy.end > slotStart,
      );
    }).length;

    return { time: label, available: free > 0, remaining: Math.min(free, 9) };
  });

  return c.json({ slots });
});

app.get('/search', async (c) => {
  const term = (c.req.query('q') ?? '').trim().toLowerCase();
  if (!term) return c.json({ services: [] });
  const payload = await cataloguePayload();
  const services = payload.services.filter((service) =>
    `${service.name} ${service.tagline} ${service.tag ?? ''} ${service.slug}`.toLowerCase().includes(term),
  );
  return c.json({ services });
});

// Public: the service landing page can open before sign-in.
app.get('/services/:slug', async (c) => {
  const db = admin;
  const slug = c.req.param('slug');
  const { data: service, error } = await db
    .from('services')
    .select('id, category_id, name, description, slug, image_path, pricing_type, price, duration_minutes, popular_rank, tag, active')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  if (error) throw new HTTPException(500, { message: error.message, cause: 'service_read' });
  if (!service) return fail(c, 404, 'not_found', 'That service is not available.');

  const [{ data: form }, { data: category }] = await Promise.all([
    db
      .from('service_form_definitions')
      .select('id, service_id, version, schema')
      .eq('service_id', service.id)
      .eq('is_current', true)
      .maybeSingle(),
    db.from('categories').select('slug').eq('id', service.category_id).maybeSingle(),
  ]);

  const servicePayload = {
    id: service.id,
    slug: service.slug,
    name: service.name,
    tagline: service.description ?? '',
    description: service.description,
    categoryId: category?.slug ?? service.category_id,
    categoryUuid: service.category_id,
    pricingMode: service.pricing_type,
    fixedPrice: service.pricing_type === 'fixed' ? money(service.price) : undefined,
    basePrice: money(service.price),
    durationMinutes: service.duration_minutes,
    popularRank: service.popular_rank ?? undefined,
    tag: service.tag ?? undefined,
    cardImage: service.image_path ?? undefined,
    imagePath: service.image_path,
    active: service.active,
  };

  return c.json({
    service: servicePayload,
    form,
    content: {
      slug: service.slug,
      cardImage: service.image_path ?? undefined,
      heroImage: service.image_path ?? undefined,
      intro: service.description ?? '',
    },
  });
});

app.get('/bookings', async (c) => {
  const { db } = await session(c);
  const { data, error } = await db
    .from('bookings')
    .select('id, reference, status, source, scheduled_start, scheduled_end, billed_hours, total_price, technicians_needed, notes, created_at, address_id, booking_items(id, service_id, quantity, price), addresses(label, line1, line2, area)')
    .order('scheduled_start', { ascending: false });
  if (error) throw new HTTPException(500, { message: error.message, cause: 'bookings_read' });

  return c.json({
    bookings: (data ?? []).map((row) => ({
      id: row.id,
      reference: row.reference,
      status: row.status,
      source: row.source,
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      billedHours: row.billed_hours === null ? null : Number(row.billed_hours),
      total: money(row.total_price),
      techniciansNeeded: row.technicians_needed,
      notes: row.notes,
      createdAt: row.created_at,
      address: row.addresses,
      items: row.booking_items,
    })),
  });
});

app.get('/bookings/:id', async (c) => {
  const { db } = await session(c);
  const { data, error } = await db
    .from('bookings')
    .select('*, booking_items(*), booking_form_snapshots(*), addresses(*), job_assignments(id, technician_id, crew_role, status)')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (error) throw new HTTPException(500, { message: error.message, cause: 'booking_read' });
  if (!data) return fail(c, 404, 'not_found', 'That booking was not found.');
  return c.json({ booking: data });
});

type BookingItemInput = { serviceId?: unknown; quantity?: unknown };

app.post('/bookings', async (c) => {
  const { profile } = await session(c);
  if (profile.role !== 'customer') {
    return fail(c, 403, 'customer_only', 'Staff bookings are created from the operations app.');
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return fail(c, 400, 'invalid_json', 'Send a JSON body.');
  }

  const location = (body.location ?? {}) as Record<string, unknown>;
  const schedule = (body.schedule ?? {}) as Record<string, unknown>;
  const addressId =
    typeof body.addressId === 'string'
      ? body.addressId
      : typeof location.addressId === 'string'
        ? location.addressId
        : '';
  const startRaw =
    typeof body.scheduledStart === 'string'
      ? body.scheduledStart
      : typeof schedule.dateISO === 'string' && typeof schedule.startTime === 'string'
        ? `${schedule.dateISO}T${schedule.startTime}:00+03:00`
        : null;
  const scheduledStart = startRaw ? new Date(startRaw) : null;
  const items = Array.isArray(body.items)
    ? (body.items as BookingItemInput[])
    : typeof body.serviceSlug === 'string'
      ? [{ serviceId: body.serviceSlug, quantity: 1 }]
      : [];

  if (!addressId) return fail(c, 400, 'address_required', 'Choose an address.');
  if (!scheduledStart || Number.isNaN(scheduledStart.getTime())) {
    return fail(c, 400, 'time_required', 'Choose a valid start time.');
  }
  if (scheduledStart.getTime() <= Date.now()) {
    return fail(c, 400, 'time_in_past', 'Choose a time in the future.');
  }
  if (items.length === 0) return fail(c, 400, 'items_required', 'Choose at least one service.');

  const { data: address } = await admin
    .from('addresses')
    .select('id, customer_id')
    .eq('id', addressId)
    .maybeSingle();
  if (!address || address.customer_id !== profile.id) {
    return fail(c, 403, 'address_forbidden', 'That address is not on your account.');
  }

  const refs = items.map((item) => String(item.serviceId ?? '')).filter(Boolean);
  const looksLikeUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
  const uuidRefs = refs.filter(looksLikeUuid);
  const slugRefs = refs.filter((value) => !looksLikeUuid(value));

  const [{ data: byUuid, error: uuidError }, { data: bySlug, error: slugError }] = await Promise.all([
    uuidRefs.length
      ? admin.from('services').select('id, slug, pricing_type, price, duration_minutes, active').in('id', uuidRefs)
      : Promise.resolve({ data: [], error: null }),
    slugRefs.length
      ? admin.from('services').select('id, slug, pricing_type, price, duration_minutes, active').in('slug', slugRefs)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const servicesError = uuidError ?? slugError;
  if (servicesError) throw new HTTPException(500, { message: servicesError.message, cause: 'services_read' });

  const byId = new Map([...(byUuid ?? []), ...(bySlug ?? [])].map((row) => [row.id, row]));
  const byKey = new Map([...(byUuid ?? []), ...(bySlug ?? [])].flatMap((row) => [[row.id, row], [row.slug, row]]));
  const resolved = items.map((item) => {
    const key = String(item.serviceId ?? '');
    const service = byId.get(key) ?? byKey.get(key);
    const quantity = Math.max(1, Math.min(10, Number(item.quantity ?? 1)));
    return service ? { service, quantity } : null;
  });
  if (resolved.some((entry) => entry === null) || resolved.length !== items.length) {
    return fail(c, 400, 'service_unavailable', 'One of those services is no longer available.');
  }
  if (resolved.some((entry) => entry!.service.active !== true)) {
    return fail(c, 400, 'service_unavailable', 'One of those services is no longer available.');
  }

  const anyQuote = resolved.some((entry) => entry!.service.pricing_type !== 'fixed');
  const total = resolved.reduce(
    (sum, entry) => sum + money(entry!.service.price) * entry!.quantity,
    0,
  );
  const minutes = Math.max(...resolved.map((entry) => Number(entry!.service.duration_minutes) || 60));
  const scheduledEnd = new Date(scheduledStart.getTime() + minutes * 60_000);

  const key = c.req.header('Idempotency-Key');
  if (key) {
    const { data: replay } = await admin
      .from('idempotency_keys')
      .select('status, response')
      .eq('user_id', profile.id)
      .eq('key', key)
      .maybeSingle();
    if (replay) return c.json(replay.response, replay.status as 200);
  }

  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .insert({
      customer_id: profile.id,
      address_id: addressId,
      source: 'app',
      status: anyQuote ? 'requested' : 'confirmed',
      technicians_needed: 1,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      total_price: anyQuote ? 0 : total,
      notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
    })
    .select('id, reference, status, scheduled_start, scheduled_end, total_price')
    .single();

  if (bookingError || !booking) {
    throw new HTTPException(500, { message: bookingError?.message ?? 'Booking failed', cause: 'booking_insert' });
  }

  const cleanup = async () => {
    await admin.from('bookings').delete().eq('id', booking.id);
  };

  const { error: itemsError } = await admin.from('booking_items').insert(
    resolved.map((entry) => ({
      booking_id: booking.id,
      service_id: entry!.service.id,
      quantity: entry!.quantity,
      price: money(entry!.service.price),
    })),
  );
  if (itemsError) {
    await cleanup();
    throw new HTTPException(500, { message: itemsError.message, cause: 'items_insert' });
  }

  const form = body.form as Record<string, unknown> | undefined;
  if (form && Array.isArray(form.questions) && form.answers && typeof form.answers === 'object') {
    const { error: snapshotError } = await admin.from('booking_form_snapshots').insert({
      booking_id: booking.id,
      form_definition_id: typeof form.definitionId === 'string' ? form.definitionId : null,
      form_version: Number(form.version ?? 1),
      questions: form.questions,
      answers: form.answers,
    });
    if (snapshotError) {
      await cleanup();
      throw new HTTPException(500, { message: snapshotError.message, cause: 'snapshot_insert' });
    }
  }

  const response = {
    bookingId: booking.id,
    booking: {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      scheduledStart: booking.scheduled_start,
      scheduledEnd: booking.scheduled_end,
      total,
    },
    priceBreakdown: {
      base: total,
      materials: 0,
      addOns: 0,
      frequencyDiscount: 0,
      promoDiscount: 0,
      vat: 0,
      total,
      minutes,
    },
  };

  if (key) {
    await admin.from('idempotency_keys').insert({
      user_id: profile.id,
      key,
      method: 'POST',
      path: '/bookings',
      status: 201,
      response,
    });
  }

  return c.json(response, 201);
});

app.get('/quotes', async (c) => {
  const { db } = await session(c);
  const { data, error } = await db
    .from('quotes')
    .select('id, booking_id, description, quoted_amount, status, inspection_required, quoted_at, responded_at, expires_at, created_at, inspections(id, status, scheduled_at, inspector_id)')
    .order('created_at', { ascending: false });
  if (error) throw new HTTPException(500, { message: error.message, cause: 'quotes_read' });
  return c.json({ quotes: data ?? [] });
});

app.get('/support/conversation', async (c) => {
  const { db, profile } = await session(c);
  let { data: conversation } = await db
    .from('support_conversations')
    .select('*')
    .eq('customer_id', profile.id)
    .maybeSingle();

  if (!conversation) {
    const { data: created, error } = await db
      .from('support_conversations')
      .insert({ customer_id: profile.id, category: 'other', status: 'open' })
      .select('*')
      .single();
    if (error) throw new HTTPException(500, { message: error.message, cause: 'conversation_create' });
    conversation = created;
  }

  const { data: messages, error: messagesError } = await db
    .from('support_messages')
    .select('id, sender_id, body, booking_id, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at');

  if (messagesError) throw new HTTPException(500, { message: messagesError.message, cause: 'messages_read' });
  return c.json({ conversation, messages: messages ?? [] });
});

app.post('/support/messages', async (c) => {
  const { db, profile } = await session(c);
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!text) return fail(c, 400, 'message_required', 'Write a message.');

  const { data: conversation } = await db
    .from('support_conversations')
    .select('id')
    .eq('customer_id', profile.id)
    .maybeSingle();
  if (!conversation) return fail(c, 404, 'conversation_missing', 'Open support first.');

  const { data, error } = await db
    .from('support_messages')
    .insert({
      conversation_id: conversation.id,
      sender_id: profile.id,
      body: text,
      booking_id: typeof body?.bookingId === 'string' ? body.bookingId : null,
    })
    .select('id, sender_id, body, booking_id, created_at')
    .single();
  if (error) throw new HTTPException(500, { message: error.message, cause: 'message_insert' });
  return c.json({ message: data }, 201);
});

app.get('/notifications', async (c) => {
  const { db } = await session(c);
  const { data, error } = await db
    .from('notifications')
    .select('id, title, body, type, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new HTTPException(500, { message: error.message, cause: 'notifications_read' });
  return c.json({ notifications: data ?? [] });
});

app.patch('/notifications/:id/read', async (c) => {
  const { db } = await session(c);
  const { error } = await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', c.req.param('id'));
  if (error) throw new HTTPException(500, { message: error.message, cause: 'notification_update' });
  return c.json({ ok: true });
});

app.notFound((c) => fail(c, 404, 'not_found', 'That endpoint does not exist.'));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    const cause = typeof error.cause === 'string' ? error.cause : 'request_failed';
    return fail(c, error.status, cause, error.message);
  }
  console.error('[api] unhandled', error);
  return fail(c, 500, 'internal_error', 'Something went wrong. Please try again.');
});

Deno.serve(app.fetch);
