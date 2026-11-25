// Gabfix API contract + RLS tests.
//
// Runs against the local Supabase stack (supabase start + functions serve api).
//   cd backend && npm test
// or directly: node --test backend/tests/api-contract.test.mjs
//
// Every fixture is removed in `after`; seed rows (Alice, desk, GBX-* bookings)
// are never modified.

import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321').replace(/\/$/, '');
const API_URL = (process.env.GABFIX_API_URL ?? `${SUPABASE_URL}/functions/v1/api`).replace(/\/$/, '');
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const PASSWORD = process.env.GABFIX_SEED_PASSWORD ?? 'gabfix2026';
const SEED_ADDRESS = '33333333-3333-4333-8333-333333333333';
const FIXED_SERVICE = 'carpet-clean';

const state = {
  customerToken: '',
  customerProfileId: '',
  deskToken: '',
  otherToken: '',
  otherUserId: '',
  bookingId: '',
  mediaIds: [],
  receiptIds: [],
  notificationIds: [],
  supportMessageIds: [],
  supportConversationIds: [],
  otpPhones: [],
};

const json = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

async function api(path, { token, method = 'GET', body, key } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await json(response) };
}

async function rest(path, { token = SERVICE_KEY, method = 'GET', body, prefer } = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await json(response) };
}

async function signIn(email) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await json(response);
  assert.equal(response.status, 200, `sign-in failed for ${email}: ${JSON.stringify(data)}`);
  return { token: data.access_token, userId: data.user?.id ?? '' };
}

/** Next date at least two days out that falls on a seeded availability weekday. */
function bookableStart() {
  const now = new Date();
  for (let offset = 2; offset < 12; offset += 1) {
    const day = new Date(now.getTime() + offset * 86_400_000);
    const weekday = day.getUTCDay();
    if (weekday >= 1 && weekday <= 6) {
      return `${day.toISOString().slice(0, 10)}T10:00:00+03:00`;
    }
  }
  throw new Error('No bookable weekday found');
}

before(async () => {
  const health = await fetch(`${API_URL}/health`);
  assert.equal(health.status, 200, `API is not serving at ${API_URL}`);
  const customer = await signIn('customer@gabfix.ug');
  state.customerToken = customer.token;
  state.deskToken = (await signIn('desk@gabfix.ug')).token;

  const email = `contract-${Date.now()}@gabfix.test`;
  const created = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const user = await json(created);
  assert.equal(created.status, 200, `could not create the second customer: ${JSON.stringify(user)}`);
  state.otherUserId = user.id;
  state.otherToken = (await signIn(email)).token;

  const me = await api('/me', { token: state.customerToken });
  assert.equal(me.status, 200);
  state.customerProfileId = me.body.profile.id;
});

after(async () => {
  if (state.bookingId) {
    await rest(`/bookings?id=eq.${state.bookingId}`, { method: 'DELETE' });
  }
  if (state.receiptIds.length > 0) {
    await rest(`/receipts?id=in.(${state.receiptIds.join(',')})`, { method: 'DELETE' });
  }
  if (state.notificationIds.length > 0) {
    await rest(`/notifications?id=in.(${state.notificationIds.join(',')})`, { method: 'DELETE' });
  }
  if (state.supportMessageIds.length > 0) {
    await rest(`/support_messages?id=in.(${state.supportMessageIds.join(',')})`, { method: 'DELETE' });
  }
  if (state.supportConversationIds.length > 0) {
    await rest(`/support_conversations?id=in.(${state.supportConversationIds.join(',')})`, {
      method: 'DELETE',
    });
  }
  for (const prefix of state.mediaIds) {
    await fetch(`${SUPABASE_URL}/storage/v1/object/booking-media`, {
      method: 'DELETE',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [prefix] }),
    });
  }
  if (state.otherUserId) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${state.otherUserId}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
  }
  for (const phone of state.otpPhones) {
    const { body: profiles } = await rest(`/profiles?select=auth_user_id&phone=eq.${phone}`);
    for (const profile of profiles ?? []) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${profile.auth_user_id}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
    }
    await rest(`/phone_otp_codes?phone=eq.${phone}`, { method: 'DELETE' });
  }
});

