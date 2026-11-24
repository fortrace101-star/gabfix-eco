import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import {
  Banknote,
  Bell,
  Briefcase,
  CalendarDays,
  ChevronRight,
  MapPin,
  Navigation,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/offline-banner';
import { formatDay, formatMoney, formatWindow } from '@/lib/format';
import { ACTIVE_STATUSES, statusChip } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';
import { auth, colors, font, radius, shadow, space, text } from '@/theme';

type HomeJob = {
  id: string;
  reference: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  total_price: number | null;
  customer_name: string | null;
  addresses: { line1: string; area: string | null } | null;
  booking_items: { quantity: number; services: { name: string } | null }[];
};

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const startOfWeek = () => {
  const today = startOfToday();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return monday;
};

const isSameDay = (iso: string, day: Date) => {
  const date = new Date(iso);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
};

async function fetchHome(profileId: string) {
  const [jobs, doneThisWeek, unread] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id, reference, status, scheduled_start, scheduled_end, total_price, customer_name, addresses(line1, area), booking_items(quantity, services(name)), job_assignments!inner(technician_id, crew_role)',
      )
      .eq('job_assignments.technician_id', profileId)
      .in('status', ACTIVE_STATUSES)
      .order('scheduled_start', { ascending: true }),
    supabase
      .from('bookings')
      .select('id, job_assignments!inner(technician_id)', { count: 'exact', head: true })
      .eq('job_assignments.technician_id', profileId)
      .eq('status', 'completed')
      .gte('scheduled_start', startOfWeek().toISOString()),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profileId)
      .is('read_at', null),
  ]);

  const firstError = jobs.error ?? doneThisWeek.error ?? unread.error;
  if (firstError) throw new Error(firstError.message);

  return {
    jobs: (jobs.data ?? []) as unknown as HomeJob[],
    doneThisWeek: doneThisWeek.count ?? 0,
    unread: unread.count ?? 0,
  };
}

const QUICK_ACTIONS: { label: string; icon: LucideIcon; href: Href }[] = [
  { label: 'Schedule', icon: CalendarDays, href: '/schedule' },
  { label: 'Cash', icon: Banknote, href: '/cash' },
  { label: 'Jobs', icon: Briefcase, href: '/jobs' },
  { label: 'Profile', icon: UserRound, href: '/profile' },
];

