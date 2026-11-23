import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Check,
  Heart,
  ImagePlus,
  Smartphone,
  Star,
  Wallet,
  X,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { TopBar } from '@/components/ui/top-bar';
import { cleanerById } from '@/config/cleaners';
import { supportsNativeDriver } from '@/lib/animation';
import { getBookingById, skipBookingRating, useBookings } from '@/store/bookings';
import { useSavedCards, useSavedMobileMoney } from '@/store/payment-methods';
import { addReview, getReviewForBooking } from '@/store/reviews';
import { colors, font, radius, shadow, space, text } from '@/theme';
import { errorHaptic, selectionHaptic, successHaptic } from '@/utils/haptics';
import { ugx } from '@/utils/format';

const JOB_TAGS = ['On time', 'Spotless', 'Good value', 'Thorough'] as const;
const CLEANER_TAGS = ['Polite', 'Careful', 'Professional', 'Friendly'] as const;
const TIP_PRESETS = [2_000, 5_000, 10_000] as const;
const MAX_PHOTOS = 3;
const RATING_LABELS = ['Tap a star to rate', 'Not good', 'Could be better', 'Good', 'Great', 'Excellent'];

type TipMethod = {
  id: string;
  method: 'visa_card' | 'mtn_momo' | 'airtel_money';
  label: string;
  detail: string;
  phone?: string;
  last4?: string;
};

const maskedPhone = (phone: string): string => {
  if (phone.length < 5) return `+256 ${phone}`;
  return `+256 ${phone.slice(0, 2)} ••• ${phone.slice(-3)}`;
};

function Stars({
  value,
  onChange,
  reducedMotion,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  reducedMotion: boolean;
  label: string;
}) {
  return (
    <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarButton
          key={star}
          value={star}
          active={star <= value}
          reducedMotion={reducedMotion}
          onPress={() => onChange(star)}
        />
      ))}
    </View>
  );
}

function StarButton({
  value,
  active,
  reducedMotion,
  onPress,
}: {
  value: number;
  active: boolean;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const [scale] = useState(() => new Animated.Value(1));

  const select = () => {
    if (!reducedMotion) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.2, duration: 90, useNativeDriver: supportsNativeDriver }),
        Animated.timing(scale, { toValue: 1, duration: 90, useNativeDriver: supportsNativeDriver }),
      ]).start();
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
      accessibilityState={{ selected: active }}
      aria-checked={active}
      hitSlop={4}
      onPress={select}
      style={styles.starButton}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Star
          size={36}
          color={active ? colors.yellow600 : colors.border}
          fill={active ? colors.yellow600 : 'transparent'}
          strokeWidth={1.8}
        />
      </Animated.View>
    </Pressable>
  );
}

