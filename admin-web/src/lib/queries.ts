import type {
  Booking,
  BookingInstallment,
  BookingStatus,
  CashCollection,
  Cleaner,
  Customer,
  Payment,
  PaymentState,
} from '../types';
import { formatUGPhone } from './phone';
import { supabase } from './supabase';

/**
 * Live reads for the console. Shapes match `src/types.ts`, so pages did not change
 * when the mock arrays were replaced. Promos, the rate card and operations settings
 * stay local until those tables exist (see `src/data.ts`).
 */

const TZ = 'Africa/Kampala';

const timeLabel = (iso: string): string =>
  new Intl.DateTimeFormat('en-UG', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TZ,
  })
    .format(new Date(iso))
    .toLowerCase();

const dateLabel = (iso: string): string => iso.slice(0, 10);

const STATUS_MAP: Record<string, BookingStatus> = {
  requested: 'Pending',
  awaiting_confirmation: 'Pending',
  confirmed: 'Confirmed',
  scheduled: 'Confirmed',
  on_the_way: 'In progress',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const toneFor = (index: number): string =>
  ['#DDF1E5', '#FCEFC7', '#DDEDF7', '#F4E1DC', '#E8E1F5', '#E2EFE8'][index % 6];

const money = (value: number | string | null | undefined): number =>
  typeof value === 'string' ? Number(value) : (value ?? 0);

const methodLabel = (method: string | null, provider: string | null): Payment['method'] =>
  method === 'cash'
    ? 'Cash'
    : /airtel/i.test(provider ?? '')
      ? 'Airtel Money'
      : /visa|card/i.test(provider ?? '')
        ? 'Visa card'
        : 'MTN MoMo';

const statusLabel = (status: string): Payment['status'] =>
  status === 'paid'
    ? 'Received'
    : status === 'pending'
      ? 'Pending'
      : status === 'refunded'
        ? 'Refunded'
        : 'Failed';

/** Stored `kind` wins; rows written before the column existed fall back to amount vs total. */
const kindLabel = (
  status: string,
  kind: string | null,
  amount: number,
  total: number,
): Payment['kind'] =>
  status === 'refunded'
    ? 'Refund'
    : status === 'failed'
      ? 'Failed payment'
      : kind === 'balance'
        ? 'Balance'
        : kind === 'deposit'
          ? 'Deposit'
          : amount < total
            ? 'Deposit'
            : 'Balance';

export type ConsoleData = {
  bookings: Booking[];
  cleaners: Cleaner[];
  customers: Customer[];
  payments: Payment[];
  cash: CashCollection[];
};

/** Reference → booking UUID, so the desk can assign by the id shown in the UI. */
const bookingIds = new Map<string, string>();

export async function loadConsoleData(): Promise<ConsoleData> {
  const [bookingsRes, itemsRes, assignmentsRes, addressesRes, profilesRes, techRes, inspectionsRes, paymentsRes, handoversRes, disputesRes] =
    await Promise.all([
      supabase
        .from('bookings')
        .select(
          'id, reference, status, scheduled_start, scheduled_end, billed_hours, total_price, customer_id, address_id, technicians_needed, notes',
        )
        .order('scheduled_start', { ascending: false }),
      supabase.from('booking_items').select('booking_id, quantity, price, services(name)'),
      supabase.from('job_assignments').select('booking_id, technician_id, crew_role, status'),
      supabase.from('addresses').select('id, area, line1'),
      supabase.from('profiles').select('id, full_name, phone, role, status'),
      supabase.from('technician_profiles').select('user_id, display_name, active, priority_rating'),
      supabase
        .from('inspections')
        .select('booking_id, status, scheduled_at')
        .neq('status', 'withdrawn')
        .order('required_at', { ascending: false }),
      supabase.from('payments').select('id, booking_id, amount, method, status, provider, kind, paid_at, created_at'),
      supabase.from('cash_handovers').select('id, technician_id, amount, confirmed_at, created_at'),
      supabase.from('cash_disputes').select('id, technician_id, status, technician_note'),
    ]);

  const failure =
    bookingsRes.error ??
    itemsRes.error ??
    assignmentsRes.error ??
    addressesRes.error ??
    profilesRes.error ??
    techRes.error ??
    inspectionsRes.error ??
    paymentsRes.error ??
    handoversRes.error ??
    disputesRes.error;
  if (failure) throw new Error(failure.message);

  const bookings = bookingsRes.data ?? [];
  const items = itemsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const addresses = addressesRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const technicians = techRes.data ?? [];
  const inspectionRows = inspectionsRes.data ?? [];
  const paymentRows = paymentsRes.data ?? [];
  const handovers = handoversRes.data ?? [];
  const disputes = disputesRes.data ?? [];

  const profileById = new Map(profiles.map((row) => [row.id, row]));
  const areaById = new Map(addresses.map((row) => [row.id, row.area]));
  const techNameById = new Map(technicians.map((row) => [row.user_id, row.display_name]));

  // One inspection per booking matters here (the latest one that is still active).
  const inspectionByBooking = new Map<string, { status: string; scheduledAt: string | null }>();
  for (const row of inspectionRows) {
    if (!inspectionByBooking.has(row.booking_id)) {
      inspectionByBooking.set(row.booking_id, {
        status: row.status,
        scheduledAt: row.scheduled_at,
      });
    }
  }
  const serviceByBooking = new Map<string, string>();
  for (const item of items) {
    const name = (item.services as { name?: string } | null)?.name;
    if (name && !serviceByBooking.has(item.booking_id)) {
      serviceByBooking.set(item.booking_id, name);
    }
  }

  const installmentsByBooking = new Map<string, BookingInstallment[]>();
  const historyByBooking = new Map<string, BookingInstallment[]>();
  const totalPriceById = new Map(bookings.map((row) => [row.id, money(row.total_price)]));
  for (const row of paymentRows) {
    if (!row.booking_id) continue;
    const entry: BookingInstallment = {
      id: row.id,
      kind: kindLabel(row.status, row.kind, money(row.amount), totalPriceById.get(row.booking_id) ?? 0),
      amount: money(row.amount),
      method: methodLabel(row.method, row.provider),
      status: statusLabel(row.status),
      dateISO: dateLabel(row.paid_at ?? row.created_at),
    };
    const history = historyByBooking.get(row.booking_id) ?? [];
    history.push(entry);
    historyByBooking.set(row.booking_id, history);
    // Only money actually received counts as an installment.
    if (row.status !== 'paid') continue;
    const list = installmentsByBooking.get(row.booking_id) ?? [];
    list.push(entry);
    installmentsByBooking.set(row.booking_id, list);
  }
  for (const map of [installmentsByBooking, historyByBooking]) {
    for (const list of map.values()) list.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  }

  const paidByBooking = new Map<string, number>();
  const refundedByBooking = new Set<string>();
  const cashByTechnician = new Map<string, number>();
  const cashConfirmedByTechnician = new Map<string, string>();
  for (const payment of paymentRows) {
    // Laundry payments have no booking; they belong to the laundry ledger.
    if (!payment.booking_id) continue;
    if (payment.status === 'refunded') refundedByBooking.add(payment.booking_id);
    const amount = money(payment.amount);
    if (payment.status === 'paid') {
      paidByBooking.set(payment.booking_id, (paidByBooking.get(payment.booking_id) ?? 0) + amount);
    }
    if (payment.method === 'cash' && payment.status === 'paid') {
      // Cash is attributed to the technician who recorded it.
      const technicianId = assignments.find((row) => row.booking_id === payment.booking_id)?.technician_id;
      if (technicianId) {
        cashByTechnician.set(technicianId, (cashByTechnician.get(technicianId) ?? 0) + amount);
        const when = dateLabel(payment.paid_at ?? payment.created_at);
        const current = cashConfirmedByTechnician.get(technicianId);
        if (!current || when > current) cashConfirmedByTechnician.set(technicianId, when);
      }
    }
  }

  const handoverByTechnician = new Map<string, number>();
  for (const handover of handovers) {
    handoverByTechnician.set(
      handover.technician_id,
      (handoverByTechnician.get(handover.technician_id) ?? 0) + money(handover.amount),
    );
  }

  const openDisputeByTechnician = new Map<string, string>();
  for (const dispute of disputes) {
    if (dispute.status === 'open') {
      openDisputeByTechnician.set(
        dispute.technician_id,
        dispute.technician_note ?? 'Cash reported does not match the booking total.',
      );
    }
  }

  bookingIds.clear();
  const bookingRows: Booking[] = bookings.map((row) => {
    bookingIds.set(row.reference, row.id);
    const paid = paidByBooking.get(row.id) ?? 0;
    const total = money(row.total_price);
    let payment: PaymentState = 'Balance due';
    if (refundedByBooking.has(row.id)) payment = 'Refunded';
    else if (paid > 0 && paid >= total) payment = 'Paid';
    else if (paid > 0) payment = 'Deposit paid';

    const start = new Date(row.scheduled_start).getTime();
    const end = new Date(row.scheduled_end).getTime();
    const lead = assignments.find(
      (item) => item.booking_id === row.id && item.crew_role === 'lead' && item.status !== 'removed',
    );
    const customer = profileById.get(row.customer_id);

    return {
      id: row.reference,
      customerId: row.customer_id,
      customer: customer?.full_name ?? 'Customer',
      phone: customer?.phone ? formatUGPhone(customer.phone) : '',
      service: serviceByBooking.get(row.id) ?? 'Cleaning',
      area: (row.address_id ? areaById.get(row.address_id) : null) ?? 'Kampala',
      dateISO: dateLabel(row.scheduled_start),
      time: timeLabel(row.scheduled_start),
      hours: Number(row.billed_hours ?? Math.max(1, Math.round((end - start) / 3_600_000))),
      cleanerId: lead?.technician_id,
      crew: assignments
        .filter((item) => item.booking_id === row.id && item.status !== 'removed')
        .sort((a, b) => (a.crew_role === 'lead' ? -1 : b.crew_role === 'lead' ? 1 : 0))
        .map((item) => ({
          id: item.technician_id,
          name: techNameById.get(item.technician_id) ?? profileById.get(item.technician_id)?.full_name ?? 'Technician',
          role: item.crew_role === 'lead' ? ('Lead' as const) : ('Support' as const),
        })),
      inspection: inspectionByBooking.get(row.id),
      status: STATUS_MAP[row.status] ?? 'Pending',
      payment,
      total,
      paid,
      installments: installmentsByBooking.get(row.id) ?? [],
      paymentHistory: historyByBooking.get(row.id) ?? [],
      scope: {
        summary: `${row.technicians_needed} technician${row.technicians_needed === 1 ? '' : 's'} needed`,
        facts: row.notes ? [{ label: 'Notes', value: row.notes }] : undefined,
      },
    };
  });

  const jobsByTechnician = new Map<string, number>();
  for (const assignment of assignments) {
    if (assignment.status === 'removed') continue;
    jobsByTechnician.set(
      assignment.technician_id,
      (jobsByTechnician.get(assignment.technician_id) ?? 0) + 1,
    );
  }

  const cleanerRows: Cleaner[] = technicians.map((tech, index) => {
    const profile = profileById.get(tech.user_id);
    const cashTotal = cashByTechnician.get(tech.user_id) ?? 0;
    const handedOver = handoverByTechnician.get(tech.user_id) ?? 0;
    return {
      id: tech.user_id,
      name: tech.display_name,
      initials: tech.display_name
        .split(/\s+/)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      phone: profile?.phone ? formatUGPhone(profile.phone) : '',
      area: 'Kampala',
      rating: Number((3.8 + tech.priority_rating * 0.2).toFixed(1)),
      jobs: jobsByTechnician.get(tech.user_id) ?? 0,
      verified: tech.active,
      available: tech.active,
      languages: 'English, Luganda',
      tone: toneFor(index),
      cashDue: Math.max(cashTotal - handedOver, 0),
      cashConfirmedOn: cashConfirmedByTechnician.get(tech.user_id),
      cashRemitted: cashTotal - handedOver <= 0,
      cashDispute: openDisputeByTechnician.get(tech.user_id),
    };
  });

  const bookingsByCustomer = new Map<string, Booking[]>();
  for (const booking of bookingRows) {
    const list = bookingsByCustomer.get(booking.customerId) ?? [];
    list.push(booking);
    bookingsByCustomer.set(booking.customerId, list);
  }

  const customerRows: Customer[] = profiles
    .filter((row) => row.role === 'customer')
    .map((row) => {
      const list = bookingsByCustomer.get(row.id) ?? [];
      const spend = list.reduce((sum, booking) => sum + booking.paid, 0);
      const last = list
        .map((booking) => booking.dateISO)
        .sort()
        .at(-1);
      const status: Customer['status'] = list.length === 0 ? 'New' : 'Active';
      return {
        id: row.id,
        name: row.full_name,
        phone: row.phone ? formatUGPhone(row.phone) : '',
        email: `${row.full_name.toLowerCase().replace(/\s+/g, '.')}@gabfix.ug`,
        area: list[0]?.area ?? 'Kampala',
        segment: 'Residential' as const,
        bookings: list.length,
        spend,
        lastBooking: last ?? '—',
        status,
      };
    });

  const paymentList: Payment[] = paymentRows.map((row) => {
    const booking = bookings.find((item) => item.id === row.booking_id);
    return {
      id: row.id,
      bookingId: booking?.reference ?? '—',
      customer: profileById.get(booking?.customer_id ?? '')?.full_name ?? 'Customer',
      kind: kindLabel(row.status, row.kind, money(row.amount), money(booking?.total_price ?? 0)),
      method: methodLabel(row.method, row.provider),
      amount: money(row.amount),
      status: statusLabel(row.status),
      dateISO: dateLabel(row.paid_at ?? row.created_at),
    };
  });

  const cashRows: CashCollection[] = cleanerRows
    .filter((cleaner) => cleaner.cashDue > 0 || cleaner.cashConfirmedOn)
    .map((cleaner) => ({
      id: cleaner.id,
      cleanerId: cleaner.id,
      cleaner: cleaner.name,
      period: cleaner.cashConfirmedOn ? `Up to ${cleaner.cashConfirmedOn}` : 'This week',
      confirmedOn: cleaner.cashConfirmedOn ?? dateLabel(new Date().toISOString()),
      amountDue: cleaner.cashDue,
      remitted: cleaner.cashRemitted,
      dispute: cleaner.cashDispute,
    }));

  return {
    bookings: bookingRows,
    cleaners: cleanerRows,
    customers: customerRows,
    payments: paymentList,
    cash: cashRows,
  };
}

/** Desk assignment through the same RPC the technician app relies on. */
export async function assignTechnician(reference: string, technicianId: string): Promise<void> {
  const bookingId = bookingIds.get(reference);
  if (!bookingId) throw new Error('Reload the booking before assigning it.');

  const { data, error } = await supabase
    .from('job_assignments')
    .select('crew_role')
    .eq('booking_id', bookingId)
    .neq('status', 'removed')
    .limit(1);
  if (error) throw new Error(error.message);

  const crewRole = data?.[0]?.crew_role ?? 'lead';
  const { error: rpcError } = await supabase.rpc('assign_technician', {
    p_booking: bookingId,
    p_technician: technicianId,
    p_crew_role: crewRole,
  });
  if (rpcError) throw new Error(rpcError.message);
}

/**
 * Confirming a handover is the desk half of `record_cash_handover`. The insert
 * policy only covers the technician's own row, so the desk goes through the
 * `confirm_cash_handover` RPC, which also stamps who confirmed it.
 */
export async function confirmCashHandover(technicianId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const { error } = await supabase.rpc('confirm_cash_handover', {
    p_technician: technicianId,
    p_amount: amount,
  });
  if (error) throw new Error(error.message);
}
