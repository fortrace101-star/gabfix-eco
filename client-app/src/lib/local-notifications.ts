import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { mock } from '@/config/mock';

const setChannel = Platform.OS === 'android' ? { channelId: 'critical' } : {};

/**
 * Schedules the "your cleaner is assigned" local notification for a new booking
 * (Phase 2 Stage 1, 12.3). Best-effort: no permission, no scheduling.
 */
export async function scheduleAssignmentReminder(
  bookingId: string,
  body: string,
): Promise<string | undefined> {
  if (Platform.OS === 'web' || !mock.assignment.enabled) return undefined;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return undefined;
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your cleaner is assigned',
        body,
        data: { href: `/booking/${bookingId}` },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.round(mock.assignment.delayMs / 1000),
        ...setChannel,
      },
    });
  } catch {
    return undefined;
  }
}

/** Cancels a pending assignment notification when a booking is cancelled or moved. */
export async function cancelAssignmentReminder(id?: string): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already delivered or never scheduled.
  }
}
