import { fieldsOf, type FormField, type FormSchema, type FormSection } from '@mobile/lib/form-schema';
import { nextId } from './form-fields';
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

/** Fields in the schema whose `showIf` points at this field id. */
export const dependentsOf = (schema: FormSchema, fieldId: string): FormField[] =>
  fieldsOf(schema).filter((field) => field.showIf?.fieldId === fieldId);

/**
 * Copies a step with fresh section and field ids. Condition rules that pointed inside
 * the copied step follow the copy; rules against earlier fields keep pointing at them.
 */
export function cloneSection(
  section: FormSection,
  taken: ReadonlySet<string>,
  title?: string,
): FormSection {
  const used = new Set(taken);
  const idMap = new Map<string, string>();
  const sectionId = nextId(used, section.id);
  used.add(sectionId);

  const copied: FormField[] = section.fields.map((field) => {
    const fieldId = nextId(used, field.type.replace('-', '_'));
    used.add(fieldId);
    idMap.set(field.id, fieldId);
    // Option ids only need to be unique inside their field, which is new.
    return { ...field, id: fieldId, options: field.options?.map((option) => ({ ...option })) };
  });

  return {
    ...section,
    id: sectionId,
    title: title ?? `${section.title || 'Step'} copy`,
    fields: copied.map((field) => ({
      ...field,
      showIf: field.showIf
        ? { ...field.showIf, fieldId: idMap.get(field.showIf.fieldId) ?? field.showIf.fieldId }
        : undefined,
    })),
  };
}

/** Starter steps offered when adding a step, so a new step is valid immediately. */
export const STEP_TEMPLATES: {
  id: string;
  label: string;
  build: (taken: ReadonlySet<string>) => FormSection;
}[] = [
  {
    id: 'blank',
    label: 'Blank step',
    build: (taken) => ({
      id: nextId(taken, 'step'),
      title: 'New step',
      fields: [
        { id: nextId(taken, 'text'), type: 'text', label: 'New question', required: false },
      ],
    }),
  },
  {
    id: 'size',
    label: 'Size & rooms',
    build: (taken) => {
      const used = new Set(taken);
      const field = (id: string) => {
        const next = nextId(used, id);
        used.add(next);
        return next;
      };
      return {
        id: nextId(used, 'size'),
        title: 'Size & rooms',
        fields: [
          { id: field('bedrooms'), type: 'counter', label: 'Bedrooms', required: true, min: 0, max: 10, minutesPerUnit: 20 },
          { id: field('bathrooms'), type: 'counter', label: 'Bathrooms', required: true, min: 0, max: 10, minutesPerUnit: 25 },
          {
            id: field('home_size'),
            type: 'select',
            label: 'Home size',
            required: true,
            options: [
              { id: 'small', label: 'Small', minutes: 30 },
              { id: 'medium', label: 'Medium', minutes: 60 },
              { id: 'large', label: 'Large', minutes: 120 },
            ],
          },
        ],
      };
    },
  },
  {
    id: 'condition',
    label: 'Condition',
    build: (taken) => {
      const used = new Set(taken);
      return {
        id: nextId(used, 'condition'),
        title: 'Condition',
        fields: [
          {
            id: nextId(used, 'condition'),
            type: 'select',
            label: 'How is the place?',
            required: true,
            options: [
              { id: 'light', label: 'Light tidy', minutes: 0 },
              { id: 'standard', label: 'Standard', minutes: 30 },
              { id: 'heavy', label: 'Needs a deep clean', minutes: 120, flagsQuote: true },
            ],
          },
        ],
      };
    },
  },
  {
    id: 'access',
    label: 'Access & notes',
    build: (taken) => {
      const used = new Set(taken);
      const notes = nextId(used, 'access_notes');
      used.add(notes);
      return {
        id: nextId(used, 'access'),
        title: 'Access & notes',
        fields: [
          { id: notes, type: 'textarea', label: 'Access notes', helper: 'Gate codes, parking, pets', required: false },
          {
            id: nextId(used, 'parking'),
            type: 'boolean',
            label: 'Parking available?',
            required: false,
            showIf: { fieldId: notes, op: 'truthy' },
          },
        ],
      };
    },
  },
  {
    id: 'photos',
    label: 'Photos',
    build: (taken) => ({
      id: nextId(taken, 'photos'),
      title: 'Photos',
      fields: [
        { id: nextId(taken, 'media'), type: 'media-slot', label: 'Photos', required: false, maxMedia: 5 },
      ],
    }),
  },
];

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
