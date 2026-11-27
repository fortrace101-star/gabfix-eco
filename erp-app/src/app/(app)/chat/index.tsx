import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';
import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/offline-banner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { markTabSeen } from '@/store/badges';
import { colors, font, radius, space, text } from '@/theme';

type ThreadRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  lead_id: string | null;
  last_message_at: string;
  customer_last_read_at: string | null;
  lead_last_read_at: string | null;
  bookings: {
    reference: string;
    status: string;
    scheduled_start: string;
  } | null;
  customer: { full_name: string } | null;
  booking_messages: { body: string; created_at: string; sender_id: string }[];
};

async function fetchThreads(): Promise<ThreadRow[]> {
  const { data, error } = await supabase
    .from('booking_threads')
    .select(
      'id, booking_id, customer_id, lead_id, last_message_at, customer_last_read_at, lead_last_read_at, bookings(reference, status, scheduled_start), customer:profiles!booking_threads_customer_id_fkey(full_name), booking_messages(body, created_at, sender_id)',
    )
    .order('last_message_at', { ascending: false })
    .order('created_at', { referencedTable: 'booking_messages', ascending: false })
    .limit(1, { referencedTable: 'booking_messages' });

  if (error) throw new Error(error.message);
  // Finished jobs have their chat archived, and are hidden meanwhile.
  return ((data ?? []) as unknown as ThreadRow[]).filter(
    (row) => row.bookings?.status !== 'completed',
  );
}

/** The console greets a customer by the first name on their account. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'C';

/** Same reading as the customer inbox: today shows the time, this week a day. */
const inboxTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  const days = (now.getTime() - date.getTime()) / 86_400_000;
  if (days < 7) return date.toLocaleDateString('en-GB', { weekday: 'short' });
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

function ThreadRowView({
  thread,
  viewerId,
  onPress,
}: {
  thread: ThreadRow;
  viewerId: string | undefined;
  onPress: () => void;
}) {
  const last = thread.booking_messages[0];
  const customerName = firstName(thread.customer?.full_name ?? 'Customer');
  const name = `${customerName} (Customer)`;
  const readAt =
    thread.lead_id === viewerId ? thread.lead_last_read_at : thread.customer_last_read_at;
  const unread =
    last && last.sender_id !== viewerId && (!readAt || new Date(last.created_at) > new Date(readAt))
      ? 1
      : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Chat about ${thread.bookings?.reference ?? 'this job'} with ${name}${
        unread > 0 ? ', 1 unread' : ''
      }`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.avatar}>
        <Text style={styles.initials} maxFontSizeMultiplier={1.2}>
          {initials(customerName)}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.name} maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.time} maxFontSizeMultiplier={1.2}>
            {inboxTime(last?.created_at ?? thread.last_message_at)}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, unread > 0 && styles.previewUnread]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}>
            {last?.body ?? `No messages yet — ${thread.bookings?.reference ?? 'new job'}`}
          </Text>
          {unread > 0 ? (
            <View style={styles.unread} accessibilityLabel="1 unread message">
              <Text style={styles.unreadText}>1</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function ChatListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { data, error, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: fetchThreads,
    refetchInterval: 30_000,
  });

  // Opening the inbox is what "reading" means for the tab badge.
  useFocusEffect(
    useCallback(() => {
      markTabSeen('chat');
    }, []),
  );

  // Realtime: a new message reorders the inbox without a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel('chat-inbox')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_messages' },
        () => void queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'booking_threads' },
        () => void queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const threads = data ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          Chat
        </Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>
          Talk to the customer on each job in one place.
        </Text>
        <OfflineBanner />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Could not load chats</Text>
          <Text style={styles.emptyBody}>{error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ThreadRowView
              thread={item}
              viewerId={profile?.id}
              onPress={() => router.push(`/chat/${item.booking_id}` as never)}
            />
          )}
          contentContainerStyle={[styles.list, threads.length === 0 && styles.listEmpty]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.green500}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <MessageSquare size={28} color={colors.textMuted} strokeWidth={1.8} />
              <Text style={styles.emptyTitle}>No active chat</Text>
              <Text style={styles.emptyBody}>
                You have no customer conversation open right now. One opens automatically when you
                are assigned to a job. Pull down to refresh.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[3],
    gap: space[1],
  },
  title: { ...text.h1 },
  subtitle: { ...text.body, color: colors.textMuted },
  list: { paddingHorizontal: space[4], paddingBottom: space[6] },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[6],
    paddingVertical: space[8],
  },
  emptyTitle: { ...text.h3, textAlign: 'center' },
  emptyBody: { ...text.body, color: colors.textMuted, textAlign: 'center' },
  retry: {
    marginTop: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.button,
    backgroundColor: colors.green50,
  },
  retryText: { ...text.button, color: colors.green700 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 76,
    paddingVertical: space[3],
  },
  rowPressed: { opacity: 0.75 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: font.poppinsSemi, fontSize: 16, color: colors.green900 },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  name: { ...text.bodyM, fontFamily: font.bodySemi, flex: 1 },
  time: { ...text.caption, color: colors.textMuted },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  preview: { ...text.caption, flex: 1 },
  previewUnread: { fontFamily: font.bodySemi, color: colors.text },
  unread: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.yellow500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { fontFamily: font.bodySemi, fontSize: 11, lineHeight: 15, color: colors.green900 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 60,
  },
});
