import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OfflineBanner } from '@/components/offline-banner';
import { Screen } from '@/components/ui/screen';
import { formatDay, formatMoney, formatWindow } from '@/lib/format';
import { ACTIVE_STATUSES, statusChip } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, shadow, space, text } from '@/theme';

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

type Segment = 'today' | 'upcoming';

const isToday = (iso: string) => {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
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
  const [segment, setSegment] = useState<Segment>('today');
  const { data, error, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['jobs', 'active'],
    queryFn: fetchJobs,
  });

  const jobs = data ?? [];
  const todayJobs = jobs.filter((job) => isToday(job.scheduled_start));
  const visible = segment === 'today' ? todayJobs : jobs;
  const counts: Record<Segment, number> = { today: todayJobs.length, upcoming: jobs.length };

  return (
    <Screen title="Jobs" subtitle="Assigned and upcoming work">
      <View style={styles.segment}>
        {(['today', 'upcoming'] as Segment[]).map((key) => {
          const active = segment === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${key === 'today' ? 'Today' : 'Upcoming'}, ${counts[key]} jobs`}
              onPress={() => setSegment(key)}
              style={[styles.segmentItem, active && styles.segmentItemOn]}>
              <Text style={[styles.segmentText, active && styles.segmentTextOn]}>
                {key === 'today' ? 'Today' : 'Upcoming'} · {counts[key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <OfflineBanner />

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
          data={visible}
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
              <Text style={styles.emptyTitle}>
                {segment === 'today' ? 'Nothing left today' : 'No jobs assigned'}
              </Text>
              <Text style={styles.emptyBody}>
                {segment === 'today'
                  ? 'Check Upcoming for the rest of your week, or pull down to refresh.'
                  : 'When dispatch assigns you work it will appear here. Pull down to refresh.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const chip = statusChip(item.status);
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
                    ) : (
                      <View style={styles.helperBadge}>
                        <Text style={styles.helperText}>Helper</Text>
                      </View>
                    )}
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
  segment: {
    flexDirection: 'row',
    gap: space[1],
    marginHorizontal: space[4],
    marginBottom: space[3],
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemOn: { backgroundColor: colors.yellow500 },
  segmentText: { ...text.caption, fontFamily: font.bodyMedium },
  segmentTextOn: { color: colors.green900, fontFamily: font.bodySemi },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[2] },
  list: { padding: space[4], paddingTop: 0, gap: space[3], paddingBottom: space[8] },
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
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space[1],
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  leadBadge: {
    backgroundColor: colors.green50,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  leadText: { ...text.caption, color: colors.green700, fontSize: 11 },
  helperBadge: {
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  helperText: { ...text.caption, fontSize: 11 },
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
