import { Platform } from 'react-native';

import { apiRequest } from './client';

/** Registers this handset so quote and booking events can reach it as push. */
export async function registerDeviceToken(token: string): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  await apiRequest('/device-tokens', {
    method: 'POST',
    body: { token, platform: Platform.OS },
  });
}
