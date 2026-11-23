import type { SavedBooking } from '@/store/bookings';

export type TransactionKind = 'deposit' | 'balance' | 'cash' | 'refund';

export type WalletTransaction = {
  id: string;
  bookingId: string;
  serviceName: string;
  kind: TransactionKind;
  title: string;
  atISO: string;
  /** Payment method used, when known. */
  method?: string;
  amount: number;
  direction: 'in' | 'out';
  cashConfirmed?: boolean;
};

/** Bookings that still owe a balance after the deposit or full payment. */
export function balanceDueBookings(bookings: SavedBooking[]): SavedBooking[] {
  return bookings
    .filter((booking) => booking.status !== 'cancelled' && booking.balance > 0)
    .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));
}

export function totalBalanceDue(bookings: SavedBooking[]): number {
  return balanceDueBookings(bookings).reduce((sum, booking) => sum + booking.balance, 0);
}

/**
 * Late fees charged to the account: cancelled cash bookings where nothing was
 * paid in-app, so there was no refund to deduct the fee from.
 */
export function accountBalanceBookings(bookings: SavedBooking[]): SavedBooking[] {
  return bookings.filter(
    (booking) =>
      booking.status === 'cancelled' &&
      booking.paid <= 0 &&
      (booking.lateFee ?? 0) > 0 &&
      !booking.lateFeeSettledAtISO,
  );
}

export function totalAccountBalance(bookings: SavedBooking[]): number {
  return accountBalanceBookings(bookings).reduce(
    (sum, booking) => sum + (booking.lateFee ?? 0),
    0,
  );
}

const kindForPlan = (plan?: string): TransactionKind =>
  plan === 'deposit' ? 'deposit' : 'balance';

const titleForPlan = (booking: SavedBooking, kind: TransactionKind): string =>
  kind === 'deposit'
    ? `Deposit · ${booking.serviceName}`
    : kind === 'cash'
      ? `Cash · ${booking.serviceName}`
      : booking.paymentPlan === 'full_now'
        ? `Payment · ${booking.serviceName}`
        : `Balance · ${booking.serviceName}`;

/**
 * Builds the wallet ledger from the local booking records. There is no payments
 * API, so every row is a projection of a booking's paid, refund and late-fee
 * fields rather than a separate transaction store.
 */
export function walletTransactions(bookings: SavedBooking[]): WalletTransaction[] {
  const transactions: WalletTransaction[] = [];

  bookings.forEach((booking) => {
    const initial = Math.max((booking.paid ?? 0) - (booking.balancePayment?.amount ?? 0), 0);
    if (initial > 0) {
      const kind = booking.paymentMethod === 'cash' ? 'cash' : kindForPlan(booking.paymentPlan);
      transactions.push({
        id: `${booking.id}-initial`,
        bookingId: booking.id,
        serviceName: booking.serviceName,
        kind,
        title: titleForPlan(booking, kind),
        atISO: booking.createdAtISO,
        method: booking.paymentMethod,
        amount: initial,
        direction: 'out',
        cashConfirmed: kind === 'cash',
      });
    }

    if (booking.balancePayment && booking.balancePayment.amount > 0) {
      transactions.push({
        id: `${booking.id}-balance`,
        bookingId: booking.id,
        serviceName: booking.serviceName,
        kind: 'balance',
        title: `Balance · ${booking.serviceName}`,
        atISO: booking.balancePayment.atISO,
        method: booking.balancePayment.method,
        amount: booking.balancePayment.amount,
        direction: 'out',
      });
    }

    if ((booking.refundAmount ?? 0) > 0) {
      transactions.push({
        id: `${booking.id}-refund`,
        bookingId: booking.id,
        serviceName: booking.serviceName,
        kind: 'refund',
        title: `Refund · ${booking.serviceName}`,
        atISO: booking.cancelledAtISO ?? booking.createdAtISO,
        method: booking.paymentMethod,
        amount: booking.refundAmount ?? 0,
        direction: 'in',
      });
    }

    if (booking.lateFeeSettledAtISO && (booking.lateFee ?? 0) > 0) {
      transactions.push({
        id: `${booking.id}-late-fee`,
        bookingId: booking.id,
        serviceName: booking.serviceName,
        kind: 'balance',
        title: `Late fee · ${booking.serviceName}`,
        atISO: booking.lateFeeSettledAtISO,
        method: booking.lateFeePaidMethod,
        amount: booking.lateFee ?? 0,
        direction: 'out',
      });
    }
  });

  return transactions.sort((a, b) => b.atISO.localeCompare(a.atISO));
}

