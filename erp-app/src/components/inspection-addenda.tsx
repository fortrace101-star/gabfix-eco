import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { colors, radius, shadow, space, text } from '@/theme';

/**
 * The desk records corrections as addenda, so the inspector's report stays as it
 * was sent. The inspector sees them here on the read-only report.
 */

type Addendum = { id: string; note: string; createdAt: string };

const when = (iso: string): string =>
  new Intl.DateTimeFormat('en-UG', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));

async function listAddenda(inspectionId: string): Promise<Addendum[]> {
  const { data, error } = await supabase
    .from('inspection_addenda')
    .select('id, note, created_at')
    .eq('inspection_id', inspectionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, note: row.note, createdAt: row.created_at }));
}

export function InspectionAddenda({ inspectionId }: { inspectionId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['inspection-addenda', inspectionId],
    queryFn: () => listAddenda(inspectionId),
  });

  const addenda = data ?? [];
  if (!isLoading && !error && !addenda.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.sectionTitle}>From the desk</Text>
        <MessageSquare size={14} color={colors.textMuted} />
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.green500} />
      ) : error ? (
        <Text style={styles.caption}>{error.message}</Text>
      ) : (
        <View style={styles.list}>
          {addenda.map((entry) => (
            <View key={entry.id} style={styles.entry}>
              <Text style={styles.body}>{entry.note}</Text>
              <Text style={styles.caption}>Added {when(entry.createdAt)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...text.caption, color: colors.textMuted, textTransform: 'uppercase' },
  caption: { ...text.caption },
  body: { ...text.body, color: colors.text },
  list: { gap: space[3] },
  entry: {
    gap: space[1],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.tile,
    backgroundColor: colors.bg,
  },
});
