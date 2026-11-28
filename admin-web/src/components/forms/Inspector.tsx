import {
  FIELD_TYPES,
  type FieldOption,
  type FieldType,
  type FormField,
  type FormSchema,
  type ShowIf,
} from '@mobile/lib/form-schema';

import {
  choiceOptions,
  conditionValueText,
  nextId,
  opLabels,
  parseConditionValue,
  typeLabels,
} from '../../lib/form-fields';
import type { FormDraftController } from '../../lib/use-form-draft';
import { MAX_FIELDS_PER_STEP, MAX_STEPS } from '../../lib/use-form-draft';
import { Icon } from '../Icon';
import { Button, Field, Toggle } from '../ui';

/** Right pane: edits the selected step, or the selected field inside it. */
export function Inspector({
  draft,
  stepId,
  fieldId,
  published,
  onSelectStep,
  onSelectField,
  ctl,
}: {
  draft: FormSchema;
  stepId: string | null;
  fieldId: string | null;
  published: boolean;
  onSelectStep: (stepId: string) => void;
  onSelectField: (fieldId: string | null) => void;
  ctl: FormDraftController;
}) {
  const section = draft.sections.find((item) => item.id === stepId) ?? draft.sections[0] ?? null;
  const field = section?.fields.find((item) => item.id === fieldId) ?? null;

  if (!section) {
    return (
      <aside className="workspace-inspector" aria-label="Inspector">
        <p className="inspector-empty">Add a step to start editing the form.</p>
      </aside>
    );
  }

  if (field) {
    return (
      <FieldInspector
        draft={draft}
        sectionId={section.id}
        field={field}
        published={published}
        onSelectField={onSelectField}
        ctl={ctl}
      />
    );
  }

  return (
    <aside className="workspace-inspector" aria-label="Step settings">
      <div className="pane-head">
        <h2>Step settings</h2>
        <span className="pane-meta">{section.fields.length} fields</span>
      </div>

      <Field label="Step title" hint="Shown above the questions on this step">
        <input
          className="text-input"
          value={section.title}
          maxLength={60}
          onChange={(event) => ctl.patchSection(section.id, { title: event.target.value })}
        />
      </Field>
      <Field
        label="Step id"
        hint={published ? 'Saved answers use this id, so it is locked after publishing' : 'Stable key; never reused'}
      >
        <input
          className="text-input"
          value={section.id}
          disabled={published}
          onChange={(event) => {
            ctl.patchSectionId(section.id, event.target.value);
            onSelectStep(event.target.value.replace(/[^a-z0-9_-]/gi, '_').toLowerCase());
          }}
        />
      </Field>

      <div className="inspector-actions">
        <Button
          icon="download"
          disabled={draft.sections.length >= MAX_STEPS}
          onClick={() => {
            const id = ctl.duplicateSection(section.id);
            if (id) onSelectStep(id);
          }}
        >
          Duplicate
        </Button>
        <Button
          variant="danger"
          icon="close"
          disabled={draft.sections.length <= 1}
          onClick={() => {
            if (ctl.dependentsCount(section.id) > 0) {
              const count = ctl.dependentsCount(section.id);
              if (
                !window.confirm(
                  `${count} condition${count === 1 ? '' : 's'} depend on this step's fields. Deleting it removes those conditions too.`,
                )
              ) {
                return;
              }
            }
            ctl.deleteSection(section.id);
            onSelectField(null);
          }}
        >
          Delete step
        </Button>
      </div>

      <div className="inspector-group">
        <p className="field-label">Fields</p>
        <div className="inspector-fields">
          {section.fields.map((item) => (
            <button
              type="button"
              key={item.id}
              className="inspector-field-row"
              onClick={() => onSelectField(item.id)}
            >
              <span>
                <strong>{item.label || 'Untitled field'}</strong>
                <small>
                  {typeLabels[item.type]}
                  {item.required ? ' · required' : ''}
                  {item.showIf ? ' · conditional' : ''}
                </small>
              </span>
              <Icon name="chevronRight" size={14} />
            </button>
          ))}
        </div>
        <div className="palette-actions">
          {FIELD_TYPES.map((type) => (
            <Button
              key={type}
              icon="plus"
              disabled={section.fields.length >= MAX_FIELDS_PER_STEP}
              onClick={() => {
                const added = ctl.addField(section.id, type);
                if (added) onSelectField(added.id);
              }}
            >
              {typeLabels[type]}
            </Button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function FieldInspector({
  draft,
  sectionId,
  field,
  published,
  onSelectField,
  ctl,
}: {
  draft: FormSchema;
  sectionId: string;
  field: FormField;
  published: boolean;
  onSelectField: (fieldId: string | null) => void;
  ctl: FormDraftController;
}) {
  const section = draft.sections.find((item) => item.id === sectionId);
  const index = section?.fields.findIndex((item) => item.id === field.id) ?? -1;
  const allFields = draft.sections.flatMap((item) => item.fields);
  const currentIndex = allFields.findIndex((item) => item.id === field.id);
  const dependency = allFields.find((item) => item.id === field.showIf?.fieldId);
  const dependencyOptions = choiceOptions(dependency);

  const edit = (patch: Partial<FormField>) => ctl.patchField(sectionId, field.id, patch);

  return (
    <aside className="workspace-inspector" aria-label="Field settings">
      <button type="button" className="inspector-back" onClick={() => onSelectField(null)}>
        <Icon name="chevronRight" size={14} className="phone-back" /> Step settings
      </button>
      <div className="pane-head">
        <h2>{field.label || 'Untitled field'}</h2>
        <span className="pane-meta">{typeLabels[field.type]}</span>
      </div>

      <Field label="Question">
        <input
          className="text-input"
          value={field.label}
          maxLength={60}
          onChange={(event) => edit({ label: event.target.value })}
        />
      </Field>

      <Field label="Field type">
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
            edit(patch);
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
          onChange={(event) => edit({ helper: event.target.value })}
        />
      </Field>

      <Field label="Required">
        <span className="inline-field builder-toggle">
          <span>{field.required ? 'Customer must answer' : 'Optional'}</span>
          <Toggle
            checked={field.required}
            onChange={(next) => edit({ required: next })}
            label="Required field"
          />
        </span>
      </Field>

      {field.type === 'text' || field.type === 'textarea' ? (
        <Field label="Placeholder">
          <input
            className="text-input"
            value={field.placeholder ?? ''}
            onChange={(event) => edit({ placeholder: event.target.value })}
          />
        </Field>
      ) : null}

      {field.type === 'number' || field.type === 'counter' || field.type === 'measurement' ? (
        <div className="form-grid">
          <Field label="Minimum">
            <input
              className="text-input"
              type="number"
              value={field.min ?? ''}
              onChange={(event) =>
                edit({ min: event.target.value === '' ? undefined : Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Maximum">
            <input
              className="text-input"
              type="number"
              value={field.max ?? ''}
              onChange={(event) =>
                edit({ max: event.target.value === '' ? undefined : Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Unit" hint="Shown after the number">
            <input
              className="text-input"
              value={field.unit ?? ''}
              onChange={(event) => edit({ unit: event.target.value })}
            />
          </Field>
          <Field label="Minutes per unit" hint="Adds to the estimated duration">
            <input
              className="text-input"
              type="number"
              min="0"
              value={field.minutesPerUnit ?? ''}
              onChange={(event) =>
                edit({
                  minutesPerUnit:
                    event.target.value === '' ? undefined : Number(event.target.value),
                })
              }
            />
          </Field>
        </div>
      ) : null}

      {field.type === 'media-slot' ? (
        <Field label="Maximum files">
          <input
            className="text-input"
            type="number"
            min="1"
            max="10"
            value={field.maxMedia ?? 5}
            onChange={(event) => edit({ maxMedia: Number(event.target.value) })}
          />
        </Field>
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
                  edit({ options });
                }}
              />
              <input
                className="text-input"
                value={option.label}
                aria-label="Option label"
                onChange={(event) => {
                  const options = [...(field.options ?? [])];
                  options[optionIndex] = { ...option, label: event.target.value };
                  edit({ options });
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
                      event.target.value === '' ? undefined : Number(event.target.value),
                  };
                  edit({ options });
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
                    edit({ options });
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
                  edit({
                    options: (field.options ?? []).filter((_, i) => i !== optionIndex),
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
                  id: nextId(
                    new Set((field.options ?? []).map((option) => option.id)),
                    'option',
                  ),
                  label: `Option ${(field.options ?? []).length + 1}`,
                },
              ];
              edit({ options });
            }}
          >
            Add option
          </Button>
        </div>
      ) : null}

      <div className="inspector-group">
        <Field label="Show this field only when">
          <select
            className="text-input"
            value={field.showIf?.fieldId ?? ''}
            onChange={(event) => {
              const dependencyId = event.target.value;
              edit({
                showIf: dependencyId
                  ? { fieldId: dependencyId, op: 'eq', value: undefined }
                  : undefined,
              });
            }}
          >
            <option value="">Always show</option>
            {allFields
              .slice(0, currentIndex)
              .filter((candidate) => candidate.id !== field.id)
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
                onChange={(event) => {
                  const op = event.target.value as ShowIf['op'];
                  edit({
                    showIf: {
                      ...field.showIf!,
                      op,
                      value: op === 'truthy' ? undefined : field.showIf!.value,
                    },
                  });
                }}
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
                  dependencyOptions.length > 0
                    ? 'One of the dependency’s options'
                    : field.showIf.op === 'in'
                      ? 'Comma-separated values'
                      : 'A value or a number'
                }
              >
                {dependencyOptions.length > 0 && field.showIf.op !== 'in' ? (
                  <select
                    className="text-input"
                    value={conditionValueText(field.showIf.value)}
                    onChange={(event) => edit({ showIf: { ...field.showIf!, value: event.target.value } })}
                  >
                    <option value="">Choose an option…</option>
                    {dependencyOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="text-input"
                    value={conditionValueText(field.showIf.value)}
                    onChange={(event) =>
                      edit({
                        showIf: {
                          ...field.showIf!,
                          value: parseConditionValue(field.showIf!.op, event.target.value),
                        },
                      })
                    }
                  />
                )}
              </Field>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="inspector-group">
        <Field label="Move to step" hint="The field keeps its id and its rules">
          <select
            className="text-input"
            value={sectionId}
            onChange={(event) => ctl.moveFieldToSection(sectionId, field.id, event.target.value)}
          >
            {draft.sections.map((item) => (
              <option key={item.id} value={item.id} disabled={item.id === sectionId}>
                {item.title || 'Untitled step'}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Field id"
          hint={published ? 'Saved answers use this id, so it is locked after publishing' : 'Stable key used in saved answers'}
        >
          <input
            className="text-input"
            value={field.id}
            disabled={published}
            onChange={(event) => ctl.patchFieldId(sectionId, field.id, event.target.value)}
          />
        </Field>
        <div className="inspector-actions">
          <Button
            icon="arrowUp"
            disabled={index <= 0}
            onClick={() => ctl.moveField(sectionId, field.id, -1)}
          >
            Up
          </Button>
          <Button
            icon="arrowDown"
            disabled={!section || index === section.fields.length - 1}
            onClick={() => ctl.moveField(sectionId, field.id, 1)}
          >
            Down
          </Button>
          <Button icon="download" onClick={() => ctl.duplicateField(sectionId, field.id)}>
            Duplicate
          </Button>
          <Button
            variant="danger"
            icon="close"
            disabled={!section || section.fields.length <= 1}
            onClick={() => {
              ctl.deleteField(sectionId, field.id);
              onSelectField(null);
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </aside>
  );
}
