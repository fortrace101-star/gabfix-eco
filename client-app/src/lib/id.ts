import { getCrypto } from '@/lib/native-module';

/** Stable unique id for media items, device identity and local records. */
export const newId = (): string => {
  const crypto = getCrypto();
  if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
