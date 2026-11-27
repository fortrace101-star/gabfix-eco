import {
  normalizeServiceContent,
  serviceContentBySlug,
  type ServiceContent,
} from '@/config/service-content';
import { apiRequest } from '@/lib/api/client';
import { hasApiBaseUrl } from '@/lib/config';

/** `GET /services/{slug}` payload; only `content` is consumed by P7 so far. */
type ServiceContentResponse = { content?: Partial<ServiceContent> };

/**
 * Service landing copy. Until `EXPO_PUBLIC_API_BASE_URL` is configured the bundled
 * content is returned; a configured backend may override any field it sends.
 */
export async function getServiceContent(slug: string): Promise<ServiceContent | null> {
  const local = serviceContentBySlug(slug) ?? null;
  if (!hasApiBaseUrl) return local;

  const data = await apiRequest<ServiceContentResponse>(`/services/${encodeURIComponent(slug)}`);

  // The payload may be partial (missing `includes`, `excludes`, `faqs`), so it is merged
  // into the bundled copy — or the generic copy — rather than cast to ServiceContent.
  if (!data?.content) return local;
  return normalizeServiceContent(slug, data.content, local);
}
