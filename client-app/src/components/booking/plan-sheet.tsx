import { CalendarClock, Check, Pause, Play, SkipForward, Trash2, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { DateStrip, toISODate } from '@/components/booking/date-strip';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { shortDate, type RecurringPlan } from '@/lib/plans';
import { endPlan, pausePlan, resumePlan, skipNextVisit, type PlanOverride } from '@/store/plans';
import { colors, radius, space, text } from '@/theme';
import { successHaptic } from '@/utils/haptics';

const daysAhead = 30;

const buildDays = (): Date[] => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: daysAhead }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

type Mode = 'menu' | 'pause' | 'end' | 'done';

type Props = {
  plan: RecurringPlan | null;
  override: PlanOverride;
  nextVisit?: string;
  visible: boolean;
  onClose: () => void;
  onChangeDayTime: () => void;
};

/** P17 actions: skip next visit, pause/resume, change day or time, request a cleaner, end plan. */
export function PlanSheet({ plan, override, nextVisit, visible, onClose, onChangeDayTime }: Props) {
  if (!visible || !plan) return null;
  return (
    <PlanBody
      plan={plan}
      override={override}
      nextVisit={nextVisit}
      onClose={onClose}
      onChangeDayTime={onChangeDayTime}
    />
  );
}

function PlanBody({
  plan,
  override,
  nextVisit,
  onClose,
  onChangeDayTime,
}: Omit<Props, 'visible' | 'plan'> & { plan: RecurringPlan }) {
  const [mode, setMode] = useState<Mode>('menu');
  const [notice, setNotice] = useState<string | null>(null);
  const [resumeISO, setResumeISO] = useState(() => nextVisit ?? toISODate(new Date()));
  const [days] = useState(buildDays);
  const paused = Boolean(override.pausedUntil);

  const finish = (message: string) => {
    successHaptic();
    setNotice(message);
    setMode('done');
  };

  const onSkip = () => {
    if (!nextVisit) return;
    skipNextVisit(plan.bookingId, nextVisit);
    finish(`The visit on ${shortDate(nextVisit)} is skipped. The plan continues after that.`);
  };

  const onPause = () => {
    pausePlan(plan.bookingId, resumeISO);
    finish(`Plan paused. Visits resume on ${shortDate(resumeISO)}.`);
  };

  const onResume = () => {
    resumePlan(plan.bookingId);
    finish('Plan resumed. Your next visit is back on the regular schedule.');
  };

  const onEnd = () => {
    endPlan(plan.bookingId);
    finish('Plan ended. Your booking history and receipts are unchanged.');
  };

  const heading =
    mode === 'pause'
      ? {
          title: paused ? 'Change pause' : 'Pause plan',
          subtitle: 'Choose the date visits should resume',
        }
      : mode === 'menu'
        ? { title: 'Manage plan', subtitle: `${plan.serviceName} · ${plan.bookingId}` }
        : { title: undefined, subtitle: undefined };

  const footer =
    mode === 'done' ? (
      <Button label="Done" onPress={onClose} />
    ) : mode === 'pause' ? (
      <View style={styles.footer}>
        <Button label={`Resume on ${shortDate(resumeISO)}`} onPress={onPause} />
        <Button label="Back" variant="ghost" onPress={() => setMode('menu')} />
      </View>
    ) : mode === 'end' ? (
      <View style={styles.footer}>
        <Button label="End plan" variant="destructive" onPress={onEnd} />
        <Button label="Keep plan" variant="ghost" onPress={() => setMode('menu')} />
      </View>
    ) : undefined;

  return (
    <BottomSheet
      visible
      onDismiss={onClose}
      title={heading.title}
      subtitle={heading.subtitle}
      maxHeightRatio={0.92}
      contentContainerStyle={styles.body}
      footer={footer}>
      {mode === 'done' ? (
        <View style={styles.success}>
          <View style={styles.successIcon}>
            <Check size={30} color={colors.surface} strokeWidth={3} />
          </View>
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>
            Plan updated
          </Text>
          <Text style={styles.successBody} maxFontSizeMultiplier={1.3}>
            {notice}
          </Text>
        </View>
      ) : mode === 'pause' ? (
        <>
          <View style={styles.stripWrap}>
            <DateStrip days={days} selectedISO={resumeISO} onSelect={setResumeISO} />
          </View>
          <Text style={styles.helper} maxFontSizeMultiplier={1.3}>
            Nothing is charged while the plan is paused. You can resume earlier at any time.
          </Text>
        </>
      ) : mode === 'end' ? (
        <View style={styles.endPanel}>
          <View style={styles.endIcon}>
            <Trash2 size={24} color={colors.error} strokeWidth={2} />
          </View>
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>
            End this plan?
          </Text>
          <Text style={styles.successBody} maxFontSizeMultiplier={1.3}>
            Future visits stop and the recurring discount ends. Past bookings, payments and
            receipts stay in your history.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summary}>
              <Text style={styles.summaryLabel} maxFontSizeMultiplier={1.2}>
                Next visit
              </Text>
              <Text style={styles.summaryValue} maxFontSizeMultiplier={1.3}>
                {paused
                  ? `Paused until ${shortDate(override.pausedUntil!)}`
                  : nextVisit
                    ? shortDate(nextVisit)
                    : 'No date set'}
              </Text>
            </View>

          <View style={styles.menu}>
              <ActionRow
                icon={SkipForward}
                label="Skip next visit"
                hint={nextVisit ? shortDate(nextVisit) : 'No upcoming visit'}
                disabled={!nextVisit}
                onPress={onSkip}
              />
              <ActionRow
                icon={paused ? Play : Pause}
                label={paused ? 'Resume plan' : 'Pause plan'}
                hint={paused ? 'Return to the regular schedule' : 'Choose a resume date'}
                onPress={() => {
                  if (paused) onResume();
                  else setMode('pause');
                }}
              />
              <ActionRow
                icon={CalendarClock}
                label="Change day or time"
                hint="Pick a new slot for the next visit"
                onPress={() => {
                  onClose();
                  onChangeDayTime();
                }}
              />
              <ActionRow
                icon={UserRound}
                label="Request a different cleaner"
                hint="We'll find the best available match"
                onPress={() =>
                  Alert.alert(
                    'Request a different cleaner',
                    'Cleaner assignment and requests will connect once the scheduling backend is available. Your plan keeps its current cleaner preference.',
                  )
                }
              />
            <ActionRow
              icon={Trash2}
              label="End plan"
              hint="Stop future visits"
              destructive
              onPress={() => setMode('end')}
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

function ActionRow({
  icon: Icon,
  label,
  hint,
  onPress,
  disabled,
  destructive,
}: {
  icon: typeof SkipForward;
  label: string;
  hint: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.actionRow}>
      <View style={[styles.actionIcon, destructive && styles.actionIconDanger]}>
        <Icon
          size={20}
          color={destructive ? colors.error : colors.green700}
          strokeWidth={2}
        />
      </View>
      <View style={styles.actionCopy}>
        <Text
          style={[styles.actionLabel, destructive && styles.actionLabelDanger, disabled && styles.disabled]}
          maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
        <Text style={styles.actionHint} maxFontSizeMultiplier={1.2}>
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: space[1],
    gap: space[3],
  },
  title: { ...text.h2 },
  summary: {
    backgroundColor: colors.green50,
    borderRadius: radius.tile,
    padding: space[3],
    gap: 2,
  },
  summaryLabel: { ...text.caption, color: colors.green700 },
  summaryValue: { ...text.bodyM, color: colors.green900 },
  menu: { marginTop: -space[1] },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.tile,
    backgroundColor: colors.green50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconDanger: { backgroundColor: colors.errorBg },
  actionCopy: { flex: 1, gap: 1 },
  actionLabel: { ...text.bodyM, color: colors.text },
  actionLabelDanger: { color: colors.error },
  actionHint: { ...text.caption, color: colors.textMuted },
  disabled: { color: colors.disabledText },
  stripWrap: { marginHorizontal: -space[4] },
  helper: { ...text.caption, color: colors.textMuted },
  footer: { gap: space[1] },
  endPanel: { alignItems: 'center', gap: space[3], paddingVertical: space[3] },
  endIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  success: { alignItems: 'center', gap: space[3], paddingVertical: space[6] },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBody: { ...text.bodyM, color: colors.textMuted, textAlign: 'center' },
});