function TagRow({
  tags,
  selected,
  onToggle,
}: {
  tags: readonly string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <View style={styles.tags}>
      {tags.map((tag) => {
        const on = selected.includes(tag);
        return (
          <Pressable
            key={tag}
            accessibilityRole="checkbox"
            accessibilityLabel={tag}
            accessibilityState={{ checked: on }}
            aria-checked={on}
            onPress={() => onToggle(tag)}
            style={[styles.tag, on && styles.tagOn]}>
            <Text style={[styles.tagText, on && styles.tagTextOn]} maxFontSizeMultiplier={1.2}>
              {tag}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** P27f / S1 12.4: optional job and cleaner ratings, plus the tip. */
export default function RateBookingScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  useBookings();
  const booking = id ? getBookingById(id) : undefined;

  const cards = useSavedCards();
  const mobileMoney = useSavedMobileMoney();
  const [jobStars, setJobStars] = useState(0);
  const [cleanerStars, setCleanerStars] = useState(0);
  const [jobTags, setJobTags] = useState<string[]>([]);
  const [cleanerTags, setCleanerTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [tipChoice, setTipChoice] = useState<number | 'custom' | null>(null);
  const [customTip, setCustomTip] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [alreadyReviewed] = useState(() => Boolean(id && getReviewForBooking(id)));
  const [initialReview] = useState(() => (id ? getReviewForBooking(id) : undefined));

  const methods = useMemo<TipMethod[]>(() => {
    const cardMethods: TipMethod[] = cards.map((card) => ({
      id: card.id,
      method: 'visa_card',
      label: `Visa •••• ${card.last4}`,
      detail: `Expires ${card.expiry}`,
      last4: card.last4,
    }));
    const momoMethods: TipMethod[] = mobileMoney.map((method) => ({
      id: method.id,
      method: method.provider === 'MTN' ? 'mtn_momo' : 'airtel_money',
      label: `${method.provider} Mobile Money`,
      detail: maskedPhone(method.phone),
      phone: method.phone,
    }));
    return [...cardMethods, ...momoMethods];
  }, [cards, mobileMoney]);

  const selectedMethod = methods.find((method) => method.id === selectedMethodId) ?? methods[0];

  const tipAmount =
    tipChoice === 'custom'
      ? Math.max(0, Math.floor(Number(customTip.replace(/\D/g, '')) || 0))
      : (tipChoice ?? 0);

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => router.replace('/(tabs)/home'), 1_800);
    return () => clearTimeout(timer);
  }, [submitted]);

  if (!booking) {
    return (
      <View style={styles.screen}>
        <TopBar title="Rate your clean" />
        <EmptyState
          icon={Star}
          title="Booking not found"
          body="This booking may not be saved on this device yet."
          actionLabel="Back to bookings"
          onAction={() => router.replace('/(tabs)/bookings')}
        />
      </View>
    );
  }

  if (booking.status !== 'completed') {
    return (
      <View style={styles.screen}>
        <TopBar title="Rate your clean" />
        <EmptyState
          icon={Star}
          title="Reviews unlock after your clean"
          body="Once your cleaner has finished, come back here to rate the visit and add a tip."
          actionLabel="View booking"
          onAction={() => router.replace(`/booking/${booking.id}`)}
        />
      </View>
    );
  }

  if (alreadyReviewed) {
    const review = initialReview;
    return (
      <View style={styles.screen}>
        <TopBar title="Your review" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.thankCard}>
            <View style={styles.thankIcon}>
              <Check size={32} color={colors.surface} strokeWidth={2.6} />
            </View>
            <Text style={styles.thankTitle} maxFontSizeMultiplier={1.3}>
              Thanks for your feedback
            </Text>
            {review?.jobStars ? (
              <Text style={styles.thankBody} maxFontSizeMultiplier={1.3}>
                You rated the job {review.jobStars} star{review.jobStars === 1 ? '' : 's'}.
              </Text>
            ) : null}
            {review?.cleanerStars ? (
              <Text style={styles.thankBody} maxFontSizeMultiplier={1.3}>
                {review.cleanerName} got {review.cleanerStars} star
                {review.cleanerStars === 1 ? '' : 's'} from you.
              </Text>
            ) : null}
            {review?.comment ? (
              <Text style={styles.savedComment} maxFontSizeMultiplier={1.3}>
                “{review.comment}”
              </Text>
            ) : null}
            <Button label="Back to home" onPress={() => router.replace('/(tabs)/home')} />
          </View>
        </ScrollView>
      </View>
    );
  }

  const cleaner = cleanerById(booking.cleanerId);
  const cleanerName = booking.cleanerName ?? cleaner?.name ?? 'Your Gabfix cleaner';
  const role = cleaner?.kind === 'technician' ? 'technician' : 'cleaner';
  const firstName = cleanerName.split(' ')[0];

  const balanceMethod = booking.rebook?.payment?.balanceMethod ?? booking.paymentMethod ?? 'cash';
  const digitalBalance = booking.balance > 0 && balanceMethod !== 'cash';
  const cashBalance = booking.balance > 0 && balanceMethod === 'cash';
  const hasDigitalMethods = methods.length > 0;
  const canSend =
    jobStars > 0 || cleanerStars > 0 || comment.trim().length > 0 || tipAmount > 0;

  const pickPhotos = async () => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access in your device settings to add photos to your review.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.45,
      base64: true,
    });
    if (result.canceled) return;

    const additions = result.assets
      .slice(0, remaining)
      .map((asset) =>
        asset.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset.uri,
      )
      .filter(Boolean);
    setPhotos((current) => [...current, ...additions].slice(0, MAX_PHOTOS));
    setError('');
  };

  const toggleTag = (group: 'job' | 'cleaner', tag: string) => {
    selectionHaptic();
    const update = (current: string[]) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag];
    if (group === 'job') setJobTags(update);
    else setCleanerTags(update);
  };

  const submit = () => {
    if (!canSend) {
      errorHaptic();
      setError('Add a rating, a comment or a tip before sending.');
      return;
    }
    if (tipChoice === 'custom' && tipAmount === 0) {
      errorHaptic();
      setError('Enter a tip amount or choose No tip.');
      return;
    }
    if (tipAmount > 0 && !selectedMethod) {
      errorHaptic();
      setError('Add a digital payment method to send a tip in the app.');
      return;
    }

    setSubmitting(true);
    setError('');

    addReview({
      bookingId: booking.id,
      cleanerId: booking.cleanerId ?? cleaner?.id,
      cleanerName,
      jobStars: jobStars > 0 ? jobStars : undefined,
      cleanerStars: cleanerStars > 0 ? cleanerStars : undefined,
      tags: [...jobTags, ...cleanerTags],
      comment: comment.trim(),
      photos,
    });
    if (tipAmount > 0 && selectedMethod) {
      router.replace({
        pathname: '/payment/[id]',
        params: {
          id: booking.id,
          bookingId: booking.id,
          slug: booking.serviceSlug,
          amount: String(tipAmount),
          method: selectedMethod.method,
          phone: selectedMethod.phone ?? booking.phone ?? '',
          last4: selectedMethod.last4 ?? 'new',
          saveCard: '0',
          kind: 'tip',
        },
      });
      return;
    }

    successHaptic();
    setSubmitted(true);
  };

  const skip = () => {
    skipBookingRating(booking.id);
    router.replace('/(tabs)/home');
  };

  return (
    <View style={styles.screen}>
      <TopBar title="Rate your clean" onBack={() => router.back()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[10] }]}>
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>
          Rate your clean (optional)
        </Text>
        <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>
          Share as much or as little as you like — a star, a comment or a tip is enough.
        </Text>

        <View style={styles.cleanerCard}>
          <Avatar uri={cleaner?.photoUri} name={cleanerName} size={48} />
          <View style={styles.cleanerCopy}>
            <Text style={styles.cleanerName} maxFontSizeMultiplier={1.3} numberOfLines={1}>
              {cleanerName}
            </Text>
            <Text style={styles.cleanerMeta} maxFontSizeMultiplier={1.2} numberOfLines={1}>
              {booking.serviceName} · {booking.id}
            </Text>
          </View>
          <View style={styles.verified}>
            <Check size={12} color={colors.green900} strokeWidth={3} />
            <Text style={styles.verifiedText} maxFontSizeMultiplier={1.2}>
              Verified
            </Text>
          </View>
        </View>

        {digitalBalance ? (
          <View style={styles.balanceCard}>
            <View style={styles.balanceIcon}>
              <Wallet size={22} color={colors.yellow600} strokeWidth={2} />
            </View>
            <View style={styles.balanceCopy}>
              <Text style={styles.balanceKicker} maxFontSizeMultiplier={1.2}>
                BALANCE DUE
              </Text>
              <Text style={styles.balanceAmount} maxFontSizeMultiplier={1.3}>
                {ugx(booking.balance)}
              </Text>
              <Text style={styles.balanceNote} maxFontSizeMultiplier={1.3}>
                Settle your remaining balance before tipping. You can still leave a review.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pay remaining balance"
              onPress={() => router.push('/profile/payments')}
              style={styles.payLink}>
              <Text style={styles.payLinkText} maxFontSizeMultiplier={1.2}>
                Pay
              </Text>
            </Pressable>
          </View>
        ) : null}

        {cashBalance ? (
          <View style={styles.cashBalance}>
            <Text style={styles.cashBalanceText} maxFontSizeMultiplier={1.3}>
              Please pay your cleaner {ugx(booking.balance)} in cash for the remaining balance.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
              Rate the job
            </Text>
            <Text style={styles.optional} maxFontSizeMultiplier={1.2}>
              Optional
            </Text>
          </View>
          <Stars
            value={jobStars}
            label="Rate the job"
            reducedMotion={reducedMotion}
            onChange={(value) => {
              selectionHaptic();
              setJobStars(value);
              setError('');
            }}
          />
          <Text
            style={[styles.ratingLabel, jobStars > 0 && styles.ratingLabelActive]}
            maxFontSizeMultiplier={1.3}>
            {RATING_LABELS[jobStars]}
          </Text>
          <Text style={styles.cardHint} maxFontSizeMultiplier={1.2}>
            What went well?
          </Text>
          <TagRow
            tags={JOB_TAGS}
            selected={jobTags}
            onToggle={(tag) => toggleTag('job', tag)}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
              Rate {firstName} (optional)
            </Text>
            <Text style={styles.optional} maxFontSizeMultiplier={1.2}>
              Your {role}
            </Text>
          </View>
          <Stars
            value={cleanerStars}
            label={`Rate ${cleanerName}`}
            reducedMotion={reducedMotion}
            onChange={(value) => {
              selectionHaptic();
              setCleanerStars(value);
              setError('');
            }}
          />
          <Text
            style={[styles.ratingLabel, cleanerStars > 0 && styles.ratingLabelActive]}
            maxFontSizeMultiplier={1.3}>
            {RATING_LABELS[cleanerStars]}
          </Text>
          <TagRow
            tags={CLEANER_TAGS}
            selected={cleanerTags}
            onToggle={(tag) => toggleTag('cleaner', tag)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
            Tell us more
          </Text>
          <TextInput
            accessibilityLabel="Review comment"
            multiline
            maxLength={500}
            onChangeText={setComment}
            placeholder="Anything we should know?"
            placeholderTextColor={colors.placeholder}
            style={styles.comment}
            textAlignVertical="top"
            value={comment}
          />
          <Text style={styles.counter} maxFontSizeMultiplier={1.2}>
            {comment.length}/500
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
              Add photos
            </Text>
            <Text style={styles.optional} maxFontSizeMultiplier={1.2}>
              Optional · up to {MAX_PHOTOS}
            </Text>
          </View>
          <Text style={styles.cardHint} maxFontSizeMultiplier={1.2}>
            Photos help us verify quality and improve the next clean.
          </Text>
          <View style={styles.photos}>
            {photos.map((photo, index) => (
              <View key={`${photo.slice(-16)}-${index}`} style={styles.photoWrap}>
                <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  hitSlop={6}
                  onPress={() => setPhotos((current) => current.filter((_, i) => i !== index))}
                  style={styles.removePhoto}>
                  <X size={14} color={colors.surface} strokeWidth={2.4} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a photo"
                onPress={pickPhotos}
                style={styles.addPhoto}>
                <ImagePlus size={24} color={colors.green700} strokeWidth={1.8} />
                <Text style={styles.addPhotoText} maxFontSizeMultiplier={1.2}>
                  Add
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.tipTitleRow}>
              <Heart size={18} color={colors.green700} strokeWidth={2} />
              <Text style={styles.cardTitle} maxFontSizeMultiplier={1.3}>
                Add a tip
              </Text>
            </View>
            <Text style={styles.optional} maxFontSizeMultiplier={1.2}>
              100% goes to your cleaner
            </Text>
          </View>

          <View style={styles.tipChips}>
            {TIP_PRESETS.map((amount) => {
              const selected = tipChoice === amount;
              return (
                <Pressable
                  key={amount}
                  accessibilityRole="radio"
                  accessibilityLabel={`Tip ${ugx(amount)}`}
                  accessibilityState={{ selected }}
                  aria-checked={selected}
                  onPress={() => {
                    selectionHaptic();
                    setTipChoice(selected ? null : amount);
                    setError('');
                  }}
                  style={[styles.tipChip, selected && styles.tipChipOn]}>
                  <Text
                    style={[styles.tipChipText, selected && styles.tipChipTextOn]}
                    maxFontSizeMultiplier={1.2}>
                    UGX {amount / 1_000}k
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel="Custom tip"
              accessibilityState={{ selected: tipChoice === 'custom' }}
              aria-checked={tipChoice === 'custom'}
              onPress={() => {
                selectionHaptic();
                setTipChoice(tipChoice === 'custom' ? null : 'custom');
                setError('');
              }}
              style={[styles.tipChip, tipChoice === 'custom' && styles.tipChipOn]}>
              <Text
                style={[styles.tipChipText, tipChoice === 'custom' && styles.tipChipTextOn]}
                maxFontSizeMultiplier={1.2}>
                Custom
              </Text>
            </Pressable>
          </View>

          {tipChoice === 'custom' ? (
            <View style={styles.customTipRow}>
              <Text style={styles.currency} maxFontSizeMultiplier={1.2}>
                UGX
              </Text>
              <TextInput
                accessibilityLabel="Custom tip amount"
                keyboardType="number-pad"
                maxLength={7}
                onChangeText={(value) => {
                  setCustomTip(value.replace(/\D/g, ''));
                  setError('');
                }}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                style={styles.customTipInput}
                value={customTip}
              />
            </View>
          ) : null}

          {hasDigitalMethods ? (
            <>
              <Text style={styles.methodLabel} maxFontSizeMultiplier={1.2}>
                Pay tip with
              </Text>
              <View style={styles.methods}>
                {methods.map((method) => {
                  const selected = selectedMethod?.id === method.id;
                  return (
                    <Pressable
                      key={method.id}
                      accessibilityRole="radio"
                      accessibilityLabel={`${method.label}, ${method.detail}`}
                      accessibilityState={{ selected }}
                      aria-checked={selected}
                      onPress={() => {
                        selectionHaptic();
                        setSelectedMethodId(method.id);
                        setError('');
                      }}
                      style={[styles.method, selected && styles.methodOn]}>
                      <Smartphone
                        size={17}
                        color={selected ? colors.green700 : colors.textMuted}
                        strokeWidth={2}
                      />
                      <View style={styles.methodCopy}>
                        <Text
                          style={styles.methodName}
                          maxFontSizeMultiplier={1.2}
                          numberOfLines={1}>
                          {method.label}
                        </Text>
                        <Text style={styles.methodDetail} maxFontSizeMultiplier={1.2}>
                          {method.detail}
                        </Text>
                      </View>
                      {selected ? (
                        <Check size={17} color={colors.green500} strokeWidth={2.6} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.cashTip} maxFontSizeMultiplier={1.3}>
              No digital method saved. Cash tips go directly to your cleaner.
            </Text>
          )}

          <Text style={styles.cashInfo} maxFontSizeMultiplier={1.2}>
            Tips sent in the app go to your cleaner&apos;s Gabfix wallet. Cash tips are handed
            over directly.
          </Text>
        </View>

        {error ? (
          <Text style={styles.error} maxFontSizeMultiplier={1.3} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Button
          label={tipAmount > 0 ? `Send and tip ${ugx(tipAmount)}` : 'Send review'}
          loading={submitting}
          disabled={!canSend}
          onPress={submit}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
          hitSlop={8}
          onPress={skip}
          style={styles.skip}>
          <Text style={styles.skipText} maxFontSizeMultiplier={1.2}>
            Skip for now
          </Text>
        </Pressable>
        <Text style={styles.footNote} maxFontSizeMultiplier={1.2}>
          Reviews are saved on this device until the reviews service is connected.
        </Text>
      </ScrollView>

      {submitted ? (
        <View
          style={[styles.toast, { top: insets.top + space[2] }]}
          accessibilityRole="alert"
          accessibilityLabel="Review sent">
          <View style={styles.toastIcon}>
            <Check size={16} color={colors.surface} strokeWidth={3} />
          </View>
          <Text style={styles.toastText} maxFontSizeMultiplier={1.3}>
            Thanks for your feedback.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space[4], gap: space[3] },
  title: { ...text.h1 },
  subtitle: { ...text.bodyM, color: colors.textMuted, marginTop: -4, marginBottom: space[1] },
  cleanerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[3],
    ...shadow.card,
  },
  cleanerCopy: { flex: 1, gap: 2 },
  cleanerName: { ...text.bodyM, fontFamily: font.bodySemi },
  cleanerMeta: { ...text.caption },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.yellow500,
  },
  verifiedText: {
    fontFamily: font.bodySemi,
    fontSize: 10,
    lineHeight: 14,
    color: colors.green900,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.green900,
  },
  balanceIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.whiteOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceCopy: { flex: 1, gap: 1 },
  balanceKicker: {
    fontFamily: font.bodySemi,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: colors.yellow500,
  },
  balanceAmount: { ...text.h3, color: colors.surface },
  balanceNote: { ...text.caption, color: colors.whiteTextMuted, lineHeight: 16 },
  payLink: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.yellow500,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[3],
  },
  payLinkText: { ...text.bodyM, fontFamily: font.bodySemi, color: colors.green900 },
  cashBalance: {
    padding: space[3],
    borderRadius: radius.input,
    backgroundColor: colors.warningBg,
  },
  cashBalanceText: { ...text.bodyM, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  cardTitle: { ...text.h3 },
  cardHint: { ...text.caption, lineHeight: 18, marginTop: -2 },
  optional: { ...text.caption, flexShrink: 1, textAlign: 'right' },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space[2],
    alignSelf: 'center',
    marginVertical: space[2],
  },
  starButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingLabel: { ...text.bodyM, textAlign: 'center', color: colors.textMuted },
  ratingLabelActive: { color: colors.green700, fontFamily: font.bodySemi },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[1] },
  tag: {
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagOn: { backgroundColor: colors.green500, borderColor: colors.green500 },
  tagText: { ...text.bodyM, fontSize: 13, color: colors.textMuted },
  tagTextOn: { color: colors.surface, fontFamily: font.bodySemi },
  comment: {
    minHeight: 120,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    padding: space[3],
    fontFamily: font.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginTop: space[1],
  },
  counter: { ...text.caption, textAlign: 'right' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[1] },
  photoWrap: { width: 76, height: 76 },
  photo: { width: 76, height: 76, borderRadius: radius.input, backgroundColor: colors.green50 },
  removePhoto: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.green900,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 76,
    height: 76,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.green300,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  addPhotoText: { ...text.caption, fontFamily: font.bodySemi, color: colors.green700 },
  tipTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  tipChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginTop: space[1] },
  tipChip: {
    minWidth: 68,
    height: 44,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[3],
  },
  tipChipOn: { backgroundColor: colors.green500, borderColor: colors.green500 },
  tipChipText: { ...text.bodyM, fontSize: 13, color: colors.text },
  tipChipTextOn: { color: colors.surface, fontFamily: font.bodySemi },
  customTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    height: 52,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.green300,
    backgroundColor: colors.surface,
    paddingHorizontal: space[3],
    marginTop: space[1],
  },
  currency: { ...text.bodyM, fontFamily: font.bodySemi, color: colors.green700 },
  customTipInput: {
    flex: 1,
    fontFamily: font.bodySemi,
    fontSize: 16,
    color: colors.text,
    padding: 0,
  },
  methodLabel: { ...text.bodyM, fontFamily: font.bodySemi, marginTop: space[2] },
  methods: { gap: space[2] },
  method: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  methodOn: { borderColor: colors.green500, backgroundColor: colors.green50 },
  methodCopy: { flex: 1, gap: 1 },
  methodName: { ...text.bodyM, fontFamily: font.bodySemi, fontSize: 13 },
  methodDetail: { ...text.caption },
  cashTip: {
    ...text.bodyM,
    color: colors.text,
    backgroundColor: colors.green50,
    borderRadius: radius.input,
    padding: space[3],
    marginTop: space[1],
  },
  cashInfo: { ...text.caption, lineHeight: 17, marginTop: space[2] },
  error: {
    ...text.bodyM,
    color: colors.error,
    backgroundColor: colors.errorBg,
    borderRadius: radius.input,
    padding: space[3],
  },
  skip: { alignSelf: 'center', paddingVertical: space[1] },
  skipText: { ...text.bodyM, color: colors.textMuted, textDecorationLine: 'underline' },
  footNote: { ...text.caption, textAlign: 'center', lineHeight: 17 },
  toast: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    zIndex: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: radius.input,
    backgroundColor: colors.green900,
    ...shadow.floating,
  },
  toastIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: { ...text.bodyM, fontFamily: font.bodySemi, color: colors.surface },
  thankCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[6],
    alignItems: 'center',
    gap: space[3],
    ...shadow.card,
  },
  thankIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thankTitle: { ...text.h2, textAlign: 'center' },
  thankBody: { ...text.bodyM, color: colors.textMuted, textAlign: 'center' },
  savedComment: {
    ...text.bodyM,
    fontStyle: 'italic',
    color: colors.textMuted,
    textAlign: 'center',
    backgroundColor: colors.green50,
    borderRadius: radius.input,
    padding: space[3],
  },
});
