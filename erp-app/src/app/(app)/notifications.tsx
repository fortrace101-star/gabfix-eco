import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { formatDay, formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { colors, radius, space, text } from '@/theme';

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  type: string;
  read_at: string | null;
  created_at: string;
};

async function fetchNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, type, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['notifications', profile?.id];

  const { data, error, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchNotifications(profile!.id),
    enabled: !!profile,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', profile!.id)
        .is('read_at', null);
      if (updateError) throw new Error(updateError.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const unread = data?.filter((row) => !row.read_at).length ?? 0;

  return (
    <Screen
      title="Alerts"
      subtitle={unread ? `${unread} unread` : 'All caught up'}
      action={
        unread ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}>
            <Text style={styles.markRead}>Mark read</Text>
          </Pressable>
        ) : undefined
      }>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.caption}>Could not load alerts.</Text>
          <Text style={styles.caption}>{error.message}</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Nothing yet</Text>
              <Text style={styles.caption}>Assignments and updates will show up here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, !item.read_at && styles.unread]}>
              <View style={styles.row}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.caption}>
                  {formatDay(item.created_at)} · {formatTime(item.created_at)}
                </Text>
              </View>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[2] },
  list: { padding: space[4], gap: space[3], paddingBottom: space[8] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[1],
    borderWidth: 1,
    borderColor: colors.border,
  },
  unread: { borderColor: colors.green300, backgroundColor: colors.green50 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
  title: { ...text.h3, flex: 1 },
  body: { ...text.body },
  caption: { ...text.caption },
  emptyTitle: { ...text.h3 },
  markRead: { ...text.bodyM, color: colors.green500 },
});
