import { useEffect, useState } from 'react';

import { serviceBySlug, type Service } from '@/config/services';
import { getService } from '@/lib/api/discovery';
import { hasApiBaseUrl } from '@/lib/config';

type Result = {
  /** Request this result belongs to, so a stale response can never replace a newer one. */
  slug: string;
  service: Service | null;
};

/**
 * One catalogue service. The bundled row renders immediately; `GET /services/{slug}`
 * replaces it when the API is configured, so an admin price change reaches the booking flow.
 */
export function useService(slug: string): Service | undefined {
  const local = serviceBySlug(slug);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!hasApiBaseUrl || !slug) return;

    let cancelled = false;
    getService(slug)
      .then((service) => {
        if (!cancelled) setResult({ slug, service });
      })
      .catch(() => {
        // Keep the bundled row; discovery already surfaces catalogue errors.
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const current = result?.slug === slug ? result.service : local;
  return current ?? undefined;
}
