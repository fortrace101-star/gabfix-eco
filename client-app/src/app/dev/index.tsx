import { router, Redirect, type Href } from 'expo-router';
import { CalendarDays, Gift, Info, MapPinOff, WifiOff } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/booking/segmented-control';
import { SelectableCard } from '@/components/booking/selectable-card';
import { Avatar } from '@/components/ui/avatar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CounterStepper } from '@/components/ui/counter-stepper';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FilterChip } from '@/components/ui/filter-chip';
import { InlineBanner } from '@/components/ui/inline-banner';
import { Input } from '@/components/ui/input';
import { PermissionCard } from '@/components/ui/permission-card';
import { RetryHint } from '@/components/ui/retry-hint';
import { Skeleton } from '@/components/ui/skeleton';
import { StatTile } from '@/components/ui/stat-tile';
import { StatusChip } from '@/components/ui/status-chip';
import { showToast } from '@/components/ui/toast';
import { TopBar } from '@/components/ui/top-bar';
import { colors, space, text } from '@/theme';

const criteria = [
  { value: 'all', label: 'All' },
  { value: 'five', label: '5 stars' },
  { value: 'comments', label: 'Comments' },
] as const;

type Criterion = (typeof criteria)[number]['value'];

const variants: ButtonVariant[] = [
  'primary',
  'onGreen',
  'secondary',
  'ghost',
  'destructive',
  'dangerGhost',
];

