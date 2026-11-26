import { CalendarDays, Check, Clock3, Sparkles, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { respondToQuote, type ServerQuoteRequest } from '@/lib/api/quotes';
import { shortDate } from '@/lib/plans';
import { addBooking, getBookings } from '@/store/bookings';
import { syncQuoteRequests } from '@/store/quotes';
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

const toneFor = (status: ServerQuoteRequest['status']) => {
  if (status === 'requested' || status === 'inspection_required') {
    return { bg: colors.warningBg, fg: colors.yellow800 };
  }
  if (status === 'declined' || status === 'expired') {
    return { bg: colors.disabledBg, fg: colors.textMuted };
  }
  if (status === 'inspection_scheduled') return { bg: colors.infoBg, fg: colors.info };
  if (status === 'quoted') return { bg: colors.successBg, fg: colors.success };
  return { bg: colors.successBg, fg: colors.success };
};

const dayLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const toDateISO = (iso: string | null): string | undefined => {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toTime = (iso: string | null): string | undefined => {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/** A quote request the desk can already see, with whatever state it has reached. */
export function ServerQuoteCard({ quote }: { quote: ServerQuoteRequest }) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const tone = toneFor(quote.status);
  const needsInspection = quote.status === 'inspection_required';
  const inspectionScheduled = quote.inspectionAtISO !== null;

  const onRespond = async (action: 'accept' | 'decline') => {
    if (busy) return;
    setBusy(action);
    try {
      const result = await respondToQuote(quote.quoteId, action);
      if (action === 'accept') {
        const booking = result.booking;
        const total =
          typeof booking.total_price === 'number'
            ? booking.total_price
            : Number(booking.total_price ?? quote.amount ?? 0);
        const firstItem = booking.booking_items?.[0]?.services ?? null;
        const address = booking.addresses;
        const reference = booking.reference || quote.reference;
        const crew = result.quote.crew ?? [];
        const lead = crew.find((member) => member.role === 'lead') ?? crew[0];
        const alreadyLocal = getBookings().some(
          (item) => item.id === reference || item.id === booking.id,
        );
        if (!alreadyLocal) {
          addBooking({
            id: reference,
            serviceSlug: firstItem?.slug ?? 'custom',
            serviceName: firstItem?.name ?? quote.serviceName,
            status: 'upcoming',
            createdAtISO: new Date().toISOString(),
            dateISO: toDateISO(booking.scheduled_start ?? quote.scheduledStartISO),
            startTime: toTime(booking.scheduled_start ?? quote.scheduledStartISO),
            area: address?.area ?? undefined,
            street: address?.line1 ?? undefined,
            cleaners: 1,
            hours: 0,
            total,
            paid: 0,
            balance: total,
            cleanerId: lead?.id,
            cleanerName: lead?.name,
            assignedAtISO: lead ? new Date().toISOString() : undefined,
          });
        }
      }
      await syncQuoteRequests();
      if (action === 'accept') {
        Alert.alert('Quote accepted', 'Your booking is confirmed. You can find it in Upcoming.');
      }
    } catch (error) {
      Alert.alert(
        'Could not update the quote',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    } finally {
      setBusy(null);
    }
  };

  const confirmDecline = () => {
    Alert.alert('Decline this quote?', 'The booking will stay closed unless you request a new one.', [
      { text: 'Keep quote', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => void onRespond('decline') },
    ]);
  };

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

      {quote.status === 'quoted' ? (
        <View style={styles.actions}>
          <Button
            label="Accept quote"
            onPress={() => void onRespond('accept')}
            loading={busy === 'accept'}
            disabled={busy !== null}
            icon={Check}
            style={styles.actionBtn}
            small
          />
          <Button
            label="Decline"
            variant="secondary"
            onPress={confirmDecline}
            loading={busy === 'decline'}
            disabled={busy !== null}
            icon={X}
            style={styles.actionBtn}
            small
          />
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
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  amount: { ...text.h3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { ...text.caption, flex: 1 },
  actions: { flexDirection: 'row', gap: space[2], marginTop: space[1] },
  actionBtn: { flex: 1 },
});
