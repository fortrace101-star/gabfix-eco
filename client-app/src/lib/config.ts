import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Runtime configuration, kept in step with the technician (ERP) app's
 * `src/lib/env.ts` so both apps reach the backend the same way.
 *
 * `EXPO_PUBLIC_API_BASE_URL` names the Hono `api` function directly. As in the ERP
 * app, `EXPO_PUBLIC_SUPABASE_URL` is also accepted: the API lives under
 * `/functions/v1/api`, so the same `.env.local` works for both apps.
 *
 * Local development: `localhost`/`127.0.0.1` means "this device", so a phone, an
 * emulator or a browser opened from a LAN address cannot reach the stack through
 * it. A loopback URL is rewritten to the host the app was loaded from — the Metro
 * host on native, the page's host on web — keeping the port. Any non-loopback URL
 * (a hosted project) is left alone, and a release build has no dev host, so it is
 * untouched too.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const configuredApi = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, '');
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');

const configured = configuredApi || (supabaseUrl ? `${supabaseUrl}/functions/v1/api` : '');

function resolveDevUrl(url: string) {
  const host =
    Platform.OS === 'web'
      ? typeof window !== 'undefined'
        ? window.location?.hostname
        : undefined
      : Constants.expoConfig?.hostUri?.split(':')[0];
  if (!host || LOOPBACK.has(host)) return url;
  return url.replace(/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `/${host}`);
}

export const API_BASE_URL = resolveDevUrl(configured);
export const hasApiBaseUrl = API_BASE_URL.length > 0;
