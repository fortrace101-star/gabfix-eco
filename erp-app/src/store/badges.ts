import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'gabfix.portal.badges.v1';

/** Tabs that can carry a count. Alerts already has its own unread list. */
export type BadgeTab = 'chat' | 'jobs' | 'cash';

type BadgesState = {
  /** When this device last looked at the tab; activity after it is "new". */
  seen: Record<BadgeTab, string | null>;
  hydrated: boolean;
};

const emptySeen = (): Record<BadgeTab, string | null> => ({ chat: null, jobs: null, cash: null });

let state: BadgesState = { seen: emptySeen(), hydrated: false };

const listeners = new Set<() => void>();

const getState = () => state;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const persist = (seen: Record<BadgeTab, string | null>) => {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seen)).catch(() => undefined);
};

const TAB_KEYS: BadgeTab[] = ['chat', 'jobs', 'cash'];

/**
 * Called once at boot from the root layout. A first launch starts from "now": the
 * badge should count what happens after the technician starts using the app, not
 * every job or payment the account has ever had.
 */
export async function hydrateBadges(): Promise<void> {
  const now = new Date().toISOString();
  const seen = emptySeen();
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (parsed && typeof parsed === 'object') {
      for (const tab of TAB_KEYS) {
        const value = (parsed as Record<string, unknown>)[tab];
        seen[tab] = typeof value === 'string' ? value : now;
      }
    } else {
      for (const tab of TAB_KEYS) seen[tab] = now;
    }
  } catch {
    for (const tab of TAB_KEYS) seen[tab] = now;
  }
  state = { seen, hydrated: true };
  listeners.forEach((listener) => listener());
  persist(seen);
}

/** Records that the technician is looking at a tab, clearing its badge. */
export function markTabSeen(tab: BadgeTab, atISO: string = new Date().toISOString()): void {
  const current = state.seen[tab];
  if (current && Date.parse(atISO) <= Date.parse(current)) return;
  const seen = { ...state.seen, [tab]: atISO };
  state = { ...state, seen };
  listeners.forEach((listener) => listener());
  persist(seen);
}

export function useTabSeen(tab: BadgeTab): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getState().seen[tab],
    () => getState().seen[tab],
  );
}

export function useBadgesHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getState().hydrated,
    () => getState().hydrated,
  );
}