/** Hidden component gallery for visual QA of the shared kit (Phase 1). */
export default function DevGalleryScreen() {
  const [count, setCount] = useState(2);
  const [name, setName] = useState('');
  const [chip, setChip] = useState('all');
  const [criterion, setCriterion] = useState<Criterion>('all');
  const [plan, setPlan] = useState('full');
  const [checked, setChecked] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <TopBar title="Component gallery" onBack={() => router.replace('/' as Href)} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Section title="Buttons">
          <View style={styles.stack}>
            {variants.map((variant) => (
              <Button key={variant} label={variant} variant={variant} />
            ))}
            <Button label="With icon" icon={Gift} />
            <Button label="Loading" loading />
            <Button label="Disabled" disabled />
            <Button label="Small" small />
          </View>
        </Section>

        <Section title="Chips and badges">
          <View style={styles.rowWrap}>
            {['all', 'home', 'office'].map((value) => (
              <FilterChip
                key={value}
                label={value}
                selected={chip === value}
                onPress={() => setChip(value)}
              />
            ))}
          </View>
          <View style={styles.rowWrap}>
            <StatusChip label="Success" tone="success" />
            <StatusChip label="Info" tone="info" />
            <StatusChip label="Warning" tone="warning" />
            <StatusChip label="Error" tone="error" />
            <StatusChip label="Neutral" tone="neutral" />
          </View>
        </Section>

        <Section title="Inputs">
          <View style={styles.stack}>
            <Input label="Full name" value={name} onChangeText={setName} placeholder="Jane Doe" />
            <Input label="With helper" helper="We only use this for your receipt." value="" onChangeText={() => {}} />
            <Input label="With error" error="Enter a valid phone number" value="070" onChangeText={() => {}} />
            <Input label="Multiline" multiline numberOfLines={3} value="" onChangeText={() => {}} inputStyle={styles.multiline} />
          </View>
        </Section>

        <Section title="Segmented control">
          <SegmentedControl options={criteria} value={criterion} onChange={setCriterion} />
        </Section>

        <Section title="Selectable cards">
          {[
            { value: 'full', title: 'Pay in full', subtitle: 'Nothing due after the clean' },
            { value: 'deposit', title: 'Pay a deposit', benefit: '30% today, the rest after', discount: 'Popular' },
            { value: 'after', title: 'Pay after service', subtitle: 'Cash or mobile money' },
          ].map((option) => (
            <SelectableCard
              key={option.value}
              title={option.title}
              subtitle={option.subtitle}
              benefit={option.benefit}
              discount={option.discount}
              selected={plan === option.value}
              onPress={() => setPlan(option.value)}
            />
          ))}
        </Section>

        <Section title="Checkbox">
          <Checkbox checked={checked} onChange={setChecked} label="I agree to the terms" />
          <Checkbox checked={false} onChange={() => {}} label="Disabled option" disabled />
          <Checkbox checked={false} onChange={() => {}} label="With an error" error="Required" />
        </Section>

        <Section title="Counter stepper">
          <Card>
            <CounterStepper label="Bedrooms" hint="Count all rooms with beds" value={count} onChange={setCount} min={1} max={8} />
          </Card>
        </Section>

        <Section title="Surfaces">
          <Card>
            <Text style={styles.body}>Default card with 16 dp padding.</Text>
          </Card>
          <View style={styles.statsRow}>
            <StatTile label="Bookings" value={12} />
            <StatTile label="Saved" value={3} />
          </View>
          <View style={styles.avatars}>
            <Avatar name="Sarah Nakato" size={40} />
            <Avatar name="Brian Okello" size={52} />
            <Avatar size={40} />
          </View>
        </Section>

        <Section title="Banners">
          <InlineBanner variant="info" title="Heads up" message="Prices include VAT." />
          <InlineBanner variant="success" message="Payment received." />
          <InlineBanner variant="warning" message="Your cleaner is running late." icon={Info} />
          <InlineBanner variant="error" title="Payment failed" message="Try another method." actionLabel="Retry" onAction={() => {}} />
        </Section>

        <Section title="Loading">
          <Skeleton style={styles.skeletonLine} />
          <Skeleton style={styles.skeletonBlock} />
          <RetryHint />
          <Text style={styles.note} maxFontSizeMultiplier={1.3}>
            RetryHint stays hidden until a load passes eight seconds.
          </Text>
        </Section>

        <Section title="Empty and error states">
          <EmptyState
            icon={CalendarDays}
            title="No bookings yet"
            body="Your first clean will appear here once it is booked."
            actionLabel="Browse services"
            onAction={() => {}}
          />
          <ErrorState
            title="Could not load bookings"
            body="Check your connection and try again."
            onRetry={() => {}}
            onContactSupport={() => {}}
          />
          <PermissionCard
            icon={MapPinOff}
            title="Turn on location"
            body="We use it only to find your address."
            onOpenSettings={() => {}}
          />
          <InlineBanner variant="info" title="Offline banner" message="Network banners use the same shell when the device drops offline." icon={WifiOff} />
        </Section>

        <Section title="Bottom sheet">
          <Button label="Open sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
        </Section>

        <Section title="Toast">
          <View style={styles.stack}>
            <Button label="Show toast" onPress={() => showToast('Referral code copied')} />
            <Button
              label="Success toast"
              variant="secondary"
              onPress={() => showToast('Booking confirmed', 'success')}
            />
            <Button
              label="Error toast"
              variant="dangerGhost"
              onPress={() => showToast('Could not save changes', 'error')}
            />
          </View>
        </Section>
      </ScrollView>

      <BottomSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        title="Shared bottom sheet"
        subtitle="Pinned header, scrolling body and a footer below."
        contentContainerStyle={styles.sheetContent}
        footer={<Button label="Primary action" onPress={() => setSheetOpen(false)} />}>
        <Text style={styles.body} maxFontSizeMultiplier={1.3}>
          Every drawer in the app uses this shell, so the drag handle, backdrop, safe-area
          inset and close behaviour stay identical.
        </Text>
        <InlineBanner variant="success" message="Safe-area padding is applied once, inside the sheet." />
      </BottomSheet>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} maxFontSizeMultiplier={1.3}>
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space[4], paddingBottom: space[10], gap: space[6] },
  section: { gap: space[2] },
  sectionTitle: { ...text.caption, color: colors.textMuted },
  sectionBody: { gap: space[3] },
  stack: { gap: space[2] },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  statsRow: { flexDirection: 'row', gap: space[2] },
  avatars: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  body: { ...text.body },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  skeletonLine: { height: 16, width: '60%' },
  skeletonBlock: { height: 88 },
  note: { ...text.caption },
  sheetContent: { paddingHorizontal: space[4], paddingVertical: space[2], gap: space[3] },
});
