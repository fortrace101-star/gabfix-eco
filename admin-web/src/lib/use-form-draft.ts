import { useCallback, useMemo, useState } from 'react';
import {
  fieldsOf,
  validateSchema,
  type FormField,
  type FormSchema,
  type FormSection,
} from '@mobile/lib/form-schema';

import { makeField, nextId } from './form-fields';
import { cloneSection, dependentsOf } from './forms';

export const MAX_STEPS = 5;
export const MAX_FIELDS_PER_STEP = 12;

const mapFields = (
  schema: FormSchema,
  sectionId: string,
  update: (fields: FormField[]) => FormField[],
): FormSchema => ({
  ...schema,
  sections: schema.sections.map((section) =>
    section.id === sectionId ? { ...section, fields: update(section.fields) } : section,
  ),
});

/** Drops condition rules that point at a field which no longer exists. */
const withoutDependents = (schema: FormSchema, removedFieldIds: ReadonlySet<string>): FormSchema => ({
  ...schema,
  sections: schema.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) =>
      field.showIf && removedFieldIds.has(field.showIf.fieldId)
        ? { ...field, showIf: undefined }
        : field,
    ),
  })),
});

const errorsByStep = (errors: string[], schema: FormSchema): Record<string, string[]> => {
  const byStep: Record<string, string[]> = {};
  for (const section of schema.sections) byStep[section.id] = [];

  for (const error of errors) {
    const owner =
      schema.sections.find((section) => error.includes(`"${section.id}"`)) ??
      schema.sections.find((section) =>
        section.fields.some((field) => error.includes(`"${field.id}"`)),
      ) ??
      schema.sections[0];
    if (owner) byStep[owner.id] = [...byStep[owner.id], error];
  }
  return byStep;
};

/**
 * The editable working copy of a form. Every mutation returns a new schema so the phone
 * preview and the validation badges always read the same object the inspector edits.
 */
