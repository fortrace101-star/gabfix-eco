import { fieldsOf, type FieldType, type FormField, type FormSchema, type ShowIf } from '@mobile/lib/form-schema';

/** Shared copy and field factories for the booking form builder. */

export const typeLabels: Record<FieldType, string> = {
  text: 'Short text',
  textarea: 'Long text',
  number: 'Number',
  counter: 'Counter',
  select: 'Choose one',
  multiselect: 'Choose many',
  boolean: 'Yes / no',
  measurement: 'Measurement',
  'media-slot': 'Photos & video',
};

export const opLabels: Record<ShowIf['op'], string> = {
  eq: 'is',
  neq: 'is not',
  in: 'is one of',
  gt: 'is above',
  lt: 'is below',
  truthy: 'is answered',
};

/** A slug that is not taken yet, in the same `name_1` shape earlier drafts used. */
export const nextId = (taken: ReadonlySet<string>, base: string): string => {
  const stem =
    base
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'item';
  let index = 1;
  while (taken.has(`${stem}_${index}`)) index += 1;
  return `${stem}_${index}`;
};

export const makeField = (schema: FormSchema, type: FieldType): FormField => {
  const field: FormField = {
    id: nextId(new Set(fieldsOf(schema).map((item) => item.id)), type.replace('-', '_')),
    type,
    label: typeLabels[type],
    required: false,
  };
  if (type === 'select' || type === 'multiselect') {
    field.options = [
      { id: 'option_1', label: 'Option 1' },
      { id: 'option_2', label: 'Option 2' },
    ];
  }
  if (type === 'number' || type === 'counter') field.unit = '';
  if (type === 'media-slot') field.maxMedia = 5;
  return field;
};

export const parseConditionValue = (op: ShowIf['op'], raw: string): ShowIf['value'] => {
  if (op === 'in') {
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  if (op === 'gt' || op === 'lt') {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : raw;
  }
  return raw;
};

export const conditionValueText = (value: ShowIf['value']): string => {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

/** True when the field is a choice list, so the condition editor can offer its options. */
export const choiceOptions = (field: FormField | undefined) =>
  field && (field.type === 'select' || field.type === 'multiselect') ? field.options ?? [] : [];
