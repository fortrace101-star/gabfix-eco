import { useMemo, useState } from 'react';
import {
  FIELD_TYPES,
  fieldsOf,
  validateSchema,
  type FieldOption,
  type FieldType,
  type FormField,
  type FormSchema,
  type ShowIf,
} from '@mobile/lib/form-schema';
import { Icon } from './Icon';
import { Button, Field, SectionCard, Toggle } from './ui';

const typeLabels: Record<FieldType, string> = {
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

const opLabels: Record<ShowIf['op'], string> = {
  eq: 'is',
  neq: 'is not',
  in: 'is one of',
  gt: 'is above',
  lt: 'is below',
  truthy: 'is answered',
};

const newId = (taken: ReadonlySet<string>, base: string): string => {
  let index = 1;
  while (taken.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
};

const makeField = (schema: FormSchema, type: FieldType): FormField => {
  const field: FormField = {
    id: newId(new Set(fieldsOf(schema).map((item) => item.id)), type.replace('-', '_')),
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

const parseConditionValue = (op: ShowIf['op'], raw: string): ShowIf['value'] => {
  if (op === 'in') return raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (op === 'gt' || op === 'lt') {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : raw;
  }
  return raw;
};

const conditionValueText = (value: ShowIf['value']): string => {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

export function FormBuilder({
  title,
  subtitle,
  schema,
  source,
  busy,
  onSave,
  onDiscard,
}: {
  title: string;
  subtitle: string;
  schema: FormSchema;
  source: 'own' | 'inherited' | 'new';
  busy: boolean;
  onSave: (next: FormSchema) => void;
  onDiscard: () => void;
}) {
  const [draft, setDraft] = useState<FormSchema>(schema);
  const [openField, setOpenField] = useState<string | null>(null);

  const errors = useMemo(() => validateSchema(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(schema);
  const allFields = useMemo(() => fieldsOf(draft), [draft]);

  const editField = (sectionId: string, fieldId: string, patch: Partial<FormField>) =>
    setDraft((current) =>
      mapFields(current, sectionId, (fields) =>
        fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
      ),
    );

  const moveSection = (index: number, direction: -1 | 1) =>
    setDraft((current) => {
      const next = [...current.sections];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return { ...current, sections: next };
    });

  return (
    <div className="builder">
      <header className="builder-head">
        <div>
          <p className="eyebrow">
            {source === 'own'
              ? 'Service override'
              : source === 'inherited'
                ? 'Inherited from category'
                : 'New form'}
          </p>
          <h2>{title}</h2>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="page-actions">
          <Button icon="refresh" disabled={!dirty || busy} onClick={onDiscard}>
            Discard
          </Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!dirty || errors.length > 0 || busy}
            onClick={() => onSave(draft)}
          >
            {busy ? 'Saving…' : 'Publish new version'}
          </Button>
        </div>
      </header>

      {source === 'inherited' ? (
        <p className="field-note">
          <Icon name="alert" size={14} />
          This service uses its category&apos;s form. Publishing here creates a service-level
          override; the category form stays unchanged for other services.
        </p>
      ) : null}

      {errors.length > 0 ? (
        <div className="form-error" role="alert">
          <Icon name="alert" size={14} />
          <span>{errors[0]}</span>
        </div>
      ) : null}

      <SectionCard title="Form basics" meta="Shown above the sections in the mobile app">
        <div className="form-grid">
          <Field label="Heading" hint="The title of the job-details step">
            <input
              className="text-input"
              value={draft.heading}
              maxLength={80}
              onChange={(event) => setDraft({ ...draft, heading: event.target.value })}
            />
          </Field>
          <Field label="Media hint" hint="Copy shown beside the photo uploader">
            <input
              className="text-input"
              value={draft.mediaHint}
              maxLength={140}
              onChange={(event) => setDraft({ ...draft, mediaHint: event.target.value })}
            />
          </Field>
          <Field label="Photo requirement" hint="Require at least one photo when booking">
            <span className="inline-field builder-toggle">
              <span>{draft.mediaRequired ? 'Photos required' : 'Photos optional'}</span>
              <Toggle
                checked={draft.mediaRequired}
                onChange={(next) => setDraft({ ...draft, mediaRequired: next })}
                label="Require photos"
              />
            </span>
          </Field>
        </div>
      </SectionCard>

      {draft.sections.map((section, sectionIndex) => (
        <SectionCard
          key={section.id}
          title={section.title || 'Untitled section'}
          meta={`${section.fields.length} field${section.fields.length === 1 ? '' : 's'}`}
          action={
            <div className="section-tools">
              <button
                type="button"
                className="icon-btn"
                aria-label="Move section up"
                disabled={sectionIndex === 0}
                onClick={() => moveSection(sectionIndex, -1)}
              >
                <Icon name="arrowUp" size={15} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Move section down"
                disabled={sectionIndex === draft.sections.length - 1}
                onClick={() => moveSection(sectionIndex, 1)}
              >
                <Icon name="arrowDown" size={15} />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Remove section"
                disabled={draft.sections.length === 1}
                onClick={() =>
                  setDraft({
                    ...draft,
                    sections: draft.sections.filter((item) => item.id !== section.id),
                  })
                }
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          }
        >
          <div className="form-grid builder-section-head">
            <Field label="Section title">
              <input
                className="text-input"
                value={section.title}
                maxLength={60}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    sections: draft.sections.map((item) =>
                      item.id === section.id ? { ...item, title: event.target.value } : item,
                    ),
                  })
                }
              />
            </Field>
            <Field label="Section id" hint="Stable key; never reused">
              <input
                className="text-input"
                value={section.id}
                onChange={(event) => {
                  const nextId = event.target.value.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
                  setDraft({
                    ...draft,
                    sections: draft.sections.map((item) =>
                      item.id === section.id ? { ...item, id: nextId || item.id } : item,
                    ),
                  });
                }}
              />
            </Field>
          </div>

          <div className="builder-fields">
            {section.fields.map((field, fieldIndex) => {
              const open = openField === field.id;
              return (
                <article className={open ? 'field-card field-card-open' : 'field-card'} key={field.id}>
                  <div className="field-card-head">
                    <button
                      type="button"
                      className="field-card-title"
                      aria-expanded={open}
                      onClick={() => setOpenField(open ? null : field.id)}
                    >
                      <strong>{field.label || 'Untitled field'}</strong>
                      <span>
                        {typeLabels[field.type]}
                        {field.required ? ' · required' : ''}
                        {field.showIf ? ' · conditional' : ''}
                      </span>
                    </button>
                    <div className="section-tools">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Move field up"
                        disabled={fieldIndex === 0}
                        onClick={() =>
                          setDraft((current) =>
                            mapFields(current, section.id, (fields) => {
                              const next = [...fields];
                              [next[fieldIndex - 1], next[fieldIndex]] = [
                                next[fieldIndex]!,
                                next[fieldIndex - 1]!,
                              ];
                              return next;
                            }),
                          )
                        }
                      >
                        <Icon name="arrowUp" size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Move field down"
                        disabled={fieldIndex === section.fields.length - 1}
                        onClick={() =>
                          setDraft((current) =>
                            mapFields(current, section.id, (fields) => {
                              const next = [...fields];
                              [next[fieldIndex + 1], next[fieldIndex]] = [
                                next[fieldIndex]!,
                                next[fieldIndex + 1]!,
                              ];
                              return next;
                            }),
                          )
                        }
                      >
                        <Icon name="arrowDown" size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Remove field"
                        onClick={() =>
                          setDraft((current) =>
                            mapFields(current, section.id, (fields) =>
                              fields.filter((item) => item.id !== field.id),
                            ),
                          )
                        }
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  </div>

                  {open ? (
                    <div className="field-card-body">
                      <div className="form-grid">
                        <Field label="Question">
                          <input
                            className="text-input"
                            value={field.label}
                            maxLength={60}
                            onChange={(event) =>
                              editField(section.id, field.id, { label: event.target.value })
                            }
                          />
                        </Field>
                        <Field label="Field type" hint="Changing this keeps the field id">
                          <select
                            className="text-input"
                            value={field.type}
                            onChange={(event) => {
                              const type = event.target.value as FieldType;
                              const patch: Partial<FormField> = { type };
                              if ((type === 'select' || type === 'multiselect') && !field.options) {
                                patch.options = [
                                  { id: 'option_1', label: 'Option 1' },
                                  { id: 'option_2', label: 'Option 2' },
                                ];
                              }
                              editField(section.id, field.id, patch);
                            }}
                          >
                            {FIELD_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {typeLabels[type]}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Helper text" hint="Optional second line under the question">
                          <input
                            className="text-input"
                            value={field.helper ?? ''}
                            maxLength={140}
                            onChange={(event) =>
                              editField(section.id, field.id, { helper: event.target.value })
                            }
                          />
                        </Field>
                        <Field label="Field id" hint="Stable key used in saved answers">
                          <input
                            className="text-input"
                            value={field.id}
                            onChange={(event) => {
                              const nextIdValue = event.target.value
                                .replace(/[^a-z0-9_-]/gi, '_')
                                .toLowerCase();
                              if (!nextIdValue) return;
                              setDraft((current) => ({
                                ...current,
                                sections: current.sections.map((item) => ({
                                  ...item,
                                  fields: item.fields.map((candidate) => {
                                    if (candidate.id === field.id) {
                                      return { ...candidate, id: nextIdValue };
                                    }
                                    if (candidate.showIf?.fieldId === field.id) {
                                      return {
                                        ...candidate,
                                        showIf: { ...candidate.showIf, fieldId: nextIdValue },
                                      };
                                    }
                                    return candidate;
                                  }),
                                })),
                              }));
                              setOpenField(nextIdValue);
                            }}
                          />
                        </Field>
                        <Field label="Required">
                          <span className="inline-field builder-toggle">
                            <span>{field.required ? 'Customer must answer' : 'Optional'}</span>
                            <Toggle
                              checked={field.required}
                              onChange={(next) => editField(section.id, field.id, { required: next })}
                              label="Required field"
                            />
                          </span>
                        </Field>
                        {field.type === 'text' || field.type === 'textarea' ? (
                          <Field label="Placeholder">
                            <input
                              className="text-input"
                              value={field.placeholder ?? ''}
                              onChange={(event) =>
                                editField(section.id, field.id, { placeholder: event.target.value })
                              }
                            />
                          </Field>
                        ) : null}
                      </div>

                      {field.type === 'number' ||
                      field.type === 'counter' ||
                      field.type === 'measurement' ? (
                        <div className="form-grid">
                          <Field label="Minimum">
                            <input
                              className="text-input"
                              type="number"
                              value={field.min ?? ''}
                              onChange={(event) =>
                                editField(section.id, field.id, {
                                  min: event.target.value === '' ? undefined : Number(event.target.value),
                                })
                              }
                            />
                          </Field>
                          <Field label="Maximum">
                            <input
                              className="text-input"
                              type="number"
                              value={field.max ?? ''}
                              onChange={(event) =>
                                editField(section.id, field.id, {
                                  max: event.target.value === '' ? undefined : Number(event.target.value),
                                })
                              }
                            />
                          </Field>
                          <Field label="Unit" hint="Shown after the number, e.g. rooms">
                            <input
                              className="text-input"
                              value={field.unit ?? ''}
                              onChange={(event) =>
                                editField(section.id, field.id, { unit: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="Minutes per unit" hint="Adds to the estimated duration">
                            <input
                              className="text-input"
                              type="number"
                              min="0"
                              value={field.minutesPerUnit ?? ''}
                              onChange={(event) =>
                                editField(section.id, field.id, {
                                  minutesPerUnit:
                                    event.target.value === ''
                                      ? undefined
                                      : Number(event.target.value),
                                })
                              }
                            />
                          </Field>
                        </div>
                      ) : null}

                      {field.type === 'media-slot' ? (
                        <div className="form-grid">
                          <Field label="Maximum files">
                            <input
                              className="text-input"
                              type="number"
                              min="1"
                              max="10"
                              value={field.maxMedia ?? 5}
                              onChange={(event) =>
                                editField(section.id, field.id, {
                                  maxMedia: Number(event.target.value),
                                })
                              }
                            />
                          </Field>
                        </div>
                      ) : null}

                      {field.type === 'select' || field.type === 'multiselect' ? (
                        <div className="options-editor">
                          <p className="field-label">Options</p>
                          {(field.options ?? []).map((option, optionIndex) => (
                            <div className="option-row" key={`${field.id}-${optionIndex}`}>
                              <input
                                className="text-input"
                                value={option.id}
                                aria-label="Option id"
                                onChange={(event) => {
                                  const options = [...(field.options ?? [])];
                                  options[optionIndex] = {
                                    ...option,
                                    id: event.target.value.replace(/[^a-z0-9_-]/gi, '_').toLowerCase(),
                                  };
                                  editField(section.id, field.id, { options });
                                }}
                              />
                              <input
                                className="text-input"
                                value={option.label}
                                aria-label="Option label"
                                onChange={(event) => {
                                  const options = [...(field.options ?? [])];
                                  options[optionIndex] = { ...option, label: event.target.value };
                                  editField(section.id, field.id, { options });
                                }}
                              />
                              <input
                                className="text-input option-minutes"
                                type="number"
                                min="0"
                                aria-label="Minutes added"
                                placeholder="min"
                                value={option.minutes ?? ''}
                                onChange={(event) => {
                                  const options = [...(field.options ?? [])];
                                  options[optionIndex] = {
                                    ...option,
                                    minutes:
                                      event.target.value === ''
                                        ? undefined
                                        : Number(event.target.value),
                                  };
                                  editField(section.id, field.id, { options });
                                }}
                              />
                              <label className="option-flag" title="Choosing this asks for a quote">
                                <input
                                  type="checkbox"
                                  checked={option.flagsQuote ?? false}
                                  onChange={(event) => {
                                    const options = [...(field.options ?? [])];
                                    options[optionIndex] = {
                                      ...option,
                                      flagsQuote: event.target.checked || undefined,
                                    };
                                    editField(section.id, field.id, { options });
                                  }}
                                />
                                Quote
                              </label>
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label="Remove option"
                                disabled={(field.options ?? []).length <= 2}
                                onClick={() =>
                                  editField(section.id, field.id, {
                                    options: (field.options ?? []).filter(
                                      (_, index) => index !== optionIndex,
                                    ),
                                  })
                                }
                              >
                                <Icon name="close" size={14} />
                              </button>
                            </div>
                          ))}
                          <Button
                            icon="plus"
                            disabled={(field.options ?? []).length >= 20}
                            onClick={() => {
                              const options: FieldOption[] = [
                                ...(field.options ?? []),
                                {
                                  id: newId(
                                    new Set((field.options ?? []).map((option) => option.id)),
                                    'option',
                                  ),
                                  label: `Option ${(field.options ?? []).length + 1}`,
                                },
                              ];
                              editField(section.id, field.id, { options });
                            }}
                          >
                            Add option
                          </Button>
                        </div>
                      ) : null}

                      <div className="form-grid">
                        <Field label="Show this field only when" hint="Optional conditional rule">
                          <select
                            className="text-input"
                            value={field.showIf?.fieldId ?? ''}
                            onChange={(event) => {
                              const fieldId = event.target.value;
                              editField(section.id, field.id, {
                                showIf: fieldId
                                  ? { fieldId, op: field.showIf?.op ?? 'eq', value: field.showIf?.value }
                                  : undefined,
                              });
                            }}
                          >
                            <option value="">Always show</option>
                            {allFields
                              .filter(
                                (candidate) =>
                                  candidate.id !== field.id &&
                                  allFields.indexOf(candidate) < allFields.indexOf(field),
                              )
                              .map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.label}
                                </option>
                              ))}
                          </select>
                        </Field>
                        {field.showIf ? (
                          <>
                            <Field label="Condition">
                              <select
                                className="text-input"
                                value={field.showIf.op}
                                onChange={(event) =>
                                  editField(section.id, field.id, {
                                    showIf: {
                                      ...field.showIf!,
                                      op: event.target.value as ShowIf['op'],
                                      value:
                                        event.target.value === 'truthy'
                                          ? undefined
                                          : field.showIf!.value,
                                    },
                                  })
                                }
                              >
                                {Object.entries(opLabels).map(([op, label]) => (
                                  <option key={op} value={op}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            {field.showIf.op !== 'truthy' ? (
                              <Field
                                label="Value"
                                hint={
                                  field.showIf.op === 'in'
                                    ? 'Comma-separated option ids'
                                    : 'An option id or a number'
                                }
                              >
                                <input
                                  className="text-input"
                                  value={conditionValueText(field.showIf.value)}
                                  onChange={(event) =>
                                    editField(section.id, field.id, {
                                      showIf: {
                                        ...field.showIf!,
                                        value: parseConditionValue(
                                          field.showIf!.op,
                                          event.target.value,
                                        ),
                                      },
                                    })
                                  }
                                />
                              </Field>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="palette-row">
            <span className="field-label">Add a field</span>
            <div className="palette-actions">
              {FIELD_TYPES.map((type) => (
                <Button
                  key={type}
                  icon="plus"
                  disabled={section.fields.length >= 12}
                  onClick={() => {
                    const field = makeField(draft, type);
                    setDraft((current) =>
                      mapFields(current, section.id, (fields) => [...fields, field]),
                    );
                    setOpenField(field.id);
                  }}
                >
                  {typeLabels[type]}
                </Button>
              ))}
            </div>
          </div>
        </SectionCard>
      ))}

      <div className="builder-foot">
        <Button
          icon="plus"
          disabled={draft.sections.length >= 5}
          onClick={() =>
            setDraft((current) => ({
              ...current,
              sections: [
                ...current.sections,
                {
                  id: newId(new Set(current.sections.map((section) => section.id)), 'section'),
                  title: `Section ${current.sections.length + 1}`,
                  fields: [],
                },
              ],
            }))
          }
        >
          Add section
        </Button>
      </div>
    </div>
  );
}

/** Disabled mobile-style rendering of the schema, for a sanity check before publishing. */
export function FormPreview({ schema }: { schema: FormSchema }) {
  return (
    <div className="form-preview" aria-label="Customer preview">
      <div className="preview-phone">
        <p className="preview-step">Step 2 of 4 · Job details</p>
        <h3>{schema.heading}</h3>
        {schema.sections.map((section) => (
          <div className="preview-section" key={section.id}>
            <p className="preview-section-title">{section.title}</p>
            {section.fields.map((field) => (
              <div className="preview-field" key={field.id}>
                <span className="preview-label">
                  {field.label}
                  {field.required ? <em> *</em> : null}
                </span>
                {field.helper ? <span className="preview-helper">{field.helper}</span> : null}
                <PreviewControl field={field} />
                {field.showIf ? (
                  <span className="preview-conditional">
                    Shown when {field.showIf.fieldId} {opLabels[field.showIf.op]}
                    {field.showIf.op === 'truthy' ? '' : ` ${conditionValueText(field.showIf.value)}`}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ))}
        <p className="preview-hint">{schema.mediaHint}</p>
      </div>
    </div>
  );
}

function PreviewControl({ field }: { field: FormField }) {
  switch (field.type) {
    case 'textarea':
      return <span className="preview-input preview-input-tall" />;
    case 'select':
    case 'multiselect':
      return (
        <div className="preview-options">
          {(field.options ?? []).map((option) => (
            <span className={field.type === 'select' ? 'preview-pill' : 'preview-chip'} key={option.id}>
              {option.label}
              {option.flagsQuote ? ' · quote' : ''}
            </span>
          ))}
        </div>
      );
    case 'boolean':
      return <span className="preview-pill">Yes / No</span>;
    case 'measurement':
      return <span className="preview-input">{field.unit || 'value'} 0</span>;
    case 'media-slot':
      return <span className="preview-upload">Add photos · up to {field.maxMedia ?? 5}</span>;
    default:
      return (
        <span className="preview-input">
          {field.placeholder || (field.type === 'number' || field.type === 'counter' ? '0' : '')}
        </span>
      );
  }
}
