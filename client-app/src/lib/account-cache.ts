import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Per-account cache isolation. Each signed-in account gets its own cache
 * namespace keyed by a stable identifying feature (the account's user id), so
 * logging out and signing in as a different account never inherits the previous
 * account's cached data. Device-level keys (session token, remembered login,
 * device id) stay global and are not scoped through here.
 */

export type AccountCache = {
  /** Stable identifier for the account that owns this cache. */
  accountId: string;
};

/**
 * Cache keys that belong to an account, mapped from the unscoped key earlier
 * versions wrote to. Device-level keys (`gabfix.session.v1`,
 * `gabfix.device-sessions.v1`, `gabfix.login.remembered.v1`,
 * `gabfix.device-id.v1`, `gabfix.pushPromptSnoozeUntil`) are deliberately absent:
 * they describe the handset, not the account.
 */
const LEGACY_ACCOUNT_KEYS: { legacyKey: string; baseKey: string }[] = [
  { legacyKey: 'gabfix.bookings.v1', baseKey: 'gabfix.bookings.v1' },
  { legacyKey: 'gabfix.addresses.v1', baseKey: 'gabfix.addresses.v1' },
  { legacyKey: 'gabfix.plans.v1', baseKey: 'gabfix.plans.v1' },
  { legacyKey: 'gabfix.reviews.v1', baseKey: 'gabfix.reviews.v1' },
  { legacyKey: 'gabfix.security.v1', baseKey: 'gabfix.security.v1' },
  { legacyKey: 'gabfix.tickets.v1', baseKey: 'gabfix.tickets.v1' },
  { legacyKey: 'gabfix.notifications.v1', baseKey: 'gabfix.notifications.v1' },
  { legacyKey: 'gabfix.media-uploads.v1', baseKey: 'gabfix.media-uploads.v1' },
  { legacyKey: 'gabfix.login-activity.v1', baseKey: 'gabfix.login-activity.v1' },
  { legacyKey: 'gabfix.payment-methods.v1', baseKey: 'gabfix.payment-methods.v1' },
  { legacyKey: 'gabfix.quotes.v1', baseKey: 'gabfix.quotes.v1' },
  { legacyKey: 'gabfix.messages.v1', baseKey: 'gabfix.messages.v1' },
  { legacyKey: 'gabfix.search.recent.v1', baseKey: 'gabfix.search.recent.v1' },
  // Newest first: the first version found for a base key wins.
  { legacyKey: 'gabfix.profile-settings.v2', baseKey: 'gabfix.profile-settings.v2' },
  { legacyKey: 'gabfix.profile-settings.v1', baseKey: 'gabfix.profile-settings.v2' },
  { legacyKey: 'gabfix.booking.draft.v2', baseKey: 'gabfix.booking.draft.v2' },
  { legacyKey: 'gabfix.booking.draft.v1', baseKey: 'gabfix.booking.draft.v2' },
];

type CacheReset = () => void;

let activeAccountId: string | null = null;
const resets = new Set<CacheReset>();

export function getActiveAccountId(): string | null {
  return activeAccountId;
}

/** The storage key for account-scoped data. Returns null when no account is active. */
export function accountCacheKey(baseKey: string, accountId: string | null = activeAccountId): string | null {
  const id = accountId?.trim();
  if (!id) return null;
  return `${baseKey}::${encodeURIComponent(id)}`;
}

/**
 * Registers a store reset callback. Called when the active account changes so
 * in-memory state never leaks across accounts.
 */
export function registerAccountCacheReset(reset: CacheReset): () => void {
  resets.add(reset);
  return () => {
    resets.delete(reset);
  };
}

/**
 * Switches the active account. When the identifying account changes, every
 * registered store is reset to its empty/default state so the next account
 * starts from its own cache object, not the previous account's data.
 */
export function setActiveAccountId(accountId: string | null): void {
  const next = accountId?.trim() || null;
  if (next === activeAccountId) return;
  activeAccountId = next;
  resets.forEach((reset) => reset());
}

/** Reads a per-account JSON cache object. */
export async function readAccountCache<T>(baseKey: string): Promise<T | null> {
  const key = accountCacheKey(baseKey);
  if (!key) return null;
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Writes a per-account JSON cache object; removes it when value is null. */
export async function writeAccountCache(baseKey: string, value: unknown): Promise<void> {
  const key = accountCacheKey(baseKey);
  if (!key) return;
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache writes are best-effort; the live in-memory state is authoritative.
  }
}

/**
 * One-time upgrade for data written before the cache was account-scoped. Only the
 * account that was signed in when the app last ran can own those keys, so the
 * caller passes the restored session's user id and never runs this for a fresh
 * sign-in. Existing account objects are kept; the unscoped keys are then removed
 * so they cannot be handed to another account later.
 */
export async function migrateLegacyAccountCache(accountId: string | null = activeAccountId): Promise<void> {
  const id = accountId?.trim();
  if (!id) return;
  try {
    const existing = new Set(await AsyncStorage.getAllKeys());
    const claimed = new Set(existing);
    const writes: [string, string][] = [];
    const removals: string[] = [];

    for (const { legacyKey, baseKey } of LEGACY_ACCOUNT_KEYS) {
      if (!existing.has(legacyKey)) continue;
      const target = accountCacheKey(baseKey, id);
      if (target && !claimed.has(target)) {
        const raw = await AsyncStorage.getItem(legacyKey);
        if (raw !== null) {
          writes.push([target, raw]);
          claimed.add(target);
        }
      }
      removals.push(legacyKey);
    }

    if (writes.length > 0) await AsyncStorage.multiSet(writes);
    if (removals.length > 0) await AsyncStorage.multiRemove(removals);
  } catch {
    // A failed migration must not block the app; the unscoped keys stay for a retry.
  }
}

export async function removeAccountCache(baseKey: string, accountId: string | null = activeAccountId): Promise<void> {
  const key = accountCacheKey(baseKey, accountId);
  if (!key) return;
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Best-effort.
  }
}
