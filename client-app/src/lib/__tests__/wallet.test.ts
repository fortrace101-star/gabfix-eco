import {
  activeFilterCount,
  defaultTransactionQuery,
  queryTransactions,
  walletTransactions,
  type WalletTransaction,
} from '@/lib/wallet';
import type { SavedBooking } from '@/store/bookings';

const tx = (overrides: Partial<WalletTransaction>): WalletTransaction => ({
  id: 'tx-1',
  bookingId: 'GBX-001',
  serviceName: 'Home Cleaning',
  kind: 'deposit',
  title: 'Deposit · Home Cleaning',
  atISO: '2026-05-10T10:00:00.000Z',
  method: 'mtn_momo',
  amount: 45000,
  direction: 'out',
  ...overrides,
});

const all: WalletTransaction[] = [
  tx({ id: 'a', bookingId: 'GBX-001', serviceName: 'Home Cleaning', kind: 'deposit', method: 'mtn_momo', amount: 45000, direction: 'out', atISO: '2026-05-10T10:00:00.000Z' }),
  tx({ id: 'b', bookingId: 'GBX-002', serviceName: 'Office Cleaning', kind: 'balance', method: 'airtel_money', amount: 120000, direction: 'out', atISO: '2026-04-15T10:00:00.000Z' }),
  tx({ id: 'c', bookingId: 'GBX-003', serviceName: 'Sofa Cleaning', kind: 'cash', method: 'cash', amount: 80000, direction: 'out', atISO: '2026-05-01T10:00:00.000Z', cashConfirmed: true }),
  tx({ id: 'd', bookingId: 'GBX-004', serviceName: 'Deep Cleaning', kind: 'refund', method: 'visa_card', amount: 30000, direction: 'in', atISO: '2026-03-20T10:00:00.000Z' }),
];

const now = new Date('2026-05-12T12:00:00.000Z');

describe('queryTransactions', () => {
  it('filters by kind through the query kind field', () => {
    const result = queryTransactions(all, { ...defaultTransactionQuery, kind: 'deposits' }, now);
    expect(result.map((t) => t.id)).toEqual(['a']);
  });

  it('filters by method', () => {
    const result = queryTransactions(all, { ...defaultTransactionQuery, method: 'airtel_money' }, now);
    expect(result.map((t) => t.id)).toEqual(['b']);
  });

  it('filters by direction', () => {
    const result = queryTransactions(all, { ...defaultTransactionQuery, direction: 'in' }, now);
    expect(result.map((t) => t.id)).toEqual(['d']);
  });

  it('filters by period boundaries with a fixed now', () => {
    const last7 = queryTransactions(all, { ...defaultTransactionQuery, period: '7d' }, now);
    expect(last7.map((t) => t.id)).toEqual(['a']);

    const last30 = queryTransactions(all, { ...defaultTransactionQuery, period: '30d' }, now);
    expect(last30.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);

    const last90 = queryTransactions(all, { ...defaultTransactionQuery, period: '90d' }, now);
    expect(last90.map((t) => t.id).sort()).toEqual(['a', 'b', 'c', 'd']);

    const month = queryTransactions(all, { ...defaultTransactionQuery, period: 'month' }, now);
    expect(month.map((t) => t.id).sort()).toEqual(['a', 'c']);
  });

  it('matches text on service name, booking id, method label and amount digits', () => {
    expect(queryTransactions(all, { ...defaultTransactionQuery, text: 'sofa' }, now).map((t) => t.id)).toEqual(['c']);
    expect(queryTransactions(all, { ...defaultTransactionQuery, text: 'GBX-002' }, now).map((t) => t.id)).toEqual(['b']);
    expect(queryTransactions(all, { ...defaultTransactionQuery, text: 'Airtel' }, now).map((t) => t.id)).toEqual(['b']);
    expect(queryTransactions(all, { ...defaultTransactionQuery, text: '45000' }, now).map((t) => t.id)).toEqual(['a']);
    expect(queryTransactions(all, { ...defaultTransactionQuery, text: 'may' }, now).map((t) => t.id).sort()).toEqual(['a', 'c']);
  });

  it('sorts by newest, oldest and amount', () => {
    expect(queryTransactions(all, { ...defaultTransactionQuery, sort: 'newest' }, now).map((t) => t.id)).toEqual(['a', 'c', 'b', 'd']);
    expect(queryTransactions(all, { ...defaultTransactionQuery, sort: 'oldest' }, now).map((t) => t.id)).toEqual(['d', 'b', 'c', 'a']);
    expect(queryTransactions(all, { ...defaultTransactionQuery, sort: 'amount' }, now).map((t) => t.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('combines filters and returns an empty result when nothing matches', () => {
    const result = queryTransactions(
      all,
      { ...defaultTransactionQuery, kind: 'cash', method: 'cash', direction: 'out', text: 'sofa' },
      now,
    );
    expect(result.map((t) => t.id)).toEqual(['c']);

    const empty = queryTransactions(all, { ...defaultTransactionQuery, text: 'nope' }, now);
    expect(empty).toEqual([]);
  });
});

describe('activeFilterCount', () => {
  it('counts only non-default filter controls', () => {
    expect(activeFilterCount(defaultTransactionQuery)).toBe(0);
    expect(activeFilterCount({ ...defaultTransactionQuery, method: 'cash', period: '30d', direction: 'out', sort: 'amount' })).toBe(4);
    expect(activeFilterCount({ ...defaultTransactionQuery, kind: 'deposits', text: 'home' })).toBe(0);
  });
});

describe('walletTransactions', () => {
  const booking = (overrides: Partial<SavedBooking> = {}): SavedBooking => ({
    id: 'GBX-CASH',
    serviceSlug: 'home-cleaning',
    serviceName: 'Home cleaning',
    status: 'completed',
    createdAtISO: '2026-11-26T08:00:00.000Z',
    cleaners: 1,
    hours: 2,
    total: 120000,
    paid: 120000,
    balance: 0,
    paymentMethod: 'cash',
    ...overrides,
  });

  it('shows the cash the cleaner recorded as a confirmed cash row', () => {
    const rows = walletTransactions([
      booking({ cashPayment: { amount: 120000, atISO: '2026-11-26T16:30:00.000Z' } }),
    ]);

    const cash = rows.find((row) => row.id === 'GBX-CASH-cash');
    expect(cash).toMatchObject({
      kind: 'cash',
      method: 'cash',
      amount: 120000,
      cashConfirmed: true,
      atISO: '2026-11-26T16:30:00.000Z',
    });
    // The paid total is not counted twice as an extra initial payment.
    expect(rows.find((row) => row.id === 'GBX-CASH-initial')).toBeUndefined();
  });

  it('does not claim a cash confirmation before the cleaner records it', () => {
    const rows = walletTransactions([booking({ paid: 0, balance: 120000 })]) as WalletTransaction[];
    expect(rows).toHaveLength(0);

    const legacy = walletTransactions([booking({ paid: 30000, balance: 90000 })]);
    expect(legacy.find((row) => row.kind === 'cash')?.cashConfirmed).toBe(false);
  });
});