test('health is public and /me needs a session', async () => {
  assert.deepEqual((await api('/health')).body, { ok: true, service: 'gabfix-api' });
  assert.equal((await api('/me')).status, 401);
  assert.equal((await api('/me', { token: 'not-a-token' })).status, 401);
});

test('auth: login accepts email or phone and rejects a wrong password', async () => {
  const byEmail = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'customer@gabfix.ug', password: PASSWORD },
  });
  assert.equal(byEmail.status, 200, JSON.stringify(byEmail.body));
  assert.ok(byEmail.body.accessToken);
  assert.ok(byEmail.body.refreshToken);
  assert.equal(byEmail.body.user.id, state.customerProfileId);
  assert.equal(byEmail.body.user.phone, '0700000008');

  const byPhone = await api('/auth/login', {
    method: 'POST',
    body: { identifier: '+256 700 000 008', password: PASSWORD },
  });
  assert.equal(byPhone.status, 200, JSON.stringify(byPhone.body));
  assert.equal(byPhone.body.user.id, state.customerProfileId);

  const wrong = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'customer@gabfix.ug', password: 'definitely-wrong' },
  });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error.code, 'invalid_credentials');

  assert.equal((await api('/auth/login', { method: 'POST', body: {} })).status, 400);
});

test('auth: register, OTP verify and refresh produce a session', async () => {
  const phone = `07${String(Date.now()).slice(-8)}`;
  state.otpPhones.push(phone);

  const registered = await api('/auth/register', {
    method: 'POST',
    body: { name: 'Auth Contract', phone, password: PASSWORD },
  });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));

  const duplicate = await api('/auth/register', {
    method: 'POST',
    body: { name: 'Auth Contract', phone, password: PASSWORD },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error.code, 'account_exists');

  const requested = await api('/auth/otp/request', { method: 'POST', body: { phone } });
  assert.equal(requested.status, 200, JSON.stringify(requested.body));
  assert.match(requested.body.debugCode ?? '', /^\d{6}$/, 'the local stack should echo the OTP code');

  const throttled = await api('/auth/otp/request', { method: 'POST', body: { phone } });
  assert.equal(throttled.status, 429);

  const wrongCode = await api('/auth/otp/verify', {
    method: 'POST',
    body: { phone, code: requested.body.debugCode === '000000' ? '000001' : '000000' },
  });
  assert.equal(wrongCode.status, 400);
  assert.equal(wrongCode.body.error.code, 'invalid_code');

  const verified = await api('/auth/otp/verify', {
    method: 'POST',
    body: { phone, code: requested.body.debugCode },
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  assert.ok(verified.body.accessToken);
  assert.equal(verified.body.user.phone, phone);

  const refreshed = await api('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: verified.body.refreshToken },
  });
  assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
  assert.ok(refreshed.body.accessToken);

  assert.equal((await api('/auth/refresh', { method: 'POST', body: { refreshToken: 'nope' } })).status, 401);

  // The code is single-use: replaying it is rejected.
  const replay = await api('/auth/otp/verify', {
    method: 'POST',
    body: { phone, code: requested.body.debugCode },
  });
  assert.equal(replay.status, 400);
});

