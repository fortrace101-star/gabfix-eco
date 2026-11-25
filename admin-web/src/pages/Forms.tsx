import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormBuilder, FormPreview } from '../components/FormBuilder';
import { Icon } from '../components/Icon';
import {
  Button,
  EmptyState,
  KpiCard,
  Modal,
  PageHeader,
  SectionCard,
  StatusChip,
} from '../components/ui';
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
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [restoreTarget, setRestoreTarget] = useState<FormDefinitionRow | null>(null);

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

  const categoryOptions = catalogue?.categories ?? [];
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
      notify(`${label} saved · ${selected.name}.`);
    } catch (saveError) {
      notify(saveError instanceof Error ? `Save failed: ${saveError.message}` : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const currentVersionCount = catalogue
    ? catalogue.definitions.filter((definition) => definition.isCurrent).length
    : 0;
  const overrides = catalogue
    ? catalogue.definitions.filter((definition) => definition.isCurrent && definition.serviceId).length
    : 0;
  const historyCount = catalogue ? catalogue.definitions.length : 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Catalogue"
        title="Booking forms"
        subtitle="Versioned job-details forms per category, with optional per-service overrides."
        actions={
          <Button icon="refresh" disabled={loading} onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Reload'}
          </Button>
        }
      />

      <div className="kpis">
        <KpiCard
          label="Current definitions"
          value={String(currentVersionCount)}
          detail="One live form per category or service"
          icon="services"
        />
        <KpiCard
          label="Service overrides"
          value={String(overrides)}
          detail="Services with their own form"
          icon="bookings"
          tone="blue"
        />
        <KpiCard
          label="Versions stored"
          value={String(historyCount)}
          detail="Old bookings keep their snapshot"
          icon="reports"
          tone="yellow"
        />
        <KpiCard
          label="Categories"
          value={String(categoryOptions.length)}
          detail="Every category needs a form"
          icon="customers"
          tone="rose"
        />
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

      <div className="forms-layout">
        <aside className="forms-rail">
          <SectionCard title="Categories" meta="Default form for every service in the category">
            <div className="stack-list">
              {categoryOptions.map((category) => {
                const definition = catalogue ? currentDefinition(catalogue.definitions, category) : null;
                return (
                  <button
                    type="button"
                    key={category.id}
                    className={
                      selectedKey === ownerKey(category) ? 'owner-row owner-row-active' : 'owner-row'
                    }
                    onClick={() => setSelectedKey(ownerKey(category))}
                  >
                    <span>
                      <strong>{category.name}</strong>
                      <small>{category.slug}</small>
                    </span>
                    {definition ? (
                      <StatusChip label={`v${definition.version}`} tone="success" />
                    ) : (
                      <StatusChip label="No form" tone="warning" />
                    )}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Services" meta="Overrides inherit the category form until one is published">
            <div className="stack-list">
              {serviceGroups.map(([group, services]) => (
                <div key={group} className="owner-group">
                  <p className="nav-label">{group}</p>
                  {services.map((service) => {
                    const definition = catalogue
                      ? currentDefinition(catalogue.definitions, service)
                      : null;
                    const inheritedDefinition =
                      catalogue && !definition
                        ? effectiveDefinition(catalogue.definitions, service)
                        : null;
                    return (
                      <button
                        type="button"
                        key={service.id}
                        className={
                          selectedKey === ownerKey(service)
                            ? 'owner-row owner-row-active'
                            : 'owner-row'
                        }
                        onClick={() => setSelectedKey(ownerKey(service))}
                      >
                        <span>
                          <strong>{service.name}</strong>
                          <small>{service.slug}</small>
                        </span>
                        {definition ? (
                          <StatusChip label={`v${definition.version}`} tone="info" />
                        ) : inheritedDefinition ? (
                          <StatusChip label="Inherits" tone="neutral" />
                        ) : (
                          <StatusChip label="No form" tone="warning" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </SectionCard>
        </aside>

        <div className="forms-main">
          {!catalogue && loading ? (
            <p className="page-loading" role="status">
              Loading form definitions…
            </p>
          ) : !selected ? (
            <SectionCard>
              <EmptyState
                icon="services"
                title="Pick a category or service"
                detail="Choose an item on the left to edit the questions customers answer when booking."
              />
            </SectionCard>
          ) : (
            <>
              <div className="forms-editor">
                <FormBuilder
                  key={`${ownerKey(selected)}:${base?.id ?? 'new'}:${editorEpoch}`}
                  title={selected.name}
                  subtitle={
                    base
                      ? `Version ${base.version} is live. Publishing writes version ${base.version + 1}; existing bookings keep their saved answers.`
                      : 'No form yet — start from the template and publish version 1.'
                  }
                  schema={schema}
                  source={source}
                  busy={saving}
                  onSave={(next) => void publish(next, `Version ${(base?.version ?? 0) + 1}`)}
                  onDiscard={() => setEditorEpoch((current) => current + 1)}
                />
                <aside className="forms-preview">
                  <SectionCard title="Customer preview" meta="How the booking step renders">
                    <FormPreview schema={schema} />
                  </SectionCard>
                </aside>
              </div>

              <SectionCard
                title="Version history"
                meta={`${versions.length} saved version${versions.length === 1 ? '' : 's'} · restoring creates a new version`}
              >
                {versions.length === 0 ? (
                  <p className="field-note">
                    <Icon name="alert" size={14} />
                    Nothing has been published for this {selected.kind} yet.
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
                          <Button onClick={() => setRestoreTarget(definition)}>
                            Restore v{definition.version}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>

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
