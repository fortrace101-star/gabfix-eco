import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CircleAlert, MapPin, Phone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
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

import { InspectionAddenda } from '@/components/inspection-addenda';
import { InspectionEvidence } from '@/components/inspection-evidence';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { formatDay, formatMoney, formatWindow } from '@/lib/format';
import { formatUGPhone, toUgE164 } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { colors, font, radius, shadow, space, text } from '@/theme';

type CheckStatus = 'ok' | 'issue';
type CheckItem = { label: string; status: CheckStatus };

type InspectionDetail = {
  id: string;
  status: string;
  scheduled_at: string | null;
  submitted_at: string | null;
  required_note: string | null;
  notes: string | null;
  checklist: unknown;
  measurements: unknown;
  recommended_hours: number | null;
  recommended_crew: number | null;
  booking_reference: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  address_line: string | null;
  area: string | null;
  services: string | null;
  quote_description: string | null;
  quote_amount: number | null;
};

/** What the desk needs answered on every visit; the technician flags what is not fine. */
export const CHECKLIST_ITEMS = [
  'Access to the property',
  'Size and condition of the space',
  'Water and power available',
  'Materials and equipment needed',
  'Safety hazards on site',
];

const statusLabels: Record<string, string> = {
  required: 'Needs a visit',
  scheduled: 'Visit booked',
  in_progress: 'In progress',
  submitted: 'Report sent',
  withdrawn: 'Withdrawn',
};

/** Optional measurements the desk prices from; stored as label → value. */
export const MEASUREMENT_FIELDS = [
  { key: 'Floor area (m²)', placeholder: 'e.g. 40' },
  { key: 'Rooms', placeholder: 'e.g. 3' },
  { key: 'Ceiling height (m)', placeholder: 'e.g. 2.8' },
];

const readMeasurements = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '',
  );
  return Object.fromEntries(entries);
};

const readChecklist = (value: unknown): CheckItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { label: string; status: CheckStatus } =>
      !!item && typeof item === 'object' && typeof (item as { label?: unknown }).label === 'string',
    )
    .map((item) => ({ label: item.label, status: item.status === 'issue' ? 'issue' : 'ok' }));
};

async function fetchInspection(id: string): Promise<InspectionDetail | null> {
  const { data, error } = await supabase.rpc('inspection_detail', { p_inspection: id });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as InspectionDetail[];
  return rows[0] ?? null;
}

