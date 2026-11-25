import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Runtime configuration. Set EXPO_PUBLIC_API_BASE_URL in your environment or EAS
 * build profile to connect the client to the Gabfix API.
 *
 * Local development: an explicit `localhost`/`127.0.0.1` API URL only works on
 * the same machine. On a phone or emulator (native or Expo web opened over the
 * LAN) it points at the device itself, so `fetch` fails with a misleading
 * "check your connection" error. In a dev build we swap the loopback host for
 * the host serving the app (the Expo dev server or the browser's address) and
 * keep the configured port. Explicit non-loopback URLs are untouched.
 */
const configured = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(configured);

const devHost = (() => {
  if (!__DEV__) return undefined;
  if (Platform.OS === 'web') {
    const location = (globalThis as { location?: { hostname?: string } }).location;
    return location?.hostname;
  }
  return Constants.expoConfig?.hostUri?.split(':')[0];
})();

const isRemoteHost = Boolean(devHost && devHost !== 'localhost' && devHost !== '127.0.0.1');

export const API_BASE_URL = (
  configured && isRemoteHost && isLoopback
    ? configured.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)/i, `$1${devHost}`)
    : configured
).replace(/\/+$/, '');

export const hasApiBaseUrl = API_BASE_URL.length > 0;