test('booking media input is validated before any row is written', async () => {
  const base = {
    serviceSlug: FIXED_SERVICE,
    addressId: SEED_ADDRESS,
    scheduledStart: bookableStart(),
    clientTotal: 0,
  };
  const image = { clientId: 'a', kind: 'image', mimeType: 'image/jpeg', bytes: 1024 };

  const eleven = await api('/bookings', {
    token: state.customerToken,
    method: 'POST',
    body: { ...base, media: Array.from({ length: 11 }, (_, index) => ({ ...image, clientId: `m${index}` })) },
  });
  assert.equal(eleven.status, 400);
  assert.equal(eleven.body.error.code, 'invalid_media');

  const bigVideo = await api('/bookings', {
    token: state.customerToken,
    method: 'POST',
    body: {
      ...base,
      media: [{ clientId: 'v', kind: 'video', mimeType: 'video/mp4', bytes: 30 * 1024 * 1024, durationMs: 10_000 }],
    },
  });
  assert.equal(bigVideo.status, 400);
  assert.match(bigVideo.body.error.message, /25 MB/);

  const longVideo = await api('/bookings', {
    token: state.customerToken,
    method: 'POST',
    body: { ...base, media: [{ clientId: 'v', kind: 'video', mimeType: 'video/mp4', bytes: 1024, durationMs: 60_000 }] },
  });
  assert.equal(longVideo.status, 400);
  assert.match(longVideo.body.error.message, /30 seconds/);

  const gif = await api('/bookings', {
    token: state.customerToken,
    method: 'POST',
    body: { ...base, media: [{ clientId: 'g', kind: 'image', mimeType: 'image/gif', bytes: 1024 }] },
  });
  assert.equal(gif.status, 400);
  assert.equal(gif.body.error.code, 'invalid_media');

  const rows = await rest(`/booking_media?select=id&created_by=eq.${state.customerProfileId}`);
  assert.deepEqual(rows.body, [], 'a rejected request must not leave media rows behind');
});

