import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from './supabase';

type NotificationsModule = typeof import('expo-notifications');

let syncedToken: string | null = null;
let handlerConfigured = false;

async function getNotifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  try {
    const Notifications = await import('expo-notifications');
    if (!handlerConfigured) {
      // A message that lands while the app is open still shows as a banner.
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          // The in-app chime plays instead, so a foreground push does not double up.
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      handlerConfigured = true;
    }
    return Notifications;
  } catch {
    return null;
  }
}

/**
 * Registers this handset against the signed-in profile so chat pushes reach the
 * technician when the app is closed. Best effort: a denied permission or an Expo
 * outage must not block sign-in.
 */
export async function syncPushToken(userId: string): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('critical', {
        name: 'Chat and job updates',
        // AndroidImportance.HIGH; the value is stable in expo-notifications.
        importance: 6,
      });
    }

    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted && current.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return;

    const projectId =
      (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
      (Constants.easConfig as { projectId?: string } | undefined)?.projectId;
    if (!projectId) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token || token === syncedToken) return;

    const { error } = await supabase.from('device_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: token,
        platform: Platform.OS,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'expo_push_token' },
    );
    if (!error) syncedToken = token;
  } catch {
    // The next launch retries; push is never allowed to block the app.
  }
}
