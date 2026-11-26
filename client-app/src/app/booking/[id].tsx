import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ArrowLeft, CalendarDays, CircleHelp, Clock3, FileText, MapPin, Navigation, Phone, Star, Users, Wallet, XCircle } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CancelSheet } from '@/components/booking/cancel-sheet';
import { RescheduleSheet } from '@/components/booking/reschedule-sheet';
import { ScopeSummary } from '@/components/booking/scope-summary';
import { slotLabel } from '@/components/booking/slot-chips';
import { UploadStatus } from '@/components/booking/upload-status';
import { Avatar } from '@/components/ui/avatar';
import {
  PaymentMethodSheet,
  type BalancePaymentSelection,
} from '@/components/wallet/payment-method-sheet';
import { Button } from '@/components/ui/button';
import { assigneeLabel, cleanerById } from '@/config/cleaners';
import { mock } from '@/config/mock';
import { minimumDeposit } from '@/config/payments';
import { paymentMethodLabel } from '@/lib/booking-policy';
import { retryBookingUploads } from '@/lib/media-upload';
import { buildRebookDraft } from '@/lib/rebook';
import { startRebookDraft } from '@/store/booking';
import {
  type BookingStatus,
  completeBooking,
  getBookingById,
  skipBookingRating,
  syncBookingAssignments,
  useBookings,
} from '@/store/bookings';
import { retryFailedUploads, useMediaUploads } from '@/store/media-uploads';
import { useReviews } from '@/store/reviews';
import { colors, font, radius, shadow, space, text } from '@/theme';
import { hoursLabel, ugx } from '@/utils/format';

const statusMeta: Record<BookingStatus, { label: string; bg: string; fg: string; note: string }> = {
  upcoming: {
    label: 'Confirmed',
    bg: colors.successBg,
    fg: colors.green700,
    note: 'Your booking is confirmed. We will assign a cleaner and keep you updated.',
  },
  completed: {
    label: 'Completed',
    bg: colors.infoBg,
    fg: colors.info,
    note: 'This booking has been completed.',
  },
  cancelled: {
    label: 'Cancelled',
    bg: colors.errorBg,
    fg: colors.error,
    note: 'This booking was cancelled.',
  },
};

const parseISODate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Icon size={18} color={colors.green700} strokeWidth={2} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel} maxFontSizeMultiplier={1.2}>
          {label}
        </Text>
        <Text style={styles.infoValue} maxFontSizeMultiplier={1.3}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryLabelStrong]} maxFontSizeMultiplier={1.2}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, strong && styles.summaryValueStrong]} maxFontSizeMultiplier={1.3}>
        {value}
      </Text>
    </View>
  );
}

