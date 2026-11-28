import { useSyncExternalStore } from 'react';

import { readAccountCache, registerAccountCacheReset, writeAccountCache } from '@/lib/account-cache';

const STORAGE_KEY = 'gabfix.login-activity.v1';
const MAX_EVENTS = 20;

export type LoginEventType = 'sign-in' | 'failed' | 'password-changed' | 'two-factor-on' | 'two-factor-off';

export type LoginEvent = {
  id: string;
  type: LoginEventType;
  atISO: string;
  deviceName?: string;
  platform?: 'android' | 'ios' | 'web';
  method?: 'password' | 'sms' | 'google' | 'phone' | 'email';
  approxLocation?: string;
  newDevice?: boolean;
};

type State = { events: LoginEvent[]; hydrated: boolean };

let state: State = { events: [], hydrated: false };
const listeners = new Set<() => void>();

const getState = () => state;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const persist = (events: LoginEvent[]) => {
  void writeAccountCache(STORAGE_KEY, events);
};

const setEvents = (events: LoginEvent[]) => {
  state = { ...state, events };
  listeners.forEach((listener) => listener());
  persist(events);
};

const isEvent = (value: unknown): value is LoginEvent => {
  const item = value as LoginEvent | null;
  return Boolean(item && item.id && item.type && item.atISO);
};

export async function hydrateLoginActivity(): Promise<void> {
  let events: LoginEvent[] = [];
  try {
    const parsed = await readAccountCache<unknown>(STORAGE_KEY);
    if (Array.isArray(parsed)) events = parsed.filter(isEvent).slice(0, MAX_EVENTS);
  } catch {
    events = [];
  }
  state = { events, hydrated: true };
  listeners.forEach((listener) => listener());
}

const resetLoginActivity = () => {
  state = { events: [], hydrated: false };
  listeners.forEach((listener) => listener());
};

registerAccountCacheReset(resetLoginActivity);

export function addLoginEvent(event: LoginEvent): void {
  setEvents([event, ...state.events].slice(0, MAX_EVENTS));
}

export function useLoginActivity(): LoginEvent[] {
  return useSyncExternalStore(subscribe, getState, getState).events;
}

export function useLoginActivityHydrated(): boolean {
  return useSyncExternalStore(subscribe, getState, getState).hydrated;
}
