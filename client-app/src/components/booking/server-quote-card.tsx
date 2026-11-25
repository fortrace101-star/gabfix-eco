import { CalendarDays, Clock3, Sparkles } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { ServerQuoteRequest } from '@/lib/api/quotes';
import { shortDate } from '@/lib/plans';
import type { QuoteStatus } from '@/store/quotes';
import { colors, font, radius, shadow, space, text } from '@/theme';
import { ugx } from '@/utils/format';

const LABELS: Record<ServerQuoteRequest['status'], string> = {
  requested: 'Awaiting quote',
  inspection_required: 'Inspection needed',
  inspection_scheduled: 'Inspection scheduled',
  inspected: 'Inspected',
  quoted: 'Quote ready',
  accepted: 'Accepted',
  declined: 'Closed',
  expired: 'Expired',
};

const localStatus = (status: ServerQuoteRequest['status']): QuoteStatus | null => {
  switch (status) {
    case 'requested':
      return 'pending';
    case 'inspection_required':
      return 'inspection_needed';
    case 'inspection_scheduled':
      return 'inspection_scheduled';
    case 'inspected':
      return 'inspected';
    case 'quoted':
      return 'quoted';
    case 'accepted':
      return 'accepted';
    default:
      return null;
  }
};

const toneFor = (status: ServerQuoteRequest['status']) => {
  const local = localStatus(status);
  if (local === 'pending' || local === 'inspection_needed') {
    return { bg: colors.warningBg, fg: colors.yellow800 };
  }
  if (local === null) return { bg: colors.disabledBg, fg: colors.textMuted };
  if (local === 'inspection_scheduled') return { bg: colors.infoBg, fg: colors.info };
  return { bg: colors.successBg, fg: colors.success };
};

const dayLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

/** A quote request the desk can already see, with whatever state it has reached. */
export function ServerQuoteCard({ quote }: { quote: ServerQuoteRequest }) {
  const tone = toneFor(quote.status);
  const needsInspection = quote.status === 'inspection_required';
  const inspectionScheduled = quote.inspectionAtISO !== null;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleWrap}>
          <Text style={styles.title} maxFontSizeMultiplier={1.3} numberOfLines={1}>
            {quote.serviceName}
          </Text>
          <Text style={styles.id} maxFontSizeMultiplier={1.2}>
            {quote.reference}
          </Text>
        </View>
        <View style={[styles.chip, { backgroundColor: tone.bg }]}>
          <Text style={[styles.chipText, { color: tone.fg }]} maxFontSizeMultiplier={1.2}>
            {LABELS[quote.status]}
          </Text>
        </View>
      </View>

      {quote.amount !== null ? (
        <View style={styles.amountRow}>
          <Sparkles size={16} color={colors.green700} strokeWidth={2} />
          <Text style={styles.amount} maxFontSizeMultiplier={1.3}>
            {ugx(quote.amount)}
          </Text>
          {quote.status === 'quoted' && quote.expiresAtISO ? (
            <Text style={styles.metaText} maxFontSizeMultiplier={1.2}>
              · valid until {shortDate(quote.expiresAtISO.slice(0, 10))}
            </Text>
          ) : null}
        </View>
      ) : null}

      {quote.scheduledStartISO ? (
        <View style={styles.metaRow}>
          <CalendarDays size={16} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.metaText} maxFontSizeMultiplier={1.2}>
            Requested for {dayLabel(quote.scheduledStartISO)}
          </Text>
        </View>
      ) : null}

      {inspectionScheduled ? (
        <View style={styles.metaRow}>
          <CalendarDays size={16} color={colors.green700} strokeWidth={2} />
          <Text style={styles.metaText} maxFontSizeMultiplier={1.2}>
            Inspection on {dayLabel(quote.inspectionAtISO!)}
          </Text>
        </View>
      ) : null}

      {needsInspection ? (
        <View style={styles.metaRow}>
          <Clock3 size={16} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.metaText} maxFontSizeMultiplier={1.2}>
            We will call you to book a short inspection before pricing it.
          </Text>
        </View>
      ) : null}

      {quote.status === 'requested' ? (
        <View style={styles.metaRow}>
          <Clock3 size={16} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.metaText} maxFontSizeMultiplier={1.2}>
            With our team for pricing · we reply within 24 hours.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
    ...shadow.card,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  titleWrap: { flex: 1, gap: 2 },
  title: { ...text.h3 },
  id: { ...text.caption },
  chip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontFamily: font.bodySemi },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { ...text.h3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { ...text.caption, flex: 1 },
});
