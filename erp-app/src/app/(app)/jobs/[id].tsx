import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Banknote, MapPin, Phone } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JobPhotos } from '@/components/job-photos';
import { isOfflineError, queueAction } from '@/lib/action-queue';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { formatDay, formatMoney, formatWindow } from '@/lib/format';
import { formatUGPhone, toUgE164 } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { colors, radius, shadow, space, text } from '@/theme';

type JobDetail = {
  id: string;
  reference: string;
  status: string;
  source: string;
  scheduled_start: string;
  scheduled_end: string;
  total_price: number | null;
  billed_hours: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  addresses: { line1: string; line2: string | null; area: string | null; notes: string | null } | null;
  booking_items: {
    quantity: number;
    price: number | null;
    services: { name: string; description: string | null; pricing_type: string } | null;
  }[];
  job_assignments: { crew_role: string; status: string; technician_id: string }[];
  payments: { amount: number; method: string; status: string; paid_at: string | null }[];
  booking_status_history: { from_status: string | null; to_status: string; changed_at: string }[];
};

async function fetchJob(id: string): Promise<JobDetail> {
  const { data, error } = await supabase
    .from('bookings')
    .select(
      'id, reference, status, source, scheduled_start, scheduled_end, total_price, billed_hours, customer_name, customer_phone, notes, addresses(line1, line2, area, notes), booking_items(quantity, price, services(name, description, pricing_type)), job_assignments(crew_role, status, technician_id), payments(amount, method, status, paid_at), booking_status_history(from_status, to_status, changed_at)',
    )
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as JobDetail;
}

type JobAction = 'on_the_way' | 'start_job' | 'complete_job';

const ACTION_LABELS: Record<JobAction, string> = {
  on_the_way: 'On the way',
  start_job: 'Start job',
  complete_job: 'Complete job',
};

