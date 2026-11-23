import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { formatDay, formatMoney, formatWindow } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, radius, shadow, space, text } from '@/theme';

const ACTIVE_STATUSES = [
  'requested',
  'awaiting_confirmation',
  'confirmed',
  'scheduled',
  'on_the_way',
  'in_progress',
] as const;

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  requested: { bg: colors.infoBg, fg: colors.info, label: 'Requested' },
  awaiting_confirmation: { bg: colors.warningBg, fg: colors.warning, label: 'Awaiting confirmation' },
  confirmed: { bg: colors.infoBg, fg: colors.info, label: 'Confirmed' },
  scheduled: { bg: colors.green50, fg: colors.green700, label: 'Scheduled' },
  on_the_way: { bg: colors.yellow50, fg: colors.yellow800, label: 'On the way' },
  in_progress: { bg: colors.yellow50, fg: colors.yellow800, label: 'In progress' },
};

type JobRow = {
  id: string;
  reference: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  total_price: number | null;
  customer_name: string | null;
  addresses: { line1: string; area: string | null } | null;
  booking_items: { quantity: number; services: { name: string } | null }[];
  job_assignments: { crew_role: string; status: string }[];
};

async function fetchJobs(): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, reference, status, scheduled_start, scheduled_end, total_price, customer_name, addresses(line1, area), booking_items(quantity, services(name)), job_assignments(crew_role, status)',
    )
    .in('status', ACTIVE_STATUSES)
    .order('scheduled_start', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as JobRow[];
}

export default function JobsScreen() {
  const router = useRouter();
  const { data, error, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['jobs', 'active'],
    queryFn: fetchJobs,
  });

  return (
    <Screen title="Jobs" subtitle="Assigned and upcoming work">
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Could not load jobs</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.green500}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No jobs assigned</Text>
              <Text style={styles.emptyBody}>
                When dispatch assigns you work it will appear here. Pull down to refresh.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const chip = STATUS_STYLES[item.status] ?? {
              bg: colors.disabledBg,
              fg: colors.textMuted,
              label: item.status,
            };
            const lead = item.job_assignments.find((a) => a.crew_role === 'lead');
            const serviceNames = item.booking_items
              .map((line) => line.services?.name)
              .filter(Boolean)
              .join(', ');

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.reference}, ${chip.label}`}
                onPress={() => router.push(`/jobs/${item.id}`)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                <View style={styles.cardTop}>
                  <Text style={styles.day}>
                    {formatDay(item.scheduled_start)} ·{' '}
                    {formatWindow(item.scheduled_start, item.scheduled_end)}
                  </Text>
                  <View style={[styles.chip, { backgroundColor: chip.bg }]}>
                    <Text style={[styles.chipText, { color: chip.fg }]}>{chip.label}</Text>
                  </View>
                </View>

                <Text style={styles.service} numberOfLines={2}>
                  {serviceNames || 'Service to confirm'}
                </Text>

                <View style={styles.metaRow}>
                  <MapPin size={15} color={colors.textMuted} />
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.addresses
                      ? `${item.addresses.line1}${item.addresses.area ? `, ${item.addresses.area}` : ''}`
                      : 'Address to confirm'}
                  </Text>
                </View>

                <View style={styles.cardBottom}>
                  <View style={styles.badges}>
                    {lead ? (
                      <View style={styles.leadBadge}>
                        <Text style={styles.leadText}>Lead</Text>
                      </View>
                    ) : null}
                    <Text style={styles.reference}>{item.reference}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{formatMoney(item.total_price)}</Text>
                    <ChevronRight size={18} color={colors.textMuted} />
                  </View>
                </View>
              </Pressable>
            );
          }}
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
    gap: space[2],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  pressed: { opacity: 0.9 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
  day: { ...text.caption, color: colors.green700 },
  chip: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 },
  chipText: { ...text.caption, fontSize: 11 },
  service: { ...text.h3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  meta: { ...text.caption, flex: 1 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space[1] },
  badges: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  leadBadge: { backgroundColor: colors.green50, borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 },
  leadText: { ...text.caption, color: colors.green700, fontSize: 11 },
  reference: { ...text.caption },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  price: { ...text.price, fontSize: 16 },
  errorTitle: { ...text.h3 },
  errorBody: { ...text.caption, textAlign: 'center' },
  retry: { paddingHorizontal: space[4], paddingVertical: space[2] },
  retryText: { ...text.bodyM, color: colors.green500 },
  emptyTitle: { ...text.h3 },
  emptyBody: { ...text.caption, textAlign: 'center', maxWidth: 280 },
});
