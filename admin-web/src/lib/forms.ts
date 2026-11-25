import type { FormSchema } from '@mobile/lib/form-schema';
import { supabase } from './supabase';

/**
 * Booking form definitions (Workstream D).
 *
 * A category owns the default form; a service may own an override. Every save writes a
 * new version row and flips `is_current`, so existing bookings keep pointing at the
 * definition they were answered against via `booking_form_snapshots`.
 */

export type FormOwnerKind = 'category' | 'service';

export type FormOwner = {
  kind: FormOwnerKind;
  id: string;
  name: string;
  slug: string;
  active: boolean;
  categoryId?: string;
  categoryName?: string;
};

export type FormDefinitionRow = {
  id: string;
  serviceId: string | null;
  categoryId: string | null;
  version: number;
  schema: FormSchema;
  isCurrent: boolean;
  createdAt: string;
  createdBy: string | null;
};

export type FormCatalogue = {
  categories: FormOwner[];
  services: FormOwner[];
  definitions: FormDefinitionRow[];
};

const mapDefinition = (row: {
  id: string;
  service_id: string | null;
  category_id: string | null;
  version: number;
  schema: unknown;
  is_current: boolean;
  created_at: string;
  created_by: string | null;
}): FormDefinitionRow => ({
  id: row.id,
  serviceId: row.service_id,
  categoryId: row.category_id,
  version: row.version,
  schema: row.schema as FormSchema,
  isCurrent: row.is_current,
  createdAt: row.created_at,
  createdBy: row.created_by,
});

export async function loadFormCatalogue(): Promise<FormCatalogue> {
  const [categoriesRes, servicesRes, definitionsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, slug, name, parent_id, display_order, active')
      .order('display_order'),
    supabase.from('services').select('id, slug, name, category_id, active').order('name'),
    supabase
      .from('service_form_definitions')
      .select('id, service_id, category_id, version, schema, is_current, created_at, created_by')
      .order('version', { ascending: false }),
  ]);

  const failure = categoriesRes.error ?? servicesRes.error ?? definitionsRes.error;
  if (failure) throw new Error(failure.message);

  const categoryRows = categoriesRes.data ?? [];
  const categoryById = new Map(categoryRows.map((row) => [row.id, row]));

  const categories: FormOwner[] = categoryRows.map((row) => ({
    kind: 'category',
    id: row.id,
    name: row.name,
    slug: row.slug,
    active: row.active,
  }));

  const services: FormOwner[] = (servicesRes.data ?? []).map((row) => ({
    kind: 'service',
    id: row.id,
    name: row.name,
    slug: row.slug ?? row.id,
    active: row.active,
    categoryId: row.category_id,
    categoryName: categoryById.get(row.category_id)?.name ?? 'Uncategorised',
  }));

  return {
    categories,
    services,
    definitions: (definitionsRes.data ?? []).map(mapDefinition),
  };
}

/** The current definition owned by a category or service, if any. */
export const currentDefinition = (
  definitions: readonly FormDefinitionRow[],
  owner: Pick<FormOwner, 'kind' | 'id'>,
): FormDefinitionRow | null =>
  definitions.find(
    (row) =>
      row.isCurrent &&
      (owner.kind === 'category' ? row.categoryId === owner.id : row.serviceId === owner.id),
  ) ?? null;

/** What the client would receive for a service: its own form, else its category's. */
export const effectiveDefinition = (
  definitions: readonly FormDefinitionRow[],
  service: FormOwner,
): FormDefinitionRow | null =>
  currentDefinition(definitions, { kind: 'service', id: service.id }) ??
  (service.categoryId
    ? currentDefinition(definitions, { kind: 'category', id: service.categoryId })
    : null);

/** Newest first, current row included. */
export const versionsFor = (
  definitions: readonly FormDefinitionRow[],
  owner: Pick<FormOwner, 'kind' | 'id'>,
): FormDefinitionRow[] =>
  definitions
    .filter((row) =>
      owner.kind === 'category' ? row.categoryId === owner.id : row.serviceId === owner.id,
    )
    .sort((a, b) => b.version - a.version);

export const blankSchema = (owner: FormOwner): FormSchema => ({
  id: owner.slug,
  version: 1,
  heading: 'Tell us about the job',
  sections: [{ id: 'details', title: 'Job details', fields: [] }],
  mediaRequired: false,
  mediaHint: 'Photos help us quote accurately.',
});

/**
 * Saves a schema as a new version: the old current row is retired first so the unique
 * current-definition index holds, then the new row becomes current.
 */
export async function publishForm(
  owner: Pick<FormOwner, 'kind' | 'id'>,
  schema: FormSchema,
  createdBy: string | null,
): Promise<FormDefinitionRow> {
  const { data: current, error: readError } = await supabase
    .from('service_form_definitions')
    .select('id, version')
    .eq(owner.kind === 'category' ? 'category_id' : 'service_id', owner.id)
    .eq('is_current', true)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const nextVersion = (current?.version ?? 0) + 1;

  if (current) {
    const { error: retireError } = await supabase
      .from('service_form_definitions')
      .update({ is_current: false })
      .eq('id', current.id);
    if (retireError) throw new Error(retireError.message);
  }

  const { data, error } = await supabase
    .from('service_form_definitions')
    .insert({
      service_id: owner.kind === 'service' ? owner.id : null,
      category_id: owner.kind === 'category' ? owner.id : null,
      version: nextVersion,
      schema: { ...schema, version: nextVersion },
      is_current: true,
      created_by: createdBy,
    })
    .select('id, service_id, category_id, version, schema, is_current, created_at, created_by')
    .single();

  if (error || !data) {
    // Put the previous version back if the insert failed after retiring it.
    if (current) {
      await supabase
        .from('service_form_definitions')
        .update({ is_current: true })
        .eq('id', current.id);
    }
    throw new Error(error?.message ?? 'The new form version could not be saved.');
  }

  return mapDefinition(data);
}
