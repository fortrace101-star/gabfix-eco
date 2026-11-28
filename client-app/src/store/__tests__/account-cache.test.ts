/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/local-notifications', () => ({
  scheduleAssignmentReminder: jest.fn(async () => undefined),
  cancelAssignmentReminder: jest.fn(async () => undefined),
}));
jest.mock('@/lib/api/bookings', () => ({
  fetchMyBookings: jest.fn(async () => []),
}));

type CacheModule = typeof import('@/lib/account-cache');
type StorageModule = typeof import('@react-native-async-storage/async-storage').default;
type BookingsModule = typeof import('@/store/bookings');

/** Fresh modules per test so the stores' in-memory state does not leak between cases. */
const load = async (): Promise<{
  storage: StorageModule;
  cache: CacheModule;
  bookings: BookingsModule;
}> => {
  jest.resetModules();
  // The package's jest mock is a CommonJS module object, not an ES default export.
  const storage = require('@react-native-async-storage/async-storage') as unknown as StorageModule;
  await storage.clear();
  const cache = require('@/lib/account-cache') as CacheModule;
  const bookings = require('@/store/bookings') as BookingsModule;
  return { storage, cache, bookings };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const booking = (id: string) => ({
  id,
  serviceSlug: 'home-cleaning',
  serviceName: 'Home cleaning',
  status: 'upcoming' as const,
  createdAtISO: '2026-11-26T08:00:00.000Z',
  cleaners: 1,
  hours: 2,
  total: 120000,
  paid: 0,
  balance: 120000,
});

describe('account cache', () => {
  it('keeps each account in its own cache object', async () => {
    const { cache } = await load();

    cache.setActiveAccountId('user-a');
    await cache.writeAccountCache('gabfix.bookings.v1', [{ id: 'GBX-A1' }]);

    cache.setActiveAccountId('user-b');
    expect(await cache.readAccountCache('gabfix.bookings.v1')).toBeNull();
    await cache.writeAccountCache('gabfix.bookings.v1', [{ id: 'GBX-B1' }]);

    cache.setActiveAccountId('user-a');
    expect(await cache.readAccountCache('gabfix.bookings.v1')).toEqual([{ id: 'GBX-A1' }]);
  });

  it('gives a new account an empty bookings store after a logout', async () => {
    const { cache, bookings } = await load();

    cache.setActiveAccountId('user-a');
    await bookings.hydrateBookings();
    bookings.addBooking(booking('GBX-A1'));
    await flush();

    // Sign out: the active account is dropped and in-memory stores reset.
    cache.setActiveAccountId(null);
    expect(bookings.getBookings()).toEqual([]);
    await bookings.hydrateBookings();
    expect(bookings.getBookings()).toEqual([]);

    // A different account starts with its own (empty) cache.
    cache.setActiveAccountId('user-b');
    await bookings.hydrateBookings();
    expect(bookings.getBookings()).toEqual([]);

    // The first account still finds exactly its own booking.
    cache.setActiveAccountId('user-a');
    await bookings.hydrateBookings();
    expect(bookings.getBookings().map((item) => item.id)).toEqual(['GBX-A1']);
  });

  it('migrates the pre-account cache into the signed-in account', async () => {
    const { storage, cache } = await load();
    await storage.setItem('gabfix.bookings.v1', JSON.stringify([{ id: 'GBX-OLD1' }]));
    await storage.setItem('gabfix.booking.draft.v1', JSON.stringify({ serviceSlug: 'deep-clean' }));
    await storage.setItem('gabfix.notifications.v1', JSON.stringify([{ id: 'n1' }]));

    cache.setActiveAccountId('user-a');
    await cache.migrateLegacyAccountCache();

    expect(await cache.readAccountCache('gabfix.bookings.v1')).toEqual([{ id: 'GBX-OLD1' }]);
    expect(await cache.readAccountCache('gabfix.booking.draft.v2')).toEqual({
      serviceSlug: 'deep-clean',
    });
    expect(await cache.readAccountCache('gabfix.notifications.v1')).toEqual([{ id: 'n1' }]);
    // The unscoped keys are gone, so another account cannot inherit them.
    expect(await storage.getItem('gabfix.bookings.v1')).toBeNull();
    expect(await storage.getItem('gabfix.booking.draft.v1')).toBeNull();
    expect(await storage.getItem('gabfix.notifications.v1')).toBeNull();
  });

  it('never overwrites an account object with the older unscoped copy', async () => {
    const { storage, cache } = await load();
    await storage.setItem('gabfix.bookings.v1', JSON.stringify([{ id: 'GBX-OLD1' }]));
    await storage.setItem('gabfix.bookings.v1::user-a', JSON.stringify([{ id: 'GBX-NEW1' }]));

    cache.setActiveAccountId('user-a');
    await cache.migrateLegacyAccountCache();

    expect(await cache.readAccountCache('gabfix.bookings.v1')).toEqual([{ id: 'GBX-NEW1' }]);
    expect(await storage.getItem('gabfix.bookings.v1')).toBeNull();
  });

  it('keeps the newest legacy draft version when both exist', async () => {
    const { storage, cache } = await load();
    await storage.setItem('gabfix.booking.draft.v1', JSON.stringify({ serviceSlug: 'old-version' }));
    await storage.setItem('gabfix.booking.draft.v2', JSON.stringify({ serviceSlug: 'new-version' }));

    cache.setActiveAccountId('user-a');
    await cache.migrateLegacyAccountCache();

    expect(await cache.readAccountCache('gabfix.booking.draft.v2')).toEqual({
      serviceSlug: 'new-version',
    });
  });

  it('leaves device-level keys global', async () => {
    const { storage, cache } = await load();
    await storage.setItem('gabfix.session.v1', '{"accessToken":"t"}');
    await storage.setItem('gabfix.device-id.v1', 'device-1');

    cache.setActiveAccountId('user-a');
    await cache.migrateLegacyAccountCache();
    cache.setActiveAccountId('user-b');

    expect(await storage.getItem('gabfix.session.v1')).not.toBeNull();
    expect(await storage.getItem('gabfix.device-id.v1')).toBe('device-1');
  });

  it('does nothing without an active account', async () => {
    const { storage, cache } = await load();
    await storage.setItem('gabfix.bookings.v1', JSON.stringify([{ id: 'GBX-OLD1' }]));

    await cache.migrateLegacyAccountCache(null);

    expect(await storage.getItem('gabfix.bookings.v1')).not.toBeNull();
  });
});
