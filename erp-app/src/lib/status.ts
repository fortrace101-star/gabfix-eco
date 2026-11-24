import { colors } from '@/theme';

/** Booking status → chip palette + label, shared by the list, home and detail screens. */
export const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  requested: { bg: colors.infoBg, fg: colors.info, label: 'Requested' },
  awaiting_confirmation: { bg: colors.warningBg, fg: colors.warning, label: 'Awaiting confirmation' },
  confirmed: { bg: colors.infoBg, fg: colors.info, label: 'Confirmed' },
  scheduled: { bg: colors.green50, fg: colors.green700, label: 'Scheduled' },
  on_the_way: { bg: colors.yellow50, fg: colors.yellow800, label: 'On the way' },
  in_progress: { bg: colors.yellow50, fg: colors.yellow800, label: 'In progress' },
  completed: { bg: colors.green50, fg: colors.green700, label: 'Completed' },
  cancelled: { bg: colors.errorBg, fg: colors.error, label: 'Cancelled' },
};

export const ACTIVE_STATUSES = [
  'requested',
  'awaiting_confirmation',
  'confirmed',
  'scheduled',
  'on_the_way',
  'in_progress',
] as const;

export function statusChip(status: string) {
  return STATUS_STYLES[status] ?? { bg: colors.disabledBg, fg: colors.textMuted, label: status };
}
