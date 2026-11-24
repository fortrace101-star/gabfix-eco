#!/usr/bin/env node
/**
 * Gabfix client mock API (Phase 1, task 1.6).
 *
 * A zero-dependency Node server that speaks the client's own REST contract so the
 * booking and discovery screens can be exercised without the Supabase stack.
 *
 *   npm run mock
 *   EXPO_PUBLIC_API_BASE_URL=http://localhost:4000 npx expo start --clear
 *
 * Endpoints (the shapes match `src/lib/api/*`):
 *   POST /auth/login | /auth/register | /auth/otp/request | /auth/otp/verify | /auth/refresh
 *   GET  /services | /search | /services/:slug | /availability
 *   POST /bookings
 *   GET  /bookings/:id | /bookings/:id/tracking
 *   GET  /health
 *
 * This is a development fixture, not a backend. Data lives in memory and resets on
 * restart. The real contract is owned by `backend/` and `Full_App_Architecture_2.md` D1.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 4000);
const HOST = process.env.MOCK_HOST ?? '127.0.0.1';

const categories = [
  { id: 'cleaning', name: 'Cleaning', caption: 'Homes, offices and handovers', order: 1, formSchemaId: 'cleaning', active: true },
  { id: 'upholstery', name: 'Upholstery and carpets', caption: 'Carpets, sofas and chairs', order: 2, formSchemaId: 'upholstery', active: true },
  { id: 'surface-care', name: 'Surface care', caption: 'Pavers, roofs, terrazzo and tiles', order: 3, formSchemaId: 'surface', active: true },
  { id: 'pest-control', name: 'Pest control', caption: 'Inspection, treatment and follow-up', order: 4, formSchemaId: 'pest', active: true },
  { id: 'repairs', name: 'Repairs and installations', caption: 'Electrical, plumbing and handyman work', order: 5, formSchemaId: 'repairs', active: true },
  { id: 'building', name: 'Building and finishing', caption: 'Tiling, painting and renovations', order: 6, formSchemaId: 'building', active: true },
  { id: 'outdoor', name: 'Outdoor and landscaping', caption: 'Paving, lawns and garden care', order: 7, formSchemaId: 'outdoor', active: true },
];

const services = [
  { slug: 'home-clean', name: 'Basic cleaning', tagline: 'Floors, surfaces, bathrooms and kitchens', tag: 'Popular', categoryId: 'cleaning', pricingMode: 'hourly', popularRank: 1, active: true },
  { slug: 'deep-clean', name: 'Deep cleaning', tagline: 'A top-to-bottom reset for your home', categoryId: 'cleaning', pricingMode: 'hourly', popularRank: 2, active: true },
  { slug: 'post-construction-clean', name: 'Post-construction cleaning', tagline: 'Dust, debris and paint splatter after a build', categoryId: 'cleaning', pricingMode: 'quote', active: true },
  { slug: 'carpet-clean', name: 'Carpet cleaning', tagline: 'Deep extraction for rugs and fitted carpet', categoryId: 'upholstery', pricingMode: 'fixed', price: 85000, popularRank: 4, active: true },
  { slug: 'sofa-clean', name: 'Sofa sets cleaning', tagline: 'Shampoo and extraction for every seat', categoryId: 'upholstery', pricingMode: 'hourly', popularRank: 3, active: true },
  { slug: 'fumigation', name: 'Fumigation', tagline: 'Inspection, treatment and a follow-up visit', categoryId: 'pest-control', pricingMode: 'quote', popularRank: 5, active: true },
  { slug: 'electrical-works', name: 'Electrical works', tagline: 'Sockets, lighting, wiring and fault-finding', categoryId: 'repairs', pricingMode: 'quote', active: true },
  { slug: 'painting', name: 'Painting', tagline: 'Interior and exterior painting and touch-ups', categoryId: 'building', pricingMode: 'quote', popularRank: 6, active: true },
  { slug: 'landscaping', name: 'Landscaping and grass cutting', tagline: 'Lawns, hedges and garden upkeep', categoryId: 'outdoor', pricingMode: 'quote', active: true },
  { slug: 'office-clean', name: 'Office cleaning', tagline: 'Desks, meeting rooms and shared kitchens', categoryId: 'cleaning', pricingMode: 'hourly', active: false },
];

const activeServices = services.filter((service) => service.active);
const bookings = new Map();
const idempotency = new Map();
const tokens = new Map();
let serial = 1000;

const json = (res, status, body) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, idempotency-key',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'cache-control': 'no-store',
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

const fail = (res, status, code, message) => json(res, status, { code, message, error: { code, message } });

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) reject(new Error('payload too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });

const publicService = ({ price, ...service }) => service;

const slotsFor = (dateISO) => {
  const seed = [...dateISO].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: 10 }, (_, index) => {
    const hour = 7 + index;
    const remaining = (seed + hour * 7) % 6;
    return { time: `${String(hour).padStart(2, '0')}:00`, available: remaining > 0, remaining };
  });
};

const trackingFor = (booking) => {
  const now = Date.now();
  const start = booking.startAt ? Date.parse(booking.startAt) : now;
  if (booking.status === 'cancelled') {
    return { status: 'cancelled', detail: 'This booking was cancelled.', updatedAt: new Date().toISOString() };
  }
  if (now > start + 60 * 60 * 1000) {
    return { status: 'completed', routeProgress: 1, etaText: 'Clean completed', updatedAt: new Date().toISOString() };
  }
  if (now >= start) {
    return { status: 'in_progress', routeProgress: 1, etaText: 'Cleaning in progress', updatedAt: new Date().toISOString() };
  }
  const minutes = Math.max(1, Math.ceil((start - now) / 60000));
  return {
    status: minutes <= 90 ? 'on_the_way' : 'confirmed',
    routeProgress: minutes <= 90 ? Math.min(0.95, Math.max(0.15, 1 - minutes / 90)) : 0,
    etaMinutes: minutes <= 90 ? minutes : null,
    detail: minutes <= 90 ? 'Your technician is on the way.' : 'Tracking opens 90 minutes before your booking.',
    cleaner: { name: 'Daniel Cleaner', initials: 'DC', phone: '0772123456', lat: 0.3476, lng: 32.5825 },
    destination: { lat: 0.335, lng: 32.57, label: 'Kampala' },
    updatedAt: new Date().toISOString(),
  };
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204);
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (req.method === 'GET' && path === '/health') {
      return json(res, 200, { ok: true, services: activeServices.length, bookings: bookings.size });
    }

    // ---- auth -------------------------------------------------------------
    if (req.method === 'POST' && path === '/auth/login') {
      const body = await readBody(req);
      if (!body.identifier || !body.password) return fail(res, 400, 'missing_credentials', 'Enter your phone or email and password.');
      if (String(body.password).length < 6) return fail(res, 401, 'invalid_credentials', 'That password is not right.');
      const token = `mock-${(++serial).toString(36)}`;
      tokens.set(token, body.identifier);
      const phone = /^\+?[0-9\s]+$/.test(String(body.identifier).trim());
      return json(res, 200, {
        accessToken: token,
        refreshToken: `refresh-${token}`,
        user: {
          id: 'mock-user',
          name: phone ? 'Aisha' : String(body.identifier).split('@')[0] || 'Aisha',
          phone: phone ? String(body.identifier) : undefined,
          email: phone ? undefined : String(body.identifier),
        },
      });
    }

    if (req.method === 'POST' && path === '/auth/register') {
      const body = await readBody(req);
      if (!body.name || !body.phone || !body.password) return fail(res, 400, 'invalid_registration', 'Name, phone and password are required.');
      if (!/^07\d{8}$/.test(String(body.phone).replace(/\D/g, ''))) return fail(res, 400, 'invalid_phone', 'Use a 10-digit number starting with 07.');
      return json(res, 201, { ok: true });
    }

    if (req.method === 'POST' && path === '/auth/otp/request') {
      await readBody(req);
      return json(res, 200, { ok: true, hint: 'Use 123456 in the mock server; 000000 exercises the error state.' });
    }

    if (req.method === 'POST' && path === '/auth/otp/verify') {
      const body = await readBody(req);
      if (String(body.code) === '000000') return fail(res, 400, 'invalid_code', "That code isn't right. Check the SMS and try again.");
      const token = `mock-${(++serial).toString(36)}`;
      tokens.set(token, body.phone);
      return json(res, 200, {
        accessToken: token,
        refreshToken: `refresh-${token}`,
        user: { id: 'mock-user', name: 'Aisha', phone: body.phone },
      });
    }

    if (req.method === 'POST' && path === '/auth/refresh') {
      const body = await readBody(req);
      if (!body.refreshToken) return fail(res, 401, 'invalid_refresh', 'Sign in again.');
      return json(res, 200, { accessToken: `mock-${(++serial).toString(36)}` });
    }

    // ---- discovery --------------------------------------------------------
    if (req.method === 'GET' && path === '/services') {
      return json(res, 200, { services: activeServices.map(publicService), categories });
    }

    if (req.method === 'GET' && path === '/search') {
      const term = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      if (!term) return json(res, 200, { services: [] });
      const matches = activeServices.filter((service) =>
        `${service.name} ${service.tagline} ${service.tag ?? ''}`.toLowerCase().includes(term),
      );
      return json(res, 200, { services: matches.map(publicService) });
    }

    if (req.method === 'GET' && path.startsWith('/services/')) {
      const slug = decodeURIComponent(path.slice('/services/'.length));
      const service = services.find((entry) => entry.slug === slug);
      if (!service) return fail(res, 404, 'service_not_found', 'That service does not exist.');
      return json(res, 200, { service: publicService(service), content: {} });
    }

    if (req.method === 'GET' && path === '/availability') {
      const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
      return json(res, 200, { slots: slotsFor(date) });
    }

    // ---- bookings ---------------------------------------------------------
    if (req.method === 'POST' && path === '/bookings') {
      const idempotencyKey = req.headers['idempotency-key'];
      if (idempotencyKey && idempotency.has(String(idempotencyKey))) {
        return json(res, 200, idempotency.get(String(idempotencyKey)));
      }
      const body = await readBody(req);
      const service = services.find((entry) => entry.slug === body.serviceSlug);
      if (!service) return fail(res, 400, 'unknown_service', 'Choose a service from the catalogue.');
      if (!body.schedule?.dateISO || !body.schedule?.startTime) return fail(res, 400, 'missing_schedule', 'Choose a date and time.');
      if (!body.location?.street || !body.location?.contactName || !body.location?.contactPhone) {
        return fail(res, 400, 'missing_location', 'Add the address and contact details.');
      }

      const bookingId = `MOCK-${++serial}`;
      const total = Number(body.clientTotal) || 0;
      const record = {
        bookingId,
        serviceSlug: service.slug,
        status: 'confirmed',
        dateISO: body.schedule.dateISO,
        startTime: body.schedule.startTime,
        startAt: `${body.schedule.dateISO}T${body.schedule.startTime}:00`,
        total,
        createdAt: new Date().toISOString(),
      };
      bookings.set(bookingId, record);
      const result = {
        bookingId,
        priceBreakdown: {
          base: total,
          materials: 0,
          addOns: 0,
          frequencyDiscount: 0,
          promoDiscount: 0,
          vat: 0,
          total,
          minutes: Number(body.details?.hours ?? 0) * 60,
        },
      };
      if (idempotencyKey) idempotency.set(String(idempotencyKey), result);
      return json(res, 201, result);
    }

    if (req.method === 'GET' && path.startsWith('/bookings/')) {
      const [, , id, extra] = path.split('/');
      const booking = bookings.get(decodeURIComponent(id ?? ''));
      if (!booking) return fail(res, 404, 'booking_not_found', 'We could not find that booking.');
      if (extra === 'tracking') return json(res, 200, trackingFor(booking));
      return json(res, 200, booking);
    }

    return fail(res, 404, 'not_found', `No mock route for ${req.method} ${path}.`);
  } catch (error) {
    return fail(res, 400, 'bad_request', error instanceof Error ? error.message : 'Bad request.');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Gabfix mock API on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log('Point the app at it with EXPO_PUBLIC_API_BASE_URL=http://localhost:4000');
  console.log('OTP: any 6-digit code except 000000. Bookings reset when the server stops.');
});
