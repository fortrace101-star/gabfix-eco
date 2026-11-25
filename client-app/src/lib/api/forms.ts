import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiRequest } from '@/lib/api/client';
import { hasApiBaseUrl } from '@/lib/config';
import type { FormSchema } from '@/lib/form-schema';

/**
 * Server-side job-detail definitions (P1). A service uses its own current
 * definition, otherwise its category's. The definition is cached per service so
 * the scope step opens instantly and still works offline; the cached id/version
 * is sent back with the booking, and the API answers 409 `form_version_stale`
 * if the definition changed in between.
 */
export type ServerFormDefinition = {
  id: string;
  version: number;
  serviceId: string | null;
  categoryId: string | null;
  schema: FormSchema;
};

type CacheEntry = { fetchedAtISO: string; definition: ServerFormDefinition };

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cacheKey = (slug: string) => `gabfix.form-definition.${slug}`;

async function readCache(slug: string): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    return parsed?.definition?.schema ? parsed : null;
  } catch {
    return null;
  }
}

const isFresh = (entry: CacheEntry) =>
  Date.parse(entry.fetchedAtISO) > Date.now() - CACHE_TTL_MS;

/** Cached first, then `GET /services/:slug/form`; a stale cache survives a failed refresh. */
export async function loadFormDefinition(slug: string): Promise<ServerFormDefinition | null> {
  if (!hasApiBaseUrl || !slug) return null;

  const cached = await readCache(slug);
  if (cached && isFresh(cached)) return cached.definition;

  try {
    const data = await apiRequest<{ definition: ServerFormDefinition | null }>(
      `/services/${encodeURIComponent(slug)}/form`,
    );
    if (!data?.definition?.schema) return cached?.definition ?? null;
    await AsyncStorage.setItem(
      cacheKey(slug),
      JSON.stringify({ fetchedAtISO: new Date().toISOString(), definition: data.definition }),
    ).catch(() => undefined);
    return data.definition;
  } catch {
    return cached?.definition ?? null;
  }
}