test('form definitions resolve per service and a stale definition is rejected', async () => {
  const form = await api('/services/home-clean/form');
  assert.equal(form.status, 200, JSON.stringify(form.body));
  assert.equal(form.body.definition.schema.id, 'cleaning');
  assert.ok(form.body.definition.id);

  const stale = await api('/bookings', {
    token: state.customerToken,
    method: 'POST',
    body: {
      serviceSlug: 'home-clean',
      addressId: SEED_ADDRESS,
      scheduledStart: bookableStart(),
      clientTotal: 0,
      scope: { answers: { size: '1-2', condition: 'light' } },
      form: { definitionId: '00000000-0000-4000-8000-000000000000', version: 1 },
    },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'form_version_stale');
});

test('POST /bookings issues one signed target per attachment', async () => {
  const form = await api(`/services/${FIXED_SERVICE}/form`);
  const created = await api('/bookings', {
    token: state.customerToken,
    method: 'POST',
    key: `contract-${Date.now()}`,
    body: {
      serviceSlug: FIXED_SERVICE,
      addressId: SEED_ADDRESS,
      scheduledStart: bookableStart(),
      clientTotal: 0,
      scope: { answers: { sofas: 1, material: 'fabric' } },
      form: { definitionId: form.body.definition.id, version: form.body.definition.version },
      media: [
        { clientId: 'photo-1', kind: 'image', mimeType: 'image/jpeg', bytes: 1024 },
        { clientId: 'video-1', kind: 'video', mimeType: 'video/mp4', bytes: 2048, durationMs: 5_000 },
      ],
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.uploads.length, 2);
  assert.deepEqual(
    created.body.uploads.map((upload) => upload.clientId).sort(),
    ['photo-1', 'video-1'],
  );
  for (const upload of created.body.uploads) {
    assert.ok(upload.mediaId);
    assert.ok(upload.uploadUrl.startsWith('http'));
    assert.ok(upload.expiresAtISO);
  }
  state.bookingId = created.body.bookingId;

  const snapshots = await rest(
    `/booking_form_snapshots?select=form_definition_id,form_version&booking_id=eq.${state.bookingId}`,
  );
  assert.equal(snapshots.body.length, 1);
  assert.equal(snapshots.body[0].form_definition_id, form.body.definition.id);
  assert.equal(snapshots.body[0].form_version, form.body.definition.version);
});

test('signed upload completes, refresh refuses a finished file, delete removes it', async () => {
  const media = await rest(`/booking_media?select=id,storage_path,status&booking_id=eq.${state.bookingId}`);
  assert.equal(media.body.length, 2);
  state.mediaIds = media.body.map((row) => row.storage_path);

  const targets = await api(`/bookings/${state.bookingId}/media/targets`, {
    token: state.customerToken,
    method: 'POST',
    body: { items: [{ clientId: 'photo-2', kind: 'image', mimeType: 'image/png', bytes: 512 }] },
  });
  assert.equal(targets.status, 201, JSON.stringify(targets.body));
  const target = targets.body.uploads[0];
  state.mediaIds.push((await rest(`/booking_media?select=storage_path&id=eq.${target.mediaId}`)).body[0].storage_path);

  // The signed URL is the credential: no bearer token is attached here.
  const put = await fetch(target.uploadUrl, {
    method: 'PUT',
    headers: { ...target.headers, 'content-type': 'image/png' },
    body: Buffer.from('gabfix-contract-test'),
  });
  assert.ok(put.status >= 200 && put.status < 300, `PUT returned ${put.status}`);

  const complete = await api(`/bookings/${state.bookingId}/media/${target.mediaId}/complete`, {
    token: state.customerToken,
    method: 'POST',
  });
  assert.equal(complete.status, 200, JSON.stringify(complete.body));
  assert.equal(complete.body.media.status, 'uploaded');

  const refresh = await api(`/bookings/${state.bookingId}/media/${target.mediaId}/refresh`, {
    token: state.customerToken,
    method: 'POST',
  });
  assert.equal(refresh.status, 409);
  assert.equal(refresh.body.error.code, 'already_uploaded');

  const removed = await api(`/bookings/${state.bookingId}/media/${target.mediaId}`, {
    token: state.customerToken,
    method: 'DELETE',
  });
  assert.equal(removed.status, 200);
  const gone = await rest(`/booking_media?select=id&id=eq.${target.mediaId}`);
  assert.deepEqual(gone.body, []);
});

test('RLS: another customer cannot see the booking or its media', async () => {
  const asOwner = await rest(`/booking_media?select=id&booking_id=eq.${state.bookingId}`, {
    token: state.customerToken,
  });
  assert.equal(asOwner.body.length, 2);

  const asOther = await rest(`/booking_media?select=id&booking_id=eq.${state.bookingId}`, {
    token: state.otherToken,
  });
  assert.deepEqual(asOther.body, []);

  assert.equal((await api(`/bookings/${state.bookingId}`, { token: state.otherToken })).status, 404);
  assert.equal((await api(`/bookings/${state.bookingId}`, { token: state.deskToken })).status, 200);
});

test('RLS: receipts are desk-issued for the booking customer only', async () => {
  const receiptNumber = `CONTRACT-${Date.now()}`;
  const desk = await rest('/receipts', {
    token: state.deskToken,
    method: 'POST',
    prefer: 'return=representation',
    body: {
      booking_id: state.bookingId,
      number: receiptNumber,
      amount: 1000,
      issued_to: state.customerProfileId,
    },
  });
  assert.equal(desk.status, 201, JSON.stringify(desk.body));
  state.receiptIds.push(desk.body[0].id);

  const customer = await rest('/receipts', {
    token: state.customerToken,
    method: 'POST',
    prefer: 'return=representation',
    body: { booking_id: state.bookingId, number: `${receiptNumber}-C`, amount: 1000 },
  });
  assert.equal(customer.status, 403);

  const wrongTarget = await rest('/receipts', {
    token: state.deskToken,
    method: 'POST',
    prefer: 'return=representation',
    body: { booking_id: state.bookingId, number: `${receiptNumber}-W`, amount: 1000, issued_to: state.otherUserId },
  });
  assert.equal(wrongTarget.status, 403);

  const visible = await rest(`/receipts?select=id&booking_id=eq.${state.bookingId}`, {
    token: state.customerToken,
  });
  assert.deepEqual(visible.body.map((row) => row.id), state.receiptIds);
});

test('support: one conversation per customer and messages stay scoped', async () => {
  assert.equal((await api('/support/conversation')).status, 401);

  const first = await api('/support/conversation', { token: state.customerToken });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.conversation.customer_id, state.customerProfileId);

  const again = await api('/support/conversation', { token: state.customerToken });
  assert.equal(again.body.conversation.id, first.body.conversation.id, 'D13: one row per customer');
  state.supportConversationIds.push(first.body.conversation.id);

  const empty = await api('/support/messages', {
    token: state.customerToken,
    method: 'POST',
    body: { body: '   ' },
  });
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, 'message_required');

  const sent = await api('/support/messages', {
    token: state.customerToken,
    method: 'POST',
    body: { body: 'The gate code is 1234.', bookingId: state.bookingId },
  });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.equal(sent.body.message.sender_id, state.customerProfileId);
  state.supportMessageIds.push(sent.body.message.id);

  const thread = await api('/support/conversation', { token: state.customerToken });
  assert.ok(thread.body.messages.some((message) => message.id === sent.body.message.id));

  const other = await api('/support/conversation', { token: state.otherToken });
  assert.equal(other.status, 200);
  assert.notEqual(other.body.conversation.id, first.body.conversation.id);
  state.supportConversationIds.push(other.body.conversation.id);

  const peek = await rest(
    `/support_messages?select=id&conversation_id=eq.${first.body.conversation.id}`,
    { token: state.otherToken },
  );
  assert.deepEqual(peek.body, [], 'another customer must not read the thread');
});

test('quotes: only the booking customer and the desk can read a quote', async () => {
  assert.equal((await api('/quotes')).status, 401);

  const created = await rest('/quotes', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      booking_id: state.bookingId,
      requested_by: state.customerProfileId,
      description: 'Carpet deep clean',
      quoted_amount: 85_000,
      status: 'quoted',
      quoted_at: new Date().toISOString(),
    },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const quoteId = created.body[0].id;

  const customer = await api('/quotes', { token: state.customerToken });
  assert.equal(customer.status, 200, JSON.stringify(customer.body));
  assert.ok(customer.body.quotes.some((quote) => quote.id === quoteId));

  const desk = await api('/quotes', { token: state.deskToken });
  assert.ok(desk.body.quotes.some((quote) => quote.id === quoteId));

  const other = await api('/quotes', { token: state.otherToken });
  assert.ok(!other.body.quotes.some((quote) => quote.id === quoteId));
});

test('notifications: read and mark-read are scoped to the owner', async () => {
  assert.equal((await api('/notifications')).status, 401);

  const inserted = await rest('/notifications', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      user_id: state.customerProfileId,
      title: 'Contract notice',
      body: 'Your booking was confirmed.',
      type: 'booking',
    },
  });
  assert.equal(inserted.status, 201, JSON.stringify(inserted.body));
  const notificationId = inserted.body[0].id;
  state.notificationIds.push(notificationId);

  const mine = await api('/notifications', { token: state.customerToken });
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  assert.ok(mine.body.notifications.some((row) => row.id === notificationId));

  const theirs = await api('/notifications', { token: state.otherToken });
  assert.ok(!theirs.body.notifications.some((row) => row.id === notificationId));

  // RLS filters the row out, so another customer's mark-read changes nothing.
  const attempted = await api(`/notifications/${notificationId}/read`, {
    token: state.otherToken,
    method: 'PATCH',
  });
  assert.equal(attempted.status, 200);
  const untouched = await rest(`/notifications?select=read_at&id=eq.${notificationId}`);
  assert.equal(untouched.body[0].read_at, null);

  const marked = await api(`/notifications/${notificationId}/read`, {
    token: state.customerToken,
    method: 'PATCH',
  });
  assert.equal(marked.status, 200);
  const read = await rest(`/notifications?select=read_at&id=eq.${notificationId}`);
  assert.ok(read.body[0].read_at, 'the owner marks the notification read');
});
