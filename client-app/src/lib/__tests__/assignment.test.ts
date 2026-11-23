/* eslint-disable @typescript-eslint/no-require-imports */
import type { Cleaner } from '@/config/cleaners';
import { pickAssignee, processDueAssignments, processDueCompletions } from '@/lib/assignment';
import { addBooking, getBookingById, updateBooking, type SavedBooking } from '@/store/bookings';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/local-notifications', () => ({
  scheduleAssignmentReminder: jest.fn(async () => undefined),
  cancelAssignmentReminder: jest.fn(async () => undefined),
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
