import type { PageId } from '../types';

import { supabase } from './supabase';

export type NavBadges = Partial<Record<PageId, number>>;

/**
 * Counts of work waiting in each sidebar queue. They are the same numbers the
 * pages lead with, read with one round trip so the nav stays current without
 * opening a page: bookings to confirm, cancellation requests, uninvoiced quote
 * requests, unread support threads and costs awaiting a decision.
 */
export async function loadNavBadges(): Promise<NavBadges> {
  const [pendingBookings, cancellations, quotes, costs, support] = await Promise.all([
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('source', ['staff', 'sales'])
      .in('status', ['requested', 'awaiting_confirmation']),
    supabase
      .from('cancellation_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase.from('quotes').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
    supabase.from('job_costs').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase
      .from('support_conversations')
      .select('last_message_at, last_read_by_staff_at'),
  ]);

  const failure =
    pendingBookings.error ?? cancellations.error ?? quotes.error ?? costs.error ?? support.error;
  if (failure) throw new Error(failure.message);

  const supportUnread = (support.data ?? []).filter(
    (row) =>
      !row.last_read_by_staff_at ||
      new Date(row.last_message_at).getTime() > new Date(row.last_read_by_staff_at).getTime(),
  ).length;

  return {
    approvals: (pendingBookings.count ?? 0) + (cancellations.count ?? 0),
    quotes: quotes.count ?? 0,
    costs: costs.count ?? 0,
    support: supportUnread,
  };
}
