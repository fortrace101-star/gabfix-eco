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

const KAMPALA_OFFSET_MS = 3 * 60 * 60 * 1000;
const LEAD_HOURS = 3;

const kampalaDateISO = (date: Date) =>
  new Date(date.getTime() + KAMPALA_OFFSET_MS).toISOString().slice(0, 10);

const kampalaMinutes = (date: Date) => {
  const shifted = new Date(date.getTime() + KAMPALA_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
};

type BookableService = {
  id: string;
  category_id: string;
  duration_minutes: number | null;
  required_skill_id: string | null;
};

type FormFieldDef = {
  id?: string;
  type?: string;
  label?: string;
  required?: boolean;
  min?: number;
  max?: number;
  options?: { id?: string }[];
};

type FormDefinition = {
  id: string;
  version: number;
  schema: {
    sections?: { fields?: FormFieldDef[] }[];
  } | null;
};

const formFields = (form: FormDefinition): FormFieldDef[] =>
  (form.schema?.sections ?? []).flatMap((section) => section.fields ?? []);

const isBlank = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/** Server-side mirror of the client's form engine for the stored definition. */
function formAnswerError(form: FormDefinition, answers: Record<string, unknown>): string | null {
  const fields = formFields(form);
  const allowed = new Set(fields.map((field) => field.id).filter(Boolean));
  const unknown = Object.keys(answers).find((key) => !allowed.has(key));
  if (unknown) return `Unknown form field: ${unknown}.`;

  for (const field of fields) {
    if (!field.id || field.type === 'media-slot') continue;
    const value = answers[field.id];
    if (isBlank(value)) {
      if (field.required) return `${field.label ?? field.id} is required.`;
      continue;
    }

    if (field.type === 'select') {
      const optionIds = (field.options ?? []).map((option) => option.id);
      if (typeof value !== 'string' || !optionIds.includes(value)) {
        return `Choose a listed option for ${field.label ?? field.id}.`;
      }
    }

    if (field.type === 'multiselect') {
      if (!Array.isArray(value)) return `Choose at least one option for ${field.label ?? field.id}.`;
      const optionIds = (field.options ?? []).map((option) => option.id);
      if (value.some((entry) => typeof entry !== 'string' || !optionIds.includes(entry))) {
        return `Choose only listed options for ${field.label ?? field.id}.`;
      }
    }

    if (field.type === 'number' || field.type === 'counter' || field.type === 'measurement') {
      const measured =
        field.type === 'measurement' && value && typeof value === 'object' && !Array.isArray(value)
          ? (value as { value?: unknown }).value
          : value;
      const numeric = typeof measured === 'number' ? measured : Number(measured);
      if (!Number.isFinite(numeric)) return `${field.label ?? field.id} needs a number.`;
      if (field.min !== undefined && numeric < field.min) {
        return `${field.label ?? field.id} must be at least ${field.min}.`;
      }
      if (field.max !== undefined && numeric > field.max) {
        return `${field.label ?? field.id} must be at most ${field.max}.`;
      }
    }
  }

  return null;
}

// Booking media limits mirror the `booking-media` bucket and the client's
// scope screen. The bucket enforces size/mime; these checks also reject an
// 11th item, an oversized video or a bad duration before a row is written.
const MEDIA_BUCKET = 'booking-media';
const MAX_MEDIA_ITEMS = 10;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_VIDEO_MS = 30_000;
const MEDIA_URL_TTL_SECONDS = 2 * 60 * 60;

const MEDIA_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

type MediaInput = {
  clientId?: unknown;
  kind?: unknown;
  mimeType?: unknown;
  bytes?: unknown;
  sizeBytes?: unknown;
  durationMs?: unknown;
  width?: unknown;
  height?: unknown;
};

const mediaExt = (mime: string) => MEDIA_MIME_EXT[mime] ?? null;

function mediaInputError(items: MediaInput[]): string | null {
  if (items.length > MAX_MEDIA_ITEMS) {
    return `Add at most ${MAX_MEDIA_ITEMS} photos or videos.`;
  }
  for (const item of items) {
    const kind = item.kind;
    if (kind !== 'image' && kind !== 'video') return 'Each attachment must be a photo or a video.';
    const mime = typeof item.mimeType === 'string' ? item.mimeType : '';
    if (!mediaExt(mime)) return 'That file type is not supported.';
    if (kind === 'image' && !mime.startsWith('image/')) return 'That file is not a photo.';
    if (kind === 'video' && !mime.startsWith('video/')) return 'That file is not a video.';

    const bytes = Number(item.bytes ?? item.sizeBytes ?? 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return 'We could not read the file size.';
    const limit = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (bytes > limit) return `${kind === 'video' ? 'Videos' : 'Photos'} must be 25 MB or smaller.`;

    if (kind === 'video') {
      const duration = Number(item.durationMs ?? 0);
      if (!Number.isFinite(duration) || duration <= 0) return 'We could not read the video length.';
      if (duration > MAX_VIDEO_MS) return 'Videos must be 30 seconds or shorter.';
    }
  }
  return null;
}

// The local edge runtime sees Supabase as `kong:8000`, which a phone cannot
// reach. `STORAGE_PUBLIC_URL` overrides the storage origin (set it to the LAN
// address when testing on a device); the local default is the public stack URL.
const STORAGE_PUBLIC_BASE = Deno.env.get('STORAGE_PUBLIC_URL') ??
  (SUPABASE_URL.includes('//kong:') ? 'http://127.0.0.1:54321' : SUPABASE_URL);

const absoluteStorageUrl = (url: string) =>
  url.startsWith('http')
    ? url.replace(/^https?:\/\/kong(:\d+)?/, STORAGE_PUBLIC_BASE)
    : `${STORAGE_PUBLIC_BASE.replace(/\/$/, '')}${url}`;

/** Creates metadata rows and returns one pre-signed upload URL per item. */
async function createMediaTargets(
  bookingId: string,
  userId: string,
  items: MediaInput[],
): Promise<{ uploads: Record<string, unknown>[]; error?: string }> {
  const rows = items.map((item) => {
    const mime = String(item.mimeType);
    const id = crypto.randomUUID();
    const bytes = Number(item.bytes ?? item.sizeBytes ?? 0);
    const clientId = typeof item.clientId === 'string' && item.clientId ? item.clientId : id;
    return {
      id,
      clientId,
      mime,
      row: {
        id,
        booking_id: bookingId,
        client_id: clientId,
        storage_path: `${bookingId}/${id}.${mediaExt(mime)}`,
        kind: item.kind as string,
        mime_type: mime,
        bytes,
        duration_ms: item.kind === 'video' ? Math.round(Number(item.durationMs ?? 0)) : null,
        width: Number.isFinite(Number(item.width)) ? Math.round(Number(item.width)) : null,
        height: Number.isFinite(Number(item.height)) ? Math.round(Number(item.height)) : null,
        status: 'pending',
        created_by: userId,
      },
    };
  });

  const { error: insertError } = await admin.from('booking_media').insert(rows.map((row) => row.row));
  if (insertError) return { uploads: [], error: insertError.message };

  const uploads: Record<string, unknown>[] = [];
  const cleanup = async () => {
    await admin.from('booking_media').delete().in('id', rows.map((row) => row.id));
  };

  for (const entry of rows) {
    const { data, error } = await admin.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(entry.row.storage_path);
    if (error || !data) {
      await cleanup();
      return { uploads: [], error: error?.message ?? 'Could not create an upload link.' };
    }
    uploads.push({
      clientId: entry.clientId,
      mediaId: entry.id,
      uploadUrl: absoluteStorageUrl(data.signedUrl),
      headers: { 'content-type': entry.mime, 'x-upsert': 'false' },
      expiresAtISO: new Date(Date.now() + MEDIA_URL_TTL_SECONDS * 1000).toISOString(),
    });
  }

  return { uploads };
}

/** Session + booking ownership/access check shared by the media routes. */
async function mediaBookingAccess(c: Context, bookingId: string) {
  const { profile } = await session(c);
  const { data: booking } = await admin
    .from('bookings')
    .select('id, customer_id')
    .eq('id', bookingId)
    .maybeSingle();
  const isDesk = ['admin', 'manager', 'customer_relations'].includes(profile.role);
  if (!booking || (booking.customer_id !== profile.id && !isDesk)) {
    throw new HTTPException(404, { message: 'That booking was not found.', cause: 'not_found' });
  }
  return { profile, booking };
}

/**
 * Technicians who can work the whole [start, end) window for a service: active,
 * skilled, inside a weekly window or date override, and not already assigned.
 */
async function availableTechnicianCount(service: BookableService, start: Date, end: Date) {
  const dateISO = kampalaDateISO(start);
  const weekday = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  const startMinutes = kampalaMinutes(start);
  const endMinutes = startMinutes + Math.round((end.getTime() - start.getTime()) / 60_000);
  if (endMinutes > 24 * 60) return 0;

  const technicianSelect = service.required_skill_id
    ? 'user_id, technician_availability(weekday, start_time, end_time), technician_skills!inner(skill_id)'
    : 'user_id, technician_availability(weekday, start_time, end_time)';
  let techniciansQuery = admin.from('technician_profiles').select(technicianSelect).eq('active', true);
  if (service.required_skill_id) {
    techniciansQuery = techniciansQuery.eq('technician_skills.skill_id', service.required_skill_id);
  }

  const { data: technicians, error: technicianError } = await techniciansQuery;
  if (technicianError) {
    throw new HTTPException(500, { message: technicianError.message, cause: 'availability_read' });
  }
  const technicianIds = (technicians ?? []).map((row) => row.user_id);
  if (technicianIds.length === 0) return 0;

  const [{ data: overrides, error: overrideError }, { data: assignments, error: assignmentError }] =
    await Promise.all([
      admin
        .from('technician_overrides')
        .select('technician_id, is_off, start_time, end_time')
        .eq('date', dateISO)
        .in('technician_id', technicianIds),
      admin
        .from('job_assignments')
        .select('technician_id, bookings!inner(scheduled_start, scheduled_end, status)')
        .in('technician_id', technicianIds)
        .not('status', 'in', '(declined,removed)')
        .lt('bookings.scheduled_start', end.toISOString())
        .gt('bookings.scheduled_end', start.toISOString()),
    ]);
  const readError = overrideError ?? assignmentError;
  if (readError) {
    throw new HTTPException(500, { message: readError.message, cause: 'availability_read' });
  }

  const overrideByTechnician = new Map((overrides ?? []).map((row) => [row.technician_id, row]));
  const busyTechnicians = new Set(
    (assignments ?? []).map((row) => row.technician_id),
  );
  const minutes = (value: string) => {
    const [hours, mins] = value.split(':').map(Number);
    return hours * 60 + mins;
  };

  return (technicians ?? []).filter((row) => {
    if (busyTechnicians.has(row.user_id)) return false;

    const override = overrideByTechnician.get(row.user_id);
    if (override?.is_off) return false;

    const windows = override?.start_time && override?.end_time
      ? [{ start_time: override.start_time, end_time: override.end_time }]
      : (row.technician_availability ?? []).filter(
          (window: { weekday: number }) => Number(window.weekday) === weekday,
        );
    return windows.some(
      (window: { start_time: string; end_time: string }) =>
        startMinutes >= minutes(window.start_time) && endMinutes <= minutes(window.end_time),
    );
  }).length;
}

app.get('/health', (c) => c.json({ ok: true, service: 'gabfix-api' }));

app.get('/me', async (c) => {
  const { profile } = await session(c);
  return c.json({ profile });
});

// Auth -----------------------------------------------------------------------
// Supabase Auth owns credentials and sessions; these routes normalise the
// client's phone/email contract and answer in the shape src/lib/api/auth.ts uses.

const anonAuth = () =>
  createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

const PROFILE_COLUMNS = 'id, full_name, phone, role, status, auth_user_id';

type AuthProfile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
  auth_user_id: string;
};

/** Accepts 07XXXXXXXX, 7XXXXXXXX or +2567XXXXXXXX and returns 07XXXXXXXX. */
const normalizePhone = (value: unknown) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (/^2567\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^7\d{8}$/.test(digits)) return `0${digits}`;
  return /^07\d{8}$/.test(digits) ? digits : '';
};

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;
const OTP_PEPPER = Deno.env.get('OTP_PEPPER') ?? SERVICE_KEY;
// No SMS provider is connected yet (D12). Echo the code only on the local stack
// (or when OTP_DEBUG=true) so local sign-up can finish; production never does.
const OTP_DEBUG_RESPONSE =
  Deno.env.get('OTP_DEBUG') === 'true' || /\/\/(127\.0\.0\.1|localhost|kong)([:/]|$)/.test(SUPABASE_URL);