/** P15b Booking detail (local snapshot saved on this device). */
export default function BookingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const id = typeof params.id === 'string' ? params.id : '';
  // Subscribe so the screen updates if store hydrates after mount.
  useBookings();
  const reviews = useReviews();
  const booking = id ? getBookingById(id) : undefined;
  const review = reviews.find((item) => item.bookingId === booking?.id);
  const uploads = useMediaUploads(booking?.id);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payKind, setPayKind] = useState<'deposit' | 'balance' | null>(null);

  // Dispatch assigns the crew on another device, so pull their choice when this
  // screen opens instead of relying on the Bookings tab having synced already.
  useEffect(() => {
    if (id) void syncBookingAssignments();
  }, [id]);

  if (!booking) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.back}>
            <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
          </Pressable>
          <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>
            Booking
          </Text>
          <View style={styles.back} />
        </View>
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle} maxFontSizeMultiplier={1.3}>
            Booking not found
          </Text>
          <Text style={styles.notFoundBody} maxFontSizeMultiplier={1.3}>
            This booking may not be saved on this device yet.
          </Text>
          <Button label="Back to bookings" variant="secondary" onPress={() => router.replace('/(tabs)/bookings')} />
        </View>
      </SafeAreaView>
    );
  }

  const meta = statusMeta[booking.status];
  const cleaner = cleanerById(booking.cleanerId);
  const role = assigneeLabel(cleaner);
  const showRatePrompt =
    booking.status === 'completed' && !review && !booking.ratingSkippedAtISO;
  const when = booking.dateISO
    ? `${parseISODate(booking.dateISO).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}${booking.startTime ? ` · ${slotLabel(booking.startTime)}` : ''}`
    : 'Time to confirm';
  const where = [booking.area, booking.street].filter(Boolean).join(', ') || 'Address to confirm';
  const propertyLabel =
    booking.propertyType === 'apartment'
      ? 'Apartment'
      : booking.propertyType === 'office'
        ? 'Office'
        : booking.propertyType === 'house'
          ? 'House'
          : booking.propertyType;
  const planLabel =
    booking.paymentPlan === 'full_now'
      ? 'Pay in full'
      : booking.paymentPlan === 'deposit'
        ? '30% deposit'
        : booking.paymentPlan === 'after_service'
          ? 'Pay after service'
          : booking.paymentPlan ?? '—';
  const methodLabel =
    booking.paymentMethod === 'mtn_momo'
      ? 'MTN MoMo'
      : booking.paymentMethod === 'airtel_money'
        ? 'Airtel Money'
        : booking.paymentMethod === 'visa_card'
          ? 'Visa card'
          : booking.paymentMethod === 'cash'
            ? 'Cash'
            : booking.paymentMethod ?? '—';

  const depositAmount = Math.min(minimumDeposit(booking.total), booking.balance);
  const payAmount = payKind === 'deposit' ? depositAmount : booking.balance;

  const onPayContinue = (selection: BalancePaymentSelection) => {
    if (!payKind) return;
    // A full amount clears the booking; anything smaller is recorded as a part-payment.
    const kind = selection.amount >= booking.balance ? 'balance' : 'deposit';
    router.push({
      pathname: '/payment/[id]',
      params: {
        id: booking.id,
        bookingId: booking.id,
        kind,
        amount: String(selection.amount),
        method: selection.method,
        phone: selection.phone ?? '',
        last4: selection.last4 ?? 'new',
        saveNumber: selection.saveNumber ? '1' : '0',
        saveCard: selection.saveCard ? '1' : '0',
      },
    } as never);
    setPayKind(null);
  };

  const bookAgain = () => {
    startRebookDraft(buildRebookDraft(booking));
    router.push({ pathname: '/book/[slug]/schedule', params: { slug: booking.serviceSlug } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.back}>
          <ArrowLeft size={22} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3} numberOfLines={1}>
          {booking.id}
        </Text>
        <View style={styles.back} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={[styles.banner, { backgroundColor: meta.bg }]}>
          <Text style={[styles.bannerTitle, { color: meta.fg }]} maxFontSizeMultiplier={1.3}>
            {meta.label}
          </Text>
          <Text style={styles.bannerNote} maxFontSizeMultiplier={1.3}>
            {meta.note}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
            {booking.serviceName}
          </Text>
          <InfoRow icon={CalendarDays} label="When" value={when} />
          {booking.rescheduledAtISO ? (
            <InfoRow
              icon={Clock3}
              label="Rescheduled"
              value={new Date(booking.rescheduledAtISO).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            />
          ) : null}
          <InfoRow icon={MapPin} label="Where" value={where} />
          <InfoRow
            icon={Users}
            label="Service details"
            value={`${booking.cleaners} cleaner${booking.cleaners === 1 ? '' : 's'} · ${hoursLabel(booking.hours)}`}
          />
          {propertyLabel ? (
            <InfoRow icon={Clock3} label="Property" value={propertyLabel} />
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
            {role}
          </Text>
          {booking.cleanerName ? (
            <>
              <View style={styles.assigneeRow}>
                <Avatar uri={cleaner?.photoUri} name={booking.cleanerName} size={56} />
                <View style={styles.assigneeCopy}>
                  <Text style={styles.assigneeName} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                    {booking.cleanerName}
                  </Text>
                  {cleaner ? (
                    <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                      {cleaner.rating.toFixed(1)} ★ · {cleaner.jobsDone} jobs done
                    </Text>
                  ) : null}
                </View>
              </View>
              {cleaner ? (
                <Button
                  label="View profile"
                  variant="secondary"
                  onPress={() => router.push(`/cleaner/${cleaner.id}` as never)}
                />
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.3}>
                A {role.toLowerCase()} will be assigned before your appointment. You’ll be
                notified once assigned.
              </Text>
              {mock.assignment.enabled ? (
                <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.3}>
                  A {role.toLowerCase()} is usually assigned within a few minutes.
                </Text>
              ) : null}
            </>
          )}
        </View>

        {booking.scope || (booking.media?.length ?? 0) > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
              Job details
            </Text>
            <ScopeSummary scope={booking.scope} media={booking.media ?? []} compact hideLabels />
            {uploads.length > 0 ? (
              <UploadStatus
                items={uploads}
                onRetry={() => {
                  const failed = retryFailedUploads(booking.id);
                  if (failed.length > 0) void retryBookingUploads(booking.id, booking.media ?? []);
                }}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
            Payment summary
          </Text>
          {booking.quoteRequestedAtISO ? (
            <>
              <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.3}>
                We&apos;re pricing this job from your details. You&apos;ll get a quote to approve and
                nothing is charged until you accept it.
              </Text>
              <SummaryRow label="Quote" value="Awaiting our price" strong />
            </>
          ) : (
            <>
              <SummaryRow label="Plan" value={planLabel} />
              <SummaryRow label="Method" value={methodLabel} />
              <SummaryRow label="Total" value={ugx(booking.total)} />
              <SummaryRow label="Paid" value={ugx(booking.paid)} />
              <SummaryRow
                label={booking.balance > 0 ? 'Balance due' : 'Balance'}
                value={ugx(booking.balance)}
                strong
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View receipt"
                hitSlop={8}
                onPress={() => router.push(`/booking/${booking.id}/receipt` as never)}
                style={styles.receiptLink}>
                <FileText size={16} color={colors.green700} strokeWidth={2} />
                <Text style={styles.receiptText} maxFontSizeMultiplier={1.2}>
                  View receipt
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {booking.status === 'completed' && review ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
              Your review
            </Text>
            {review.jobStars ? (
              <View style={styles.reviewRow}>
                <Text style={styles.summaryLabel} maxFontSizeMultiplier={1.2}>
                  Job
                </Text>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      size={18}
                      color={value <= (review.jobStars ?? 0) ? colors.yellow600 : colors.border}
                      fill={value <= (review.jobStars ?? 0) ? colors.yellow600 : 'transparent'}
                      strokeWidth={1.8}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {review.cleanerStars ? (
              <View style={styles.reviewRow}>
                <Text style={styles.summaryLabel} maxFontSizeMultiplier={1.2}>
                  {role}
                </Text>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      size={18}
                      color={value <= (review.cleanerStars ?? 0) ? colors.yellow600 : colors.border}
                      fill={value <= (review.cleanerStars ?? 0) ? colors.yellow600 : 'transparent'}
                      strokeWidth={1.8}
                    />
                  ))}
                </View>
              </View>
            ) : null}
            {review.comment ? (
              <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.3}>
                “{review.comment}”
              </Text>
            ) : null}
          </View>
        ) : null}

        {showRatePrompt ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
              How was your clean?
            </Text>
            <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.3}>
              Rating is optional. Rate the job and {booking.cleanerName ?? 'your cleaner'}, and add
              a tip if you like.
            </Text>
            <Button
              label="Rate your clean"
              icon={Star}
              onPress={() => router.push(`/booking/${booking.id}/rate` as never)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip rating for now"
              hitSlop={8}
              onPress={() => skipBookingRating(booking.id)}
              style={styles.skipRating}>
              <Text style={styles.skipRatingText} maxFontSizeMultiplier={1.2}>
                Skip for now
              </Text>
            </Pressable>
          </View>
        ) : null}

        {booking.status === 'cancelled' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
              Cancellation
            </Text>
            {booking.cancelReason ? (
              <SummaryRow label="Reason" value={booking.cancelReason} />
            ) : null}
            {booking.lateFee ? (
              <SummaryRow label="Late fee" value={ugx(booking.lateFee)} />
            ) : null}
            {booking.refundAmount ? (
              <SummaryRow
                label="Refund"
                value={`${ugx(booking.refundAmount)} to ${paymentMethodLabel(booking.paymentMethod)}`}
              />
            ) : (
              <SummaryRow label="Refund" value="Nothing to refund" />
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
            Manage booking
          </Text>
          <Text style={styles.bodyMuted} maxFontSizeMultiplier={1.3}>
            Reschedule and cancel here. Extras changes will connect once their backend is available.
          </Text>
          <View style={styles.actions}>
            {booking.balance > 0 && booking.status === 'upcoming' ? (
              <>
                {booking.paid === 0 && depositAmount > 0 && depositAmount < booking.balance ? (
                  <Button
                    label={`Pay ${ugx(depositAmount)} deposit`}
                    icon={Wallet}
                    onPress={() => setPayKind('deposit')}
                  />
                ) : null}
                <Button
                  label={booking.paid === 0 ? 'Pay full balance' : 'Pay balance'}
                  variant={
                    booking.paid === 0 && depositAmount < booking.balance ? 'secondary' : 'primary'
                  }
                  icon={Wallet}
                  onPress={() => setPayKind('balance')}
                />
              </>
            ) : null}
            {booking.status === 'upcoming' ? (
              <Button
                label="Track booking"
                variant="secondary"
                icon={Navigation}
                onPress={() => router.push(`/booking/${booking.id}/track` as never)}
              />
            ) : null}
            {booking.status === 'upcoming' ? (
              <Button
                label="Reschedule"
                variant="secondary"
                icon={CalendarDays}
                onPress={() => setRescheduleOpen(true)}
              />
            ) : null}
            {booking.status !== 'upcoming' ? (
              <Button label="Book again" variant="secondary" onPress={() => bookAgain()} />
            ) : null}
            <Button
              label="Contact support"
              variant="secondary"
              icon={Phone}
              onPress={() =>
                router.push({ pathname: '/help/contact', params: { bookingId: booking.id } } as Href)
              }
            />
            {booking.status === 'upcoming' ? (
              <Button
                label="Cancel booking"
                variant="dangerGhost"
                icon={XCircle}
                onPress={() => setCancelOpen(true)}
              />
            ) : null}
            {booking.status === 'upcoming' && mock.completion.devButton ? (
              <Button
                label="Mark job complete (demo)"
                variant="ghost"
                onPress={() => completeBooking(booking.id)}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerText} maxFontSizeMultiplier={1.2}>
            This is a local booking record saved on this device for demo purposes.
          </Text>
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Need help? Open help centre"
        onPress={() =>
          router.push({ pathname: '/help/contact', params: { bookingId: booking.id } } as Href)
        }
        style={[styles.needHelp, { bottom: insets.bottom + space[4] }]}>
        <CircleHelp size={20} color={colors.yellow500} strokeWidth={2} />
        <Text style={styles.needHelpText} maxFontSizeMultiplier={1.2}>
          Need help?
        </Text>
      </Pressable>

      <RescheduleSheet
        booking={booking}
        visible={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
      />
      <CancelSheet
        booking={booking}
        visible={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onBookAgain={() => {
          setCancelOpen(false);
          bookAgain();
        }}
      />
      <PaymentMethodSheet
        visible={payKind !== null}
        title={payKind === 'deposit' ? 'Pay deposit' : 'Pay balance'}
        subtitle={`${booking.serviceName} · ${booking.id}`}
        amount={payAmount}
        editableAmount
        maxAmount={booking.balance}
        onClose={() => setPayKind(null)}
        onContinue={onPayContinue}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...text.h3, color: colors.text, flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: space[4], paddingBottom: 120, gap: space[3] },
  banner: { borderRadius: radius.card, padding: space[4], gap: 4 },
  bannerTitle: { ...text.h3 },
  bannerNote: { ...text.bodyM, color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
    ...shadow.card,
  },
  cardTitle: { ...text.h3, color: colors.text, marginBottom: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: { flex: 1, gap: 2 },
  infoLabel: { ...text.caption, color: colors.textMuted },
  infoValue: { ...text.bodyM, color: colors.text },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { ...text.bodyM, color: colors.textMuted },
  summaryLabelStrong: { color: colors.text, fontFamily: font.bodySemi },
  summaryValue: { ...text.bodyM, color: colors.text },
  summaryValueStrong: { fontFamily: font.bodySemi },
  receiptLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space[1],
    paddingTop: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  receiptText: { ...text.bodyM, color: colors.green700, fontFamily: font.bodySemi },
  bodyMuted: { ...text.bodyM, color: colors.textMuted },
  reviewStars: { flexDirection: 'row', gap: 4, paddingVertical: 2 },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  assigneeCopy: { flex: 1, gap: 2 },
  assigneeName: { ...text.bodyM, fontFamily: font.bodySemi },
  skipRating: { alignSelf: 'center', paddingVertical: space[1] },
  skipRatingText: {
    ...text.bodyM,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  actions: { gap: space[2], marginTop: space[1] },
  footerNote: { alignItems: 'center', paddingHorizontal: space[3] },
  footerText: { ...text.caption, color: colors.textMuted, textAlign: 'center' },
  needHelp: {
    position: 'absolute',
    right: space[4],
    height: 48,
    borderRadius: radius.pill,
    paddingHorizontal: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.green900,
    zIndex: 10,
    ...shadow.floating,
  },
  needHelpText: {
    ...text.bodyM,
    fontFamily: font.bodySemi,
    color: colors.surface,
  },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space[6], gap: space[2] },
  notFoundTitle: { ...text.h3, color: colors.text, textAlign: 'center' },
  notFoundBody: { ...text.bodyM, color: colors.textMuted, textAlign: 'center', marginBottom: space[2] },
});
