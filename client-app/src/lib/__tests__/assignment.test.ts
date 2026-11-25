/* eslint-disable @typescript-eslint/no-require-imports */
import type { Cleaner } from '@/config/cleaners';
import { pickAssignee, processDueAssignments, processDueCompletions } from '@/lib/assignment';
import {
  addBooking,
  completeBooking,
  getBookingById,
  getBookings,
  updateBooking,
  type SavedBooking,
} from '@/store/bookings';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/local-notifications', () => ({
  scheduleAssignmentReminder: jest.fn(async () => undefined),
  cancelAssignmentReminder: jest.fn(async () => undefined),
}));
// The switches are off in the app now that the desk assigns crews; this suite is the
// regression test for the simulation code itself, so it turns them back on.
jest.mock('@/config/mock', () => ({
  mock: {
    assignment: { enabled: true, delayMs: 6 * 60_000 },
    completion: {
      enabled: true,
      afterScheduleEnd: true,
      devButton: false,
      seedNextVisit: true,
    },
  },
}));

const roster: Cleaner[] = [
  {
    id: 'b-cleaner',
    name: 'Bea Cleaner',
    initials: 'BC',
    kind: 'cleaner',
    rating: 4.8,
    jobsDone: 10,
    years: 2,
    languages: ['English'],
    skills: [],
    serviceSlugs: ['home-clean'],
    primaryServiceSlug: 'home-clean',
    reviewIds: [],
  },
  {
    id: 'a-cleaner',
    name: 'Ann Cleaner',
    initials: 'AC',
    kind: 'cleaner',
    rating: 4.8,
    jobsDone: 20,
    years: 3,
    languages: ['English'],
    skills: [],
    serviceSlugs: ['home-clean'],
    primaryServiceSlug: 'home-clean',
    reviewIds: [],
  },
  {
    id: 'tech',
    name: 'Tom Technician',
    initials: 'TT',
    kind: 'technician',
    rating: 5,
    jobsDone: 5,
    years: 9,
    languages: ['English'],
    skills: [],
    serviceSlugs: ['electrical-works'],
    primaryServiceSlug: 'electrical-works',
    reviewIds: [],
  },
];

const booking = (overrides: Partial<SavedBooking> = {}): SavedBooking => ({
  id: 'GBX-TEST',
  serviceSlug: 'home-clean',
  serviceName: 'Home cleaning',
  status: 'upcoming',
  createdAtISO: new Date('2026-01-01T08:00:00Z').toISOString(),
  dateISO: '2026-01-02',
  startTime: '09:00',
  cleaners: 1,
  hours: 2,
  total: 45_000,
  paid: 45_000,
  balance: 0,
  assignAtISO: new Date('2026-01-01T08:06:00Z').toISOString(),
  ...overrides,
});

describe('pickAssignee', () => {
  it('keeps the customer’s preferred cleaner', () => {
    const assignee = pickAssignee({ serviceSlug: 'home-clean', cleanerId: 'b-cleaner' }, roster);
    expect(assignee?.id).toBe('b-cleaner');
  });

  it('picks the best-rated roster member for the service, ties by id', () => {
    expect(pickAssignee({ serviceSlug: 'home-clean' }, roster)?.id).toBe('a-cleaner');
    expect(pickAssignee({ serviceSlug: 'electrical-works' }, roster)?.id).toBe('tech');
  });
});

describe('processDueAssignments', () => {
  it('assigns a due booking once and notifies only that first time', () => {
    addBooking(booking());
    const due = new Date('2026-01-01T08:07:00Z').getTime();

    expect(processDueAssignments(due)).toHaveLength(1);
    const assigned = getBookingById('GBX-TEST');
    // The real roster's best-rated home cleaner.
    expect(assigned?.cleanerName).toBe('Sarah Namukasa');
    expect(assigned?.assignedAtISO).toBeTruthy();

    expect(processDueAssignments(due + 60_000)).toHaveLength(0);
  });

  it('does not assign a cancelled booking', () => {
    addBooking(booking({ id: 'GBX-CANCELLED', status: 'cancelled' }));
    const due = new Date('2026-01-01T08:07:00Z').getTime();

    expect(processDueAssignments(due)).toHaveLength(0);
    expect(getBookingById('GBX-CANCELLED')?.assignedAtISO).toBeUndefined();
  });
});

describe('recurring next visit (F6)', () => {
  const weekly = (id: string, serviceSlug = 'home-clean'): SavedBooking =>
    booking({
      id,
      serviceSlug,
      cleanerId: 'a-cleaner',
      cleanerName: 'Ann Cleaner',
      assignedAtISO: '2026-01-02T08:00:00.000Z',
      rebook: {
        details: { cleaners: 1, hours: 2, frequency: 'weekly', materials: false },
        addOns: [],
      },
    });

  it('books the next weekly visit for the same cleaner on completion', () => {
    addBooking(weekly('GBX-WEEKLY'));
    completeBooking('GBX-WEEKLY', new Date('2026-01-02T12:00:00').getTime());

    const seeded = getBookings().find((item) => item.seededFromId === 'GBX-WEEKLY');
    expect(seeded?.status).toBe('upcoming');
    expect(seeded?.dateISO).toBe('2026-01-09');
    expect(seeded?.startTime).toBe('09:00');
    expect(seeded?.cleanerName).toBe('Ann Cleaner');
    expect(seeded?.paid).toBe(0);
    expect(seeded?.balance).toBe(45_000);
  });

  it('does not seed a one-off job', () => {
    addBooking(booking({ id: 'GBX-ONCE' }));
    completeBooking('GBX-ONCE', new Date('2026-01-02T12:00:00').getTime());

    expect(getBookings().some((item) => item.seededFromId === 'GBX-ONCE')).toBe(false);
  });

  it('does not seed a date that already has a booking for the service', () => {
    addBooking(weekly('GBX-WEEKLY-DUP', 'deep-clean'));
    // A visit already exists on the date the recurrence would land on.
    addBooking(booking({ id: 'GBX-EXISTING', serviceSlug: 'deep-clean', dateISO: '2026-01-09' }));

    completeBooking('GBX-WEEKLY-DUP', new Date('2026-01-02T12:00:00').getTime());

    expect(getBookings().some((item) => item.seededFromId === 'GBX-WEEKLY-DUP')).toBe(false);
    expect(
      getBookings().filter((item) => item.serviceSlug === 'deep-clean' && item.dateISO === '2026-01-09'),
    ).toHaveLength(1);
  });
});

describe('processDueCompletions', () => {
  it('completes a booking whose scheduled end has passed', () => {
    addBooking(booking({ id: 'GBX-PAST', dateISO: '2026-01-02', startTime: '09:00' }));
    const afterEnd = new Date('2026-01-02T12:00:00').getTime();

    expect(processDueCompletions(afterEnd)).toContain('GBX-PAST');
    expect(getBookingById('GBX-PAST')?.status).toBe('completed');
    expect(getBookingById('GBX-PAST')?.completedAtISO).toBeTruthy();
  });

  it('leaves a future booking upcoming', () => {
    addBooking(booking({ id: 'GBX-FUTURE', dateISO: '2026-06-01' }));
    updateBooking('GBX-FUTURE', { startTime: '09:00' });

    expect(
      processDueCompletions(new Date('2026-01-02T12:00:00').getTime()),
    ).not.toContain('GBX-FUTURE');
    expect(getBookingById('GBX-FUTURE')?.status).toBe('upcoming');
  });
});