const otpHash = async (phone: string, code: string) => {
  const bytes = new TextEncoder().encode(`${OTP_PEPPER}:${phone}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

async function authProfile(authUserId: string): Promise<AuthProfile | null> {
  const { data } = await admin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  return (data as AuthProfile | null) ?? null;
}

function authSession(
  session: { access_token: string; refresh_token: string; user: { email?: string | null } },
  profile: AuthProfile,
) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    user: {
      id: profile.id,
      name: profile.full_name,
      phone: profile.phone ?? undefined,
      email: session.user.email ?? undefined,
    },
  };
}

app.post('/auth/login', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { identifier?: unknown; password?: unknown }
    | null;
  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!identifier || !password) {
    return fail(c, 400, 'missing_credentials', 'Enter your phone or email and password.');
  }

  const credentialsError = () =>
    fail(c, 401, 'invalid_credentials', 'That phone or email and password do not match.');

  let email = identifier.includes('@') ? identifier.toLowerCase() : '';
  if (!email) {
    const phone = normalizePhone(identifier);
    if (!phone) return credentialsError();
    const { data: match } = await admin
      .from('profiles')
      .select('auth_user_id')
      .eq('phone', phone)
      .maybeSingle();
    if (!match) return credentialsError();
    const { data: authUser } = await admin.auth.admin.getUserById(match.auth_user_id);
    email = authUser.user?.email ?? '';
    if (!email) return credentialsError();
  }

  const { data, error } = await anonAuth().auth.signInWithPassword({ email, password });
  if (error || !data.session) return credentialsError();

  const profile = await authProfile(data.user.id);
  if (!profile) {
    return fail(c, 403, 'no_profile', 'No Gabfix profile is linked to this account.');
  }
  if (profile.status !== 'active') return fail(c, 403, 'deactivated', 'This account is deactivated.');
  return c.json(authSession(data.session, profile));
});

app.post('/auth/register', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const phone = normalizePhone(body?.phone);
  const password = typeof body?.password === 'string' ? body.password : '';
  const suppliedEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!name || !phone || !password) {
    return fail(c, 400, 'invalid_registration', 'Name, phone and password are required.');
  }
  if (!phone) return fail(c, 400, 'invalid_phone', 'Use a 10-digit number starting with 07.');
  if (password.length < 6) {
    return fail(c, 400, 'weak_password', 'Use a password with at least 6 characters.');
  }

  // Phone-first accounts still need an Auth email; login resolves it by phone.
  const email = suppliedEmail.includes('@') ? suppliedEmail : `${phone}@phone.gabfix.ug`;
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, phone },
  });
  if (error) {
    if (/already|exists|registered|duplicate|saving new user/i.test(error.message)) {
      return fail(c, 409, 'account_exists', 'An account already uses that number or email.');
    }
    return fail(c, 400, 'registration_failed', 'We could not create that account. Check the details and try again.');
  }

  return c.json({ ok: true }, 201);
});

app.post('/auth/otp/request', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { phone?: unknown } | null;
  const phone = normalizePhone(body?.phone);
  if (!phone) return fail(c, 400, 'invalid_phone', 'Use a 10-digit number starting with 07.');

  const since = new Date(Date.now() - OTP_RESEND_SECONDS * 1000).toISOString();
  const { data: recent } = await admin
    .from('phone_otp_codes')
    .select('id')
    .eq('phone', phone)
    .is('consumed_at', null)
    .gte('created_at', since)
    .limit(1)
    .maybeSingle();
  if (recent) {
    return fail(c, 429, 'otp_throttled', 'Wait a moment before asking for another code.');
  }

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
  const { error } = await admin.from('phone_otp_codes').insert({
    phone,
    code_hash: await otpHash(phone, code),
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) throw new HTTPException(500, { message: error.message, cause: 'otp_insert' });

  // No SMS provider is connected yet (D12). The code goes to the function log;
  // local development can echo it with OTP_DEBUG=true.
  console.log(`[api] OTP for ${phone}: ${code} (expires in ${OTP_TTL_MINUTES} minutes)`);
  return c.json({ ok: true, ...(OTP_DEBUG_RESPONSE ? { debugCode: code } : {}) });
});

app.post('/auth/otp/verify', async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { phone?: unknown; code?: unknown }
    | null;
  const phone = normalizePhone(body?.phone);
  const code = String(body?.code ?? '').replace(/\D/g, '');
  if (!phone || code.length !== 6) {
    return fail(c, 400, 'invalid_code', "That code isn't right. Check the SMS and try again.");
  }

  const { data: row } = await admin
    .from('phone_otp_codes')
    .select('id, code_hash, attempts, expires_at')
    .eq('phone', phone)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) {
    return fail(c, 400, 'invalid_code', "That code isn't right. Check the SMS and try again.");
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await admin.from('phone_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
    return fail(c, 400, 'code_expired', 'That code has expired. Ask for a new one.');
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return fail(c, 429, 'too_many_attempts', 'Too many tries. Ask for a new code.');
  }

  if ((await otpHash(phone, code)) !== row.code_hash) {
    await admin
      .from('phone_otp_codes')
      .update({ attempts: row.attempts + 1 })
      .eq('id', row.id);
    return fail(c, 400, 'invalid_code', "That code isn't right. Check the SMS and try again.");
  }

  await admin
    .from('phone_otp_codes')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id);

  const { data: profile } = await admin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('phone', phone)
    .maybeSingle();
  if (!profile) {
    return fail(c, 404, 'account_not_found', 'No account uses that number yet. Create one first.');
  }
  if (profile.status !== 'active') return fail(c, 403, 'deactivated', 'This account is deactivated.');

  const { data: authUser } = await admin.auth.admin.getUserById(profile.auth_user_id);
  const email = authUser.user?.email;
  if (!email) return fail(c, 403, 'no_profile', 'No sign-in email is linked to this account.');

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    throw new HTTPException(500, {
      message: linkError?.message ?? 'Could not create a session.',
      cause: 'otp_session',
    });
  }

  const { data: verified, error: verifyError } = await anonAuth().auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  if (verifyError || !verified.session) {
    throw new HTTPException(500, {
      message: verifyError?.message ?? 'Could not create a session.',
      cause: 'otp_session',
    });
  }

  return c.json(authSession(verified.session, profile as AuthProfile));
});

app.post('/auth/refresh', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { refreshToken?: unknown } | null;
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken : '';
  if (!refreshToken) return fail(c, 401, 'invalid_refresh', 'Sign in again.');

  const { data, error } = await anonAuth().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return fail(c, 401, 'invalid_refresh', 'Sign in again.');

  const profile = await authProfile(data.session.user.id);
  if (!profile) {
    return fail(c, 403, 'no_profile', 'No Gabfix profile is linked to this account.');
  }
  if (profile.status !== 'active') return fail(c, 403, 'deactivated', 'This account is deactivated.');
  return c.json(authSession(data.session, profile));
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

  const todayISO = kampalaDateISO(new Date());
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
  const earliestStart = Date.now() + LEAD_HOURS * 60 * 60 * 1000;
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
/** A service's current definition, else its category's (Section 14.4). */
async function effectiveFormDefinition(serviceId: string, categoryId: string) {
  const { data: serviceForm, error } = await admin
    .from('service_form_definitions')
    .select('id, service_id, category_id, version, schema, is_current')
    .eq('service_id', serviceId)
    .eq('is_current', true)
    .maybeSingle();
  if (error) throw new HTTPException(500, { message: error.message, cause: 'forms_read' });
  if (serviceForm) return serviceForm;

  const { data: categoryForm, error: categoryError } = await admin
    .from('service_form_definitions')
    .select('id, service_id, category_id, version, schema, is_current')
    .eq('category_id', categoryId)
    .eq('is_current', true)
    .maybeSingle();
  if (categoryError) throw new HTTPException(500, { message: categoryError.message, cause: 'forms_read' });
  return categoryForm ?? null;
}

// The client caches this per service and sends the id back with the booking.
app.get('/services/:slug/form', async (c) => {
  const { data: service, error } = await admin
    .from('services')
    .select('id, category_id')
    .eq('slug', c.req.param('slug'))
    .eq('active', true)
    .maybeSingle();
  if (error) throw new HTTPException(500, { message: error.message, cause: 'service_read' });
  if (!service) return fail(c, 404, 'not_found', 'That service is not available.');

  const definition = await effectiveFormDefinition(service.id, service.category_id);
  if (!definition) return c.json({ definition: null });

  return c.json({
    definition: {
      id: definition.id,
      version: definition.version,
      serviceId: definition.service_id ?? null,
      categoryId: definition.category_id ?? null,
      schema: definition.schema,
    },
  });
});

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

  const [form, { data: category }] = await Promise.all([
    effectiveFormDefinition(service.id, service.category_id),
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
      ? admin.from('services').select('id, category_id, slug, pricing_type, price, duration_minutes, required_skill_id, active').in('id', uuidRefs)
      : Promise.resolve({ data: [], error: null }),
    slugRefs.length
      ? admin.from('services').select('id, category_id, slug, pricing_type, price, duration_minutes, required_skill_id, active').in('slug', slugRefs)
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

  if (scheduledStart.getTime() < Date.now() + LEAD_HOURS * 60 * 60 * 1000) {
    return fail(
      c,
      409,
      'slot_unavailable',
      `Same-day bookings need at least ${LEAD_HOURS} hours' notice. Choose a later time.`,
    );
  }

  const capacity = await Promise.all(
    resolved.map((entry) => availableTechnicianCount(entry!.service, scheduledStart, scheduledEnd)),
  );
  if (capacity.some((count) => count < 1)) {
    return fail(c, 409, 'slot_unavailable', 'That time is no longer available. Choose another slot.');
  }

  const serviceIds = resolved.map((entry) => entry!.service.id);
  const categoryIds = [...new Set(resolved.map((entry) => entry!.service.category_id))];
  const [{ data: serviceForms, error: serviceFormsError }, { data: categoryForms, error: categoryFormsError }] =
    await Promise.all([
      admin
        .from('service_form_definitions')
        .select('id, service_id, category_id, version, schema, is_current')
        .eq('is_current', true)
        .in('service_id', serviceIds),
      admin
        .from('service_form_definitions')
        .select('id, service_id, category_id, version, schema, is_current')
        .eq('is_current', true)
        .in('category_id', categoryIds),
    ]);
  const formsError = serviceFormsError ?? categoryFormsError;
  if (formsError) throw new HTTPException(500, { message: formsError.message, cause: 'forms_read' });

  const serviceForm = new Map((serviceForms ?? []).map((form) => [form.service_id, form as FormDefinition]));
  const categoryForm = new Map((categoryForms ?? []).map((form) => [form.category_id, form as FormDefinition]));
  const formFor = (service: BookableService) =>
    serviceForm.get(service.id) ?? categoryForm.get(service.category_id) ?? null;

  // P1 version negotiation: validate against the definition the client showed,
  // but only while it is still the current one for this service or category.
  const requestedDefinitionId =
    typeof (body.form as { definitionId?: unknown } | undefined)?.definitionId === 'string'
      ? (body.form as { definitionId: string }).definitionId
      : '';
  const scope = body.scope as { answers?: Record<string, unknown> } | undefined;
  let negotiatedForm: FormDefinition | null = null;
  if (scope?.answers && requestedDefinitionId) {
    const { data: definition, error: definitionError } = await admin
      .from('service_form_definitions')
      .select('id, service_id, category_id, version, schema, is_current')
      .eq('id', requestedDefinitionId)
      .maybeSingle();
    if (definitionError) {
      throw new HTTPException(500, { message: definitionError.message, cause: 'forms_read' });
    }
    const applies =
      definition &&
      definition.is_current === true &&
      (serviceIds.includes(definition.service_id ?? '') ||
        categoryIds.includes(definition.category_id ?? ''));
    if (!applies) {
      return fail(
        c,
        409,
        'form_version_stale',
        'These questions changed. Go back and check your answers.',
      );
    }
    negotiatedForm = definition as FormDefinition;
  }

  if (scope?.answers) {
    for (const [index, entry] of resolved.entries()) {
      const definition = index === 0 && negotiatedForm ? negotiatedForm : formFor(entry!.service);
      if (!definition) continue;
      const answerError = formAnswerError(definition, scope.answers);
      if (answerError) return fail(c, 400, 'invalid_form_answers', answerError);
    }
  }

  const mediaItems = Array.isArray(body.media) ? (body.media as MediaInput[]) : [];
  const mediaError = mediaItems.length > 0 ? mediaInputError(mediaItems) : null;
  if (mediaError) return fail(c, 400, 'invalid_media', mediaError);

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

  const primaryService = resolved[0]!.service;
  const serverForm = negotiatedForm ?? formFor(primaryService);
  const bodyForm = body.form as Record<string, unknown> | undefined;
  if (serverForm && scope?.answers) {
    const { error: snapshotError } = await admin.from('booking_form_snapshots').insert({
      booking_id: booking.id,
      form_definition_id: serverForm.id,
      form_version: serverForm.version,
      questions: serverForm.schema ?? {},
      answers: scope.answers,
    });
    if (snapshotError) {
      await cleanup();
      throw new HTTPException(500, { message: snapshotError.message, cause: 'snapshot_insert' });
    }
  } else if (bodyForm && Array.isArray(bodyForm.questions) && bodyForm.answers && typeof bodyForm.answers === 'object') {
    const { error: snapshotError } = await admin.from('booking_form_snapshots').insert({
      booking_id: booking.id,
      form_definition_id: typeof bodyForm.definitionId === 'string' ? bodyForm.definitionId : null,
      form_version: Number(bodyForm.version ?? 1),
      questions: bodyForm.questions,
      answers: bodyForm.answers,
    });
    if (snapshotError) {
      await cleanup();
      throw new HTTPException(500, { message: snapshotError.message, cause: 'snapshot_insert' });
    }
  }

  let uploads: Record<string, unknown>[] | undefined;
  if (mediaItems.length > 0) {
    const issued = await createMediaTargets(booking.id, profile.id, mediaItems);
    if (issued.error) {
      await cleanup();
      throw new HTTPException(500, { message: issued.error, cause: 'media_target' });
    }
    uploads = issued.uploads;
  }

  const response = {
    bookingId: booking.id,
    ...(uploads ? { uploads } : {}),
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

// W3 media contract: issue targets, complete, refresh and delete booking media.
app.post('/bookings/:id/media/targets', async (c) => {
  const bookingId = c.req.param('id');
  const { profile } = await mediaBookingAccess(c, bookingId);
  const body = (await c.req.json().catch(() => null)) as { items?: unknown } | null;
  const items = Array.isArray(body?.items) ? (body!.items as MediaInput[]) : [];
  if (items.length === 0) return fail(c, 400, 'media_required', 'Attach at least one photo or video.');

  const error = mediaInputError(items);
  if (error) return fail(c, 400, 'invalid_media', error);

  const { data: existing, error: countError } = await admin
    .from('booking_media')
    .select('id')
    .eq('booking_id', bookingId);
  if (countError) throw new HTTPException(500, { message: countError.message, cause: 'media_read' });
  if ((existing?.length ?? 0) + items.length > MAX_MEDIA_ITEMS) {
    return fail(c, 400, 'invalid_media', `Add at most ${MAX_MEDIA_ITEMS} photos or videos.`);
  }

  const issued = await createMediaTargets(bookingId, profile.id, items);
  if (issued.error) throw new HTTPException(500, { message: issued.error, cause: 'media_target' });
  return c.json({ uploads: issued.uploads }, 201);
});

app.post('/bookings/:id/media/:mediaId/complete', async (c) => {
  const bookingId = c.req.param('id');
  await mediaBookingAccess(c, bookingId);
  const mediaId = c.req.param('mediaId');

  const { data: media, error } = await admin
    .from('booking_media')
    .select('id, booking_id, storage_path, status')
    .eq('id', mediaId)
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) throw new HTTPException(500, { message: error.message, cause: 'media_read' });
  if (!media) return fail(c, 404, 'not_found', 'That attachment was not found.');
  if (media.status === 'uploaded') return c.json({ media });

  const fileName = media.storage_path.split('/').pop() ?? '';
  const { data: objects, error: listError } = await admin.storage
    .from(MEDIA_BUCKET)
    .list(bookingId, { limit: 100 });
  if (listError) throw new HTTPException(500, { message: listError.message, cause: 'media_list' });
  if (!(objects ?? []).some((object) => object.name === fileName)) {
    return fail(c, 409, 'media_missing', 'The file has not reached storage yet. Retry the upload.');
  }

  const { data: updated, error: updateError } = await admin
    .from('booking_media')
    .update({ status: 'uploaded', uploaded_at: new Date().toISOString() })
    .eq('id', mediaId)
    .select('id, booking_id, storage_path, status, uploaded_at')
    .single();
  if (updateError) throw new HTTPException(500, { message: updateError.message, cause: 'media_update' });
  return c.json({ media: updated });
});

