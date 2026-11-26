import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { mock } from '@/config/mock';
import { fetchMyBookings } from '@/lib/api/bookings';
import { cancelAssignmentReminder } from '@/lib/local-notifications';
import { isRecurringFrequency, nextOccurrenceISO, toISODate } from '@/lib/plans';
import type {
  BookingDetails,
  BookingLocation,
  BookingMediaItem,
  BookingPayment,
  BookingScope,
} from '@/lib/pricing';
import { addNotification } from '@/store/notifications';

const STORAGE_KEY = 'gabfix.bookings.v1';

export type BookingStatus = 'upcoming' | 'completed' | 'cancelled';

export type SavedBooking = {
  id: string;
  serviceSlug: string;
  serviceName: string;
  status: BookingStatus;
  createdAtISO: string;
  /** Date of the service (YYYY-MM-DD) when known. */
  dateISO?: string;
  /** Start time (HH:mm) when known. */
  startTime?: string;
  area?: string;
  street?: string;
  propertyType?: string;
  cleaners: number;
  hours: number;
  total: number;
  paid: number;
  balance: number;
  paymentPlan?: string;
  paymentMethod?: string;
  phone?: string;
  contactName?: string;
  /** Assigned cleaner, once assignment exists (P18 “Book same cleaner”). */
  cleanerId?: string;
  cleanerName?: string;
  /** Mock assignment (S1 12.3): when the assignee should appear, and when they did. */
  assignAtISO?: string;
  assignedAtISO?: string;
  /** Pending local notification for the assignment, so it can be cancelled. */
  assignmentNotificationId?: string;
  /** S1 12.4: set when the job reaches the completed state. */
  completedAtISO?: string;
  /** The customer skipped the rating prompt; do not ask again. */
  ratingSkippedAtISO?: string;
  /** F6: this upcoming visit was booked by completing a recurring plan's previous visit. */
  seededFromId?: string;
  /** Job scope facts captured at booking time (Phase 2). */
  scope?: BookingScope;
  /** Local/finalized media attached to the job (Phase 2). */
  media?: BookingMediaItem[];
  /** P18: the choices needed to prefill a fresh draft from this booking. */
  rebook?: {
    details: BookingDetails;
    addOns: string[];
    scope?: BookingScope;
    media?: BookingMediaItem[];
    location?: BookingLocation;
    payment?: BookingPayment;
    promoCode?: string;
  };
  /** Set when the customer moved the booking to a new date/time. */
  rescheduledAtISO?: string;
  /** P13: an authorisation attempt failed; an unpaid hold is released after 30 minutes. */
  paymentFailedAtISO?: string;
  /** H10: a quote-mode service was submitted for pricing; nothing has been charged. */
  quoteRequestedAtISO?: string;
  /** Why the customer cancelled, captured on P16. */
  cancelReason?: string;
  cancelledAtISO?: string;
  /** Deposit refunded on cancellation (UGX). */
  refundAmount?: number;
  /** Late fee charged when cancelling within 24 hours (UGX). */
  lateFee?: number;
  /** P27b: the balance was settled in-app (not cash at the door). */
  balancePayment?: {
    amount: number;
    method: string;
    atISO: string;
  };
  /** Cash the cleaner recorded in the ERP and the desk's ledger accepted. */
  cashPayment?: {
    amount: number;
    atISO: string;
  };
  /** A deposit paid in-app before the visit (30% of a confirmed quote). */
  depositPayment?: {
    amount: number;
    method: string;
    atISO: string;
  };
  /** P27b: a cash late fee on the account was cleared with a digital method. */
  lateFeeSettledAtISO?: string;
  lateFeePaidMethod?: string;
  /** P27f: a digital tip sent after a completed clean. */
  tip?: {
    amount: number;
    method: string;
    atISO: string;
  };
};

type BookingsState = {
  bookings: SavedBooking[];
  hydrated: boolean;
};

let state: BookingsState = { bookings: [], hydrated: false };
const listeners = new Set<() => void>();

const getState = () => state;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const persist = (bookings: SavedBooking[]) => {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bookings)).catch(() => undefined);
};

const setBookings = (bookings: SavedBooking[]) => {
  state = { ...state, bookings };
  listeners.forEach((listener) => listener());
  persist(bookings);
};

/** Called once at boot from the root layout. */
export async function hydrateBookings(): Promise<void> {
  let bookings: SavedBooking[] = [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed)) {
      bookings = parsed.filter((item): item is SavedBooking => Boolean(item && (item as SavedBooking).id));
    }
  } catch {
    bookings = [];
  }
  state = { bookings, hydrated: true };
  listeners.forEach((listener) => listener());
  expireUnpaidBookings();
}

export function addBooking(booking: SavedBooking): void {
  if (state.bookings.some((item) => item.id === booking.id)) return;
  const assignAtISO =
    booking.assignAtISO ??
    (mock.assignment.enabled
      ? new Date(Date.parse(booking.createdAtISO) + mock.assignment.delayMs).toISOString()
      : undefined);
  setBookings([{ ...booking, assignAtISO }, ...state.bookings]);
}

