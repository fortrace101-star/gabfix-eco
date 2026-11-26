import Constants from 'expo-constants';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and run `npx supabase status -o env` in backend/.',
  );
}

// `localhost` means "this device": a phone, an emulator or a browser opened from a
// LAN address cannot reach the stack through it (Chrome also blocks a LAN page
// fetching loopback). Point the loopback URL at whatever host the app was loaded
// from — the Metro host on native, the page's host on web. Any non-loopback URL
// (a hosted project) is left alone.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function resolveDevUrl(url: string) {
  // `window` exists on React Native (it aliases the global object) but
  // `window.location` does not, so only touch it on web. A release build has no
  // `hostUri` either, which correctly leaves a hosted Supabase URL unchanged.
  const host =
    Platform.OS === 'web'
      ? typeof window !== 'undefined'
        ? window.location?.hostname
        : undefined
      : Constants.expoConfig?.hostUri?.split(':')[0];
  if (!host || LOOPBACK.has(host)) return url;
  return url.replace(/\/\/(localhost|127\.0\.0\.1)(?=[:/]|$)/, `//${host}`);
}

export const env = { supabaseUrl: resolveDevUrl(supabaseUrl), supabaseAnonKey } as const;
