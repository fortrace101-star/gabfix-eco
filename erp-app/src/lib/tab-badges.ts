import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { ACTIVE_STATUSES } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { useBadgesHydrated, useTabSeen, type BadgeTab } from '@/store/badges';

type ChatActivity = {
  last_message_at: string;
  booking_messages: { sender_id: string; created_at: string }[];
};

const NEWER = (at: string, than: string | null) => (than ? Date.parse(at) > Date.parse(than) : false);

/**
 * Counts of what changed since the technician last opened each tab: a customer
 * reply per chat, an edited/assigned active job, and cash activity (a payment
 * recorded or a handover sent/confirmed). Local seen markers keep it honest
 * without a server-side read table.
 */
export function useTabBadges(): Record<BadgeTab, number> {
  const queryClient = useQueryClient();
  const { profile, role } = useAuth();
  const hydrated = useBadgesHydrated();
  const chatSeen = useTabSeen('chat');
  const jobsSeen = useTabSeen('jobs');
  const cashSeen = useTabSeen('cash');
  const enabled = Boolean(profile) && hydrated;

  // A chat reply, job change or cash event updates its badge straight away.
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('tab-badges')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'booking_messages' },
        () => void queryClient.invalidateQueries({ queryKey: ['badges', 'chat'] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => void queryClient.invalidateQueries({ queryKey: ['badges', 'jobs'] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cash_handovers' },
        () => void queryClient.invalidateQueries({ queryKey: ['badges', 'cash'] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  const chat = useQuery({
    queryKey: ['badges', 'chat', profile?.id],
    enabled,
    refetchInterval: 15_000,
    queryFn: async (): Promise<ChatActivity[]> => {
      const { data, error } = await supabase
        .from('booking_threads')
        .select('id, last_message_at, booking_messages(sender_id, created_at)')
        .order('created_at', { referencedTable: 'booking_messages', ascending: false })
        .limit(1, { referencedTable: 'booking_messages' });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as ChatActivity[];
    },
  });

  const jobs = useQuery({
    queryKey: ['badges', 'jobs', profile?.id, role],
    enabled,
    refetchInterval: 60_000,
    queryFn: async (): Promise<{ updated_at: string }[]> => {
      let query = supabase
        .from('bookings')
        .select('id, updated_at, job_assignments(technician_id, status)')
        .in('status', ACTIVE_STATUSES);
      if (role === 'technician' && profile) {
        query = query
          .eq('job_assignments.technician_id', profile.id)
          .neq('job_assignments.status', 'removed');
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as { updated_at: string }[];
    },
  });

  const cash = useQuery({
    queryKey: ['badges', 'cash', profile?.id, cashSeen],
    enabled: enabled && Boolean(cashSeen),
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => {
      const since = cashSeen ?? new Date().toISOString();
      const [payments, handovers] = await Promise.all([
        supabase
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .eq('method', 'cash')
          .gte('paid_at', since),
        supabase
          .from('cash_handovers')
          .select('id', { count: 'exact', head: true })
          .or(`created_at.gt.${since},confirmed_at.gt.${since}`),
      ]);
      const firstError = payments.error ?? handovers.error;
      if (firstError) throw new Error(firstError.message);
      return (payments.count ?? 0) + (handovers.count ?? 0);
    },
  });

  const chatCount = (chat.data ?? []).filter((thread) => {
    const last = thread.booking_messages[0];
    return (
      Boolean(last) &&
      last.sender_id !== profile?.id &&
      NEWER(last.created_at, chatSeen)
    );
  }).length;

  const jobsCount = (jobs.data ?? []).filter((job) => NEWER(job.updated_at, jobsSeen)).length;

  return {
    chat: chat.isError ? 0 : chatCount,
    jobs: jobs.isError ? 0 : jobsCount,
    cash: cash.isError ? 0 : (cash.data ?? 0),
  };
}