export function getBookings(): SavedBooking[] {
  return state.bookings;
}

export function getBookingById(id: string): SavedBooking | undefined {
  return state.bookings.find((item) => item.id === id);
}

export function updateBooking(id: string, patch: Partial<Omit<SavedBooking, 'id'>>): void {
  if (!state.bookings.some((item) => item.id === id)) return;
  setBookings(state.bookings.map((item) => (item.id === id ? { ...item, ...patch } : item)));
}

/** P16 reschedule. The deposit stays; only the date/time move. */
export function rescheduleBooking(
  id: string,
  schedule: { dateISO: string; startTime: string },
): void {
  const booking = state.bookings.find((item) => item.id === id);
  void cancelAssignmentReminder(booking?.assignmentNotificationId);
  updateBooking(id, {
    ...schedule,
    rescheduledAtISO: new Date().toISOString(),
    assignmentNotificationId: undefined,
  });
}

const recurringBookingId = (): string => {
  const base = Number(String(Date.now()).slice(-5));
  for (let step = 0; step < 100; step += 1) {
    const id = `GBX-${String((base + step) % 100000).padStart(5, '0')}`;
    if (!state.bookings.some((item) => item.id === id)) return id;
  }
  return `GBX-${String(Date.now()).slice(-5)}`;
};

/**
 * F6: a completed recurring job books the next visit for the same person and plan, so Home's
 * next clean, the bookings list and the plan's next-visit date stay current without a server.
 * Idempotent: a date that is already booked is never seeded twice.
 */
function seedNextRecurringVisit(booking: SavedBooking, now: number): void {
  if (!mock.completion.enabled || !mock.completion.seedNextVisit) return;
  const frequency = booking.rebook?.details.frequency;
  if (!isRecurringFrequency(frequency) || !booking.dateISO) return;

  const todayISO = toISODate(new Date(now));
  let dateISO = booking.dateISO;
  for (let guard = 0; dateISO <= todayISO && guard < 500; guard += 1) {
    dateISO = nextOccurrenceISO(dateISO, frequency);
  }
  if (dateISO <= todayISO) return;

  const alreadyBooked = state.bookings.some(
    (item) =>
      item.status !== 'cancelled' &&
      item.serviceSlug === booking.serviceSlug &&
      item.dateISO === dateISO,
  );
  if (alreadyBooked) return;

  addBooking({
    id: recurringBookingId(),
    serviceSlug: booking.serviceSlug,
    serviceName: booking.serviceName,
    status: 'upcoming',
    createdAtISO: new Date(now).toISOString(),
    dateISO,
    startTime: booking.startTime,
    area: booking.area,
    street: booking.street,
    propertyType: booking.propertyType,
    cleaners: booking.cleaners,
    hours: booking.hours,
    total: booking.total,
    paid: 0,
    balance: booking.total,
    paymentPlan: booking.paymentPlan,
    paymentMethod: booking.paymentMethod,
    phone: booking.phone,
    contactName: booking.contactName,
    // A recurring plan keeps the same person (P17), so the visit starts assigned.
    cleanerId: booking.cleanerId,
    cleanerName: booking.cleanerName,
    assignedAtISO: booking.cleanerId ? new Date(now).toISOString() : undefined,
    scope: booking.scope,
    rebook: booking.rebook,
    seededFromId: booking.id,
  });
}

/** S1 12.4: mock completion. Notifies once and unlocks the optional rating. */
export function completeBooking(id: string, now: number = Date.now()): void {
  const booking = state.bookings.find((item) => item.id === id);
  if (!booking || booking.status !== 'upcoming') return;

  updateBooking(id, { status: 'completed', completedAtISO: new Date(now).toISOString() });
  seedNextRecurringVisit(booking, now);
  addNotification({
    id: `booking-review-${id}`,
    kind: 'booking',
    title: 'How did it go?',
    body: `${booking.serviceName} is complete. Rate the job and ${booking.cleanerName ?? 'your cleaner'} — both optional.`,
    createdAtISO: new Date().toISOString(),
    href: `/booking/${id}/rate`,
  });
}

/** The customer chose "Skip for now", so the rating prompt is not shown again. */
export function skipBookingRating(id: string): void {
  updateBooking(id, { ratingSkippedAtISO: new Date().toISOString() });
}

/**
 * Pulls dispatch's assignment and the job's server state for every booking saved
 * on this device, so the customer sees both even when they changed elsewhere.
 */
