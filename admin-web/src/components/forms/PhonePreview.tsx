import { Fragment, useMemo, useState } from 'react';
import {
  requiresQuote,
  schemaLayout,
  suggestedMinutes,
  validateAnswers,
  visibleFields,
  type FormSchema,
  type FormValue,
} from '@mobile/lib/form-schema';

import { cx } from '../../lib/format';
import { Icon } from '../Icon';
import { PreviewField } from './PreviewFields';

const CLIENT_STAGES = ['Details', 'Job scope', 'Schedule', 'Address', 'Summary', 'Payment'];

const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
};

/**
 * The customer's Job scope screen inside a 390 × 844 phone. It renders from the working
 * draft with the same visibility, validation, duration and quote rules the app uses, so a
 * rule can be tested before publishing.
 */
export function PhonePreview({
  draft,
  stepIndex,
  onStepIndex,
  mode,
  onMode,
  selectedFieldId,
  onSelectField,
  onNotice,
}: {
  draft: FormSchema;
  stepIndex: number;
  onStepIndex: (index: number) => void;
  mode: 'edit' | 'customer';
  onMode: (mode: 'edit' | 'customer') => void;
  selectedFieldId: string | null;
  onSelectField: (fieldId: string | null) => void;
  /** Page-level toast, used to explain a click the preview cannot act on. */
  onNotice?: (message: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, FormValue>>({});
  const [mediaCounts, setMediaCounts] = useState<Record<string, number>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const sections = draft.sections;
  const paged = schemaLayout(draft) === 'steps' && sections.length > 1;
  const index = Math.min(Math.max(stepIndex, 0), Math.max(sections.length - 1, 0));
  const section = sections[index];
  // One screen layout shows every section stacked, exactly like the app does for
  // schemas without `layout: 'steps'`.
  const shownSections = paged ? (section ? [section] : []) : sections;
  const visible = useMemo(() => new Set(visibleFields(draft, answers).map((field) => field.id)), [draft, answers]);
  const visibleIn = (item: (typeof sections)[number]) =>
    item.fields.filter((field) => visible.has(field.id));

  function collectErrors(): Record<string, string> {
    const found: Record<string, string> = {};
    for (const item of shownSections) {
      for (const field of visibleIn(item)) {
        const single = validateAnswers(
          { ...draft, sections: [{ ...item, fields: [field] }] },
          answers,
          mediaCounts[field.id] ?? 0,
        );
        if (single[field.id]) found[field.id] = single[field.id]!;
      }
    }
    return found;
  }

  const errors = showErrors ? collectErrors() : {};
  const minutes = suggestedMinutes(draft, answers);
  const quote = requiresQuote(draft, answers);
  const last = index === sections.length - 1;
  const hasVisibleFields = shownSections.some((item) => visibleIn(item).length > 0);

  const setAnswer = (fieldId: string, value: FormValue) => {
    setAnswers((current) => ({ ...current, [fieldId]: value }));
    setShowErrors(false);
  };

  const go = (next: number) => {
    setShowErrors(false);
    onStepIndex(Math.min(Math.max(next, 0), sections.length - 1));
  };

  const onNext = () => {
    // Customer mode blocks on a required answer; Edit mode never blocks, so authors can
    // move through a half-built step.
    if (mode === 'customer') {
      const missing = collectErrors();
      const count = Object.keys(missing).length;
      if (count > 0) {
        setShowErrors(true);
        onNotice?.(
          `${count} required answer${count === 1 ? '' : 's'} still missing on this step.`,
        );
        return;
      }
    }
    setShowErrors(false);
    if (paged && !last) {
      go(index + 1);
      return;
    }
    // The preview stops at the end of Job scope; the app hands over to Schedule.
    onNotice?.('Next stage is not part of this form — the app continues to Schedule.');
  };

  const resetAnswers = () => {
    setAnswers({});
    setMediaCounts({});
    setShowErrors(false);
    setResetKey((value) => value + 1);
  };

  return (
    <div className="phone-wrap">
      <div className="phone-mode" role="tablist" aria-label="Preview mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'edit'}
          className={cx('phone-mode-btn', mode === 'edit' && 'is-on')}
          onClick={() => onMode('edit')}
        >
          Edit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'customer'}
          className={cx('phone-mode-btn', mode === 'customer' && 'is-on')}
          onClick={() => onMode('customer')}
        >
          Customer
        </button>
      </div>

      <div className="phone-frame">
        <div className="phone-status" aria-hidden="true">
          <span>9:41</span>
          <span className="phone-status-icons">▮▮▮ ⌁ ▰</span>
        </div>
        <div
          className="phone-screen"
          aria-label={
            paged
              ? `Customer preview, step ${index + 1} of ${sections.length}`
              : 'Customer preview, all sections on one screen'
          }
        >
          <header className="phone-top">
            <button type="button" className="phone-icon" aria-label="Back" onClick={() => go(index - 1)}>
              <Icon name="chevronRight" size={16} className="phone-back" />
            </button>
            <strong>Job scope</strong>
            <span className="phone-close" aria-hidden="true">
              <Icon name="close" size={16} />
            </span>
          </header>

          <ol className="phone-stepper" aria-label="Booking stages">
            {CLIENT_STAGES.map((stage, stageIndex) => (
              <li
                key={stage}
                className={cx(
                  'phone-stage',
                  stageIndex === 1 && 'is-active',
                  stageIndex < 1 && 'is-done',
                )}
                title={stageIndex === 1 ? stage : `${stage} is not editable here`}
              >
                <span>{stageIndex + 1}</span>
                <em>{stage}</em>
              </li>
            ))}
          </ol>

          <div
            className="phone-body"
            key={`${paged ? section?.id ?? 'empty' : 'single'}-${resetKey}`}
            onClick={() => onSelectField(null)}
          >
            {paged ? (
              <p className="phone-step-line">
                Step {index + 1} of {sections.length} · {section?.title || 'Untitled step'}
              </p>
            ) : null}
            <h3>{draft.heading || 'Tell us about the job'}</h3>

            {!hasVisibleFields ? (
              <p className="phone-empty">
                {paged ? 'No visible questions on this step yet.' : 'No visible questions yet.'}
              </p>
            ) : null}

            {shownSections.map((item) => {
              const fields = visibleIn(item);
              if (fields.length === 0) return null;
              return (
                <Fragment key={item.id}>
                  {item.title ? <p className="phone-section-title">{item.title}</p> : null}
                  {fields.map((field) => (
                    <div
                      key={field.id}
                      className={cx(
                        'phone-field',
                        mode === 'edit' && 'is-selectable',
                        mode === 'edit' && selectedFieldId === field.id && 'is-selected',
                      )}
                      onClick={(event) => {
                        if (mode !== 'edit') return;
                        event.stopPropagation();
                        onSelectField(field.id);
                      }}
                    >
                      <PreviewField
                        field={field}
                        value={answers[field.id]}
                        error={errors[field.id]}
                        mediaCount={mediaCounts[field.id] ?? 0}
                        onChange={(value) => setAnswer(field.id, value)}
                        onAddMedia={() =>
                          setMediaCounts((current) => ({
                            ...current,
                            [field.id]: Math.min(
                              (current[field.id] ?? 0) + 1,
                              field.maxMedia ?? 5,
                            ),
                          }))
                        }
                      />
                      {mode === 'edit' && field.showIf ? (
                        <span className="phone-rule-badge">Conditional · {field.id}</span>
                      ) : null}
                    </div>
                  ))}
                </Fragment>
              );
            })}

            {minutes !== undefined ? (
              <p className="phone-result">About {formatMinutes(minutes)}</p>
            ) : null}
            {quote ? (
              <p className="phone-quote">We will confirm the price after reviewing the details.</p>
            ) : null}
            {draft.mediaHint && (!paged || last) ? (
              <p className="phone-media-hint">
                <Icon name="camera" size={14} /> {draft.mediaHint}
              </p>
            ) : null}
          </div>

          <footer className="phone-foot">
            {paged ? (
              <button
                type="button"
                className="phone-btn phone-btn-secondary"
                disabled={index === 0}
                onClick={() => go(index - 1)}
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="phone-btn phone-btn-primary"
              onClick={onNext}
            >
              {paged && !last ? 'Next' : 'Continue to schedule'}
            </button>
          </footer>
        </div>
      </div>

      <div className="phone-under">
        {paged ? (
          <>
            <div className="phone-dots" role="tablist" aria-label="Preview steps">
              {sections.map((item, dotIndex) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={dotIndex === index}
                  aria-label={`Step ${dotIndex + 1}: ${item.title}`}
                  className={cx('phone-dot', dotIndex === index && 'is-on')}
                  onClick={() => go(dotIndex)}
                />
              ))}
            </div>
            <span className="phone-under-label">
              Step {index + 1} / {sections.length}
            </span>
          </>
        ) : (
          <span className="phone-under-label">
            One screen · {sections.length} section{sections.length === 1 ? '' : 's'}
          </span>
        )}
        <button type="button" className="text-btn" onClick={resetAnswers}>
          Reset answers
        </button>
      </div>
    </div>
  );
}
