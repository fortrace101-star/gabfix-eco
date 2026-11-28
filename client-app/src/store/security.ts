import { useSyncExternalStore } from 'react';

import { readAccountCache, registerAccountCacheReset, removeAccountCache, writeAccountCache } from '@/lib/account-cache';

const STORAGE_KEY = 'gabfix.security.v1';

export type TwoFactorMethod = 'sms' | 'email';
export type TwoFactorState = { enabled: boolean; method: TwoFactorMethod; enabledAtISO?: string };

export type SecurityState = {
  passwordChangedAtISO?: string;
  twoFactor: TwoFactorState;
  lastLoginISO?: string;
  biometric: boolean;
  hydrated: boolean;
};

const defaults = (): SecurityState => ({
  twoFactor: { enabled: false, method: 'sms' },
  biometric: false,
  hydrated: false,
});

let state: SecurityState = defaults();
const listeners = new Set<() => void>();

const getState = () => state;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const persist = (next: SecurityState) => {
  const stored = {
    passwordChangedAtISO: next.passwordChangedAtISO,
    twoFactor: next.twoFactor,
    lastLoginISO: next.lastLoginISO,
    biometric: next.biometric,
  };
  void writeAccountCache(STORAGE_KEY, stored);
};

const setState = (next: SecurityState) => {
  state = { ...next, hydrated: true };
  listeners.forEach((listener) => listener());
  persist(state);
};

export async function hydrateSecurity(): Promise<void> {
  let next = defaults();
  try {
    const parsed = await readAccountCache<Partial<Omit<SecurityState, 'hydrated'>> | null>(STORAGE_KEY);
    if (parsed) {
      next = {
        ...next,
        passwordChangedAtISO:
          typeof parsed.passwordChangedAtISO === 'string' ? parsed.passwordChangedAtISO : undefined,
        lastLoginISO: typeof parsed.lastLoginISO === 'string' ? parsed.lastLoginISO : undefined,
        biometric: parsed.biometric === true,
        twoFactor: {
          enabled: parsed.twoFactor?.enabled === true,
          method: parsed.twoFactor?.method === 'email' ? 'email' : 'sms',
          enabledAtISO:
            typeof parsed.twoFactor?.enabledAtISO === 'string'
              ? parsed.twoFactor.enabledAtISO
              : undefined,
        },
      };
    }
  } catch {
    next = defaults();
  }
  state = { ...next, hydrated: true };
  listeners.forEach((listener) => listener());
}

const resetSecurity = () => {
  state = { ...defaults(), hydrated: false };
  listeners.forEach((listener) => listener());
};

registerAccountCacheReset(resetSecurity);

export function markPasswordChanged(): void {
  setState({ ...state, passwordChangedAtISO: new Date().toISOString() });
}

export function setTwoFactor(twoFactor: TwoFactorState): void {
  setState({ ...state, twoFactor });
}

export function setLastLogin(iso = new Date().toISOString()): void {
  setState({ ...state, lastLoginISO: iso });
}

export function setBiometric(enabled: boolean): void {
  setState({ ...state, biometric: enabled });
}

export async function clearSecurity(): Promise<void> {
  state = { ...defaults(), hydrated: true };
  listeners.forEach((listener) => listener());
  await removeAccountCache(STORAGE_KEY);
}

export function useSecurity(): SecurityState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useSecurityHydrated(): boolean {
  return useSyncExternalStore(subscribe, getState, getState).hydrated;
}