export default function InspectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [checks, setChecks] = useState<Record<string, CheckStatus>>({});
  const [notes, setNotes] = useState('');
  const [hours, setHours] = useState('');
  const [crew, setCrew] = useState('');
  const [measurements, setMeasurements] = useState<Record<string, string>>({});

  const { data, error, isLoading } = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => fetchInspection(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (!data) return;
    const saved = readChecklist(data.checklist);
    const next: Record<string, CheckStatus> = {};
    for (const label of CHECKLIST_ITEMS) {
      next[label] = saved.find((item) => item.label === label)?.status ?? 'ok';
    }
    setChecks(next);
    setNotes(data.notes ?? '');
    setHours(data.recommended_hours ? String(data.recommended_hours) : '');
    setCrew(data.recommended_crew ? String(data.recommended_crew) : '');
    setMeasurements(readMeasurements(data.measurements));
  }, [data]);

  const submit = useMutation({
    mutationFn: async () => {
      const checklist: CheckItem[] = CHECKLIST_ITEMS.map((label) => ({
        label,
        status: checks[label] ?? 'ok',
      }));
      const parsedHours = hours.trim() ? Number(hours.replace(',', '.')) : undefined;
      const parsedCrew = crew.trim() ? Number(crew) : undefined;
      const sized = Object.fromEntries(
        MEASUREMENT_FIELDS.map(({ key }) => [key, (measurements[key] ?? '').trim()]).filter(
          (entry) => entry[1] !== '',
        ),
      );
      const { error: rpcError } = await supabase.rpc('submit_inspection', {
        p_inspection: id,
        p_checklist: checklist,
        p_notes: notes.trim(),
        p_measurements: sized,
        ...(parsedHours != null ? { p_recommended_hours: parsedHours } : {}),
        ...(parsedCrew != null ? { p_recommended_crew: parsedCrew } : {}),
      });
      if (rpcError) throw new Error(rpcError.message);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inspection', id] }),
        queryClient.invalidateQueries({ queryKey: ['inspections'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
      ]);
      Alert.alert('Report sent', 'The desk can price this quote from your report.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    },
    onError: (mutationError) => {
      Alert.alert('Could not send the report', mutationError.message);
    },
  });

  const sendReport = () => {
    if (!notes.trim()) {
      Alert.alert('Add your findings', 'Write what you saw so the desk can price the job.');
      return;
    }
    if (hours.trim() && (!Number.isFinite(Number(hours.replace(',', '.'))) || Number(hours) <= 0)) {
      Alert.alert('Check the hours', 'Recommended hours must be a positive number.');
      return;
    }
    if (crew.trim() && (!Number.isInteger(Number(crew)) || Number(crew) <= 0)) {
      Alert.alert('Check the crew size', 'Recommended cleaners must be a whole number.');
      return;
    }
    submit.mutate();
  };

  const submitted = data?.status === 'submitted';
  const flagged = CHECKLIST_ITEMS.filter((label) => checks[label] === 'issue').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to inspections"
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.back}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {data?.booking_reference ?? 'Inspection'}
        </Text>
        <View style={styles.back} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.green500} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Could not load this inspection</Text>
          <Text style={styles.errorBody}>{error.message}</Text>
        </View>
      ) : !data ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Inspection not found</Text>
          <Text style={styles.errorBody}>
            It may have been withdrawn by the desk. Pull back to refresh your list.
          </Text>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              <Text style={styles.status}>{statusLabels[data.status] ?? data.status}</Text>
              <Text style={styles.when}>
                {data.scheduled_at
                  ? formatDay(data.scheduled_at)
                  : data.scheduled_start
                    ? formatDay(data.scheduled_start)
                    : 'No visit booked'}
                {data.scheduled_start && data.scheduled_end
                  ? ` · ${formatWindow(data.scheduled_start, data.scheduled_end)}`
                  : ''}
              </Text>
              <Text style={styles.service}>{data.services ?? 'Inspection visit'}</Text>
              {data.quote_description ? (
                <Text style={styles.caption}>{data.quote_description}</Text>
              ) : null}
            </View>

            {data.required_note ? (
              <View style={[styles.card, styles.askCard]}>
                <View style={styles.askHead}>
                  <CircleAlert size={16} color={colors.warning} />
                  <Text style={styles.sectionTitle}>What the desk needs</Text>
                </View>
                <Text style={styles.body}>{data.required_note}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Customer</Text>
              <Text style={styles.bodyStrong}>{data.customer_name ?? 'Name not recorded'}</Text>
              {data.customer_phone ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() =>
                    void Linking.openURL(
                      `tel:${toUgE164(data.customer_phone ?? '') ?? data.customer_phone}`,
                    )
                  }
                  style={styles.linkRow}>
                  <Phone size={16} color={colors.green500} />
                  <Text style={styles.link}>{formatUGPhone(data.customer_phone)}</Text>
                </Pressable>
              ) : null}
              <View style={styles.linkRow}>
                <MapPin size={16} color={colors.textMuted} />
                <Text style={styles.body} numberOfLines={2}>
                  {[data.address_line, data.area].filter(Boolean).join(', ') || 'Address to confirm'}
                </Text>
              </View>
              {data.quote_amount != null ? (
                <Text style={styles.caption}>Current quote {formatMoney(data.quote_amount)}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Checklist</Text>
              {CHECKLIST_ITEMS.map((label) => {
                const status = checks[label] ?? 'ok';
                const isIssue = status === 'issue';
                return (
                  <View key={label} style={styles.checkRow}>
                    <Text style={[styles.body, styles.checkLabel]}>{label}</Text>
                    {submitted ? (
                      <View style={[styles.chip, isIssue ? styles.chipIssue : styles.chipOk]}>
                        <Text style={[styles.chipText, isIssue ? styles.chipTextIssue : styles.chipTextOk]}>
                          {isIssue ? 'Issue' : 'Fine'}
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${label}: ${isIssue ? 'issue found, tap to clear' : 'fine, tap to flag'}`}
                        onPress={() =>
                          setChecks((current) => ({
                            ...current,
                            [label]: isIssue ? 'ok' : 'issue',
                          }))
                        }
                        style={[styles.chip, isIssue ? styles.chipIssue : styles.chipOk]}>
                        <Text
                          style={[styles.chipText, isIssue ? styles.chipTextIssue : styles.chipTextOk]}>
                          {isIssue ? 'Issue' : 'Fine'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
              {!submitted && flagged > 0 ? (
                <Text style={styles.flagged}>
                  {flagged} item{flagged === 1 ? '' : 's'} flagged for the desk
                </Text>
              ) : null}
            </View>

            <InspectionEvidence inspectionId={data.id} readOnly={submitted} />

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Findings</Text>
              {submitted ? (
                <Text style={styles.body}>{data.notes || 'No notes were written.'}</Text>
              ) : (
                <TextField
                  label="What did you find?"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Condition, access, what the job needs"
                  autoCapitalize="sentences"
                />
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Measurements</Text>
              {submitted ? (
                <Text style={styles.body}>
                  {Object.entries(readMeasurements(data.measurements)).length
                    ? Object.entries(readMeasurements(data.measurements))
                        .map(([label, value]) => `${label}: ${value}`)
                        .join(' · ')
                    : 'No measurements were recorded.'}
                </Text>
              ) : (
                <>
                  {MEASUREMENT_FIELDS.map(({ key, placeholder }) => (
                    <TextField
                      key={key}
                      label={key}
                      value={measurements[key] ?? ''}
                      onChangeText={(value) =>
                        setMeasurements((current) => ({ ...current, [key]: value }))
                      }
                      keyboardType="decimal-pad"
                      placeholder={placeholder}
                    />
                  ))}
                  <Text style={styles.caption}>Optional; used to size the quote.</Text>
                </>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Recommendation</Text>
              {submitted ? (
                <Text style={styles.body}>
                  {data.recommended_hours ? `${data.recommended_hours} hours` : 'No hours given'}
                  {data.recommended_crew
                    ? ` · ${data.recommended_crew} cleaner${data.recommended_crew === 1 ? '' : 's'}`
                    : ''}
                </Text>
              ) : (
                <>
                  <TextField
                    label="Hours needed"
                    value={hours}
                    onChangeText={setHours}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 3.5"
                  />
                  <TextField
                    label="Cleaners needed"
                    value={crew}
                    onChangeText={setCrew}
                    keyboardType="number-pad"
                    placeholder="e.g. 2"
                  />
                </>
              )}
            </View>

            {submitted ? <InspectionAddenda inspectionId={data.id} /> : null}

            {submitted && data.submitted_at ? (
              <Text style={styles.caption}>Submitted {formatDay(data.submitted_at)}</Text>
            ) : null}
          </ScrollView>

          {!submitted ? (
            <View style={styles.footer}>
              <Button
                label="Send report to the desk"
                onPress={sendReport}
                loading={submit.isPending}
                disabled={submit.isPending}
              />
            </View>
          ) : null}
        </>
      )}
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
  askCard: { backgroundColor: colors.warningBg, borderColor: colors.yellow200 },
  askHead: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  status: { ...text.caption, color: colors.green700, textTransform: 'capitalize' },
  when: { ...text.h2 },
  service: { ...text.bodyM },
  sectionTitle: { ...text.caption, color: colors.textMuted, textTransform: 'uppercase' },
  body: { ...text.body },
  bodyStrong: { ...text.bodyM },
  caption: { ...text.caption },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  link: { ...text.bodyM, color: colors.green500 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    paddingVertical: space[1],
  },
  checkLabel: { flex: 1 },
  chip: { borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 4 },
  chipOk: { backgroundColor: colors.successBg },
  chipIssue: { backgroundColor: colors.errorBg },
  chipText: { ...text.caption, fontSize: 11, fontFamily: font.bodySemi },
  chipTextOk: { color: colors.success },
  chipTextIssue: { color: colors.error },
  flagged: { ...text.caption, color: colors.error },
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