/** Home tab — same shape as the client app's home: brand hero, next job, stats and actions. */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, role } = useAuth();
  const { data, error, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['home', profile?.id],
    queryFn: () => fetchHome(profile!.id),
    enabled: !!profile,
  });

  const jobs = data?.jobs ?? [];
  const today = startOfToday();
  const todayJobs = jobs.filter((job) => isSameDay(job.scheduled_start, today));
  const nextJob = todayJobs[0] ?? jobs[0];
  const displayName = profile?.full_name?.trim() || 'there';
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'G';
  const roleLabel = role ? role.replaceAll('_', ' ') : 'Staff';

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            colors={[colors.green500]}
            onRefresh={() => void refetch()}
            refreshing={isRefetching}
            tintColor={colors.green500}
          />
        }>
        <LinearGradient
          colors={[auth.bgTop, auth.bgBottom]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + space[3] }]}>
          <View style={styles.heroTop}>
            <View style={styles.nameBlock}>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.name} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Account menu, signed in as ${displayName}`}
                onPress={() => router.push('/profile')}
                hitSlop={8}
                style={({ pressed }) => [styles.avatar, pressed && styles.avatarPressed]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  data?.unread ? `Alerts, ${data.unread} unread` : 'Alerts'
                }
                onPress={() => router.push('/notifications')}
                hitSlop={8}
                style={styles.bell}>
                <Bell size={20} color={colors.surface} strokeWidth={2} />
                {data?.unread ? (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>
                      {data.unread > 99 ? '99+' : data.unread}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </View>

          <View style={styles.areaPill}>
            <Briefcase size={14} color={colors.surface} strokeWidth={2} />
            <Text style={styles.areaText} numberOfLines={1}>
              {roleLabel}
            </Text>
            <Text style={styles.areaDivider}>·</Text>
            <Text style={styles.areaText} numberOfLines={1}>
              {today.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.statCard}>
            <Stat label="Today" value={todayJobs.length} />
            <View style={styles.statDivider} />
            <Stat label="Upcoming" value={jobs.length} />
            <View style={styles.statDivider} />
            <Stat label="Done this week" value={data?.doneThisWeek ?? 0} />
          </View>

          <OfflineBanner />

          {error ? (
            <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.card}>
              <Text style={styles.cardTitle}>Could not load your day</Text>
              <Text style={styles.caption}>{error.message}</Text>
              <Text style={styles.link}>Tap to try again</Text>
            </Pressable>
          ) : null}

          {nextJob ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Next job ${nextJob.reference}. Open job`}
              onPress={() => router.push(`/jobs/${nextJob.id}`)}
              style={styles.nextCard}>
              <View style={styles.nextTop}>
                <View style={styles.nextBody}>
                  <Text style={styles.kicker}>Next job</Text>
                  <Text style={styles.nextTitle} numberOfLines={1}>
                    {nextJob.booking_items.map((line) => line.services?.name).filter(Boolean).join(', ') ||
                      'Service to confirm'}
                  </Text>
                  <Text style={styles.nextMeta} numberOfLines={1}>
                    {formatDay(nextJob.scheduled_start)} ·{' '}
                    {formatWindow(nextJob.scheduled_start, nextJob.scheduled_end)}
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: statusChip(nextJob.status).bg }]}>
                  <Text style={[styles.chipText, { color: statusChip(nextJob.status).fg }]}>
                    {statusChip(nextJob.status).label}
                  </Text>
                </View>
              </View>
              <View style={styles.nextActions}>
                <View style={styles.trackButton}>
                  <Navigation size={14} color={colors.surface} strokeWidth={2.2} />
                  <Text style={styles.trackText}>Open job</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.detailsText}>{formatMoney(nextJob.total_price)}</Text>
                  <ChevronRight size={18} color={colors.green700} strokeWidth={2} />
                </View>
              </View>
            </Pressable>
          ) : !isLoading ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Nothing scheduled</Text>
              <Text style={styles.caption}>
                When dispatch assigns you work it appears here. Pull down to refresh.
              </Text>
            </View>
          ) : null}

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Today&apos;s work</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/jobs')} hitSlop={8}>
              <Text style={styles.link}>All jobs</Text>
            </Pressable>
          </View>

          {todayJobs.length ? (
            <View style={styles.card}>
              {todayJobs.map((job, index) => (
                <Pressable
                  key={job.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${job.reference}, ${statusChip(job.status).label}`}
                  onPress={() => router.push(`/jobs/${job.id}`)}
                  style={[styles.row, index > 0 && styles.rowDivider]}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {job.booking_items.map((line) => line.services?.name).filter(Boolean).join(', ') ||
                        'Service to confirm'}
                    </Text>
                    <View style={styles.metaRow}>
                      <MapPin size={13} color={colors.textMuted} />
                      <Text style={styles.caption} numberOfLines={1}>
                        {formatWindow(job.scheduled_start, job.scheduled_end)}
                        {job.addresses ? ` · ${job.addresses.area ?? job.addresses.line1}` : ''}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyCaption}>No jobs booked for today.</Text>
          )}

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Quick actions</Text>
          </View>
          <View style={styles.actions}>
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={() => router.push(action.href)}
                  style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                  <View style={styles.actionIcon}>
                    <Icon size={20} color={colors.green700} strokeWidth={2} />
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  nameBlock: { flex: 1, gap: 0 },
  greeting: { ...text.body, color: auth.textSoft },
  name: { fontFamily: font.poppinsSemi, fontSize: 20, lineHeight: 28, color: colors.surface },
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
  bellBadgeText: { fontFamily: font.bodySemi, fontSize: 10, lineHeight: 12, color: colors.green900 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.yellow500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPressed: { opacity: 0.75 },
  avatarText: { fontFamily: font.poppinsSemi, fontSize: 13, lineHeight: 18, color: colors.green900 },
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
  areaText: { fontFamily: font.bodySemi, fontSize: 13, lineHeight: 18, color: colors.surface, flexShrink: 1 },
  areaDivider: { color: colors.whiteTextMuted, fontSize: 13 },
  body: { padding: space[4], gap: space[4], marginTop: -space[10] - space[2] },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: space[3],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...text.h1, lineHeight: 32 },
  statLabel: { ...text.caption, textAlign: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[2],
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  cardTitle: { ...text.h3 },
  caption: { ...text.caption },
  emptyCaption: { ...text.caption, paddingHorizontal: space[1] },
  link: { ...text.bodyM, color: colors.green500 },
  kicker: { ...text.caption, color: colors.yellow800, textTransform: 'uppercase' },
  nextCard: {
    backgroundColor: colors.yellow50,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
    borderWidth: 1,
    borderColor: colors.yellow200,
  },
  nextTop: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  nextBody: { flex: 1, gap: 2 },
  nextTitle: { ...text.h3 },
  nextMeta: { ...text.caption },
  chip: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 2 },
  chipText: { ...text.caption, fontSize: 11 },
  nextActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: colors.green500,
    borderRadius: radius.pill,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  trackText: { ...text.caption, color: colors.surface, fontFamily: font.bodySemi },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  detailsText: { ...text.bodyM, color: colors.green700 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...text.h2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[3] },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...text.bodyM },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  actions: { flexDirection: 'row', gap: space[3] },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[3],
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { ...text.caption, color: colors.text },
});
