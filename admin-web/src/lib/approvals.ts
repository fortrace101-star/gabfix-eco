import { supabase } from './supabase';

/**
 * Manager decisions (E3): staff-created bookings waiting for confirmation, and
 * cancellation requests raised by customer relations or sales. Both go through
 * security-definer RPCs so the booking status history keeps the trail — a direct
 * `bookings` update would skip it.
 */

export type PendingBooking = {
  id: string;
  reference: string;
  status: string;
  source: string;
  scheduledStart: string;
  total: number;
  createdAt: string;
  customerName: string;
  phone: string;
  area: string;
  serviceName: string;
  note: string;
};

export type CancellationRequest = {
  id: string;
  bookingId: string;
  reason: string;
  createdAt: string;
  requestedBy: string | null;
  bookingReference: string;
  bookingStatus: string;
  scheduledStart: string;
  total: number;
  customerName: string;
  phone: string;
  area: string;
  serviceName: string;
};

export type AssignableTechnician = {
  id: string;
  name: string;
  role: string;
};

export type ApprovalsQueue = {
  bookings: PendingBooking[];
  cancellations: CancellationRequest[];
  requesterNames: Record<string, string>;
  technicians: AssignableTechnician[];
};

type BookingShape = {
  id: string;
  reference: string;
  status: string;
  source?: string;
  scheduled_start: string;
  total_price: number | string | null;
  created_at?: string;
  customer_name: string | null;
  customer_phone: string | null;
  notes?: string | null;
  addresses: { area: string | null } | null;
  booking_items: { quantity: number; services: { name: string } | null }[];
};

const money = (value: number | string | null): number =>
  value === null ? 0 : typeof value === 'string' ? Number(value) : value;

const firstService = (booking: BookingShape): string =>
  booking.booking_items.find((line) => line.services?.name)?.services?.name ?? 'Service';

const fail = (message: string): never => {
  throw new Error(message);
};

export async function loadApprovalsQueue(): Promise<ApprovalsQueue> {
  const [pendingRes, requestsRes, profilesRes, techniciansRes] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id, reference, status, source, scheduled_start, total_price, created_at, customer_name, customer_phone, notes, addresses(area), booking_items(quantity, services(name))',
      )
      .in('source', ['staff', 'sales'])
      .in('status', ['requested', 'awaiting_confirmation'])
      .order('created_at', { ascending: true }),
    supabase
      .from('cancellation_requests')
      .select(
        'id, booking_id, reason, created_at, requested_by, bookings!inner(id, reference, status, scheduled_start, total_price, customer_name, customer_phone, addresses(area), booking_items(quantity, services(name)))',
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, full_name'),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('role', 'technician')
      .eq('status', 'active')
      .order('full_name'),
  ]);

  const failure = pendingRes.error ?? requestsRes.error ?? profilesRes.error ?? techniciansRes.error;
  if (failure) throw new Error(failure.message);

  const requesterNames: Record<string, string> = {};
  for (const profile of profilesRes.data ?? []) {
    requesterNames[profile.id] = profile.full_name;
  }

  const bookings: PendingBooking[] = (pendingRes.data ?? []).map((row) => {
    const booking = row as unknown as BookingShape;
    return {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      source: booking.source ?? 'staff',
      scheduledStart: booking.scheduled_start,
      total: money(booking.total_price),
      createdAt: booking.created_at ?? '',
      customerName: booking.customer_name ?? 'Customer',
      phone: booking.customer_phone ?? '',
      area: booking.addresses?.area ?? 'Kampala',
      serviceName: firstService(booking),
      note: booking.notes ?? '',
    };
  });

  const cancellations: CancellationRequest[] = (requestsRes.data ?? []).map((row) => {
    const booking = row.bookings as unknown as BookingShape;
    return {
      id: row.id,
      bookingId: row.booking_id,
      reason: row.reason,
      createdAt: row.created_at,
      requestedBy: row.requested_by,
      bookingReference: booking.reference,
      bookingStatus: booking.status,
      scheduledStart: booking.scheduled_start,
      total: money(booking.total_price),
      customerName: booking.customer_name ?? 'Customer',
      phone: booking.customer_phone ?? '',
      area: booking.addresses?.area ?? 'Kampala',
      serviceName: firstService(booking),
    };
  });

  const technicians: AssignableTechnician[] = (techniciansRes.data ?? []).map((row) => ({
    id: row.id,
    name: row.full_name,
    role: row.role,
  }));

  return { bookings, cancellations, requesterNames, technicians };
}

export async function confirmStaffBooking(bookingId: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_booking', {
    p_booking: bookingId,
    p_note: note.trim() || undefined,
  });
  if (error) fail(error.message);
}

export async function cancelStaffBooking(
  bookingId: string,
  reason: string,
  note: string,
): Promise<void> {
  if (!reason.trim()) fail('A cancellation reason is required.');
  const { error } = await supabase.rpc('cancel_booking', {
    p_booking: bookingId,
    p_reason: reason.trim(),
    p_note: note.trim() || undefined,
  });
  if (error) fail(error.message);
}

/** Confirming and dispatching in one step, through the same RPC the ERP app uses. */
export async function assignBookingTechnician(
  bookingId: string,
  technicianId: string,
  crewRole: string,
): Promise<void> {
  const { error } = await supabase.rpc('assign_technician', {
    p_booking: bookingId,
    p_technician: technicianId,
    p_crew_role: crewRole as 'lead' | 'helper',
  });
  if (error) fail(error.message);
}

export async function decideCancellation(
  requestId: string,
  approve: boolean,
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc('decide_cancellation_request', {
    p_request: requestId,
    p_approve: approve,
    p_note: note.trim() || undefined,
  });
  if (error) fail(error.message);
}
