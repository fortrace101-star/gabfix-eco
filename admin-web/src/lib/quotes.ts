import { supabase } from './supabase';

/**
 * Quotes and inspections for the desk (Workstream E2).
 *
 * Reads are allowed for the whole desk; writes follow the phase-2 RLS policies:
 * quotes and inspections are managed by manager/admin accounts, so the console
 * hides the editors from the support role.
 */

export type QuoteStatus =
  | 'requested'
  | 'inspection_required'
  | 'inspection_scheduled'
  | 'inspected'
  | 'quoted'
  | 'accepted'
  | 'declined'
  | 'expired';

export type InspectionStatus = 'required' | 'scheduled' | 'in_progress' | 'submitted' | 'withdrawn';

export type QuoteRow = {
  id: string;
  bookingId: string;
  description: string;
  amount: number | null;
  status: QuoteStatus;
  inspectionRequired: boolean;
  quotedAt: string | null;
  respondedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  preparedBy: string | null;
};

export type InspectionCheckItem = { label: string; status: 'ok' | 'issue' };

export type InspectionRow = {
  id: string;
  quoteId: string;
  bookingId: string;
  inspectorId: string | null;
  scheduledAt: string | null;
  submittedAt: string | null;
  status: InspectionStatus;
  requiredNote: string;
  notes: string;
  checklist: InspectionCheckItem[];
  measurements: Record<string, string>;
  recommendedHours: number | null;
  recommendedCrew: number | null;
  photos: InspectionPhoto[];
};

export type InspectionPhoto = {
  id: string;
  caption: string;
  url: string | null;
};

export type QuoteBooking = {
  id: string;
  reference: string;
  status: string;
  scheduledStart: string;
  total: number;
  customerName: string;
  phone: string;
  area: string;
  serviceName: string;
};

export type Inspector = { id: string; name: string };

export type QuoteQueue = {
  quotes: QuoteRow[];
  inspections: InspectionRow[];
  bookings: Record<string, QuoteBooking>;
  inspectors: Inspector[];
};

const numberOrNull = (value: number | string | null): number | null =>
  value === null ? null : typeof value === 'string' ? Number(value) : value;

export async function loadQuoteQueue(): Promise<QuoteQueue> {
  const [quotesRes, inspectionsRes, mediaRes, bookingsRes, itemsRes, addressesRes, profilesRes, techRes] =
    await Promise.all([
      supabase
        .from('quotes')
        .select(
          'id, booking_id, description, quoted_amount, status, inspection_required, quoted_at, responded_at, expires_at, created_at, prepared_by',
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('inspections')
        .select(
          'id, quote_id, booking_id, inspector_id, scheduled_at, submitted_at, status, required_note, notes, checklist, measurements, recommended_hours, recommended_crew',
        )
        .neq('status', 'withdrawn')
        .order('required_at', { ascending: false }),
      supabase
        .from('inspection_media')
        .select('id, inspection_id, storage_path, caption')
        .order('created_at', { ascending: true }),
      supabase
        .from('bookings')
        .select('id, reference, status, scheduled_start, total_price, customer_id, address_id'),
      supabase.from('booking_items').select('booking_id, quantity, services(name)'),
      supabase.from('addresses').select('id, area'),
      supabase.from('profiles').select('id, full_name, phone'),
      supabase.from('technician_profiles').select('user_id, display_name').eq('active', true),
    ]);

  const failure =
    quotesRes.error ??
    inspectionsRes.error ??
    mediaRes.error ??
    bookingsRes.error ??
    itemsRes.error ??
    addressesRes.error ??
    profilesRes.error ??
    techRes.error;
  if (failure) throw new Error(failure.message);

  const profileById = new Map((profilesRes.data ?? []).map((row) => [row.id, row]));
  const areaById = new Map((addressesRes.data ?? []).map((row) => [row.id, row.area]));
  const serviceByBooking = new Map<string, string>();
  for (const item of itemsRes.data ?? []) {
    const name = (item.services as { name?: string } | null)?.name;
    if (name && !serviceByBooking.has(item.booking_id)) {
      serviceByBooking.set(item.booking_id, name);
    }
  }

  // Sign every inspection photo once so the report can show what the inspector saw.
  const mediaRows = mediaRes.data ?? [];
  const signedByPath = new Map<string, string>();
  if (mediaRows.length) {
    const { data: signed } = await supabase.storage
      .from('inspection-media')
      .createSignedUrls(
        mediaRows.map((row) => row.storage_path),
        60 * 60,
      );
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl);
    }
  }
  const photosByInspection = new Map<string, InspectionPhoto[]>();
  for (const row of mediaRows) {
    const list = photosByInspection.get(row.inspection_id) ?? [];
    list.push({
      id: row.id,
      caption: row.caption ?? '',
      url: signedByPath.get(row.storage_path) ?? null,
    });
    photosByInspection.set(row.inspection_id, list);
  }

  const bookings: Record<string, QuoteBooking> = {};
  for (const booking of bookingsRes.data ?? []) {
    const customer = profileById.get(booking.customer_id);
    bookings[booking.id] = {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      scheduledStart: booking.scheduled_start,
      total: typeof booking.total_price === 'string' ? Number(booking.total_price) : (booking.total_price ?? 0),
      customerName: customer?.full_name ?? 'Customer',
      phone: customer?.phone ?? '',
      area: areaById.get(booking.address_id ?? '') ?? 'Kampala',
      serviceName: serviceByBooking.get(booking.id) ?? 'Service',
    };
  }

  return {
    quotes: (quotesRes.data ?? []).map((row) => ({
      id: row.id,
      bookingId: row.booking_id,
      description: row.description ?? '',
      amount: numberOrNull(row.quoted_amount),
      status: row.status,
      inspectionRequired: row.inspection_required,
      quotedAt: row.quoted_at,
      respondedAt: row.responded_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      preparedBy: row.prepared_by,
    })),
    inspections: (inspectionsRes.data ?? []).map((row) => ({
      id: row.id,
      quoteId: row.quote_id,
      bookingId: row.booking_id,
      inspectorId: row.inspector_id,
      scheduledAt: row.scheduled_at,
      submittedAt: row.submitted_at,
      status: row.status,
      requiredNote: row.required_note ?? '',
      notes: row.notes ?? '',
      checklist: Array.isArray(row.checklist)
        ? (row.checklist as InspectionCheckItem[]).filter(
            (item) => item && typeof item.label === 'string',
          )
        : [],
      measurements:
        row.measurements && typeof row.measurements === 'object' && !Array.isArray(row.measurements)
          ? (row.measurements as Record<string, string>)
          : {},
      recommendedHours: numberOrNull(row.recommended_hours),
      recommendedCrew: row.recommended_crew,
      photos: photosByInspection.get(row.id) ?? [],
    })),
    bookings,
    inspectors: (techRes.data ?? []).map((row) => ({
      id: row.user_id,
      name: row.display_name,
    })),
  };
}

