import AsyncStorage from '@react-native-async-storage/async-storage';
import { dehydrate, hydrate, type QueryClient, type QueryCacheNotifyEvent } from '@tanstack/react-query';

const CACHE_KEY = 'gabfix.portal.query-cache';

/**
 * Keeps the last successful query data on the device. Without this a cold start while offline
 * shows the empty/error state even though the technician had today's jobs a minute ago.
 */
export async function restoreQueryCache(client: QueryClient): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    hydrate(client, JSON.parse(raw));
  } catch {
    // A corrupt or outdated cache is not worth a crash; the network will refill it.
  }
}

/** Subscribes to cache changes and writes a debounced snapshot. Returns the unsubscribe. */
export function persistQueryCache(client: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = client.getQueryCache().subscribe((event: QueryCacheNotifyEvent) => {
    if (event.type !== 'updated' && event.type !== 'added' && event.type !== 'removed') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(dehydrate(client))).catch(() => {
        // Storage pressure or web quota: persistence is best-effort.
      });
    }, 1_000);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