export function useFormDraft(base: FormSchema) {
  const [draft, setDraft] = useState<FormSchema>(base);

  const errors = useMemo(() => validateSchema(draft), [draft]);
  const byStep = useMemo(() => errorsByStep(errors, draft), [errors, draft]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(base), [draft, base]);
  const allFields = useMemo(() => fieldsOf(draft), [draft]);

  const reset = useCallback(() => setDraft(base), [base]);

  const patchSettings = useCallback(
    (patch: Partial<FormSchema>) => setDraft((current) => ({ ...current, ...patch })),
    [],
  );

  const patchSection = useCallback(
    (sectionId: string, patch: Partial<FormSection>) =>
      setDraft((current) => ({
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId ? { ...section, ...patch } : section,
        ),
      })),
    [],
  );

  /** Renaming a section id does not need a rule rewrite; nothing references it. */
  const patchSectionId = useCallback(
    (sectionId: string, rawId: string) => {
      const nextIdValue = rawId.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
      if (!nextIdValue) return;
      setDraft((current) => ({
        ...current,
        sections: current.sections.map((section) =>
          section.id === sectionId ? { ...section, id: nextIdValue } : section,
        ),
      }));
    },
    [],
  );

  const patchField = useCallback(
    (sectionId: string, fieldId: string, patch: Partial<FormField>) =>
      setDraft((current) =>
        mapFields(current, sectionId, (fields) =>
          fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
        ),
      ),
    [],
  );

  /** Renaming a field id rewrites every rule that depended on it. */
  const patchFieldId = useCallback((_sectionId: string, fieldId: string, rawId: string) => {
    const nextIdValue = rawId.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
    if (!nextIdValue) return;
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) => {
          if (field.id === fieldId) return { ...field, id: nextIdValue };
          if (field.showIf?.fieldId === fieldId) {
            return { ...field, showIf: { ...field.showIf, fieldId: nextIdValue } };
          }
          return field;
        }),
      })),
    }));
  }, []);

  const addField = useCallback((sectionId: string, type: FormField['type']): FormField | null => {
    const section = draft.sections.find((item) => item.id === sectionId);
    if (!section || section.fields.length >= MAX_FIELDS_PER_STEP) return null;
    const field = makeField(draft, type);
    setDraft((current) =>
      mapFields(current, sectionId, (fields) => [...fields, field]),
    );
    return field;
  }, [draft]);

  const duplicateField = useCallback((sectionId: string, fieldId: string) => {
    setDraft((current) => {
      const section = current.sections.find((item) => item.id === sectionId);
      const field = section?.fields.find((item) => item.id === fieldId);
      if (!section || !field) return current;
      const taken = new Set(fieldsOf(current).map((item) => item.id));
      const copy: FormField = {
        ...field,
        id: nextId(taken, field.type.replace('-', '_')),
        label: `${field.label} copy`,
        showIf: field.showIf ? { ...field.showIf } : undefined,
        options: field.options?.map((option) => ({ ...option })),
      };
      const index = section.fields.findIndex((item) => item.id === fieldId);
      return mapFields(current, sectionId, (fields) => [
        ...fields.slice(0, index + 1),
        copy,
        ...fields.slice(index + 1),
      ]);
    });
  }, []);

  const deleteField = useCallback((sectionId: string, fieldId: string) => {
    setDraft((current) => {
      const section = current.sections.find((item) => item.id === sectionId);
      if (!section || section.fields.length <= 1) return current;
      return withoutDependents(
        mapFields(current, sectionId, (fields) =>
          fields.filter((field) => field.id !== fieldId),
        ),
        new Set([fieldId]),
      );
    });
  }, []);

  const moveField = useCallback((sectionId: string, fieldId: string, direction: -1 | 1) => {
    setDraft((current) =>
      mapFields(current, sectionId, (fields) => {
        const index = fields.findIndex((field) => field.id === fieldId);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= fields.length) return fields;
        const next = [...fields];
        [next[index], next[target]] = [next[target]!, next[index]!];
        return next;
      }),
    );
  }, []);

  /** Moves one field to another step, keeping its id and dependencies. */
  const moveFieldToSection = useCallback(
    (fromSectionId: string, fieldId: string, toSectionId: string) => {
      if (fromSectionId === toSectionId) return;
      setDraft((current) => {
        const source = current.sections.find((item) => item.id === fromSectionId);
        const target = current.sections.find((item) => item.id === toSectionId);
        const field = source?.fields.find((item) => item.id === fieldId);
        if (!source || !target || !field) return current;
        if (source.fields.length <= 1 || target.fields.length >= MAX_FIELDS_PER_STEP) return current;

        return {
          ...current,
          sections: current.sections.map((section) => {
            if (section.id === fromSectionId) {
              return { ...section, fields: section.fields.filter((item) => item.id !== fieldId) };
            }
            if (section.id === toSectionId) {
              return { ...section, fields: [...section.fields, field] };
            }
            return section;
          }),
        };
      });
    },
    [],
  );

  /** Adds a step and returns its id so the rail and inspector can jump to it. */
  const addSection = useCallback(
    (template?: FormSection): string | null => {
      if (draft.sections.length >= MAX_STEPS) return null;
      const taken = new Set(draft.sections.map((section) => section.id));
      const section: FormSection = template
        ? cloneSection(template, taken, template.title)
        : {
            id: nextId(taken, 'step'),
            title: `Step ${draft.sections.length + 1}`,
            fields: [
              {
                id: nextId(new Set(fieldsOf(draft).map((field) => field.id)), 'text'),
                type: 'text',
                label: 'New question',
                required: false,
              },
            ],
          };
      setDraft((current) => ({ ...current, sections: [...current.sections, section] }));
      return section.id;
    },
    [draft],
  );

  const duplicateSection = useCallback(
    (sectionId: string): string | null => {
      const section = draft.sections.find((item) => item.id === sectionId);
      if (!section || draft.sections.length >= MAX_STEPS) return null;
      const copy = cloneSection(
        section,
        new Set(draft.sections.map((item) => item.id)),
      );
      setDraft((current) => ({ ...current, sections: [...current.sections, copy] }));
      return copy.id;
    },
    [draft],
  );

  const deleteSection = useCallback((sectionId: string) => {
    setDraft((current) => {
      if (current.sections.length <= 1) return current;
      const removed = current.sections.find((section) => section.id === sectionId);
      if (!removed) return current;
      const next = {
        ...current,
        sections: current.sections.filter((section) => section.id !== sectionId),
      };
      return withoutDependents(next, new Set(removed.fields.map((field) => field.id)));
    });
  }, []);

  const moveSection = useCallback((sectionId: string, direction: -1 | 1) => {
    setDraft((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.sections.length) return current;
      const next = [...current.sections];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return { ...current, sections: next };
    });
  }, []);

  const dependentsCount = useCallback(
    (sectionId: string): number => {
      const section = draft.sections.find((item) => item.id === sectionId);
      if (!section) return 0;
      return section.fields.reduce(
        (sum, field) => sum + dependentsOf(draft, field.id).length,
        0,
      );
    },
    [draft],
  );

  return {
    draft,
    dirty,
    errors,
    errorsByStep: byStep,
    allFields,
    replace: setDraft,
    reset,
    patchSettings,
    patchSection,
    patchSectionId,
    patchField,
    patchFieldId,
    addField,
    duplicateField,
    deleteField,
    moveField,
    moveFieldToSection,
    addSection,
    duplicateSection,
    deleteSection,
    moveSection,
    dependentsCount,
  };
}

export type FormDraftController = ReturnType<typeof useFormDraft>;
