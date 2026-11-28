import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormWorkspace } from '../components/forms/FormWorkspace';
import { Icon } from '../components/Icon';
import { Button, Drawer, EmptyState, Modal, StatusChip } from '../components/ui';
import type { AdminUser } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import {
  blankSchema,
  currentDefinition,
  effectiveDefinition,
  loadFormCatalogue,
  publishForm,
  versionsFor,
  type FormCatalogue,
  type FormDefinitionRow,
  type FormOwner,
} from '../lib/forms';
import type { FormSchema } from '@mobile/lib/form-schema';

const ownerKey = (owner: FormOwner): string => `${owner.kind}:${owner.id}`;

export function FormsPage({ user, notify }: { user: AdminUser; notify: (message: string) => void }) {
  const [catalogue, setCatalogue] = useState<FormCatalogue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<FormDefinitionRow | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadFormCatalogue();
      setCatalogue(next);
      setSelectedKey((current) => current ?? (next.categories[0] ? ownerKey(next.categories[0]) : null));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not read the form definitions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const owners = useMemo(
    () => [...(catalogue?.categories ?? []), ...(catalogue?.services ?? [])],
    [catalogue],
  );
  const selected = owners.find((owner) => ownerKey(owner) === selectedKey) ?? null;

  const ownDefinition = selected && catalogue
    ? currentDefinition(catalogue.definitions, selected)
    : null;
  const inherited =
    selected?.kind === 'service' && catalogue
      ? effectiveDefinition(catalogue.definitions, selected)
      : null;
  const base = ownDefinition ?? inherited;
  const source = ownDefinition ? 'own' : inherited ? 'inherited' : 'new';
  const schema: FormSchema = base?.schema ?? (selected ? blankSchema(selected) : blankSchema({
    kind: 'category',
    id: 'draft',
    name: 'Draft',
    slug: 'draft',
    active: true,
  }));
  const versions = selected && catalogue ? versionsFor(catalogue.definitions, selected) : [];

  const serviceGroups = useMemo(() => {
    const map = new Map<string, FormOwner[]>();
    for (const service of catalogue?.services ?? []) {
      const key = service.categoryName ?? 'Uncategorised';
      map.set(key, [...(map.get(key) ?? []), service]);
    }
    return [...map.entries()];
  }, [catalogue]);

  const publish = async (next: FormSchema, label: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      await publishForm(selected, next, user.id);
      await refresh();
      setHistoryOpen(false);
      notify(`${label} saved · ${selected.name}.`);
    } catch (saveError) {
      notify(saveError instanceof Error ? `Save failed: ${saveError.message}` : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page forms-page">
      <div className="forms-toolbar">
        <div className="forms-owner">
          <label className="field-label" htmlFor="form-owner">
            Booking form for
          </label>
          <select
            id="form-owner"
            className="text-input"
            value={selectedKey ?? ''}
            onChange={(event) => setSelectedKey(event.target.value)}
          >
            {!catalogue && !selected ? <option value="">Loading…</option> : null}
            <optgroup label="Categories">
              {(catalogue?.categories ?? []).map((category) => (
                <option key={ownerKey(category)} value={ownerKey(category)}>
                  {category.name}
                </option>
              ))}
            </optgroup>
            {serviceGroups.map(([group, services]) => (
              <optgroup key={group} label={`Services · ${group}`}>
                {services.map((service) => (
                  <option key={ownerKey(service)} value={ownerKey(service)}>
                    {service.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {selected ? (
            source === 'own' ? (
              <StatusChip label={`v${base?.version} live`} tone="success" />
            ) : source === 'inherited' ? (
              <StatusChip label={`Inherits v${inherited?.version}`} tone="neutral" />
            ) : (
              <StatusChip label="No form yet" tone="warning" />
            )
          ) : null}
        </div>

        <div className="page-actions">
          <Button icon="refresh" disabled={loading} onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Reload'}
          </Button>
          <Button
            icon="clock"
            disabled={!selected}
            onClick={() => setHistoryOpen(true)}
          >
            History · {versions.length}
          </Button>
        </div>
      </div>

      {error ? (
        <section className="card restricted" role="alert">
          <h2>Could not load booking forms</h2>
          <p>{error}</p>
          <Button variant="primary" onClick={() => void refresh()}>
            Try again
          </Button>
        </section>
      ) : null}

      {!catalogue && loading ? (
        <p className="page-loading" role="status">
          Loading form definitions…
        </p>
      ) : !selected ? (
        <section className="card">
          <EmptyState
            icon="services"
            title="Pick a category or service"
            detail="Choose an item above to edit the questions customers answer when booking."
          />
        </section>
      ) : (
        <FormWorkspace
          key={`${ownerKey(selected)}:${base?.id ?? 'new'}`}
          title={selected.name}
          subtitle={
            base
              ? `Version ${base.version} is live. Publishing writes version ${base.version + 1}; existing bookings keep their saved answers.`
              : 'No form yet — start from a template and publish version 1.'
          }
          source={source}
          publishedVersion={base?.version ?? null}
          busy={saving}
          baseSchema={schema}
          notify={notify}
          onPublish={(next) => void publish(next, `Version ${(base?.version ?? 0) + 1}`)}
        />
      )}

      <Drawer
        open={historyOpen}
        title={`Version history · ${selected?.name ?? ''}`}
        description="Restoring copies an old version into a new current version; saved bookings keep their snapshot."
        onClose={() => setHistoryOpen(false)}
        wide
      >
        {versions.length === 0 ? (
          <p className="field-note">
            <Icon name="alert" size={14} />
            Nothing has been published for this {selected?.kind ?? 'form'} yet.
          </p>
        ) : (
          <div className="history-list">
            {versions.map((definition) => (
              <div className="history-row" key={definition.id}>
                <span className="history-version">v{definition.version}</span>
                <span className="history-meta">
                  <strong>{definition.schema.heading}</strong>
                  <small>
                    {definition.schema.sections.length} section
                    {definition.schema.sections.length === 1 ? '' : 's'} ·{' '}
                    {formatDateTime(definition.createdAt)}
                  </small>
                </span>
                {definition.isCurrent ? (
                  <StatusChip label="Live" tone="success" />
                ) : (
                  <Button
                    onClick={() => {
                      setRestoreTarget(definition);
                      setHistoryOpen(false);
                    }}
                  >
                    Restore v{definition.version}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>

      <Modal
        open={restoreTarget !== null}
        title={`Restore version ${restoreTarget?.version ?? ''}?`}
        description="The restored questions are published as a new version. Bookings already taken keep their original snapshot."
        onClose={() => setRestoreTarget(null)}
        footer={
          <>
            <Button onClick={() => setRestoreTarget(null)}>Cancel</Button>
            <Button
              variant="primary"
              icon="check"
              disabled={saving}
              onClick={() => {
                if (!restoreTarget) return;
                const target = restoreTarget;
                setRestoreTarget(null);
                void publish(target.schema, `Restored v${target.version}`);
              }}
            >
              Publish restored form
            </Button>
          </>
        }
      >
        <p>
          Version {restoreTarget?.version} will be copied into a new current version. The live
          version changes immediately for new bookings.
        </p>
      </Modal>
    </div>
  );
}
