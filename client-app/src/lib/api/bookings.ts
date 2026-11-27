import { newBookingReference } from '@/lib/booking-reference';
import { price, type BookingDraft, type PriceBreakdown } from '@/lib/pricing';
import { hasApiBaseUrl } from '@/lib/config';

import { apiRequest } from './client';

export type UploadTarget = {
  /** BookingMedia.id from the draft. */
  clientId: string;
  /** Server id used when the upload completes. */
  mediaId: string;
  /** Pre-signed one-file URL; the URL itself is the credential. */
  uploadUrl: string;
  headers?: Record<string, string>;
  expiresAtISO: string;
};

export type BookingResult = {
  /** The human-readable reference the app shows, e.g. GBX-7K2M9Q4T1B. */
  bookingId: string;
  priceBreakdown: PriceBreakdown;
  /** Present when the backend accepted media metadata and issued targets. */
  uploads?: UploadTarget[];
  /** The server's booking row; `reference` is what the customer sees. */
  booking?: { id: string; reference: string };
};

export type ServerBookingAssignment = {
  technicianId: string;
  name: string;
  role: string;
  status: string;
};

export type ServerBooking = {
  id: string;
  reference: string;
  status: string;
  /** Settled payments recorded by the desk, the cleaner or this app. */
  paidTotal?: number;
  /** The part of `paidTotal` the cleaner collected in cash. */
  cashPaid?: number;
  cashPaidAt?: string | null;
  assignments: ServerBookingAssignment[];
};

/**
 * The customer's bookings as the desk sees them: dispatch assignments and the money
 * already collected, so cash the cleaner records shows up on this device too.
 */
export async function fetchMyBookings(): Promise<ServerBooking[]> {
  if (!hasApiBaseUrl) return [];
  const { bookings } = await apiRequest<{ bookings: ServerBooking[] }>('/bookings');
  return bookings ?? [];
}

export type RecordedBookingPayment = {
  id: string;
  amount: number;
  method: string;
  provider: string;
  paidAt: string;
  kind: 'deposit' | 'balance';
  paid: number;
  balance: number;
};

/**
 * Registers a deposit or balance payment so the desk ledger shows it. Returns null
 * when the device is offline or the API is not configured; the caller decides
 * whether to treat the payment as unsettled.
 */
export async function recordBookingPayment(
  reference: string,
  input: { amount: number; method: string; kind: 'deposit' | 'balance' },
): Promise<RecordedBookingPayment | null> {
  if (!hasApiBaseUrl) return null;
  try {
    const { payment } = await apiRequest<{ payment: RecordedBookingPayment }>(
      `/bookings/${encodeURIComponent(reference)}/payments`,
      {
        method: 'POST',
        idempotencyKey: `payment-${reference}-${input.kind}-${input.amount}-${Date.now()}`,
        body: input,
      },
    );
    return payment;
  } catch {
    return null;
  }
}

const localBookingId = (): string => newBookingReference();

/**
 * `POST /bookings` with a local fallback until the endpoint is available. The
 * request mirrors the draft so the backend can price the booking again and
 * return its own breakdown (P12 submit sequence, step 2).
 */
export async function createBooking(draft: BookingDraft, total: number): Promise<BookingResult> {
  if (!hasApiBaseUrl) {
    return { bookingId: localBookingId(), priceBreakdown: price(draft) };
  }

  const result = await apiRequest<BookingResult>('/bookings', {
    method: 'POST',
    idempotencyKey: `booking-${Date.now()}-${draft.serviceSlug}`,
    body: {
      serviceSlug: draft.serviceSlug,
      details: draft.details,
      addOns: draft.addOns,
      schedule: draft.schedule,
      location: draft.location,
      payment: draft.payment,
      promoCode: draft.promoCode,
      scope: draft.scope,
      // The definition the answers were entered against (P1 version negotiation).
      form: draft.scope?.formDefinitionId
        ? { definitionId: draft.scope.formDefinitionId, version: draft.scope.schemaVersion }
        : undefined,
      media: (draft.media?.items ?? []).map(({ id, kind, mimeType, sizeBytes, width, height, durationSec }) => ({
        clientId: id,
        kind,
        mimeType,
        bytes: sizeBytes,
        width,
        height,
        durationMs: durationSec ? durationSec * 1000 : undefined,
      })),
      clientTotal: total,
    },
  });

  // Older API builds returned the desk UUID as `bookingId`; always show the reference.
  return result.booking?.reference
    ? { ...result, bookingId: result.booking.reference }
    : result;
}