export type TransactionFilter = 'all' | 'deposits' | 'balances' | 'cash' | 'refunds';

export const transactionFilters: { id: TransactionFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'deposits', label: 'Deposits' },
  { id: 'balances', label: 'Balances' },
  { id: 'cash', label: 'Cash' },
  { id: 'refunds', label: 'Refunds' },
];

export type TransactionQuery = {
  text: string;
  kind: TransactionFilter;
  method: 'all' | 'mtn_momo' | 'airtel_money' | 'visa_card' | 'cash';
  period: 'all' | '7d' | '30d' | '90d' | 'month';
  direction: 'all' | 'in' | 'out';
  sort: 'newest' | 'oldest' | 'amount';
};

export const defaultTransactionQuery: TransactionQuery = {
  text: '',
  kind: 'all',
  method: 'all',
  period: 'all',
  direction: 'all',
  sort: 'newest',
};

const methodLabel = (method?: string): string => {
  if (method === 'mtn_momo') return 'MTN Mobile Money';
  if (method === 'airtel_money') return 'Airtel Money';
  if (method === 'visa_card') return 'Visa';
  if (method === 'cash') return 'Cash';
  return method ?? '';
};

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const periodStart = (period: TransactionQuery['period'], now: Date): number => {
  if (period === 'all') return 0;
  const base = new Date(now);
  if (period === 'month') {
    return new Date(base.getFullYear(), base.getMonth(), 1).getTime();
  }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  return base.getTime() - days * 24 * 60 * 60 * 1000;
};

const matchesText = (tx: WalletTransaction, raw: string): boolean => {
  const needle = raw.trim().toLowerCase();
  if (!needle) return true;
  const month = MONTH_NAMES[new Date(tx.atISO).getMonth()] ?? '';
  const haystack = [tx.serviceName, tx.bookingId, tx.title, methodLabel(tx.method), month]
    .join(' ')
    .toLowerCase();
  if (haystack.includes(needle)) return true;
  const digits = needle.replace(/\D/g, '');
  return digits.length > 0 && String(tx.amount).includes(digits);
};

export const queryTransactions = (
  all: WalletTransaction[],
  q: TransactionQuery,
  now: Date = new Date(),
): WalletTransaction[] => {
  let result = filterTransactions(all, q.kind);

  if (q.method !== 'all') {
    result = result.filter((tx) => tx.method === q.method);
  }

  if (q.period !== 'all') {
    const start = periodStart(q.period, now);
    result = result.filter((tx) => new Date(tx.atISO).getTime() >= start);
  }

  if (q.direction !== 'all') {
    result = result.filter((tx) => tx.direction === q.direction);
  }

  result = result.filter((tx) => matchesText(tx, q.text));

  const sorted = [...result];
  if (q.sort === 'oldest') {
    sorted.sort((a, b) => a.atISO.localeCompare(b.atISO));
  } else if (q.sort === 'amount') {
    sorted.sort((a, b) => b.amount - a.amount || b.atISO.localeCompare(a.atISO));
  } else {
    sorted.sort((a, b) => b.atISO.localeCompare(a.atISO));
  }

  return sorted;
};

export const activeFilterCount = (q: TransactionQuery): number => {
  let count = 0;
  if (q.method !== 'all') count += 1;
  if (q.period !== 'all') count += 1;
  if (q.direction !== 'all') count += 1;
  if (q.sort !== 'newest') count += 1;
  return count;
};

export const filterTransactions = (
  transactions: WalletTransaction[],
  filter: TransactionFilter,
): WalletTransaction[] => {
  if (filter === 'all') return transactions;
  if (filter === 'deposits') return transactions.filter((item) => item.kind === 'deposit');
  if (filter === 'balances') return transactions.filter((item) => item.kind === 'balance');
  if (filter === 'cash') return transactions.filter((item) => item.kind === 'cash');
  return transactions.filter((item) => item.kind === 'refund');
};
