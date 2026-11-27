/* eslint-disable @typescript-eslint/no-require-imports */
import { addBooking, getBookingById, syncBookingsFromServer, type SavedBooking } from '@/store/bookings';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/local-notifications', () => ({
  scheduleAssignmentReminder: jest.fn(async () => undefined),
  cancelAssignmentReminder: jest.fn(async () => undefined),
}));
jest.mock('@/lib/api/bookings', () => ({
  fetchMyBookings: jest.fn(),
}));

const { fetchMyBookings } = require('@/lib/api/bookings') as {
  fetchMyBookings: jest.Mock;
};

// One id per test: the store is a module singleton, so addBooking would skip a repeat.
const booking = (id: string, overrides: Partial<SavedBooking> = {}): SavedBooking => ({
  id,
  serviceSlug: 'home-cleaning',
  serviceName: 'Home cleaning',
  status: 'upcoming',
  createdAtISO: '2026-11-26T08:00:00.000Z',
  dateISO: '2026-11-27',
  startTime: '09:00',
  cleaners: 1,
  hours: 2,
  total: 120000,
  paid: 30000,
  balance: 90000,
  ...overrides,
});

const serverBooking = (
  reference: string,
  status: string,
  money: { paidTotal?: number; cashPaid?: number; cashPaidAt?: string | null } = {},
) => ({
  id: `uuid-${reference}`,
  reference,
  status,
  ...money,
  assignments: [
    { technicianId: 'tech-1', name: 'Daniel Cleaner', role: 'lead', status: 'accepted' },
  ],
});

beforeEach(() => {
  fetchMyBookings.mockReset();
});

describe('syncBookingsFromServer', () => {
  it('marks the customer booking completed when the cleaner completes it in the ERP', async () => {
    addBooking(booking('GBX-ERP1'));
    fetchMyBookings.mockResolvedValue([serverBooking('GBX-ERP1', 'completed')]);

    await syncBookingsFromServer();

    const synced = getBookingById('GBX-ERP1');
    expect(synced?.status).toBe('completed');
    expect(synced?.completedAtISO).toBeTruthy();
    // The ERP's crew still arrives with the same pull.
    expect(synced?.cleanerName).toBe('Daniel Cleaner');
  });

  it('replaces a stored booking UUID with the reference the app displays', async () => {
    const uuid = '7b0c1f2e-3a4d-4e5f-8a9b-0c1d2e3f4a5b';
    addBooking(booking(uuid));
    fetchMyBookings.mockResolvedValue([
      { ...serverBooking('GBX-ERP7', 'confirmed'), id: uuid },
    ]);

    await syncBookingsFromServer();

    expect(getBookingById('GBX-ERP7')?.status).toBe('upcoming');
    expect(getBookingById(uuid)).toBeUndefined();
  });

  it('leaves an upcoming booking upcoming while the job is still confirmed', async () => {
    addBooking(booking('GBX-ERP2'));
    fetchMyBookings.mockResolvedValue([serverBooking('GBX-ERP2', 'confirmed')]);

    await syncBookingsFromServer();

    expect(getBookingById('GBX-ERP2')?.status).toBe('upcoming');
  });

  it('keeps a completion the customer already had', async () => {
    addBooking(
      booking('GBX-ERP3', { status: 'completed', completedAtISO: '2026-11-25T17:00:00.000Z' }),
    );
    fetchMyBookings.mockResolvedValue([serverBooking('GBX-ERP3', 'completed')]);

    await syncBookingsFromServer();

    expect(getBookingById('GBX-ERP3')?.completedAtISO).toBe('2026-11-25T17:00:00.000Z');
  });

  it('records the cash the cleaner collected and settles the balance', async () => {
    addBooking(booking('GBX-ERP5', { paid: 0, balance: 120000, paymentMethod: 'cash' }));
    fetchMyBookings.mockResolvedValue([
      serverBooking('GBX-ERP5', 'completed', {
        paidTotal: 120000,
        cashPaid: 120000,
        cashPaidAt: '2026-11-26T16:30:00.000Z',
      }),
    ]);

    await syncBookingsFromServer();

    const synced = getBookingById('GBX-ERP5');
    expect(synced?.paid).toBe(120000);
    expect(synced?.balance).toBe(0);
    expect(synced?.cashPayment).toEqual({
      amount: 120000,
      atISO: '2026-11-26T16:30:00.000Z',
    });
  });

  it('never lowers a paid total this device already has', async () => {
    addBooking(booking('GBX-ERP6', { paid: 40000, balance: 80000 }));
    fetchMyBookings.mockResolvedValue([
      serverBooking('GBX-ERP6', 'confirmed', { paidTotal: 30000 }),
    ]);

    await syncBookingsFromServer();

    expect(getBookingById('GBX-ERP6')?.paid).toBe(40000);
    expect(getBookingById('GBX-ERP6')?.balance).toBe(80000);
  });

  it('keeps the local copy when the API is unreachable', async () => {
    addBooking(booking('GBX-ERP4'));
    fetchMyBookings.mockRejectedValue(new Error('offline'));

    await syncBookingsFromServer();

    expect(getBookingById('GBX-ERP4')?.status).toBe('upcoming');
  });
});
