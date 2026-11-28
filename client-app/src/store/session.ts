import { useSyncExternalStore } from 'react';

import { setActiveAccountId } from '@/lib/account-cache';
import { refreshSession as requestRefresh, type AuthSession, type AuthUser } from '@/lib/api/auth';
import { setAuthBridge } from '@/lib/api/session-bridge';
import { loadSession, saveSession } from '@/lib/session-storage';
import { setUserName } from '@/store/onboarding';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

type SessionState = {
  status: SessionStatus;
  session: AuthSession | null;
};

let state: SessionState = { status: 'loading', session: null };
let expired = false;
/** False when the user signed in without "Remember me": keep the session in memory only. */
let persistSession = true;
const listeners = new Set<() => void>();
const expiredListeners = new Set<() => void>();

const getState = () => state;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const emit = (next: SessionState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const emitExpired = () => {
  expiredListeners.forEach((listener) => listener());
};

const markSessionExpired = () => {
  if (expired) return;
  expired = true;
  emitExpired();
};

const firstNameOf = (user: AuthUser) => user.name?.trim().split(/\s+/)[0] || null;

/** Read the persisted session once at boot (called from the root layout). */
export async function restoreSession(): Promise<void> {
  const session = await loadSession();
  if (session) {
    // Activate this account's cache before emitting so account-scoped stores can
    // hydrate against the correct identifying user id.
    setActiveAccountId(session.user.id);
    const firstName = firstNameOf(session.user);
    if (firstName) setUserName(firstName);
    emit({ status: 'authenticated', session });
    return;
  }
  setActiveAccountId(null);
  emit({ status: 'unauthenticated', session: null });
}

/**
 * Called after login or OTP verification. Persists the tokens and updates the
 * greeting; `remember: false` (the unticked "Remember me") keeps the session for
 * this run only and clears any tokens stored by an earlier sign-in.
 */
export async function startSession(
  session: AuthSession,
  options: { remember?: boolean } = {},
): Promise<void> {
  if (expired) {
    expired = false;
    emitExpired();
  }
  const remember = options.remember ?? true;
  persistSession = remember;
  // Switch the cache to this account before emitting; a different account gets a
  // fresh cache object, never the previous account's data.
  setActiveAccountId(session.user.id);
  const firstName = firstNameOf(session.user);
  if (firstName) setUserName(firstName);
  emit({ status: 'authenticated', session });
  await saveSession(remember ? session : null);
}

export async function endSession(): Promise<void> {
  emit({ status: 'unauthenticated', session: null });
  setUserName(null);
  persistSession = true;
  // Drop the active account so account-scoped stores reset to empty defaults
  // instead of leaking into the next sign-in.
  setActiveAccountId(null);
  await saveSession(null);
}

/** Edits the local profile until `PUT /me` is connected. */
export async function updateSessionUser(patch: Partial<AuthUser>): Promise<void> {
  const current = state.session;
  if (!current) return;
  const next: AuthSession = { ...current, user: { ...current.user, ...patch } };
  emit({ status: 'authenticated', session: next });
  setUserName(next.user.name?.trim().split(/\s+/)[0] || null);
  if (persistSession) await saveSession(next);
}

let refreshInFlight: Promise<boolean> | null = null;

/** Refresh once per expiry window even when several requests fail at the same time. */
async function refreshActiveSession(): Promise<boolean> {
  const current = state.session;
  if (!current?.refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const tokens = await requestRefresh(current.refreshToken);
        const next: AuthSession = {
          ...current,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken ?? current.refreshToken,
        };
        emit({ status: 'authenticated', session: next });
        if (persistSession) await saveSession(next);
        return true;
      } catch {
        markSessionExpired();
        await endSession();
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

setAuthBridge({
  getAccessToken: () => state.session?.accessToken ?? null,
  refreshSession: refreshActiveSession,
  onUnauthorized: () => {
    markSessionExpired();
    void endSession();
  },
});

/** Imperative snapshot for redirect guards and tests. */
export const getSessionState = (): SessionState => state;

export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(subscribe, getState, getState).status;
}

export function useSession(): AuthSession | null {
  return useSyncExternalStore(subscribe, getState, getState).session;
}

const subscribeExpired = (listener: () => void) => {
  expiredListeners.add(listener);
  return () => expiredListeners.delete(listener);
};

const getExpired = () => expired;

/** Imperative snapshot for the modal guard and tests. */
export const getSessionExpiredState = (): boolean => expired;

export function useSessionExpired(): boolean {
  return useSyncExternalStore(subscribeExpired, getExpired, getExpired);
}

/** Dismisses the expired-session modal after the user returns to the login screen. */
export async function acknowledgeSessionExpired(): Promise<void> {
  expired = false;
  emitExpired();
  await endSession();
}

export function useAuthUser(): AuthUser | null {
  return useSyncExternalStore(subscribe, getState, getState).session?.user ?? null;
}
