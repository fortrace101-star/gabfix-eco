import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Paperclip, SendHorizontal, Video } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { uploadChatAttachment } from '@/lib/chat-media';
import { playMessageSound } from '@/lib/message-sound';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { colors, font, radius, space, text } from '@/theme';

type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  media_path: string | null;
  media_kind: 'image' | 'video' | null;
  media_duration_ms: number | null;
  mediaUrl?: string | null;
};

type Thread = {
  id: string;
  booking_id: string;
  customer_id: string;
  lead_id: string | null;
  bookings: {
    reference: string;
    status: string;
    customer_name: string | null;
  } | null;
  customer: { full_name: string } | null;
  booking_messages: ChatMessage[];
};

async function fetchThread(bookingId: string): Promise<Thread | null> {
  const { data, error } = await supabase
    .from('booking_threads')
    .select(
      'id, booking_id, customer_id, lead_id, bookings(reference, status, customer_name), customer:profiles!booking_threads_customer_id_fkey(full_name), booking_messages(id, sender_id, body, created_at, media_path, media_kind, media_duration_ms)',
    )
    .eq('booking_id', bookingId)
    .order('created_at', { referencedTable: 'booking_messages', ascending: true })
    .maybeSingle();

  if (error) throw new Error(error.message);
  const thread = data as unknown as Thread | null;
  if (!thread) return null;

  // Attachments are private; sign each one for the conversation view.
  const paths = thread.booking_messages
    .map((message) => message.media_path)
    .filter((path): path is string => Boolean(path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('chat-media')
      .createSignedUrls(paths, 3600);
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
    }
  }
  return {
    ...thread,
    booking_messages: thread.booking_messages.map((message) => ({
      ...message,
      mediaUrl: message.media_path ? urls.get(message.media_path) ?? null : null,
    })),
  };
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'C';

type DecoratedMessage = ChatMessage & { showTime: boolean };

export default function BookingChatScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<DecoratedMessage>>(null);

  const { data: thread, error, isLoading } = useQuery({
    queryKey: ['chat', 'thread', bookingId],
    queryFn: () => fetchThread(bookingId),
    enabled: !!bookingId,
    refetchInterval: 15_000,
  });

  const messages = useMemo(() => thread?.booking_messages ?? [], [thread]);
  const latestCount = messages.length;

  const decorated = useMemo(
    () =>
      messages.map((message, index) => ({
        ...message,
        showTime:
          index === messages.length - 1 ||
          messages[index + 1]?.sender_id !== message.sender_id,
      })),
    [messages],
  );
  const ordered = useMemo(() => [...decorated].reverse(), [decorated]);

  useEffect(() => {
    if (latestCount > 0) listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [latestCount]);

  // Realtime: the customer's reply appears without waiting for the poll.
  useEffect(() => {
    if (!thread?.id) return;
    const channel = supabase
      .channel(`booking-chat-${thread.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'booking_messages',
          filter: `thread_id=eq.${thread.id}`,
        },
        (payload) => {
          const row = payload.new as { sender_id?: string };
          if (row.sender_id && row.sender_id !== profile?.id) playMessageSound();
          void queryClient.invalidateQueries({ queryKey: ['chat', 'thread', bookingId] });
          void queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [thread?.id, bookingId, queryClient]);

  // Reading the conversation clears the customer's unread badge for the lead.
  useEffect(() => {
    if (!thread || thread.lead_id !== profile?.id) return;
    void supabase
      .from('booking_threads')
      .update({ lead_last_read_at: new Date().toISOString() })
      .eq('id', thread.id);
  }, [thread?.id, thread?.lead_id, profile?.id, latestCount]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      if (!thread || !profile) throw new Error('This conversation is not ready yet.');
      const { error: insertError } = await supabase
        .from('booking_messages')
        .insert({ thread_id: thread.id, sender_id: profile.id, body });
      if (insertError) throw new Error(insertError.message);
    },
    onSuccess: async () => {
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['chat', 'thread', bookingId] });
      await queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    },
  });

  const canSend = draft.trim().length > 0 && !!thread && !!profile && !send.isPending;
  const [attaching, setAttaching] = useState(false);

  const attach = async () => {
    if (!thread || !profile || attaching) return;
    setAttaching(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow photo access in your device settings to attach a photo or video.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.7,
        videoMaxDuration: 30,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      const kind = asset.type === 'video' ? 'video' : 'image';
      const bytes = asset.fileSize ?? 0;
      const durationMs = asset.duration ?? 0;
      if (!bytes) {
        Alert.alert('Could not read that file', 'Choose the photo or video again.');
        return;
      }
      if (bytes > 25 * 1024 * 1024) {
        Alert.alert('File too large', 'Photos and videos must be 25 MB or smaller.');
        return;
      }
      if (kind === 'video' && (!durationMs || durationMs > 30_000)) {
        Alert.alert('Video too long', 'Attach a video that is 30 seconds or shorter.');
        return;
      }

      const path = await uploadChatAttachment(thread.id, {
        uri: asset.uri,
        kind,
        mimeType: asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
        bytes,
        durationMs: kind === 'video' ? durationMs : undefined,
      });
      const { error: insertError } = await supabase.from('booking_messages').insert({
        thread_id: thread.id,
        sender_id: profile.id,
        body: draft.trim(),
        media_path: path,
        media_kind: kind,
        media_mime: asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'),
        media_bytes: bytes,
        media_duration_ms: kind === 'video' ? durationMs : null,
      });
      if (insertError) throw new Error(insertError.message);
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['chat', 'thread', bookingId] });
      await queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    } catch (attachError) {
      Alert.alert(
        'Could not send attachment',
        attachError instanceof Error ? attachError.message : 'Try again.',
      );
    } finally {
      setAttaching(false);
    }
  };

  const submit = () => {
    if (!canSend) return;
    send.mutate(draft.trim());
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/chat' as never);
  };

  const customer = thread?.customer?.full_name ?? thread?.bookings?.customer_name ?? 'Customer';
  const firstName = customer.trim().split(/\s+/)[0] ?? customer;
  const title = `${firstName} (Customer)`;
  const reference = thread?.bookings?.reference ?? 'Job';
  const avatarInitials = initials(customer);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={goBack}
          style={styles.back}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.initials} maxFontSizeMultiplier={1.2}>
            {avatarInitials}
          </Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          <Text style={styles.role} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {reference} · job chat
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Could not load this chat</Text>
          <Text style={styles.emptyBody}>{error.message}</Text>
        </View>
      ) : !thread ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No open chat</Text>
          <Text style={styles.emptyBody}>
            A conversation opens when a technician is assigned to this job and closes once the job
            is completed.
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <FlatList
            ref={listRef}
            inverted
            style={styles.flex}
            data={ordered}
            keyExtractor={(message) => message.id}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyThread} maxFontSizeMultiplier={1.3}>
                Say hello and let the customer know when you will arrive.
              </Text>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === profile?.id;
              return (
                <View style={[styles.messageRow, mine && styles.messageRowMine]}>
                  {!mine ? (
                    <View style={styles.smallAvatar}>
                      <Text style={styles.smallInitials} maxFontSizeMultiplier={1.1}>
                        {avatarInitials}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.messageColumn, mine && styles.messageColumnMine]}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      {item.media_kind === 'video' ? (
                        <View style={styles.videoTile}>
                          <Video size={20} color={colors.surface} strokeWidth={2} />
                          <Text style={styles.videoLabel} maxFontSizeMultiplier={1.2}>
                            Video
                            {item.media_duration_ms
                              ? ` · ${Math.round(item.media_duration_ms / 1000)}s`
                              : ''}
                          </Text>
                        </View>
                      ) : item.mediaUrl ? (
                        <Image
                          source={{ uri: item.mediaUrl }}
                          style={styles.bubbleImage}
                          contentFit="cover"
                          accessibilityLabel="Attached photo"
                        />
                      ) : null}
                      {item.body ? (
                        <Text
                          style={[styles.bubbleText, mine && styles.bubbleTextMine]}
                          maxFontSizeMultiplier={1.3}>
                          {item.body}
                        </Text>
                      ) : null}
                    </View>
                    {item.showTime ? (
                      <View style={[styles.metaRow, mine && styles.metaRowMine]}>
                        <Text style={styles.meta} maxFontSizeMultiplier={1.2}>
                          {clock(item.created_at)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            }}
          />

          {send.error ? (
            <Text style={styles.sendError} maxFontSizeMultiplier={1.2}>
              {send.error.message}
            </Text>
          ) : null}

          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, space[2]) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach a photo or video"
              accessibilityState={{ busy: attaching, disabled: attaching }}
              disabled={attaching}
              hitSlop={6}
              onPress={() => void attach()}
              style={[styles.attach, attaching && styles.attachBusy]}>
              <Paperclip size={20} color={colors.green700} strokeWidth={2} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message…"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={2000}
              maxFontSizeMultiplier={1.3}
              accessibilityLabel={`Message ${customer}`}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !canSend }}
              disabled={!canSend}
              hitSlop={6}
              onPress={submit}
              style={[styles.send, !canSend && styles.sendDisabled]}>
              {send.isPending ? (
                <ActivityIndicator color={colors.surface} size="small" />
              ) : (
                <SendHorizontal
                  size={20}
                  color={canSend ? colors.surface : colors.disabledText}
                  strokeWidth={2}
                />
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[2],
    paddingBottom: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: font.poppinsSemi, fontSize: 14, color: colors.green900 },
  headerCopy: { flex: 1, gap: 1 },
  name: { ...text.h3, fontSize: 16 },
  role: { ...text.caption },
  messages: {
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    gap: space[2],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    paddingHorizontal: space[6],
  },
  emptyTitle: { ...text.h3, textAlign: 'center' },
  emptyBody: { ...text.body, color: colors.textMuted, textAlign: 'center' },
  emptyThread: {
    ...text.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingTop: space[8],
    transform: [{ scaleY: -1 }],
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[2],
  },
  messageRowMine: { justifyContent: 'flex-end' },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.green100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  smallInitials: { fontFamily: font.poppinsSemi, fontSize: 10, color: colors.green900 },
  messageColumn: { maxWidth: '78%', gap: 3, alignItems: 'flex-start' },
  messageColumnMine: { alignItems: 'flex-end' },
  bubble: { padding: space[3], borderRadius: 18 },
  bubbleMine: {
    backgroundColor: colors.green500,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 4 },
  videoTile: {
    width: 200,
    height: 110,
    borderRadius: 12,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.green700,
  },
  videoLabel: { ...text.caption, color: colors.surface },
  bubbleText: { ...text.body, lineHeight: 20 },
  bubbleTextMine: { color: colors.surface },
  attach: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green50,
  },
  attachBusy: { opacity: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 2 },
  metaRowMine: { justifyContent: 'flex-end' },
  meta: { ...text.caption, fontSize: 10, lineHeight: 14, color: colors.textMuted },
  sendError: {
    ...text.caption,
    color: colors.error,
    paddingHorizontal: space[4],
    paddingBottom: space[1],
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    ...text.body,
    color: colors.text,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.green500,
  },
  sendDisabled: { backgroundColor: colors.disabledBg },
});
