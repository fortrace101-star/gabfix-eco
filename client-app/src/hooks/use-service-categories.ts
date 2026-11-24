import { useEffect, useState } from 'react';

import { serviceCategories, type ServiceCategory } from '@/config/service-categories';
import { getServiceCategories } from '@/lib/api/discovery';
import { hasApiBaseUrl } from '@/lib/config';

/**
 * Category chips for discovery. The bundled list renders immediately and is replaced by
 * `GET /service-categories` when the API is configured, so the tab never waits to paint.
 */
export function useServiceCategories(): readonly ServiceCategory[] {
  const [categories, setCategories] = useState<readonly ServiceCategory[]>(serviceCategories);

  useEffect(() => {
    if (!hasApiBaseUrl) return;

    let cancelled = false;
    getServiceCategories()
      .then((next) => {
        if (!cancelled) setCategories(next);
      })
      .catch(() => {
        // Keep the bundled categories; the services hook already surfaces the error.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return categories;
}
