import { supabase } from './supabase';

/**
 * Catalogue data for Workstream D: categories, services and the skills used to
 * route jobs. Deactivation is the delete: bookings and form definitions keep
 * pointing at the rows, so nothing is hard-deleted from this screen.
 */

export type PricingType = 'fixed' | 'hourly' | 'quote';

export type CatalogueCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imagePath: string | null;
  parentId: string | null;
  displayOrder: number;
  active: boolean;
};

export type CatalogueService = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  imagePath: string | null;
  pricingType: PricingType;
  price: number;
  durationMinutes: number;
  requiredSkillId: string | null;
  popularRank: number | null;
  tag: string | null;
  active: boolean;
};

export type Skill = { id: string; name: string };

export type Catalogue = {
  categories: CatalogueCategory[];
  services: CatalogueService[];
  skills: Skill[];
};

export type CategoryInput = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  imagePath: string | null;
  parentId: string | null;
  displayOrder: number;
  active: boolean;
};

export type ServiceInput = {
  id?: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  imagePath: string | null;
  pricingType: PricingType;
  price: number;
  durationMinutes: number;
  requiredSkillId: string | null;
  popularRank: number | null;
  tag: string | null;
  active: boolean;
};

const IMAGE_BUCKET = 'service-icons';

const numberOrZero = (value: number | string | null): number =>
  typeof value === 'string' ? Number(value) : (value ?? 0);

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const mapCategory = (row: {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_path: string | null;
  parent_id: string | null;
  display_order: number;
  active: boolean;
}): CatalogueCategory => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  description: row.description ?? '',
  imagePath: row.image_path,
  parentId: row.parent_id,
  displayOrder: row.display_order,
  active: row.active,
});

const mapService = (row: {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category_id: string;
  image_path: string | null;
  pricing_type: PricingType;
  price: number | string;
  duration_minutes: number;
  required_skill_id: string | null;
  popular_rank: number | null;
  tag: string | null;
  active: boolean;
}): CatalogueService => ({
  id: row.id,
  slug: row.slug ?? row.id,
  name: row.name,
  description: row.description ?? '',
  categoryId: row.category_id,
  imagePath: row.image_path,
  pricingType: row.pricing_type,
  price: numberOrZero(row.price),
  durationMinutes: row.duration_minutes,
  requiredSkillId: row.required_skill_id,
  popularRank: row.popular_rank,
  tag: row.tag,
  active: row.active,
});

const fail = (message: string): never => {
  throw new Error(message);
};

/** Turns a Postgres unique violation into the field it collided on. */
const describeError = (error: { code?: string; message: string }, subject: string): string => {
  if (error.code === '23505') {
    return error.message.includes('slug')
      ? `That ${subject} slug is already in use. Pick another one.`
      : `That ${subject} already exists.`;
  }
  return error.message;
};

export async function loadCatalogue(): Promise<Catalogue> {
  const [categoriesRes, servicesRes, skillsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, slug, name, description, image_path, parent_id, display_order, active')
      .order('display_order')
      .order('name'),
    supabase
      .from('services')
      .select(
        'id, slug, name, description, category_id, image_path, pricing_type, price, duration_minutes, required_skill_id, popular_rank, tag, active',
      )
      .order('name'),
    supabase.from('skills').select('id, name').order('name'),
  ]);

  const failure = categoriesRes.error ?? servicesRes.error ?? skillsRes.error;
  if (failure) throw new Error(failure.message);

  return {
    categories: (categoriesRes.data ?? []).map(mapCategory),
    services: (servicesRes.data ?? []).map(mapService),
    skills: (skillsRes.data ?? []).map((row) => ({ id: row.id, name: row.name })),
  };
}

const categoryColumns =
  'id, slug, name, description, image_path, parent_id, display_order, active';
const serviceColumns =
  'id, slug, name, description, category_id, image_path, pricing_type, price, duration_minutes, required_skill_id, popular_rank, tag, active';

export async function saveCategory(input: CategoryInput): Promise<CatalogueCategory> {
  const payload = {
    slug: input.slug,
    name: input.name.trim(),
    description: input.description.trim() || null,
    image_path: input.imagePath,
    parent_id: input.parentId,
    display_order: input.displayOrder,
    active: input.active,
  };

  const query = input.id
    ? supabase.from('categories').update(payload).eq('id', input.id)
    : supabase.from('categories').insert(payload);

  const { data, error } = await query.select(categoryColumns).single();
  if (error) return fail(describeError(error, 'category'));
  if (!data) return fail('The category could not be saved.');
  return mapCategory(data);
}

export async function saveService(input: ServiceInput): Promise<CatalogueService> {
  const payload = {
    category_id: input.categoryId,
    name: input.name.trim(),
    slug: input.slug,
    description: input.description.trim() || null,
    image_path: input.imagePath,
    pricing_type: input.pricingType,
    price: input.pricingType === 'quote' ? 0 : input.price,
    duration_minutes: input.durationMinutes,
    required_skill_id: input.requiredSkillId,
    popular_rank: input.popularRank,
    tag: input.tag?.trim() || null,
    active: input.active,
  };

  const query = input.id
    ? supabase.from('services').update(payload).eq('id', input.id)
    : supabase.from('services').insert(payload);

  const { data, error } = await query.select(serviceColumns).single();
  if (error) return fail(describeError(error, 'service'));
  if (!data) return fail('The service could not be saved.');
  return mapService(data);
}

/** Persists a new sibling order for categories (lower `display_order` first). */
export async function saveCategoryOrder(
  rows: readonly { id: string; displayOrder: number }[],
): Promise<void> {
  const results = await Promise.all(
    rows.map((row) =>
      supabase.from('categories').update({ display_order: row.displayOrder }).eq('id', row.id),
    ),
  );
  const failure = results.find((result) => result.error)?.error;
  if (failure) fail(failure.message);
}

export async function setCategoryActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('categories').update({ active }).eq('id', id);
  if (error) fail(error.message);
}

export async function setServiceActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('services').update({ active }).eq('id', id);
  if (error) fail(error.message);
}

/** Uploads to the public `service-icons` bucket and returns the stored object path. */
export async function uploadCatalogueImage(
  file: File,
  kind: 'category' | 'service',
  slug: string,
): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${kind}/${slug || 'image'}-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) fail(`Image upload failed: ${error.message}`);
  return path;
}

/** `image_path` holds a bucket object path; older rows may hold a full URL. */
export const catalogueImageUrl = (path: string | null): string | null => {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
};