app.post('/bookings/:id/media/:mediaId/refresh', async (c) => {
  const bookingId = c.req.param('id');
  await mediaBookingAccess(c, bookingId);
  const mediaId = c.req.param('mediaId');

  const { data: media, error } = await admin
    .from('booking_media')
    .select('id, storage_path, status, mime_type')
    .eq('id', mediaId)
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) throw new HTTPException(500, { message: error.message, cause: 'media_read' });
  if (!media) return fail(c, 404, 'not_found', 'That attachment was not found.');
  if (media.status === 'uploaded') {
    return fail(c, 409, 'already_uploaded', 'That file is already uploaded.');
  }

  const { data, error: signError } = await admin.storage
    .from(MEDIA_BUCKET)
    .createSignedUploadUrl(media.storage_path);
  if (signError || !data) {
    throw new HTTPException(500, { message: signError?.message ?? 'Could not refresh the link.', cause: 'media_target' });
  }
  return c.json({
    upload: {
      mediaId: media.id,
      uploadUrl: absoluteStorageUrl(data.signedUrl),
      headers: { 'content-type': media.mime_type ?? 'application/octet-stream', 'x-upsert': 'false' },
      expiresAtISO: new Date(Date.now() + MEDIA_URL_TTL_SECONDS * 1000).toISOString(),
    },
  });
});

app.delete('/bookings/:id/media/:mediaId', async (c) => {
  const bookingId = c.req.param('id');
  await mediaBookingAccess(c, bookingId);
  const mediaId = c.req.param('mediaId');

  const { data: media, error } = await admin
    .from('booking_media')
    .select('id, storage_path')
    .eq('id', mediaId)
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (error) throw new HTTPException(500, { message: error.message, cause: 'media_read' });
  if (!media) return fail(c, 404, 'not_found', 'That attachment was not found.');

  await admin.storage.from(MEDIA_BUCKET).remove([media.storage_path]);
  const { error: deleteError } = await admin.from('booking_media').delete().eq('id', mediaId);
  if (deleteError) throw new HTTPException(500, { message: deleteError.message, cause: 'media_delete' });
  return c.json({ ok: true });
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
