import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { formatMoney, formatTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { markTabSeen } from '@/store/badges';
import { useAuth } from '@/store/auth';
import { colors, font, radius, shadow, space, text } from '@/theme';

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
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [handingOver, setHandingOver] = useState(false);

  const { data, error, isLoading } = useQuery({ queryKey: ['cash', 'today'], queryFn: fetchCash });

  useFocusEffect(
    useCallback(() => {
      markTabSeen('cash');
    }, []),
  );

  const handover = useMutation({
    mutationFn: async () => {
      const parsed = Number(amount.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('Enter a positive amount.');
      }
      const { error: rpcError } = await supabase.rpc('record_cash_handover', {
        p_amount: parsed,
        p_note: note.trim() || undefined,
      });
      if (rpcError) throw new Error(rpcError.message);
      return parsed;
    },
    onSuccess: async (parsed) => {
      setAmount('');
      setNote('');
      setHandingOver(false);
      await queryClient.invalidateQueries({ queryKey: ['cash'] });
      Alert.alert('Handover recorded', `${formatMoney(parsed)} is waiting for the desk to confirm.`);
    },
    onError: (mutationError) => {
      Alert.alert('Could not record the handover', mutationError.message);
    },
  });

  return (
    <Screen
      title="Cash"
      subtitle="Collected today and handovers"
      action={
        data ? (
          <View style={styles.headerAmount}>
            <Text style={styles.headerAmountLabel}>Today</Text>
            <Text style={styles.headerAmountValue}>{formatMoney(data.total)}</Text>
          </View>
        ) : undefined
      }>
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

          {role === 'technician' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Hand over cash</Text>
              {handingOver ? (
                <View style={styles.form}>
                  <TextField
                    label="Amount received by the desk"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 90000"
                  />
                  <TextField
                    label="Note (optional)"
                    value={note}
                    onChangeText={setNote}
                    placeholder="Who took it, where"
                  />
                  <Button
                    label="Record handover"
                    onPress={() => handover.mutate()}
                    loading={handover.isPending}
                  />
                  <Button label="Cancel" variant="ghost" onPress={() => setHandingOver(false)} />
                </View>
              ) : (
                <>
                  <Text style={styles.caption}>
                    Cash you have handed to the desk. It stays unconfirmed until they check it.
                  </Text>
                  <Button
                    label="Hand over cash"
                    variant="secondary"
                    onPress={() => setHandingOver(true)}
                  />
                </>
              )}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Handovers</Text>
            {data?.handovers.length ? (
              data.handovers.map((row) => (
                <View key={row.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.body}>{formatMoney(Number(row.amount))}</Text>
                    <Text
                      style={[
                        styles.caption,
                        row.confirmed_at ? styles.confirmed : styles.awaiting,
                      ]}>
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
  headerAmount: { alignItems: 'flex-end', gap: 0 },
  headerAmountLabel: { ...text.caption },
  headerAmountValue: { ...text.bodyM, color: colors.green700 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  sectionTitle: { ...text.caption, textTransform: 'uppercase', color: colors.textMuted },
  form: { gap: space[2] },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] },
  rowText: { flex: 1, gap: 2 },
  body: { ...text.bodyM },
  caption: { ...text.caption },
  awaiting: { color: colors.error, fontFamily: font.bodySemi },
  confirmed: { color: colors.green700, fontFamily: font.bodySemi },
  amount: { ...text.price, fontSize: 15 },
});
