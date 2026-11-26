import { apiRequest } from './client';
import { hasApiBaseUrl } from '@/lib/config';

/**
 * Quote requests live on the server so the desk can price them. `POST /bookings`
 * creates the booking (status `requested`) and the database opens its `quotes`
 * row; `GET /quotes` reads back whatever state the desk has moved it to.
 */

export type ServerQuoteStatus =
  | 'requested'
  | 'inspection_required'
  | 'inspection_scheduled'
  | 'inspected'
  | 'quoted'
  | 'accepted'
  | 'declined'
  | 'expired';

export type QuoteCrewMember = {
  id: string;
  name: string;
  role: string;
  status: string;
};

export type ServerQuoteRequest = {
  quoteId: string;
  bookingId: string;
  reference: string;
  serviceName: string;
  serviceSlug: string | null;
  status: ServerQuoteStatus;
  amount: number | null;
  bookingTotal: number | null;
  /** Cleaners dispatch has assigned to the booking (empty until assignment). */
  crew: QuoteCrewMember[];
  description: string;
  inspectionStatus: string | null;
  inspectionAtISO: string | null;
  scheduledStartISO: string | null;
  expiresAtISO: string | null;
  createdAtISO: string;
  area: string | null;
  street: string | null;
};

type RawQuote = {
  id: string;
  booking_id: string;
  description: string | null;
  quoted_amount: number | string | null;
  status: ServerQuoteStatus;
  quoted_at: string | null;
  expires_at: string | null;
  created_at: string;
  bookingReference: string | null;
  bookingStatus?: string | null;
  scheduledStart: string | null;
  bookingTotal?: number | string | null;
  bookingAddress?: { line1?: string | null; area?: string | null } | null;
  serviceName: string | null;
  serviceSlug?: string | null;
  crew?: QuoteCrewMember[] | null;
  inspections: { status: string; scheduled_at: string | null }[] | null;
};

export type QuoteRequestInput = {
  serviceSlug: string;
  serviceName: string;
  details: string;
  propertyType: string;
  size: string;
  frequency: string;
  preferredDateISO: string;
  areaName: string;
  contactName: string;
  contactPhone: string;
};

const amountOf = (value: number | string | null): number | null =>
  value === null ? null : Number(value);

export async function fetchMyQuoteRequests(): Promise<ServerQuoteRequest[]> {
  if (!hasApiBaseUrl) return [];
  const { quotes } = await apiRequest<{ quotes: RawQuote[] }>('/quotes');
  return (quotes ?? []).map((quote) => {
    const inspection = quote.inspections?.[0] ?? null;
    return {
      quoteId: quote.id,
      bookingId: quote.booking_id,
      reference: quote.bookingReference ?? '—',
      serviceName: quote.serviceName ?? 'Cleaning',
      serviceSlug: quote.serviceSlug ?? null,
      status: quote.status,
      amount: amountOf(quote.quoted_amount),
      bookingTotal: amountOf(quote.bookingTotal ?? null),
      crew: quote.crew ?? [],
      description: quote.description ?? '',
      inspectionStatus: inspection?.status ?? null,
      inspectionAtISO: inspection?.scheduled_at ?? null,
      scheduledStartISO: quote.scheduledStart,
      expiresAtISO: quote.expires_at,
      createdAtISO: quote.created_at,
      area: quote.bookingAddress?.area ?? null,
      street: quote.bookingAddress?.line1 ?? null,
    };
  });
}

/**
 * The custom request screen has a preferred start date but no time slot, so it asks
 * for 9:00 am and the desk moves it while pricing. Everything the customer typed is
 * folded into the booking notes, which is what the desk reads as the quote request.
 */
export async function submitQuoteRequest(
  input: QuoteRequestInput,
): Promise<{ bookingId: string; reference: string }> {
  const summary = [
    input.details.trim(),
    `${input.propertyType} · ${input.size} · ${input.frequency}`,
    `Contact ${input.contactName.trim()} · ${input.contactPhone}`,
  ]
    .filter(Boolean)
    .join('\n');

  const response = await apiRequest<{
    bookingId: string;
    booking: { reference: string };
  }>('/bookings', {
    method: 'POST',
    idempotencyKey: `quote-${Date.now()}-${input.serviceSlug}`,
    body: {
      serviceSlug: input.serviceSlug,
      details: input.details,
      notes: summary,
      schedule: { dateISO: input.preferredDateISO, startTime: '09:00' },
      location: { street: input.areaName.trim(), area: input.areaName.trim() },
      clientTotal: 0,
    },
  });

  return { bookingId: response.bookingId, reference: response.booking.reference };
}

export type QuoteResponseBooking = {
  id: string;
  reference: string;
  status: string;
  total_price: number | string | null;
  scheduled_start: string | null;
  addresses: { line1?: string | null; area?: string | null } | null;
  booking_items: Array<{ services: { slug?: string; name?: string } | null }> | null;
};

export type RespondToQuoteResult = {
  quote: RawQuote & {
    bookingReference: string | null;
    bookingStatus: string | null;
    scheduledStart: string | null;
    serviceName: string | null;
  };
  booking: QuoteResponseBooking;
};

/** The customer accepts or declines a priced quote. Accepting confirms the booking. */
export async function respondToQuote(
  quoteId: string,
  action: 'accept' | 'decline',
): Promise<RespondToQuoteResult> {
  return apiRequest<RespondToQuoteResult>(`/quotes/${quoteId}/respond`, {
    method: 'POST',
    body: { action },
  });
}