export async function syncBookingsFromServer(): Promise<void> {
  try {
    const server = await fetchMyBookings();
    if (server.length === 0) return;
    let changed = false;
    const next = state.bookings.map((booking) => {
      const match = server.find((item) => item.reference === booking.id);
      if (!match) return booking;
      const lead = match.assignments.find((assignment) => assignment.role === 'lead') ?? match.assignments[0];
      let updated = booking;

      if (lead && (booking.cleanerId !== lead.technicianId || booking.cleanerName !== lead.name)) {
        updated = { ...updated, cleanerId: lead.technicianId, cleanerName: lead.name };
      }

      // The cleaner's "Record cash" writes a cash payment on the server; the customer's
      // paid total and balance follow it so the wallet shows the cash as received.
      const paidTotal = match.paidTotal ?? 0;
      const cashPaid = match.cashPaid ?? 0;
      if (paidTotal > updated.paid) {
        updated = {
          ...updated,
          paid: paidTotal,
          balance: Math.max(booking.total - paidTotal, 0),
        };
      }
      if (cashPaid > 0 && cashPaid !== (booking.cashPayment?.amount ?? 0)) {
        updated = {
          ...updated,
          cashPayment: {
            amount: cashPaid,
            atISO: match.cashPaidAt ?? new Date().toISOString(),
          },
        };
      }

      if (updated !== booking) changed = true;
      return updated;
    });
    if (changed) setBookings(next);

    // The cleaner presses "Complete job" in the ERP, which writes the booking's
    // status on the server. Mirror it through the normal completion path so the
    // visit leaves Upcoming for Completed and the rating prompt appears.
    server
      .filter((item) => item.status === 'completed')
      .forEach((item) => {
        const local = state.bookings.find((booking) => booking.id === item.reference);
        if (local?.status === 'upcoming') completeBooking(local.id);
      });
  } catch {
    // Offline or no API: keep whatever assignment and status are already saved.
  }
}

/** A part-payment (deposit) against a confirmed booking. */
export function payBookingDeposit(id: string, amount: number, method: string): void {
  const booking = state.bookings.find((item) => item.id === id);
  if (!booking || booking.balance <= 0) return;
  const applied = Math.min(Math.max(amount, 0), booking.balance);
  if (applied <= 0) return;
  updateBooking(id, {
    paid: booking.paid + applied,
    balance: booking.balance - applied,
    paymentPlan: booking.paymentPlan ?? 'deposit',
    depositPayment: { amount: applied, method, atISO: new Date().toISOString() },
  });
}

/** P27b: pays the remaining balance of one booking from the wallet screen. */
export function payBookingBalance(id: string, method: string): void {
  const booking = state.bookings.find((item) => item.id === id);
  if (!booking || booking.balance <= 0) return;
  updateBooking(id, {
    paid: booking.paid + booking.balance,
    balance: 0,
    balancePayment: {
      amount: booking.balance,
      method,
      atISO: new Date().toISOString(),
    },
  });
}

/** P27f: records a digital tip against the completed booking. */
export function addBookingTip(id: string, amount: number, method: string): void {
  if (amount <= 0) return;
  updateBooking(id, {
    tip: { amount, method, atISO: new Date().toISOString() },
  });
}

/** P27b: clears late fees charged to the account (cancelled cash bookings). */
export function settleLateFees(ids: string[], method: string): void {
  if (ids.length === 0) return;
  const atISO = new Date().toISOString();
  setBookings(
    state.bookings.map((item) =>
      ids.includes(item.id)
        ? { ...item, lateFeeSettledAtISO: atISO, lateFeePaidMethod: method }
        : item,
    ),
  );
}

/** P13: records a failed authorisation so an unpaid booking can be released. */
export function markPaymentFailed(id: string): void {
  updateBooking(id, { paymentFailedAtISO: new Date().toISOString() });
}

/** How long an unpaid booking is held after a failed authorisation (Open item 25). */
export const PAYMENT_HOLD_MS = 30 * 60_000;

/**
 * P13 auto-cancel: an unpaid booking whose authorisation failed more than 30 minutes
 * ago is released, matching the provider callback rule. Called at boot and whenever
 * the bookings list is opened, so a hold cannot outlive the window.
 */
export function expireUnpaidBookings(now: number = Date.now()): number {
  const expired = state.bookings.filter(
    (booking) =>
      booking.status === 'upcoming' &&
      booking.paid === 0 &&
      booking.paymentFailedAtISO !== undefined &&
      now - Date.parse(booking.paymentFailedAtISO) >= PAYMENT_HOLD_MS,
  );
  if (expired.length === 0) return 0;

  const atISO = new Date(now).toISOString();
  setBookings(
    state.bookings.map((booking) =>
      expired.some((item) => item.id === booking.id)
        ? {
            ...booking,
            status: 'cancelled',
            cancelledAtISO: atISO,
            cancelReason: 'Payment not completed',
            refundAmount: 0,
            lateFee: 0,
          }
        : booking,
    ),
  );
  return expired.length;
}

/** P16 cancel. Records the reason and the local refund/late-fee outcome. */
export function cancelBooking(
  id: string,
  details: { reason: string; refundAmount: number; lateFee: number },
): void {
  const booking = state.bookings.find((item) => item.id === id);
  void cancelAssignmentReminder(booking?.assignmentNotificationId);
  updateBooking(id, {
    status: 'cancelled',
    cancelledAtISO: new Date().toISOString(),
    cancelReason: details.reason,
    refundAmount: details.refundAmount,
    lateFee: details.lateFee,
    assignmentNotificationId: undefined,
  });
}

export function useBookings(): SavedBooking[] {
  return useSyncExternalStore(subscribe, getState, getState).bookings;
}

export function useBookingsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getState, getState).hydrated;
}
