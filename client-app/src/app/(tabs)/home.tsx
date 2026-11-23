import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import {
  Bell,
  BellOff,
  CalendarCheck2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Navigation,
  Repeat,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Tag,
  WalletCards,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { slotLabel } from '@/components/booking/slot-chips';
import { ServicePhoto } from '@/components/service/service-photo';
import { Avatar } from '@/components/ui/avatar';
import { StatTile } from '@/components/ui/stat-tile';
import { useServices } from '@/hooks/use-services';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { buildRebookDraft } from '@/lib/rebook';
import { price } from '@/lib/pricing';
import { balanceDueBookings, totalBalanceDue } from '@/lib/wallet';
import { cleanerById } from '@/config/cleaners';
import { promos } from '@/config/promos';
import { fromHourly, serviceBySlug } from '@/config/services';
import { startRebookDraft, useBookingDraft } from '@/store/booking';
import {
  type SavedBooking,
  hydrateBookings,
  useBookings,
} from '@/store/bookings';
import {
  markAllNotificationsRead,
  markNotificationRead,
  useNotifications,
  useNotificationsHydrated,
  useUnreadNotificationCount,
  type AppNotification,
  type NotificationKind,
} from '@/store/notifications';
import { useReviews } from '@/store/reviews';
import { useOnboardingUserName } from '@/store/onboarding';
import { useAddresses } from '@/store/addresses';
import { endSession, useAuthUser } from '@/store/session';
import { showToast } from '@/components/ui/toast';
import { auth, base, colors, font, radius, shadow, space, text } from '@/theme';
import { ugx } from '@/utils/format';
import { selectionHaptic } from '@/utils/haptics';

const notifIconFor: Record<NotificationKind, LucideIcon> = {
  booking: CalendarCheck2,
  reminder: Sparkles,
  payment: WalletCards,
  system: Bell,
  security: ShieldAlert,
  promo: Tag,
};

const isSameNotifDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const notifTimeLabel = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (isSameNotifDay(date, now)) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameNotifDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const bookingStart = (booking: SavedBooking): number => {
  if (!booking.dateISO) return Number.MAX_SAFE_INTEGER;
  const [year, month, day] = booking.dateISO.split('-').map(Number);
  const [hour, minute] = (booking.startTime ?? '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
};

const bookingWhen = (booking: SavedBooking): string => {
  if (!booking.dateISO) return 'Time to confirm';
  const date = new Date(bookingStart(booking)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return booking.startTime ? `${date} · ${slotLabel(booking.startTime)}` : date;
};

const bookingDay = (booking: SavedBooking): string => {
  if (!booking.dateISO) return 'Recent clean';
  return new Date(bookingStart(booking)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

/** How long each promo stays on screen before the carousel advances. */
const PROMO_INTERVAL_MS = 4_500;
/** Keep autoplay out of the way for a moment after the customer swipes. */
const PROMO_RESUME_DELAY_MS = 6_000;

/** P4 Home tab shell. Discovery data is still local; `GET /home` replaces it in Phase 3. */
export default function HomeTab() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  useStatusBarStyle('light');

  const addresses = useAddresses();
  const defaultAddress =
    addresses.find((address) => address.isDefault) ?? addresses[0];
  const addressLabel = defaultAddress
    ? [defaultAddress.area, defaultAddress.street].filter(Boolean).join(' · ')
    : '';
  const userName = useOnboardingUserName();
  const user = useAuthUser();
  const draft = useBookingDraft();
  const notificationsReady = useNotificationsHydrated();
  const unreadNotifications = useUnreadNotificationCount();
  const notifications = useNotifications();
  const { services, refresh: refreshServices } = useServices();
  const bookings = useBookings();
  const [refreshing, setRefreshing] = useState(false);
  const [activePromo, setActivePromo] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeNotif = useCallback(() => setNotifOpen(false), []);
  const openNotif = useCallback(() => setNotifOpen(true), []);

  const openNotification = useCallback((notification: AppNotification) => {
    if (!notification.read) markNotificationRead(notification.id);
    closeNotif();
    if (notification.href) router.push(notification.href as Href);
  }, [closeNotif]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshServices();
    try {
      await hydrateBookings();
    } finally {
      setRefreshing(false);
    }
  }, [refreshServices]);

  const nextBooking = useMemo(() => {
    const upcoming = bookings.filter(
      (booking) => booking.status === 'upcoming',
    );
    return upcoming.sort((a, b) => bookingStart(a) - bookingStart(b))[0];
  }, [bookings]);

  const openMyProfile = useCallback(() => {
    closeMenu();
    router.push('/(tabs)/profile');
  }, [closeMenu]);

  const openAddresses = useCallback(() => {
    closeMenu();
    router.push('/addresses');
  }, [closeMenu]);

  const openNextBooking = useCallback(() => {
    closeMenu();
    if (nextBooking) {
      router.push(`/booking/${nextBooking.id}` as never);
      return;
    }
    showToast('No bookings yet');
    router.push('/(tabs)/services');
  }, [closeMenu, nextBooking]);

  const openReferrals = useCallback(() => {
    closeMenu();
    router.push('/refer' as Href);
  }, [closeMenu]);

  const openHelpSupport = useCallback(() => {
    closeMenu();
    router.push('/help' as Href);
  }, [closeMenu]);

  const confirmSignOut = useCallback(() => {
    closeMenu();
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void endSession().then(() => router.replace('/login' as Href));
        },
      },
    ]);
  }, [closeMenu]);
  const reviews = useReviews();
  const dueBookings = useMemo(() => balanceDueBookings(bookings), [bookings]);
  const dueTotal = useMemo(() => totalBalanceDue(bookings), [bookings]);
  const rateBooking = useMemo(() => {
    const reviewed = new Set(reviews.map((review) => review.bookingId));
    return [...bookings]
      .filter(
        (booking) =>
          booking.status === 'completed' &&
          !reviewed.has(booking.id) &&
          !booking.ratingSkippedAtISO,
      )
      .sort((a, b) => bookingStart(b) - bookingStart(a))[0];
  }, [bookings, reviews]);
  const recentBookings = useMemo(
    () =>
      [...bookings]
        .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO))
        .slice(0, 3),
    [bookings],
  );
  const popularServices = useMemo(
    () =>
      [...services]
        .filter((service) => service.active !== false)
        .sort(
          (a, b) =>
            (a.popularRank ?? Number.MAX_SAFE_INTEGER) -
            (b.popularRank ?? Number.MAX_SAFE_INTEGER),
        )
        .slice(0, 4),
    [services],
  );
  const lastRebookable = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status !== 'upcoming')
        .slice()
        .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO))[0],
    [bookings],
  );
  const displayName = userName?.trim() || user?.name?.trim() || 'there';
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'G';

  const rebook = (booking: SavedBooking) => {
    startRebookDraft(buildRebookDraft(booking));
    router.push({
      pathname: '/book/[slug]/schedule',
      params: { slug: booking.serviceSlug },
    });
  };

  const draftService = serviceBySlug(draft?.serviceSlug);
  const draftTotal = draft ? price(draft).total : 0;
  const popularWidth = (width - space[4] * 2 - space[3]) / 2;
  const promoWidth = width - space[4] * 2;
  const promoStep = promoWidth + space[3];
  const promoCarousel = useRef<ScrollViewInstance>(null);
  const activePromoRef = useRef(0);
  const promoPauseUntil = useRef(0);

  const goToPromo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(promos.length - 1, index));
      activePromoRef.current = clamped;
      setActivePromo(clamped);
      promoCarousel.current?.scrollTo({
        x: clamped * promoStep,
        animated: true,
      });
    },
    [promoStep],
  );

  useFocusEffect(
    useCallback(() => {
      if (promos.length < 2) return undefined;
      const timer = setInterval(() => {
        if (Date.now() < promoPauseUntil.current) return;
        const next = (activePromoRef.current + 1) % promos.length;
        goToPromo(next);
      }, PROMO_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [goToPromo]),
  );

  const onPromoScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / promoStep);
    const clamped = Math.max(0, Math.min(promos.length - 1, next));
    activePromoRef.current = clamped;
    if (clamped !== activePromo) setActivePromo(clamped);
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        refreshControl={
          <RefreshControl
            colors={[colors.green500]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={colors.green500}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <LinearGradient
          colors={[auth.bgTop, auth.bgBottom]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + space[3] }]}
        >
          <View style={base.between}>
            <View style={styles.nameBlock}>
              <Text style={styles.greeting} maxFontSizeMultiplier={1.3}>
                Hello,
              </Text>
              <Text
                style={styles.name}
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
              >
                {displayName}
              </Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  unreadNotifications > 0
                    ? `Notifications, ${unreadNotifications} unread`
                    : 'Notifications'
                }
                accessibilityHint="Opens your notifications"
                accessibilityState={{ expanded: notifOpen }}
                hitSlop={8}
                onPress={openNotif}
                style={styles.bell}
              >
                <Bell size={20} color={colors.surface} strokeWidth={2} />
                {notificationsReady && unreadNotifications > 0 ? (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText} maxFontSizeMultiplier={1.1}>
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Account menu, signed in as ${displayName}`}
                accessibilityHint="Opens account options"
                hitSlop={8}
                onPress={() => setMenuOpen(true)}
                style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}>
                <Text style={styles.avatarText} maxFontSizeMultiplier={1.2}>
                  {initials}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              defaultAddress
                ? `Address: ${addressLabel}. Change address`
                : 'Set your address'
            }
            onPress={() => router.push('/addresses')}
            style={styles.areaPill}
          >
            <MapPin size={14} color={colors.surface} strokeWidth={2} />
            <Text
              style={styles.areaText}
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
            >
              {defaultAddress ? addressLabel : 'Set your address'}
            </Text>
            <ChevronDown size={14} color={colors.surface} strokeWidth={2} />
          </Pressable>
        </LinearGradient>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search cleaning services"
          onPress={() => router.push('/search')}
          style={styles.search}
        >
          <Search size={20} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.searchText} maxFontSizeMultiplier={1.3}>
            What needs cleaning today?
          </Text>
        </Pressable>

        <View style={styles.body}>
          {draft ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Resume booking for ${draftService?.name ?? 'cleaning'}`}
              onPress={() =>
                router.push({
                  pathname: '/book/[slug]/details',
                  params: { slug: draft.serviceSlug },
                })
              }
              style={styles.draftCard}
            >
              <View style={styles.draftBody}>
                <Text style={styles.draftKicker} maxFontSizeMultiplier={1.3}>
                  Continue your booking
                </Text>
                <Text
                  style={styles.draftTitle}
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                >
                  {draftService?.name ?? 'Cleaning service'}
                </Text>
                <Text style={styles.draftMeta} maxFontSizeMultiplier={1.3}>
                  {draft.details.cleaners} cleaner
                  {draft.details.cleaners === 1 ? '' : 's'} ·{' '}
                  {draft.details.hours} h · {ugx(draftTotal)}
                </Text>
              </View>
              <View style={styles.resume}>
                <Text style={styles.resumeText} maxFontSizeMultiplier={1.3}>
                  Resume
                </Text>
                <ChevronRight
                  size={14}
                  color={colors.green700}
                  strokeWidth={2}
                />
              </View>
            </Pressable>
          ) : null}

          {dueTotal > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Balance due: ${ugx(dueTotal)}. Pay now`}
              onPress={() =>
                router.push({
                  pathname: '/profile/payments',
                  params: { focus: 'balance-due' },
                })
              }
              style={styles.dueCard}
            >
              <View style={styles.dueIcon}>
                <Text style={styles.dueIconText} maxFontSizeMultiplier={1.2}>
                  {dueBookings.length}
                </Text>
              </View>
              <View style={styles.draftBody}>
                <Text style={styles.draftTitle} maxFontSizeMultiplier={1.3}>
                  {ugx(dueTotal)} due
                </Text>
                <Text
                  style={styles.draftMeta}
                  maxFontSizeMultiplier={1.2}
                  numberOfLines={1}
                >
                  {dueBookings.length === 1
                    ? `Balance on ${dueBookings[0].serviceName}`
                    : `Balance on ${dueBookings.length} bookings`}
                </Text>
              </View>
              <View style={styles.resume}>
                <Text style={styles.resumeText} maxFontSizeMultiplier={1.2}>
                  Pay
                </Text>
                <ChevronRight
                  size={14}
                  color={colors.green700}
                  strokeWidth={2}
                />
              </View>
            </Pressable>
          ) : null}

          {promos.length > 0 ? (
            <View style={styles.promoBlock}>
              <ScrollView
                ref={promoCarousel}
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                disableIntervalMomentum
                snapToAlignment="start"
                snapToInterval={promoStep}
                onScroll={onPromoScroll}
                onScrollBeginDrag={() => {
                  promoPauseUntil.current = Date.now() + PROMO_RESUME_DELAY_MS;
                }}
                scrollEventThrottle={16}
                style={styles.promoScroll}
                contentContainerStyle={styles.promoRow}
              >
                {promos.map((promo) => (
                  <Pressable
                    key={promo.code}
                    accessibilityRole="button"
                    accessibilityLabel={`${promo.title}. ${promo.discountLabel} off. Code ${promo.code}. Open promos`}
                    onPress={() => router.push('/profile/promos')}
                    style={[styles.promo, { width: promoWidth }]}
                  >
                    <LinearGradient
                      colors={[colors.yellow500, colors.yellow600]}
                      end={{ x: 1, y: 1 }}
                      start={{ x: 0, y: 0 }}
                      style={styles.promoInner}
                    >
                      <View style={styles.promoCircle} />
                      <View style={styles.promoCopy}>
                        <Text
                          style={styles.promoTitle}
                          maxFontSizeMultiplier={1.3}
                          numberOfLines={2}
                        >
                          {promo.title}
                        </Text>
                        <Text
                          style={styles.promoCaption}
                          maxFontSizeMultiplier={1.2}
                        >
                          {promo.caption}
                        </Text>
                        <View style={styles.promoCode}>
                          <Text
                            style={styles.promoCodeLabel}
                            maxFontSizeMultiplier={1.2}
                          >
                            CODE
                          </Text>
                          <Text
                            style={styles.promoCodeText}
                            maxFontSizeMultiplier={1.2}
                          >
                            {promo.code}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.promoBadge}>
                        <Text
                          style={styles.promoDiscount}
                          maxFontSizeMultiplier={1.2}
                        >
                          {promo.discountLabel}
                        </Text>
                        <Text
                          style={styles.promoOff}
                          maxFontSizeMultiplier={1.2}
                        >
                          OFF
                        </Text>
                      </View>
                    </LinearGradient>
                  </Pressable>
                ))}
              </ScrollView>
              {promos.length > 1 ? (
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.promoDots}
                >
                  {promos.map((promo, index) => (
                    <View
                      key={promo.code}
                      style={[
                        styles.promoDot,
                        index === activePromo && styles.promoDotActive,
                      ]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={base.between}>
            <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>
              Most popular
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/services')}
              hitSlop={8}
            >
              <Text style={styles.seeAll} maxFontSizeMultiplier={1.3}>
                See all
              </Text>
            </Pressable>
          </View>

          <View style={styles.popularGrid}>
            {popularServices.map((service) => (
              <Pressable
                key={service.slug}
                accessibilityRole="button"
                accessibilityLabel={`${service.name}. ${service.pricingMode === 'quote' ? 'Get a quote' : `From ${ugx(fromHourly)} per hour`}`}
                onPress={() =>
                  router.push({
                    pathname: '/service/[slug]',
                    params: { slug: service.slug },
                  })
                }
                style={[styles.popularCard, { width: popularWidth }]}
              >
                <View style={styles.popularMedia}>
                  <ServicePhoto
                    slug={service.slug}
                    cardUri={service.cardImage}
                    style={styles.popularPhoto}
                  />
                  {service.tag ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{service.tag}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.popularInfo}>
                  <Text
                    style={styles.popularName}
                    maxFontSizeMultiplier={1.2}
                    numberOfLines={2}
                  >
                    {service.name}
                  </Text>
                  <Text style={styles.popularPrice} maxFontSizeMultiplier={1.2}>
                    {service.pricingMode === 'quote'
                      ? 'Get a quote'
                      : `From ${ugx(fromHourly)}/hr`}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {rateBooking ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Rate your ${rateBooking.serviceName}`}
              onPress={() =>
                router.push(`/booking/${rateBooking.id}/rate` as never)
              }
              style={styles.rateCard}
            >
              <View style={styles.rateIcon}>
                <Sparkles size={20} color={colors.green700} strokeWidth={2} />
              </View>
              <View style={styles.draftBody}>
                <Text style={styles.draftKicker} maxFontSizeMultiplier={1.2}>
                  How did it go?
                </Text>
                <Text
                  style={styles.draftTitle}
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                >
                  {rateBooking.serviceName}
                </Text>
                <Text
                  style={styles.draftMeta}
                  maxFontSizeMultiplier={1.2}
                  numberOfLines={1}
                >
                  {rateBooking.cleanerName ?? 'Your clean'} ·{' '}
                  {bookingDay(rateBooking)}
                </Text>
              </View>
              <View style={styles.resume}>
                <Text style={styles.resumeText} maxFontSizeMultiplier={1.2}>
                  Rate
                </Text>
                <ChevronRight
                  size={14}
                  color={colors.green700}
                  strokeWidth={2}
                />
              </View>
            </Pressable>
          ) : null}

          {nextBooking ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Next booking: ${nextBooking.serviceName}. View details`}
              onPress={() => router.push(`/booking/${nextBooking.id}` as never)}
              style={styles.upcomingCard}
            >
              <View style={styles.upcomingTop}>
                <View style={styles.rebookBody}>
                  <Text style={styles.draftKicker} maxFontSizeMultiplier={1.3}>
                    Next clean
                  </Text>
                  <Text
                    style={styles.draftTitle}
                    maxFontSizeMultiplier={1.3}
                    numberOfLines={1}
                  >
                    {nextBooking.serviceName}
                  </Text>
                  <Text
                    style={styles.draftMeta}
                    maxFontSizeMultiplier={1.2}
                    numberOfLines={1}
                  >
                    {bookingWhen(nextBooking)}
                    {nextBooking.area ? ` · ${nextBooking.area}` : ''}
                  </Text>
                </View>
                {nextBooking.cleanerName ? (
                  <Avatar
                    uri={cleanerById(nextBooking.cleanerId)?.photoUri}
                    name={nextBooking.cleanerName}
                    size={40}
                  />
                ) : null}
                <View style={styles.confirmedPill}>
                  <Text
                    style={styles.confirmedText}
                    maxFontSizeMultiplier={1.2}
                  >
                    Confirmed
                  </Text>
                </View>
              </View>
              <View style={styles.upcomingActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Track booking ${nextBooking.id}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    router.push(`/booking/${nextBooking.id}/track` as never);
                  }}
                  style={styles.trackButton}
                >
                  <Navigation
                    size={14}
                    color={colors.surface}
                    strokeWidth={2.2}
                  />
                  <Text style={styles.trackText} maxFontSizeMultiplier={1.2}>
                    Track
                  </Text>
                </Pressable>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsText} maxFontSizeMultiplier={1.2}>
                    View details
                  </Text>
                  <ChevronRight
                    size={18}
                    color={colors.green700}
                    strokeWidth={2}
                  />
                </View>
              </View>
            </Pressable>
          ) : null}

          {lastRebookable ? (
            <View style={styles.rebookCard}>
              <View style={styles.rebookAvatar}>
                <Repeat size={20} color={colors.yellow800} strokeWidth={2} />
              </View>
              <View style={styles.rebookBody}>
                <Text style={styles.draftKicker} maxFontSizeMultiplier={1.3}>
                  Book again
                </Text>
                <Text
                  style={styles.draftTitle}
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                >
                  {lastRebookable.serviceName}
                </Text>
                <Text
                  style={styles.draftMeta}
                  maxFontSizeMultiplier={1.2}
                  numberOfLines={1}
                >
                  {lastRebookable.cleanerName
                    ? `${lastRebookable.cleanerName} · `
                    : ''}
                  {bookingDay(lastRebookable)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Book ${lastRebookable.serviceName} again`}
                onPress={() => rebook(lastRebookable)}
                style={styles.rebookAction}
              >
                <Text
                  style={styles.rebookActionText}
                  maxFontSizeMultiplier={1.2}
                >
                  Book again
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.statRow}>
            <StatTile
              label="Bookings"
              value={bookings.length}
              accessibilityHint="Opens your bookings"
              onPress={() => router.push('/(tabs)/bookings')}
            />
            <StatTile
              label="Upcoming"
              value={bookings.filter((b) => b.status === 'upcoming').length}
              accessibilityHint="Opens your upcoming bookings"
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/bookings',
                  params: { tab: 'upcoming' },
                })
              }
            />
            <StatTile
              label="Completed"
              value={bookings.filter((b) => b.status === 'completed').length}
              accessibilityHint="Opens your completed bookings"
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/bookings',
                  params: { tab: 'completed' },
                })
              }
            />
          </View>

          {recentBookings.length > 0 ? (
            <View style={styles.sectionBlock}>
              <View style={base.between}>
                <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>
                  Activity
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/(tabs)/bookings')}
                  hitSlop={8}
                >
                  <Text style={styles.seeAll} maxFontSizeMultiplier={1.3}>
                    All bookings
                  </Text>
                </Pressable>
              </View>
              <View style={[base.card, styles.activityCard]}>
                {recentBookings.map((booking, index) => (
                  <Pressable
                    key={booking.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${booking.serviceName}, ${booking.status}`}
                    onPress={() =>
                      router.push(`/booking/${booking.id}` as never)
                    }
                    style={[
                      styles.activityRow,
                      index > 0 && styles.activityDivider,
                    ]}
                  >
                    <View style={styles.activityBody}>
                      <Text
                        style={styles.activityTitle}
                        maxFontSizeMultiplier={1.3}
                        numberOfLines={1}
                      >
                        {booking.serviceName}
                      </Text>
                      <Text
                        style={styles.activityMeta}
                        maxFontSizeMultiplier={1.2}
                        numberOfLines={1}
                      >
                        {bookingWhen(booking)} · {booking.status}
                      </Text>
                    </View>
                    <ChevronRight
                      size={18}
                      color={colors.textMuted}
                      strokeWidth={2}
                    />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={menuOpen}
        animationType="fade"
        onRequestClose={closeMenu}>
        <Pressable
          accessibilityLabel="Close account menu"
          accessibilityRole="button"
          onPress={closeMenu}
          style={styles.menuOverlay}>
          <Pressable
            accessible={false}
            onPress={(event) => event.stopPropagation()}
            style={[styles.menuCard, { top: insets.top + space[4] + 48, right: space[4] }]}>
            <Pressable
              accessibilityRole="button"
              onPress={openMyProfile}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
              <Text style={styles.menuItemText} maxFontSizeMultiplier={1.3}>
                My Profile
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={openAddresses}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
              <Text style={styles.menuItemText} maxFontSizeMultiplier={1.3}>
                Addresses
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Opens your next upcoming booking, or services if you have none"
              onPress={openNextBooking}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
              <Text style={styles.menuItemText} maxFontSizeMultiplier={1.3}>
                Next Booking
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={openReferrals}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
              <Text style={styles.menuItemText} maxFontSizeMultiplier={1.3}>
                Referrals
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={openHelpSupport}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
              <Text style={styles.menuItemText} maxFontSizeMultiplier={1.3}>
                Help &amp; Support
              </Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              accessibilityRole="button"
              onPress={confirmSignOut}
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
              <Text
                style={[styles.menuItemText, styles.menuItemDanger]}
                maxFontSizeMultiplier={1.3}>
                Sign out
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={notifOpen}
        animationType="fade"
        onRequestClose={closeNotif}>
        <Pressable
          accessibilityLabel="Close notifications"
          accessibilityRole="button"
          onPress={closeNotif}
          style={styles.menuOverlay}>
          <Pressable
            accessible={false}
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.notifCard,
              { top: insets.top + space[4] + 48, maxHeight: Math.round(height * 0.62) },
            ]}>
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle} maxFontSizeMultiplier={1.3}>
                Notifications
              </Text>
              <View style={styles.notifHeaderActions}>
                {unreadNotifications > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Mark all notifications as read"
                    hitSlop={8}
                    onPress={() => {
                      selectionHaptic();
                      markAllNotificationsRead();
                    }}
                    style={styles.notifMarkAll}>
                    <Text style={styles.notifMarkAllText} maxFontSizeMultiplier={1.2}>
                      Mark all read
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Notification settings"
                  hitSlop={8}
                  onPress={() => {
                    closeNotif();
                    router.push('/profile/notification-preferences' as Href);
                  }}
                  style={styles.notifIconBtn}>
                  <Settings size={18} color={colors.textMuted} strokeWidth={2} />
                </Pressable>
              </View>
            </View>

            {!notificationsReady ? (
              <View style={styles.notifEmpty}>
                <Text style={styles.notifEmptyBody} maxFontSizeMultiplier={1.3}>
                  Loading notifications…
                </Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.notifEmpty}>
                <View style={styles.notifEmptyIcon}>
                  <BellOff size={22} color={colors.green700} strokeWidth={2} />
                </View>
                <Text style={styles.notifEmptyTitle} maxFontSizeMultiplier={1.3}>
                  You&apos;re all caught up
                </Text>
                <Text style={styles.notifEmptyBody} maxFontSizeMultiplier={1.3}>
                  Booking updates and reminders will appear here.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.notifScroll}
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.notifList}>
                {notifications.map((notification) => {
                  const Icon = notifIconFor[notification.kind] ?? Bell;
                  const time = notifTimeLabel(notification.createdAtISO);
                  return (
                    <Pressable
                      key={notification.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${notification.title}. ${notification.body}. ${time}${
                        notification.read ? '' : '. Unread'
                      }`}
                      onPress={() => openNotification(notification)}
                      style={({ pressed }) => [
                        styles.notifRow,
                        !notification.read && styles.notifRowUnread,
                        pressed && styles.notifRowPressed,
                      ]}>
                      <View style={styles.notifRowIcon}>
                        <Icon size={18} color={colors.green700} strokeWidth={2} />
                      </View>
                      <View style={styles.notifRowBody}>
                        <View style={styles.notifRowTop}>
                          <Text
                            style={styles.notifRowTitle}
                            maxFontSizeMultiplier={1.3}
                            numberOfLines={1}>
                            {notification.title}
                          </Text>
                          <Text style={styles.notifRowTime} maxFontSizeMultiplier={1.2}>
                            {time}
                          </Text>
                        </View>
                        <Text
                          style={styles.notifRowText}
                          maxFontSizeMultiplier={1.3}
                          numberOfLines={2}>
                          {notification.body}
                        </Text>
                      </View>
                      {!notification.read ? <View style={styles.notifUnreadDot} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all notifications"
              onPress={() => {
                closeNotif();
                router.push('/notifications' as Href);
              }}
              style={({ pressed }) => [styles.notifFooter, pressed && styles.notifRowPressed]}>
              <Text style={styles.notifFooterText} maxFontSizeMultiplier={1.2}>
                View all notifications
              </Text>
              <ChevronRight size={16} color={colors.green700} strokeWidth={2} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: space[6] },
  hero: {
    paddingHorizontal: space[4],
    paddingBottom: space[10] + space[4],
    borderBottomLeftRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
    overflow: 'hidden',
    gap: space[3],
  },
  nameBlock: { flex: 1, gap: 0 },
  greeting: { ...text.body, color: auth.textSoft },
  name: {
    fontFamily: font.poppinsSemi,
    fontSize: 20,
    lineHeight: 28,
    color: colors.surface,
  },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  bell: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.whiteOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.yellow500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    fontFamily: font.bodySemi,
    fontSize: 10,
    lineHeight: 12,
    color: colors.green900,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.yellow500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPressed: { opacity: 0.75 },
  avatarText: {
    fontFamily: font.poppinsSemi,
    fontSize: 14,
    lineHeight: 20,
    color: colors.green900,
  },
  areaPill: {
    alignSelf: 'flex-start',
    height: 32,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    backgroundColor: colors.whiteOverlay,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    maxWidth: '100%',
  },
  areaText: {
    fontFamily: font.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: colors.surface,
    flexShrink: 1,
  },
  search: {
    marginTop: -space[6],
    marginHorizontal: space[4],
    height: 52,
    borderRadius: radius.tile,
    backgroundColor: colors.surface,
    paddingHorizontal: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    zIndex: 10,
    ...shadow.card,
  },
  searchText: { ...text.body, color: colors.textMuted },
  body: { paddingHorizontal: space[4], paddingTop: space[6], gap: space[5] },
  draftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.warningBg,
    borderRadius: radius.card,
    padding: space[4],
    ...shadow.card,
  },
  draftBody: { flex: 1, gap: 2 },
  draftKicker: {
    ...text.caption,
    color: colors.yellow800,
    fontFamily: font.bodySemi,
  },
  draftTitle: { ...text.h3 },
  draftMeta: { ...text.caption },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 36,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  resumeText: {
    ...text.caption,
    fontFamily: font.bodySemi,
    color: colors.green700,
  },
  promoBlock: { gap: space[2] },
  promoScroll: { marginHorizontal: -space[4] },
  promoRow: { paddingHorizontal: space[4], gap: space[3] },
  promo: { borderRadius: radius.card, overflow: 'hidden' },
  promoInner: {
    minHeight: 116,
    borderRadius: radius.card,
    padding: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    overflow: 'hidden',
  },
  promoCircle: {
    position: 'absolute',
    right: -24,
    top: -12,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  promoCopy: { flex: 1, gap: 3 },
  promoTitle: {
    fontFamily: font.poppinsSemi,
    fontSize: 17,
    lineHeight: 23,
    color: colors.green900,
  },
  promoCaption: {
    ...text.caption,
    color: colors.green900,
  },
  promoCode: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: space[1],
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(17,60,29,0.4)',
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  promoCodeLabel: {
    fontFamily: font.bodySemi,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.8,
    color: colors.green900,
    opacity: 0.7,
  },
  promoCodeText: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.5,
    color: colors.green900,
  },
  promoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    flexShrink: 0,
    backgroundColor: colors.green700,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  promoDiscount: {
    fontFamily: font.poppinsBold,
    fontSize: 19,
    lineHeight: 23,
    color: colors.surface,
  },
  promoOff: {
    fontFamily: font.bodySemi,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1,
    color: colors.surface,
  },
  promoDots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
    marginTop: 2,
  },
  promoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green100,
  },
  promoDotActive: { width: 18, backgroundColor: colors.green500 },
  rebookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.warningBg,
    borderRadius: radius.card,
    padding: space[4],
    ...shadow.card,
  },
  rebookAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rebookBody: { flex: 1, gap: 2 },
  rebookAction: {
    minHeight: 40,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rebookActionText: {
    ...text.caption,
    fontFamily: font.bodySemi,
    color: colors.green700,
  },
  upcomingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
    borderWidth: 1,
    borderColor: colors.green100,
    ...shadow.card,
  },
  upcomingTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
  },
  confirmedPill: {
    height: 24,
    paddingHorizontal: space[2],
    borderRadius: radius.pill,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedText: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    lineHeight: 15,
    color: colors.green700,
  },
  upcomingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.green500,
    paddingHorizontal: space[3],
  },
  trackText: {
    fontFamily: font.bodySemi,
    fontSize: 12,
    lineHeight: 16,
    color: colors.surface,
  },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsText: {
    ...text.bodyM,
    color: colors.green700,
    fontFamily: font.bodySemi,
  },
  reviewScroll: { marginHorizontal: -space[4] },
  reviewRow: { paddingHorizontal: space[4], gap: space[3] },
  reviewCard: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    padding: space[4],
    gap: space[2],
    ...shadow.card,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.green100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewInitials: {
    fontFamily: font.poppinsSemi,
    fontSize: 12,
    lineHeight: 16,
    color: colors.green900,
  },
  reviewName: { ...text.bodyM, fontFamily: font.bodySemi, flex: 1 },
  reviewDate: { ...text.caption, fontSize: 11, lineHeight: 15 },
  reviewComment: { ...text.caption, lineHeight: 19 },
  sectionBlock: { gap: space[3] },
  sectionTitle: { ...text.h2 },
  sectionCaption: { ...text.caption },
  seeAll: { ...text.bodyM, fontFamily: font.bodySemi, color: colors.green500 },
  statRow: { flexDirection: 'row', gap: space[3] },
  dueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.yellow50,
    borderRadius: radius.card,
    padding: space[4],
    ...shadow.card,
  },
  dueIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dueIconText: {
    fontFamily: font.poppinsSemi,
    fontSize: 15,
    lineHeight: 21,
    color: colors.yellow800,
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: colors.green100,
    ...shadow.card,
  },
  rateIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCard: { padding: 0, overflow: 'hidden' },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
  },
  activityDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  activityBody: { flex: 1, gap: 2 },
  activityTitle: { ...text.bodyM, fontFamily: font.bodySemi },
  activityMeta: { ...text.caption, textTransform: 'capitalize' },
  popularGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  popularCard: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.card,
  },
  popularMedia: { aspectRatio: 1.1, backgroundColor: colors.green100 },
  popularPhoto: { ...StyleSheet.absoluteFill },
  popularInfo: { padding: space[3], gap: 2 },
  tag: {
    position: 'absolute',
    top: space[2],
    left: space[2],
    height: 22,
    paddingHorizontal: space[2],
    borderRadius: 11,
    backgroundColor: colors.yellow500,
    justifyContent: 'center',
    zIndex: 1,
  },
  tagText: {
    fontFamily: font.bodySemi,
    fontSize: 11,
    lineHeight: 14,
    color: colors.green900,
  },
  popularName: {
    fontFamily: font.bodySemi,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  popularPrice: {
    ...text.caption,
    fontFamily: font.bodySemi,
    color: colors.green700,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.2)',
  },
  menuCard: {
    position: 'absolute',
    minWidth: 200,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingVertical: space[2],
    ...shadow.card,
  },
  menuItem: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space[4],
  },
  menuItemPressed: { backgroundColor: colors.green50 },
  menuItemText: { ...text.bodyM, color: colors.text },
  menuItemDanger: { color: colors.error },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: space[1],
  },
  notifCard: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.card,
  },
  notifHeader: {
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  notifTitle: { ...text.h3, fontSize: 16, color: colors.text },
  notifHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  notifMarkAll: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space[2],
  },
  notifMarkAllText: { ...text.caption, fontFamily: font.bodySemi, color: colors.green700 },
  notifIconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifScroll: { flexShrink: 1 },
  notifList: { paddingVertical: space[1] },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    minHeight: 72,
  },
  notifRowUnread: { backgroundColor: colors.green50 },
  notifRowPressed: { backgroundColor: colors.green50 },
  notifRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.green100,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notifRowBody: { flex: 1, gap: 2 },
  notifRowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[2],
  },
  notifRowTitle: { ...text.bodyM, fontFamily: font.bodySemi, color: colors.text, flex: 1 },
  notifRowTime: { ...text.caption, color: colors.textMuted },
  notifRowText: { ...text.caption, color: colors.textMuted, lineHeight: 18 },
  notifUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green500,
    marginTop: 8,
  },
  notifEmpty: {
    paddingHorizontal: space[5],
    paddingVertical: space[8],
    alignItems: 'center',
    gap: space[2],
  },
  notifEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.green100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[1],
  },
  notifEmptyTitle: { ...text.h3, fontSize: 16, color: colors.text, textAlign: 'center' },
  notifEmptyBody: { ...text.bodyM, color: colors.textMuted, textAlign: 'center' },
  notifFooter: {
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    paddingHorizontal: space[4],
  },
  notifFooterText: { ...text.bodyM, fontFamily: font.bodySemi, color: colors.green700 },
});
