import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { formatMoney, formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { colors, radius, space, text } from '@/theme';

function startOfTodayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

async function fetchCash() {
  const [payments, handovers] = await Promise.all([
    supabase
      .from('payments')
      .select('id, amount, method, status, paid_at, bookings(reference)')
      .eq('method', 'cash')
      .gte('paid_at', startOfTodayIso())
      .order('paid_at', { ascending: false }),
    supabase
      .from('cash_handovers')
      .select('id, amount, note, created_at, confirmed_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const firstError = payments.error ?? handovers.error;
  if (firstError) throw new Error(firstError.message);

  return {
    payments: payments.data ?? [],
    handovers: handovers.data ?? [],
    total: (payments.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0),
  };
}

export default function CashScreen() {
  const { data, error, isLoading } = useQuery({ queryKey: ['cash', 'today'], queryFn: fetchCash });

  return (
    <Screen title="Cash" subtitle="Collected today">
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.caption}>Could not load cash records.</Text>
          <Text style={styles.caption}>{error.message}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Cash collected today</Text>
            <Text style={styles.heroValue}>{formatMoney(data?.total ?? 0)}</Text>
            <Text style={styles.heroHint}>
              {data?.payments.length ?? 0} payment{data?.payments.length === 1 ? '' : 's'} recorded
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payments</Text>
            {data?.payments.length ? (
              data.payments.map((row) => (
                <View key={row.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.body}>{row.bookings?.reference ?? 'Booking'}</Text>
                    <Text style={styles.caption}>{formatTime(row.paid_at)}</Text>
                  </View>
                  <Text style={styles.amount}>{formatMoney(Number(row.amount))}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.caption}>
                No cash recorded yet today. Collect on the job, then record it there.
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Handovers</Text>
            {data?.handovers.length ? (
              data.handovers.map((row) => (
                <View key={row.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.body}>{formatMoney(Number(row.amount))}</Text>
                    <Text style={styles.caption}>
                      {row.confirmed_at
                        ? `Confirmed ${formatTime(row.confirmed_at)}`
                        : 'Awaiting confirmation'}
                    </Text>
                  </View>
                  <Text style={styles.caption}>{formatTime(row.created_at)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.caption}>No handovers recorded.</Text>
            )}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[2] },
  content: { padding: space[4], gap: space[3], paddingBottom: space[8] },
  heroCard: {
    backgroundColor: colors.green700,
    borderRadius: radius.card,
    padding: space[5],
    gap: space[1],
  },
  heroLabel: { ...text.caption, color: colors.whiteTextMuted },
  heroValue: { ...text.display, color: colors.surface },
  heroHint: { ...text.caption, color: colors.whiteTextMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { ...text.caption, textTransform: 'uppercase', color: colors.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] },
  rowText: { flex: 1, gap: 2 },
  body: { ...text.bodyM },
  caption: { ...text.caption },
  amount: { ...text.price, fontSize: 15 },
});
