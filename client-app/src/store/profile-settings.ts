import { useSyncExternalStore } from 'react';

import { deviceTimezone } from '@/config/timezones';
import { readAccountCache, registerAccountCacheReset, removeAccountCache, writeAccountCache } from '@/lib/account-cache';

const STORAGE_KEY = 'gabfix.profile-settings.v2';
const LEGACY_KEY = 'gabfix.profile-settings.v1';

export type QuietHours = { enabled: boolean; start: string; end: string };

export type NotificationPreferences = {
  inApp: boolean;
  push: boolean;
  reminders: boolean;
  offers: boolean;
  quietHours: QuietHours;
  timezone: string;
};

export type ProfileSettings = {
  avatarUri?: string;
  language: 'en';
  notifications: NotificationPreferences;
  hydrated: boolean;
};

type V1 = {
  avatarUri?: string;
  notifications?: { bookingUpdates?: boolean; reminders?: boolean; offers?: boolean };
  biometric?: boolean;
};

const defaultTimezone = () => deviceTimezone() ?? 'Africa/Kampala';

const defaultNotifications = (): NotificationPreferences => ({
  inApp: true,
  push: true,
  reminders: true,
  offers: false,
  quietHours: { enabled: false, start: '22:00', end: '07:00' },
  timezone: defaultTimezone(),
});

const defaults = (): ProfileSettings => ({
  language: 'en',
  notifications: defaultNotifications(),
  hydrated: false,
});

let state: ProfileSettings = defaults();
const listeners = new Set<() => void>();

const getState = () => state;

export const getProfileSettings = () => state;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const persist = (next: ProfileSettings) => {
  const stored = {
    avatarUri: next.avatarUri,
    language: next.language,
    notifications: next.notifications,
  };
  void writeAccountCache(STORAGE_KEY, stored);
};

const setSettings = (next: ProfileSettings) => {
  state = { ...next, hydrated: true };
  listeners.forEach((listener) => listener());
  persist(state);
};

export function migrateV1(v1: V1): {
  settings: Pick<ProfileSettings, 'avatarUri' | 'notifications'>;
  biometric: boolean;
} {
  const old = v1.notifications ?? {};
  const bookingUpdates = old.bookingUpdates !== false;
  const reminders = old.reminders !== false;
  return {
    settings: {
      avatarUri: typeof v1.avatarUri === 'string' ? v1.avatarUri : undefined,
      notifications: {
        inApp: true,
        push: bookingUpdates || reminders,
        reminders,
        offers: old.offers === true,
        quietHours: { enabled: false, start: '22:00', end: '07:00' },
        timezone: defaultTimezone(),
      },
    },
    biometric: v1.biometric === true,
  };
}

const normaliseNotifications = (value: unknown): NotificationPreferences => {
  const defaultsN = defaultNotifications();
  const n = value as Partial<NotificationPreferences> | null;
  if (!n || typeof n !== 'object') return defaultsN;
  const q = n.quietHours as Partial<QuietHours> | undefined;
  return {
    inApp: n.inApp !== false,
    push: n.push !== false,
    reminders: n.reminders !== false,
    offers: n.offers === true,
    quietHours: {
      enabled: q?.enabled === true,
      start: typeof q?.start === 'string' && /^\d\d:\d\d$/.test(q.start) ? q.start : defaultsN.quietHours.start,
      end: typeof q?.end === 'string' && /^\d\d:\d\d$/.test(q.end) ? q.end : defaultsN.quietHours.end,
    },
    timezone: typeof n.timezone === 'string' && n.timezone ? n.timezone : defaultsN.timezone,
  };
};

/** Called once at boot and when the active account changes. */
export async function hydrateProfileSettings(): Promise<void> {
  let next = defaults();
  try {
    const parsed = await readAccountCache<Partial<Omit<ProfileSettings, 'hydrated'>> | null>(STORAGE_KEY);
    if (parsed) {
      next = {
        ...next,
        avatarUri: typeof parsed.avatarUri === 'string' ? parsed.avatarUri : undefined,
        notifications: normaliseNotifications(parsed.notifications),
      };
    } else {
      const legacy = await readAccountCache<V1 | null>(LEGACY_KEY);
      if (legacy) {
        const migrated = migrateV1(legacy);
        next = {
          ...next,
          avatarUri: migrated.settings.avatarUri,
          notifications: migrated.settings.notifications,
        };
        await removeAccountCache(LEGACY_KEY);
      }
    }
  } catch {
    next = defaults();
  }
  state = { ...next, hydrated: true };
  listeners.forEach((listener) => listener());
  persist(state);
}

const resetProfileSettings = () => {
  state = { ...defaults(), hydrated: false };
  listeners.forEach((listener) => listener());
};

registerAccountCacheReset(resetProfileSettings);

export function setAvatarUri(avatarUri?: string): void {
  setSettings({ ...state, avatarUri });
}

export function saveNotificationPreferences(notifications: NotificationPreferences): void {
  setSettings({ ...state, notifications });
}

/** Delete-account path; clears this account's profile settings cache. */
export async function clearProfileSettings(): Promise<void> {
  state = { ...defaults(), hydrated: true };
  listeners.forEach((listener) => listener());
  await removeAccountCache(STORAGE_KEY);
  await removeAccountCache(LEGACY_KEY);
}

export function useProfileSettings(): ProfileSettings {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useProfileSettingsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getState, getState).hydrated;
}
