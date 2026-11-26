import { supabase } from './supabase';

/**
 * Live updates. The API runs as an edge function and cannot push to the browser, but
 * every operational table is in the `supabase_realtime` publication (migration
 * 20261125202000), so the console listens to Postgres changes and reloads the page it
 * is on. Debounced because one desk action often touches several tables at once.
 */
const TABLES = [
  'bookings',
  'booking_items',
  'job_assignments',
  'quotes',
  'inspections',
  'inspection_addenda',
  'payments',
  'cash_handovers',
  'cash_disputes',
  'job_costs',
  'support_conversations',
  'support_messages',
] as const;

export type LiveStatus = 'connecting' | 'live' | 'offline';

// Supabase reuses an existing channel with the same topic, so a remount that happens
// before the old channel finished leaving (React 19 runs effects twice in dev) would
// silently join the dead one: status `SUBSCRIBED`, no events ever. Unique topics keep
// every subscription its own socket binding.
let topicSeq = 0;

export function subscribeToOperations(
  onChange: () => void,
  onStatus?: (status: LiveStatus) => void,
): () => void {
  let timer: number | null = null;
  const ping = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      onChange();
    }, 1200);
  };

  onStatus?.('connecting');
  topicSeq += 1;
  const channel = supabase.channel(`console-operations-${topicSeq}`);
  for (const table of TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, ping);
  }
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') onStatus?.('live');
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      onStatus?.('offline');
    }
  });

  return () => {
    if (timer !== null) window.clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}
