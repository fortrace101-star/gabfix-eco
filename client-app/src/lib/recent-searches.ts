import { readAccountCache, removeAccountCache, writeAccountCache } from '@/lib/account-cache';

const STORAGE_KEY = 'gabfix.search.recent.v1';
const limit = 8;

const clean = (items: unknown): string[] =>
  Array.isArray(items)
    ? items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

/** Last eight searches for the active account, newest first (Part 2, P5). */
export async function loadRecentSearches(): Promise<string[]> {
  try {
    return clean(await readAccountCache<unknown>(STORAGE_KEY)).slice(0, limit);
  } catch {
    return [];
  }
}

export async function addRecentSearch(term: string): Promise<string[]> {
  const value = term.trim();
  const existing = await loadRecentSearches();
  if (!value) return existing;

  const next = [value, ...existing.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(
    0,
    limit,
  );

  await writeAccountCache(STORAGE_KEY, next);

  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await removeAccountCache(STORAGE_KEY);
}
