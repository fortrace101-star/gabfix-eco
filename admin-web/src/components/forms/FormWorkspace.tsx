import { useEffect, useMemo, useState } from 'react';
import type { FormSchema } from '@mobile/lib/form-schema';

import { cx } from '../../lib/format';
import { STEP_TEMPLATES } from '../../lib/forms';
import { useFormDraft } from '../../lib/use-form-draft';
import { Icon } from '../Icon';
import { Button, StatusChip } from '../ui';
import { Inspector } from './Inspector';
import { PhonePreview } from './PhonePreview';
import { StepsRail } from './StepsRail';

const countChanges = (base: FormSchema, draft: FormSchema): number => {
  let changes = 0;
  for (const key of ['heading', 'mediaHint', 'mediaRequired', 'layout'] as const) {
    if (base[key] !== draft[key]) changes += 1;
  }
  const baseSections = new Map(base.sections.map((section) => [section.id, section]));
  for (const section of draft.sections) {
    const original = baseSections.get(section.id);
    if (!original) {
      changes += 1 + section.fields.length;
      continue;
    }
    if (original.title !== section.title) changes += 1;
    const baseFields = new Map(original.fields.map((field) => [field.id, field]));
    for (const field of section.fields) {
      const before = baseFields.get(field.id);
      if (!before) changes += 1;
      else if (JSON.stringify(before) !== JSON.stringify(field)) changes += 1;
    }
    changes += original.fields.filter((field) => !section.fields.some((item) => item.id === field.id)).length;
  }
  changes += base.sections.filter(
    (section) => !draft.sections.some((item) => item.id === section.id),
  ).length;
  return changes;
};

/**
 * The editing workspace: steps on the left, the customer's phone in the middle and the
 * inspector on the right, all reading one working draft.
 */
export function FormWorkspace({
  title,
  subtitle,
  source,
  publishedVersion,
  busy,
  baseSchema,
  onPublish,
  notify,
}: {
  title: string;
  subtitle: string;
  source: 'own' | 'inherited' | 'new';
  publishedVersion: number | null;
  busy: boolean;
  baseSchema: FormSchema;
  onPublish: (schema: FormSchema) => void;
  notify?: (message: string) => void;
}) {
  const ctl = useFormDraft(baseSchema);
  const [stepId, setStepId] = useState<string | null>(baseSchema.sections[0]?.id ?? null);
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'customer'>('edit');
  const [previewEpoch, setPreviewEpoch] = useState(0);

  const stepIndex = Math.max(
    ctl.draft.sections.findIndex((section) => section.id === stepId),
    0,
  );
  const changes = useMemo(() => countChanges(baseSchema, ctl.draft), [baseSchema, ctl.draft]);
  const firstErrorStep = useMemo(() => {
    const entry = ctl.draft.sections.find(
      (section) => (ctl.errorsByStep[section.id] ?? []).length > 0,
    );
    return entry?.id ?? null;
  }, [ctl.draft.sections, ctl.errorsByStep]);

  const selectStep = (nextId: string) => {
    setStepId(nextId);
    setFieldId(null);
  };

  useEffect(() => {
    if (!ctl.dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [ctl.dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key !== '[' && event.key !== ']') return;
      event.preventDefault();
      const next = Math.min(
        Math.max(stepIndex + (event.key === ']' ? 1 : -1), 0),
        ctl.draft.sections.length - 1,
      );
      const section = ctl.draft.sections[next];
      if (section) selectStep(section.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // The handler only reads the current step list and index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, ctl.draft.sections]);

  return (
    <section className="form-workspace" aria-label="Booking form workspace">
      <div className="workspace-bar">
        <div className="workspace-id">
          <p className="eyebrow">
            {source === 'own'
              ? 'Service override'
              : source === 'inherited'
                ? 'Inherited from category'
                : 'New form'}
          </p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <div className="workspace-actions">
          {publishedVersion ? (
            <StatusChip label={`v${publishedVersion} live`} tone="success" />
          ) : (
            <StatusChip label="Not published" tone="warning" />
          )}

          {ctl.errors.length > 0 ? (
            <button
              type="button"
              className="draft-chip is-error"
              onClick={() => {
                if (!firstErrorStep) return;
                selectStep(firstErrorStep);
              }}
              title={ctl.errors[0]}
            >
              <Icon name="alert" size={13} />
              {ctl.errors.length} error{ctl.errors.length === 1 ? '' : 's'}
            </button>
          ) : ctl.dirty ? (
            <span className="draft-chip is-unsaved" aria-live="polite">
              <span className="draft-dot" /> Unsaved · {changes} change{changes === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="draft-chip" aria-live="polite">
              Saved
            </span>
          )}

          <Button
            icon="refresh"
            disabled={!ctl.dirty || busy}
            onClick={() => {
              ctl.reset();
              setFieldId(null);
              setStepId(baseSchema.sections[0]?.id ?? null);
              setPreviewEpoch((value) => value + 1);
            }}
          >
            Discard
          </Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!ctl.dirty || ctl.errors.length > 0 || busy}
            title={ctl.errors[0] ?? undefined}
            onClick={() => onPublish(ctl.draft)}
          >
            {busy ? 'Publishing…' : 'Publish new version'}
          </Button>
        </div>
      </div>

      {source === 'inherited' ? (
        <p className="field-note workspace-note">
          <Icon name="alert" size={14} />
          This service uses its category&apos;s form. Publishing here creates a service-level
          override; the category form stays unchanged for other services.
        </p>
      ) : null}

      <div className="workspace-grid">
        <StepsRail
          draft={ctl.draft}
          selectedStepId={stepId}
          errorsByStep={ctl.errorsByStep}
          onSelect={selectStep}
          onAdd={(templateId) => {
            const template = STEP_TEMPLATES.find((item) => item.id === templateId);
            if (!template) return;
            const id = ctl.addSection(
              template.build(new Set(ctl.draft.sections.map((section) => section.id))),
            );
            if (id) selectStep(id);
          }}
          onDuplicate={(id) => {
            const copy = ctl.duplicateSection(id);
            if (copy) selectStep(copy);
          }}
          onDelete={(id) => {
            const remaining = ctl.draft.sections.filter((section) => section.id !== id);
            ctl.deleteSection(id);
            setFieldId(null);
            setStepId(remaining[0]?.id ?? null);
          }}
          onMove={(id, direction) => ctl.moveSection(id, direction)}
          onPatchSettings={ctl.patchSettings}
        />

        <div
          className={cx('workspace-stage', mode === 'customer' && 'is-customer')}
          role="presentation"
        >
          <PhonePreview
            key={`${baseSchema.id}-${previewEpoch}`}
            draft={ctl.draft}
            stepIndex={stepIndex}
            onStepIndex={(next) => {
              const section = ctl.draft.sections[next];
              if (section) selectStep(section.id);
            }}
            mode={mode}
            onMode={setMode}
            selectedFieldId={fieldId}
            onSelectField={setFieldId}
            onNotice={notify}
          />
        </div>

        <Inspector
          draft={ctl.draft}
          stepId={stepId}
          fieldId={fieldId}
          published={publishedVersion !== null}
          onSelectStep={selectStep}
          onSelectField={setFieldId}
          ctl={ctl}
        />
      </div>
    </section>
  );
}
