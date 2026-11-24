import type { ServiceCategory } from '@/config/service-categories';
import { serviceCategories } from '@/config/service-categories';
import type { Service } from '@/config/services';
import { activeServices, serviceBySlug } from '@/config/services';
import { apiRequest } from '@/lib/api/client';
import { hasApiBaseUrl } from '@/lib/config';

/** `GET /services` response shape from the Phase 3 discovery contract. */
export type ServiceListResponse = {
  services?: Service[];
  /** Sent with the catalogue so the tab chips come from the same response. */
  categories?: ServiceCategory[];
};

/** Categories for the Services tab; the bundled set until the API sends its own. */
export const catalogueCategories = (): readonly ServiceCategory[] => serviceCategories;

/**
 * `GET /service-categories`. The bundled list is used when no API is configured or the
 * response is empty, so the tab chips never disappear.
 */
/** `GET /services/{slug}`; the bundled catalogue is the offline fallback. */
export async function getService(slug: string): Promise<Service | null> {
  if (!hasApiBaseUrl || !slug) return serviceBySlug(slug) ?? null;

  const data = await apiRequest<{ service?: Service }>(`/services/${encodeURIComponent(slug)}`);
  return data?.service ?? serviceBySlug(slug) ?? null;
}

export async function getServiceCategories(): Promise<readonly ServiceCategory[]> {
  if (!hasApiBaseUrl) return serviceCategories;

  const data = await apiRequest<{ categories?: ServiceCategory[] }>('/service-categories');
  const categories = Array.isArray(data?.categories)
    ? data.categories.filter((category) => category.active !== false)
    : [];

  return categories.length > 0 ? categories : serviceCategories;
}

const shown = (services: readonly Service[]) => services.filter((service) => service.active !== false);

/**
 * Discovery catalogue. Until `EXPO_PUBLIC_API_BASE_URL` is configured the bundled list in
 * `src/config/services.ts` is returned, so Home and Services work without a backend.
 */
export async function getServices(): Promise<readonly Service[]> {
  if (!hasApiBaseUrl) return activeServices;

  const data = await apiRequest<ServiceListResponse>('/services');

  return Array.isArray(data?.services) ? shown(data.services) : activeServices;
}

/**
 * `GET /search?q=` (Part 2, P5). Without a backend the bundled catalogue is
 * filtered on name, tagline and tag, which matches what the API is expected to index.
 */
export async function searchServices(query: string): Promise<readonly Service[]> {
  const term = query.trim();
  if (!term) return [];

  if (!hasApiBaseUrl) {
    const needle = term.toLowerCase();
    return activeServices.filter((service) =>
      `${service.name} ${service.tagline} ${service.tag ?? ''}`.toLowerCase().includes(needle),
    );
  }

  const params = new URLSearchParams({ q: term });

  const data = await apiRequest<ServiceListResponse>(`/search?${params.toString()}`);
  return Array.isArray(data?.services) ? shown(data.services) : [];
}