const ACTION_RPCS = {
  on_the_way: 'set_booking_on_the_way',
  start_job: 'start_job',
  complete_job: 'complete_job',
} as const;

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [finishing, setFinishing] = useState(false);
  const [hours, setHours] = useState('');
  const [cash, setCash] = useState('');

  const { data, error, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => fetchJob(id),
    enabled: !!id,
  });

  const running = useMutation({
    mutationFn: async ({ action, billedHours }: { action: JobAction; billedHours?: number }) => {
      const { error: rpcError } =
        action === 'complete_job'
          ? await supabase.rpc(ACTION_RPCS.complete_job, {
              p_booking: id,
              p_billed_hours: billedHours,
            })
          : await supabase.rpc(ACTION_RPCS[action], { p_booking: id });
      if (rpcError) throw new Error(rpcError.message);
    },
    onSuccess: async (_result, variables) => {
      setFinishing(false);
      setHours('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['job', id] }),
        queryClient.invalidateQueries({ queryKey: ['jobs'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
      ]);
      // The screen stayed on a finished job with no word that it landed.
      if (variables.action === 'complete_job') {
        Alert.alert('Job completed', `${data?.reference ?? 'The job'} is marked complete.`, [
          { text: 'Back to jobs', onPress: () => router.back() },
        ]);
      }
    },
    onError: async (mutationError, variables) => {
      if (isOfflineError(mutationError.message)) {
        await queueAction({
          kind: 'rpc',
          name: ACTION_RPCS[variables.action],
          params: {
            p_booking: id,
            ...(variables.billedHours != null ? { p_billed_hours: variables.billedHours } : {}),
          },
          label: `${ACTION_LABELS[variables.action]} · ${data?.reference ?? id}`,
        });
        setFinishing(false);
        setHours('');
        Alert.alert(
          'Saved on this device',
          'You are offline. The status change will sync automatically when the connection is back.',
        );
        return;
      }
      Alert.alert('Could not update the job', mutationError.message);
    },
  });

  const cashMutation = useMutation({
    mutationFn: async (amount: number) => {
      const { error: rpcError } = await supabase.rpc('record_cash_payment', {
        p_booking: id,
        p_amount: amount,
      });
      if (rpcError) throw new Error(rpcError.message);
      return amount;
    },
    onSuccess: async () => {
      setCash('');
      await queryClient.invalidateQueries({ queryKey: ['job', id] });
      await queryClient.invalidateQueries({ queryKey: ['cash'] });
    },
    onError: async (mutationError, amount) => {
      if (isOfflineError(mutationError.message)) {
        await queueAction({
          kind: 'cash',
          params: { p_booking: id, p_amount: amount },
          label: `Cash · ${data?.reference ?? id}`,
        });
        setCash('');
        Alert.alert(
          'Cash saved on this device',
          'You are offline. The payment will be recorded when the connection is back.',
        );
        return;
      }
      Alert.alert('Could not record the cash', mutationError.message);
    },
  });

  const recordCash = () => {
    const parsed = Number(cash.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      Alert.alert('Check the amount', 'Enter a positive amount of cash received.');
      return;
    }
    cashMutation.mutate(parsed);
  };

  const myAssignment = data?.job_assignments.find((row) => row.technician_id === profile?.id);
  const hourly = data?.booking_items.some((line) => line.services?.pricing_type === 'hourly');
  const status = data?.status;
  const canTravel = !!myAssignment && (status === 'confirmed' || status === 'scheduled');
  const canStart =
    !!myAssignment && (status === 'on_the_way' || status === 'scheduled');
  const canComplete = !!myAssignment && status === 'in_progress';

  const startCompletion = async () => {
    const { count } = await supabase
      .from('job_photos')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', id)
      .eq('kind', 'after');

    const proceed = () => (hourly ? setFinishing(true) : running.mutate({ action: 'complete_job' }));

    if ((count ?? 0) > 0) {
      proceed();
      return;
    }

    Alert.alert(
      'No completion photos',
      'Add an after photo so the customer can see the finished work. You can still complete without one.',
      [
        { text: 'Add photos', style: 'cancel' },
        { text: 'Complete anyway', style: 'destructive', onPress: proceed },
      ],
    );
  };

  const submitFinish = () => {
    const parsed = hours.trim() ? Number(hours.replace(',', '.')) : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
      Alert.alert('Check the hours', 'Enter a positive number of billed hours.');
      return;
    }
    running.mutate({ action: 'complete_job', billedHours: parsed ?? undefined });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to jobs"
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.back}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {data ? data.reference : 'Job'}
        </Text>
        <View style={styles.back} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Could not load this job</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
        </View>
      ) : data ? (
        <>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.status}>{data.status.replaceAll('_', ' ')}</Text>
            <Text style={styles.when}>
              {formatDay(data.scheduled_start)} ·{' '}
              {formatWindow(data.scheduled_start, data.scheduled_end)}
            </Text>
            <Text style={styles.price}>{formatMoney(data.total_price)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <Text style={styles.bodyStrong}>{data.customer_name ?? 'Name not recorded'}</Text>
            {data.customer_phone ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(`tel:${toUgE164(data.customer_phone ?? '') ?? data.customer_phone}`)}
                style={styles.linkRow}>
                <Phone size={16} color={colors.green500} />
                <Text style={styles.link}>{formatUGPhone(data.customer_phone)}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Where</Text>
            {data.addresses ? (
              <>
                <View style={styles.linkRow}>
                  <MapPin size={16} color={colors.textMuted} />
                  <Text style={styles.body}>
                    {data.addresses.line1}
                    {data.addresses.line2 ? `, ${data.addresses.line2}` : ''}
                  </Text>
                </View>
                {data.addresses.area ? <Text style={styles.caption}>{data.addresses.area}</Text> : null}
                {data.addresses.notes ? <Text style={styles.caption}>{data.addresses.notes}</Text> : null}
              </>
            ) : (
              <Text style={styles.caption}>No address recorded — confirm with the customer.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Work</Text>
            {data.booking_items.map((line, index) => (
              <View key={`${line.services?.name ?? 'item'}-${index}`} style={styles.line}>
                <Text style={styles.bodyStrong}>
                  {line.quantity}× {line.services?.name ?? 'Service'}
                </Text>
                {line.services?.description ? (
                  <Text style={styles.caption}>{line.services.description}</Text>
                ) : null}
              </View>
            ))}
            {data.notes ? <Text style={styles.notes}>{data.notes}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Cash</Text>
            {data.payments.filter((row) => row.method === 'cash').length ? (
              data.payments
                .filter((row) => row.method === 'cash')
                .map((row, index) => (
                  <View key={`cash-${index}`} style={styles.cashRow}>
                    <Text style={styles.body}>{formatMoney(Number(row.amount))}</Text>
                    <Text style={styles.caption}>{row.status}</Text>
                  </View>
                ))
            ) : (
              <Text style={styles.caption}>No cash recorded on this job yet.</Text>
            )}
            <View style={styles.cashRow}>
              <Banknote size={16} color={colors.green700} />
              <Text style={styles.caption}>Record what the customer paid in cash.</Text>
            </View>
            <TextField
              label="Cash received"
              value={cash}
              onChangeText={setCash}
              keyboardType="decimal-pad"
              placeholder="e.g. 45000"
            />
            <Button
              label="Record cash"
              variant="secondary"
              onPress={recordCash}
              loading={cashMutation.isPending}
            />
          </View>

          <JobPhotos bookingId={data.id} />

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Crew</Text>
            {data.job_assignments.map((assignment) => (
              <Text key={assignment.technician_id} style={styles.body}>
                {assignment.crew_role === 'lead' ? 'Lead' : 'Helper'} ·{' '}
                {assignment.status.replaceAll('_', ' ')}
              </Text>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>History</Text>
            {data.booking_status_history.length === 0 ? (
              <Text style={styles.caption}>No transitions recorded yet.</Text>
            ) : (
              data.booking_status_history.map((row, index) => (
                <Text key={`${row.to_status}-${index}`} style={styles.caption}>
                  {row.from_status ? `${row.from_status} → ` : ''}
                  {row.to_status} · {formatDay(row.changed_at)}
                </Text>
              ))
            )}
          </View>
        </ScrollView>

        {finishing ? (
          <View style={styles.footer}>
            <TextField
              label="Billed hours"
              value={hours}
              onChangeText={setHours}
              keyboardType="decimal-pad"
              placeholder={hourly ? 'e.g. 2.5' : 'Optional'}
            />
            <Button label="Confirm completion" onPress={submitFinish} loading={running.isPending} />
            <Button
              label="Cancel"
              variant="ghost"
              onPress={() => {
                setFinishing(false);
                setHours('');
              }}
            />
          </View>
        ) : canTravel || canStart || canComplete ? (
          <View style={styles.footer}>
            {canTravel ? (
              <Button
                label={ACTION_LABELS.on_the_way}
                onPress={() => running.mutate({ action: 'on_the_way' })}
                loading={running.isPending && running.variables?.action === 'on_the_way'}
                disabled={running.isPending}
              />
            ) : null}
            {canStart ? (
              <Button
                label={ACTION_LABELS.start_job}
                variant={canTravel ? 'secondary' : 'primary'}
                onPress={() => running.mutate({ action: 'start_job' })}
                loading={running.isPending && running.variables?.action === 'start_job'}
                disabled={running.isPending}
              />
            ) : null}
            {canComplete ? (
              <Button
                label={ACTION_LABELS.complete_job}
                onPress={() => void startCompletion()}
                loading={running.isPending && running.variables?.action === 'complete_job'}
                disabled={running.isPending}
              />
            ) : null}
          </View>
        ) : null}
        </>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...text.h3, flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[2] },
  content: { padding: space[4], gap: space[3], paddingBottom: space[10] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  status: { ...text.caption, color: colors.green700, textTransform: 'capitalize' },
  when: { ...text.h2 },
  price: { ...text.price },
  sectionTitle: { ...text.caption, color: colors.textMuted, textTransform: 'uppercase' },
  body: { ...text.body },
  bodyStrong: { ...text.bodyM },
  caption: { ...text.caption },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  link: { ...text.bodyM, color: colors.green500 },
  cashRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  line: { gap: 2 },
  notes: { ...text.body, backgroundColor: colors.bg, borderRadius: radius.input, padding: space[3], marginTop: space[1] },
  errorTitle: { ...text.h3 },
  errorBody: { ...text.caption, textAlign: 'center' },
  footer: {
    padding: space[4],
    gap: space[2],
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
