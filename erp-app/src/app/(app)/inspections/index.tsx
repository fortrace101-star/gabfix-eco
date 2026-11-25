import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { ChevronRight, ClipboardCheck, MapPin } from 'lucide-react-native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OfflineBanner } from '@/components/offline-banner';
import { Screen } from '@/components/ui/screen';
import { formatDay, formatWindow } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { colors, font, radius, shadow, space, text } from '@/theme';

type InspectionSummary = {
  id: string;
  status: string;
  scheduled_at: string | null;
  required_note: string | null;
  booking_reference: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  customer_name: string | null;
  address_line: string | null;
  area: string | null;
  services: string | null;
  quote_description: string | null;
};

const statusLabels: Record<string, string> = {
  required: 'Needs a visit',
  scheduled: 'Visit booked',
  in_progress: 'In progress',
  submitted: 'Report sent',
};

async function fetchInspections(): Promise<InspectionSummary[]> {
  const { data, error } = await supabase.rpc('my_inspections');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as InspectionSummary[];
}

export default function InspectionsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { data, error, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['inspections', profile?.id],
    queryFn: fetchInspections,
    enabled: !!profile,
  });

  const rows = data ?? [];
  const open = rows.filter((row) => row.status !== 'submitted');
  const done = rows.filter((row) => row.status === 'submitted');

  const card = (row: InspectionSummary) => (
    <Pressable
      key={row.id}
      accessibilityRole="button"
      accessibilityLabel={`Inspection for ${row.booking_reference ?? 'a booking'}, ${
        statusLabels[row.status] ?? row.status
      }`}
      onPress={() => router.push(`/inspections/${row.id}` as Href)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardTop}>
        <Text style={styles.reference}>{row.booking_reference ?? 'Booking'}</Text>
        <View
          style={[
            styles.chip,
            {
              backgroundColor: row.status === 'submitted' ? colors.successBg : colors.warningBg,
            },
          ]}>
          <Text
            style={[
              styles.chipText,
              { color: row.status === 'submitted' ? colors.success : colors.warning },
            ]}>
            {statusLabels[row.status] ?? row.status}
          </Text>
        </View>
      </View>

      <Text style={styles.service} numberOfLines={2}>
        {row.services ?? row.quote_description ?? 'Inspection visit'}
      </Text>

      {row.scheduled_start ? (
        <Text style={styles.meta}>
          Visit {formatDay(row.scheduled_start)} ·{' '}
          {row.scheduled_end
            ? formatWindow(row.scheduled_start, row.scheduled_end)
            : 'time to confirm'}
        </Text>
      ) : (
        <Text style={styles.meta}>No visit time booked yet</Text>
      )}

      <View style={styles.metaRow}>
        <MapPin size={14} color={colors.textMuted} />
        <Text style={styles.meta} numberOfLines={1}>
          {[row.address_line, row.area].filter(Boolean).join(', ') || 'Address to confirm'}
        </Text>
      </View>

      {row.required_note ? (
        <Text style={styles.note} numberOfLines={2}>
          {row.required_note}
        </Text>
      ) : null}

      <View style={styles.cardBottom}>
        <Text style={styles.customer}>{row.customer_name ?? 'Customer'}</Text>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );

  return (
    <Screen title="Inspections" subtitle="Visits that decide a quote">
      <OfflineBanner />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Could not load inspections</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
          <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.green500}
            />
          }>
          {rows.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <ClipboardCheck size={22} color={colors.green700} />
              </View>
              <Text style={styles.emptyTitle}>No inspections assigned</Text>
              <Text style={styles.emptyBody}>
                When the desk books you for an inspection visit it appears here, with the customer and
                the address you need.
              </Text>
            </View>
          ) : null}

          {open.length ? (
            <>
              <Text style={styles.sectionTitle}>To do</Text>
              {open.map(card)}
            </>
          ) : null}

          {done.length ? (
            <>
              <Text style={styles.sectionTitle}>Reports sent</Text>
              {done.map(card)}
            </>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space[4], gap: space[3], paddingBottom: space[8] },
  sectionTitle: { ...text.caption, color: colors.textMuted, textTransform: 'uppercase' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[2] },
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[2] },
  reference: { ...text.caption, color: colors.green700, fontFamily: font.bodySemi },
  chip: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 },
  chipText: { ...text.caption, fontSize: 11, fontFamily: font.bodySemi },
  service: { ...text.h3 },
  meta: { ...text.caption, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  note: { ...text.caption, color: colors.text },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customer: { ...text.bodyM },
  empty: { alignItems: 'center', gap: space[2], paddingVertical: space[8], paddingHorizontal: space[4] },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { ...text.h3, textAlign: 'center' },
  emptyBody: { ...text.caption, textAlign: 'center', maxWidth: 300 },
  errorTitle: { ...text.h3 },
  errorBody: { ...text.caption, textAlign: 'center' },
  retry: { paddingHorizontal: space[4], paddingVertical: space[2] },
  retryText: { ...text.bodyM, color: colors.green500 },
});
