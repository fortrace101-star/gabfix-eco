import { cleaners, type Cleaner } from '@/config/cleaners';
import { mock } from '@/config/mock';
import { completeBooking, getBookings, updateBooking, type SavedBooking } from '@/store/bookings';
import { addNotification } from '@/store/notifications';

type AssignableBooking = Pick<SavedBooking, 'serviceSlug' | 'cleanerId'>;

/**
 * S1 12.3: keep the customer's preferred person (P18), otherwise pick the best-rated
 * roster member who handles the service. Ties break on id so the choice is deterministic.
 */
export function pickAssignee(
  booking: AssignableBooking,
  roster: readonly Cleaner[] = cleaners,
): Cleaner | undefined {
  if (booking.cleanerId) {
    const preferred = roster.find((cleaner) => cleaner.id === booking.cleanerId);
    if (preferred) return preferred;
  }
  const forService = roster.filter((cleaner) => cleaner.serviceSlugs.includes(booking.serviceSlug));
  const candidates = forService.length > 0 ? forService : roster;
  return [...candidates].sort(
    (a, b) => b.rating - a.rating || a.id.localeCompare(b.id),
  )[0];
}

const scheduleDay = (booking: SavedBooking): string => {
  if (!booking.dateISO) return 'your booked day';
  const [year, month, day] = booking.dateISO.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

/** Assigns every due booking once. Running it twice never double-notifies. */
export function processDueAssignments(now: number = Date.now()): SavedBooking[] {
  if (!mock.assignment.enabled) return [];

  const due = getBookings().filter(
    (booking) =>
      booking.status === 'upcoming' &&
      !booking.assignedAtISO &&
      booking.assignAtISO !== undefined &&
      Date.parse(booking.assignAtISO) <= now,
  );

  const assigned: SavedBooking[] = [];
  for (const booking of due) {
    const assignee = pickAssignee(booking);
    if (!assignee) continue;

    const role = assignee.kind === 'technician' ? 'technician' : 'cleaner';
    updateBooking(booking.id, {
      cleanerId: assignee.id,
      cleanerName: assignee.name,
      assignedAtISO: new Date(now).toISOString(),
    });
    addNotification({
      id: `booking-assigned-${booking.id}`,
      kind: 'booking',
      title: `Your ${role} is assigned`,
      body: `${assignee.name} will handle your ${booking.serviceName} on ${scheduleDay(booking)}.`,
      createdAtISO: new Date(now).toISOString(),
      href: `/booking/${booking.id}`,
    });
    assigned.push(booking);
  }
  return assigned;
}

const bookingEnd = (booking: SavedBooking): number | undefined => {
  if (!booking.dateISO || !booking.startTime) return undefined;
  const [year, month, day] = booking.dateISO.split('-').map(Number);
  const [hours, minutes] = booking.startTime.split(':').map(Number);
  if ([year, month, day, hours, minutes].some((part) => !Number.isFinite(part))) return undefined;
  return new Date(year, month - 1, day, hours, minutes).getTime() + booking.hours * 60 * 60 * 1000;
};

/** S1 12.4: completes an upcoming job once its scheduled end has passed. */
export function processDueCompletions(now: number = Date.now()): string[] {
  if (!mock.completion.enabled || !mock.completion.afterScheduleEnd) return [];

  const due = getBookings().filter((booking) => {
    if (booking.status !== 'upcoming') return false;
    const end = bookingEnd(booking);
    return end !== undefined && end <= now;
  });

  due.forEach((booking) => completeBooking(booking.id));
  return due.map((booking) => booking.id);
}

/** Assignments plus completions, called at boot and while the app is open. */
export function runMockBookingChecks(now: number = Date.now()): void {
  processDueAssignments(now);
  processDueCompletions(now);
}
