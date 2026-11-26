/**
 * Native modules that are not guaranteed to exist in the running build.
 *
 * A module-scope `import * as Notifications from 'expo-notifications'` pulls in
 * `expo-application` (and expo-crypto pulls in its own native module) while the
 * bundle is still evaluating. When the runtime has no such native module — Expo
 * Go, a dev client built before the module was added, web without the `.web`
 * build — `requireNativeModule` throws at import time and takes the whole root
 * layout down before a single screen renders.
 *
 * These accessors import on demand and cache the result, so a missing module
 * disables the feature (push, UUIDs) instead of crashing the app.
 */

type NotificationsModule = typeof import('expo-notifications');
type CryptoModule = typeof import('expo-crypto');

// Metro rewrites `require` with a static string at build time.
declare const require: (id: string) => unknown;

let notifications: NotificationsModule | null | undefined;
let crypto: CryptoModule | null | undefined;

/** expo-notifications, or null when this build has no notifications module. */
export function getNotifications(): NotificationsModule | null {
  if (notifications === undefined) {
    try {
      notifications = require('expo-notifications') as NotificationsModule;
    } catch {
      notifications = null;
    }
  }
  return notifications;
}

/** expo-crypto, or null when this build has no crypto module. */
export function getCrypto(): CryptoModule | null {
  if (crypto === undefined) {
    try {
      crypto = require('expo-crypto') as CryptoModule;
    } catch {
      crypto = null;
    }
  }
  return crypto;
}
