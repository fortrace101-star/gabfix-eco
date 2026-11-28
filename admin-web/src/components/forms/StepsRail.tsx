import type { FormSchema } from '@mobile/lib/form-schema';
import { STEP_TEMPLATES } from '../../lib/forms';
import { MAX_STEPS } from '../../lib/use-form-draft';
import { cx } from '../../lib/format';
import { Icon } from '../Icon';
import { Field, Toggle } from '../ui';

/** Left pane: the steps in the form and the settings shared by every step. */
export function StepsRail({
  draft,
  selectedStepId,
  errorsByStep,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
  onPatchSettings,
}: {
  draft: FormSchema;
  selectedStepId: string | null;
  errorsByStep: Record<string, string[]>;
  onSelect: (stepId: string) => void;
  onAdd: (templateId: string) => void;
  onDuplicate: (stepId: string) => void;
  onDelete: (stepId: string) => void;
  onMove: (stepId: string, direction: -1 | 1) => void;
  onPatchSettings: (patch: Partial<FormSchema>) => void;
}) {
  return (
    <aside className="workspace-rail" aria-label="Form steps">
      <div className="pane-head">
        <h2>Steps</h2>
        <span className="pane-meta">
          {draft.sections.length} of {MAX_STEPS}
        </span>
      </div>

      <ol className="steps-list" role="tablist" aria-orientation="vertical">
        {draft.sections.map((section, index) => {
          const problems = errorsByStep[section.id] ?? [];
          const selected = section.id === selectedStepId;
          return (
            <li key={section.id}>
              <button
                type="button"
                role="tab"
                aria-selected={selected}
                className={cx('step-row', selected && 'is-selected')}
                onClick={() => onSelect(section.id)}
              >
                <span className="step-index">{index + 1}</span>
                <span className="step-copy">
                  <strong>{section.title || 'Untitled step'}</strong>
                  <small>
                    {section.fields.length} field{section.fields.length === 1 ? '' : 's'}
                    {problems.length > 0 ? ` · ${problems.length} issue${problems.length === 1 ? '' : 's'}` : ''}
                  </small>
                </span>
                {problems.length > 0 ? (
                  <Icon name="alert" size={14} className="step-flag" />
                ) : (
                  <Icon name="check" size={14} className="step-ok" />
                )}
              </button>
              <div className="step-tools">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${section.title} up`}
                  disabled={index === 0}
                  onClick={() => onMove(section.id, -1)}
                >
                  <Icon name="arrowUp" size={13} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Move ${section.title} down`}
                  disabled={index === draft.sections.length - 1}
                  onClick={() => onMove(section.id, 1)}
                >
                  <Icon name="arrowDown" size={13} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Duplicate ${section.title}`}
                  disabled={draft.sections.length >= MAX_STEPS}
                  onClick={() => onDuplicate(section.id)}
                >
                  <Icon name="download" size={13} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Delete ${section.title}`}
                  disabled={draft.sections.length <= 1}
                  onClick={() => onDelete(section.id)}
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <label className="add-step">
        <span className="field-label">Add a step</span>
        <select
          className="text-input"
          value=""
          disabled={draft.sections.length >= MAX_STEPS}
          onChange={(event) => {
            if (event.target.value) onAdd(event.target.value);
          }}
        >
          <option value="">
            {draft.sections.length >= MAX_STEPS ? 'Maximum 5 steps' : 'Choose a template…'}
          </option>
          {STEP_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
      </label>

      <div className="rail-settings">
        <div className="pane-head">
          <h2>Form settings</h2>
        </div>
        <Field label="Heading" hint="Shown above the questions">
          <input
            className="text-input"
            value={draft.heading}
            maxLength={80}
            onChange={(event) => onPatchSettings({ heading: event.target.value })}
          />
        </Field>
        <Field label="Media hint" hint="Shown beside the photo uploader">
          <input
            className="text-input"
            value={draft.mediaHint}
            maxLength={140}
            onChange={(event) => onPatchSettings({ mediaHint: event.target.value })}
          />
        </Field>
        <Field label="Layout" hint="How the app shows these steps">
          <select
            className="text-input"
            value={draft.layout === 'steps' ? 'steps' : 'single'}
            onChange={(event) =>
              onPatchSettings({
                layout: event.target.value === 'steps' ? 'steps' : undefined,
              })
            }
          >
            <option value="single">One screen</option>
            <option value="steps">Step by step</option>
          </select>
        </Field>
        <Field label="Photo requirement">
          <span className="inline-field builder-toggle">
            <span>{draft.mediaRequired ? 'Photos required' : 'Photos optional'}</span>
            <Toggle
              checked={draft.mediaRequired}
              onChange={(next) => onPatchSettings({ mediaRequired: next })}
              label="Require photos"
            />
          </span>
        </Field>
        <p className="rail-note">
          <Icon name="alert" size={13} />{' '}
          {draft.layout === 'steps'
            ? 'The app pages these steps. App builds released before this setting show them stacked on one screen.'
            : 'The app shows every step stacked on one Job scope screen.'}
        </p>
        <p className="rail-note muted">
          Schema id <code>{draft.id}</code> · publishing writes version {draft.version}
        </p>
      </div>
    </aside>
  );
}
