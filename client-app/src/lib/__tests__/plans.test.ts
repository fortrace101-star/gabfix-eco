import { nextOccurrenceISO, recurringPlans } from '@/lib/plans';
import type { SavedBooking } from '@/store/bookings';

const plan = (overrides: Partial<SavedBooking> = {}): SavedBooking => ({
  id: 'GBX-PLAN',
  serviceSlug: 'home-clean',
  serviceName: 'Home cleaning',
  status: 'upcoming',
  createdAtISO: '2026-01-01T08:00:00.000Z',
  dateISO: '2026-01-02',
  startTime: '09:00',
  cleaners: 1,
  hours: 2,
  total: 45_000,
  paid: 45_000,
  balance: 0,
  rebook: {
    details: { cleaners: 1, hours: 2, frequency: 'weekly', materials: false },
    addOns: [],
  },
  ...overrides,
});

describe('nextOccurrenceISO', () => {
  it('steps weekly and monthly', () => {
    expect(nextOccurrenceISO('2026-01-02', 'weekly')).toBe('2026-01-09');
    expect(nextOccurrenceISO('2026-01-02', 'severalPerWeek')).toBe('2026-01-05');
    expect(nextOccurrenceISO('2026-01-31', 'monthly')).toBe('2026-02-28');
  });
});

describe('recurringPlans', () => {
  it('lists one card per plan and ignores the visit seeded by completion', () => {
    const plans = recurringPlans(
      [plan(), plan({ id: 'GBX-SEEDED', dateISO: '2026-01-09', seededFromId: 'GBX-PLAN' })],
      {},
    );
    expect(plans).toHaveLength(1);
    expect(plans[0].bookingId).toBe('GBX-PLAN');
  });
});