const fail = (message: string): never => {
  throw new Error(message);
};

/** Sends a priced quote back to the customer and starts the expiry clock. */
export async function sendQuote(
  quoteId: string,
  input: { description: string; amount: number; expiresAt: string | null; preparedBy: string },
): Promise<void> {
  const { error } = await supabase
    .from('quotes')
    .update({
      description: input.description.trim() || null,
      quoted_amount: input.amount,
      quoted_at: new Date().toISOString(),
      expires_at: input.expiresAt,
      prepared_by: input.preparedBy,
      status: 'quoted',
    })
    .eq('id', quoteId);
  if (error) fail(error.message);
}

/** Opens an inspection for a quote that cannot be priced from the submission. */
export async function requestInspection(input: {
  quoteId: string;
  bookingId: string;
  note: string;
  requiredBy: string;
}): Promise<void> {
  const { error } = await supabase.from('inspections').insert({
    quote_id: input.quoteId,
    booking_id: input.bookingId,
    required_by: input.requiredBy,
    required_note: input.note.trim() || null,
    status: 'required',
  });
  if (error) fail(error.message);

  const { error: quoteError } = await supabase
    .from('quotes')
    .update({ inspection_required: true, status: 'inspection_required' })
    .eq('id', input.quoteId);
  if (quoteError) fail(quoteError.message);
}

/** Books an inspector and moves the quote to `inspection_scheduled`. */
export async function scheduleInspection(input: {
  inspectionId: string;
  quoteId: string;
  inspectorId: string;
  scheduledAt: string;
}): Promise<void> {
  const { error } = await supabase
    .from('inspections')
    .update({
      inspector_id: input.inspectorId,
      scheduled_at: input.scheduledAt,
      status: 'scheduled',
    })
    .eq('id', input.inspectionId);
  if (error) fail(error.message);

  const { error: quoteError } = await supabase
    .from('quotes')
    .update({ status: 'inspection_scheduled' })
    .eq('id', input.quoteId);
  if (quoteError) fail(quoteError.message);
}

/** Desk-side record of the customer's answer when it comes in by phone. */
export async function recordQuoteResponse(
  quoteId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  const { error } = await supabase
    .from('quotes')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', quoteId);
  if (error) fail(error.message);
}
