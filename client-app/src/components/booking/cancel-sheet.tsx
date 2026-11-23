import { Check, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  cancellationOutcome,
  paymentMethodLabel,
  type CancellationOutcome,
} from '@/lib/booking-policy';
import { cancelBooking, type SavedBooking } from '@/store/bookings';
import { colors, font, radius, space, text } from '@/theme';
import { successHaptic } from '@/utils/haptics';
import { ugx } from '@/utils/format';

const REASONS = [
  'Change of plans',
  'Found another service',
  'Booked by mistake',
  'Price',
  'Other',
] as const;

const policyCopy = (booking: SavedBooking, outcome: CancellationOutcome): string => {
  if (!outcome.withinWindow) {
    return booking.paid > 0
      ? `Free cancellation. Your payment of ${ugx(outcome.refund)} will be refunded to ${paymentMethodLabel(
          booking.paymentMethod,
        )} (3 to 5 working days).`
      : 'Free cancellation. Nothing has been paid, so there is nothing to refund.';
  }

  if (outcome.chargedToAccount) {
    return `A late fee of ${ugx(outcome.lateFee)} will be added to your account and must be paid before your next booking.`;
  }

  return `This is within 24 hours. A late fee of ${ugx(outcome.lateFee)} applies; ${ugx(
    outcome.refund,
  )} of your payment will be refunded to ${paymentMethodLabel(booking.paymentMethod)}.`;
};

type Props = {
  booking: SavedBooking | null;
  visible: boolean;
  onClose: () => void;
  onBookAgain: () => void;
};

/** P16 cancellation flow with reasons, policy and the late-fee acknowledgement. */
export function CancelSheet({ booking, visible, onClose, onBookAgain }: Props) {
  if (!visible || !booking) return null;
  return <CancelBody booking={booking} onClose={onClose} onBookAgain={onBookAgain} />;
}

function CancelBody({
  booking,
  onClose,
  onBookAgain,
}: {
  booking: SavedBooking;
  onClose: () => void;
  onBookAgain: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [done, setDone] = useState(false);

  const outcome = cancellationOutcome(booking);
  const needsReason = reason === 'Other' ? otherText.trim().length > 0 : Boolean(reason);
  const canCancel = needsReason && (!outcome.withinWindow || understood);

  const onCancel = () => {
    if (!canCancel || !reason) return;
    cancelBooking(booking.id, {
      reason: reason === 'Other' ? `Other: ${otherText.trim()}` : reason,
      refundAmount: outcome.refund,
      lateFee: outcome.lateFee,
    });
    successHaptic();
    setDone(true);
  };

  return (
    <BottomSheet
      visible
      onDismiss={onClose}
      title={done ? undefined : 'Cancel booking'}
      subtitle={done ? undefined : `${booking.serviceName} · ${booking.id}`}
      contentContainerStyle={styles.content}
      footer={
        <View style={styles.footer}>
          {done ? (
            <>
              <Button label="Book again" onPress={onBookAgain} style={styles.fullWidth} />
              <Button label="Done" variant="ghost" onPress={onClose} />
            </>
          ) : (
            <>
              <Button label="Keep booking" onPress={onClose} />
              <Button
                label="Cancel booking"
                variant="destructive"
                disabled={!canCancel}
                onPress={onCancel}
              />
            </>
          )}
        </View>
      }>
      {done ? (
        <View style={styles.success}>
          <View style={styles.successIcon}>
            <Check size={30} color={colors.surface} strokeWidth={3} />
          </View>
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>
            Booking cancelled
          </Text>
          <Text style={styles.successBody} maxFontSizeMultiplier={1.3}>
            {outcome.withinWindow
              ? outcome.chargedToAccount
                ? `A late fee of ${ugx(outcome.lateFee)} has been added to your account.`
                : `A late fee of ${ugx(outcome.lateFee)} was applied and ${ugx(
                    outcome.refund,
                  )} will be refunded to ${paymentMethodLabel(booking.paymentMethod)} (3 to 5 working days).`
              : booking.paid > 0
                ? `${ugx(outcome.refund)} will be refunded to ${paymentMethodLabel(
                    booking.paymentMethod,
                  )} (3 to 5 working days).`
                : 'Nothing was paid, so there is nothing to refund.'}
          </Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>
            Why are you cancelling?
          </Text>
          <View style={styles.chips}>
            {REASONS.map((option) => {
              const selected = reason === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  aria-checked={selected}
                  onPress={() => setReason(option)}
                  style={[styles.chip, selected && styles.chipOn]}>
                  <Text
                    style={[styles.chipText, selected && styles.chipTextOn]}
                    maxFontSizeMultiplier={1.2}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {reason === 'Other' ? (
            <TextInput
              accessibilityLabel="Tell us why you are cancelling"
              maxLength={200}
              multiline
              onChangeText={setOtherText}
              placeholder="Tell us a little more"
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              value={otherText}
            />
          ) : null}

          <View style={[styles.policy, outcome.withinWindow && styles.policyWarn]}>
            {outcome.withinWindow ? (
              <TriangleAlert size={20} color={colors.yellow800} strokeWidth={2} />
            ) : null}
            <Text
              style={[styles.policyText, outcome.withinWindow && styles.policyTextWarn]}
              maxFontSizeMultiplier={1.3}>
              {policyCopy(booking, outcome)}
            </Text>
          </View>

          {outcome.withinWindow ? (
            <Checkbox
              checked={understood}
              onChange={setUnderstood}
              accessibilityLabel="I understand the late fee"
              label="I understand the late fee"
            />
          ) : null}
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { ...text.h2 },
  content: { paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[1], gap: space[3] },
  sectionTitle: { ...text.h3, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: 36,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.green500, borderColor: colors.green500 },
  chipText: { ...text.caption, color: colors.text },
  chipTextOn: { color: colors.surface, fontFamily: font.bodySemi },
  input: {
    minHeight: 96,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: space[3],
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    textAlignVertical: 'top',
  },
  policy: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.successBg,
    borderRadius: 16,
    padding: space[3],
  },
  policyWarn: { backgroundColor: colors.warningBg },
  policyText: { ...text.caption, flex: 1, color: colors.green700 },
  policyTextWarn: { color: colors.yellow800 },
  footer: { gap: space[2] },
  fullWidth: { alignSelf: 'stretch' },
  success: { alignItems: 'center', gap: space[3], paddingVertical: space[6], paddingHorizontal: space[4] },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBody: {
    ...text.bodyM,
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: font.body,
  },
});
