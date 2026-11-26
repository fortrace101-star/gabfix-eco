import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import {
  Button,
  EmptyState,
  Field,
  KpiCard,
  Modal,
  PageHeader,
  SectionCard,
  StatusChip,
  Toggle,
} from '../components/ui';
import {
  catalogueImageUrl,
  loadCatalogue,
  saveCategory,
  saveCategoryOrder,
  saveService,
  setCategoryActive,
  setServiceActive,
  slugify,
  uploadCatalogueImage,
  type Catalogue,
  type CatalogueCategory,
  type CatalogueService,
  type PricingType,
} from '../lib/catalogue';
import { cx, ugx } from '../lib/format';

const pricingLabels: Record<PricingType, string> = {
  fixed: 'Fixed price',
  hourly: 'Hourly',
  quote: 'Request a quote',
};

const priceLabel = (service: CatalogueService): string => {
  if (service.pricingType === 'quote') return 'Quote on inspection';
  if (service.pricingType === 'hourly') return `${ugx(service.price)}/hr`;
  return ugx(service.price);
};

type CategoryDraft = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  imagePath: string | null;
  parentId: string | null;
  displayOrder: string;
  active: boolean;
  slugTouched: boolean;
};

type ServiceDraft = {
  id?: string;
  name: string;
  slug: string;
  categoryId: string;
  description: string;
  imagePath: string | null;
  pricingType: PricingType;
  price: string;
  durationMinutes: string;
  requiredSkillId: string | null;
  popularRank: string;
  tag: string;
  active: boolean;
  slugTouched: boolean;
};

type Editor = { kind: 'category'; draft: CategoryDraft } | { kind: 'service'; draft: ServiceDraft } | null;

const blankCategoryDraft = (order: number): CategoryDraft => ({
  name: '',
  slug: '',
  description: '',
  imagePath: null,
  parentId: null,
  displayOrder: String(order),
  active: true,
  slugTouched: false,
});

const blankServiceDraft = (categoryId: string): ServiceDraft => ({
  name: '',
  slug: '',
  categoryId,
  description: '',
  imagePath: null,
  pricingType: 'fixed',
  price: '',
  durationMinutes: '60',
  requiredSkillId: null,
  popularRank: '',
  tag: '',
  active: true,
  slugTouched: false,
});

const categoryToDraft = (category: CatalogueCategory): CategoryDraft => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  description: category.description,
  imagePath: category.imagePath,
  parentId: category.parentId,
  displayOrder: String(category.displayOrder),
  active: category.active,
  slugTouched: true,
});

const serviceToDraft = (service: CatalogueService): ServiceDraft => ({
  id: service.id,
  name: service.name,
  slug: service.slug,
  categoryId: service.categoryId,
  description: service.description,
  imagePath: service.imagePath,
  pricingType: service.pricingType,
  price: service.pricingType === 'quote' ? '' : String(service.price),
  durationMinutes: String(service.durationMinutes),
  requiredSkillId: service.requiredSkillId,
  popularRank: service.popularRank === null ? '' : String(service.popularRank),
  tag: service.tag ?? '',
  active: service.active,
  slugTouched: true,
});

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function CataloguePage({ notify }: { notify: (message: string) => void }) {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'hidden'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [editor, setEditor] = useState<Editor>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [pricingChangeWarning, setPricingChangeWarning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCatalogue(await loadCatalogue());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not read the catalogue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const categories = catalogue?.categories ?? [];
  const services = catalogue?.services ?? [];

  const matches = useCallback(
    (item: { name: string; slug: string; description: string; active: boolean }) => {
      if (activeFilter === 'active' && !item.active) return false;
      if (activeFilter === 'hidden' && item.active) return false;
      const term = query.trim().toLowerCase();
      if (!term) return true;
      return `${item.name} ${item.slug} ${item.description}`.toLowerCase().includes(term);
    },
    [activeFilter, query],
  );

  const filteredCategories = useMemo(() => {
    const keep = new Set(categories.filter((category) => matches(category)).map((category) => category.id));
    // Keep the ancestors of a matching child so the tree does not lose its root.
    const byId = new Map(categories.map((category) => [category.id, category]));
    for (const id of [...keep]) {
      let parentId = byId.get(id)?.parentId ?? null;
      while (parentId && !keep.has(parentId)) {
        keep.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
    }
    return categories.filter((category) => keep.has(category.id));
  }, [categories, matches]);

  const filteredServices = useMemo(
    () =>
      services.filter(
        (service) =>
          matches(service) && (selectedCategoryId === 'all' || service.categoryId === selectedCategoryId),
      ),
    [services, matches, selectedCategoryId],
  );

  const categoryName = (id: string): string =>
    categories.find((category) => category.id === id)?.name ?? 'Uncategorised';

  const serviceCount = (categoryId: string): number =>
    services.filter((service) => service.categoryId === categoryId).length;

  /** A category cannot be its own parent or sit under one of its own children. */
  const descendantIds = (id: string): Set<string> => {
    const found = new Set<string>();
    const walk = (parentId: string) => {
      for (const category of categories) {
        if (category.parentId === parentId && !found.has(category.id)) {
          found.add(category.id);
          walk(category.id);
        }
      }
    };
    walk(id);
    return found;
  };

  const toggleActive = async (kind: 'category' | 'service', id: string, active: boolean) => {
    const item = kind === 'category' ? categories.find((row) => row.id === id) : services.find((row) => row.id === id);
    try {
      if (kind === 'category') await setCategoryActive(id, active);
      else await setServiceActive(id, active);
      await refresh();
      notify(
        item
          ? `${item.name} ${active ? 'is live in the customer catalogue' : 'is hidden from customers'}.`
          : 'Catalogue updated.',
      );
    } catch (toggleError) {
      notify(toggleError instanceof Error ? `Update failed: ${toggleError.message}` : 'Update failed.');
    }
  };

  const uploadImage = async (file: File) => {
    if (!editor) return;
    const draft = editor.draft;
    setUploading(true);
    setFormError('');
    try {
      const path = await uploadCatalogueImage(
        file,
        editor.kind,
        draft.slug || slugify(draft.name) || 'image',
      );
      setEditor({ ...editor, draft: { ...draft, imagePath: path } } as Editor);
    } catch (uploadError) {
      setFormError(uploadError instanceof Error ? uploadError.message : 'The image could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (confirmPricingChange = false) => {
    if (!editor) return;
    setFormError('');

    const name = editor.draft.name.trim();
    const slug = editor.draft.slug.trim();
    if (!name) return setFormError('Give this item a name.');
    if (!slugPattern.test(slug)) {
      return setFormError('The slug can only use lowercase letters, numbers and single dashes.');
    }

    // Past bookings keep the pricing mode and price they were booked with, so the
    // change only shifts how new bookings are priced. Warn before it lands.
    if (editor.kind === 'service' && editor.draft.id && !confirmPricingChange) {
      const original = services.find((service) => service.id === editor.draft.id);
      if (original && original.pricingType !== editor.draft.pricingType) {
        setPricingChangeWarning(
          `Pricing changes from ${pricingLabels[original.pricingType].toLowerCase()} to ${pricingLabels[
            editor.draft.pricingType
          ].toLowerCase()}. Past bookings keep their recorded price and mode; only new bookings use the new setting.`,
        );
        return;
      }
    }
    setPricingChangeWarning(null);

    setSaving(true);
    try {
      if (editor.kind === 'category') {
        const draft = editor.draft;
        const order = Number(draft.displayOrder);
        if (!Number.isInteger(order) || order < 0) {
          return setFormError('Display order must be a whole number, 0 or higher.');
        }
        await saveCategory({
          id: draft.id,
          name,
          slug,
          description: draft.description,
          imagePath: draft.imagePath,
          parentId: draft.parentId,
          displayOrder: order,
          active: draft.active,
        });
        notify(`${name} saved.${draft.active ? '' : ' It is hidden from customers.'}`);
      } else {
        const draft = editor.draft;
        const duration = Number(draft.durationMinutes);
        const price = Number(draft.price || 0);
        const rank = draft.popularRank.trim() ? Number(draft.popularRank) : null;
        if (!draft.categoryId) {
          return setFormError('Choose the category this service belongs to.');
        }
        if (!Number.isInteger(duration) || duration <= 0) {
          return setFormError('Duration must be a whole number of minutes.');
        }
        if (draft.pricingType !== 'quote' && (!Number.isFinite(price) || price <= 0)) {
          return setFormError('Enter the price customers will pay.');
        }
        if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 99)) {
          return setFormError('Popular rank must be a whole number between 1 and 99, or left empty.');
        }
        await saveService({
          id: draft.id,
          categoryId: draft.categoryId,
          name,
          slug,
          description: draft.description,
          imagePath: draft.imagePath,
          pricingType: draft.pricingType,
          price,
          durationMinutes: duration,
          requiredSkillId: draft.requiredSkillId,
          popularRank: rank,
          tag: draft.tag,
          active: draft.active,
        });
        notify(`${name} saved.${draft.active ? '' : ' It is hidden from customers.'}`);
      }
      setEditor(null);
      await refresh();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : 'The item could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const activeCategories = categories.filter((category) => category.active).length;
  const activeServices = services.filter((service) => service.active).length;
  const quoteServices = services.filter((service) => service.pricingType === 'quote').length;
  const missingImages = services.filter((service) => !service.imagePath).length;

  const openCategory = (category?: CatalogueCategory) => {
    setFormError('');
    setPricingChangeWarning(null);
    setEditor({
      kind: 'category',
      draft: category
        ? categoryToDraft(category)
        : blankCategoryDraft(categories.length ? Math.max(...categories.map((row) => row.displayOrder)) + 1 : 1),
    });
  };

  const openService = (service?: CatalogueService) => {
    setFormError('');
    setPricingChangeWarning(null);
    const defaultCategory =
      selectedCategoryId !== 'all' ? selectedCategoryId : (categories[0]?.id ?? '');
    setEditor({
      kind: 'service',
      draft: service ? serviceToDraft(service) : blankServiceDraft(defaultCategory),
    });
  };

  // Reordering only makes sense on the unfiltered tree; filtered rows are not siblings.
  const canReorder = query.trim() === '' && activeFilter === 'all';

  const moveCategory = async (draggedId: string, targetId: string) => {
    const dragged = categories.find((category) => category.id === draggedId);
    const target = categories.find((category) => category.id === targetId);
    if (!dragged || !target || dragged.id === target.id) return;
    if (dragged.parentId !== target.parentId) {
      notify('Drag within a level, or change the parent in the category editor.');
      return;
    }

    const siblings = categories.filter((category) => category.parentId === dragged.parentId);
    const from = siblings.findIndex((category) => category.id === dragged.id);
    const to = siblings.findIndex((category) => category.id === target.id);
    if (from < 0 || to < 0 || from === to) return;

    const ordered = [...siblings];
    ordered.splice(to, 0, ...ordered.splice(from, 1));
    const updates = ordered
      .map((category, index) => ({ category, displayOrder: (index + 1) * 10 }))
      .filter(({ category, displayOrder }) => category.displayOrder !== displayOrder)
      .map(({ category, displayOrder }) => ({ id: category.id, displayOrder }));
    if (updates.length === 0) return;

    try {
      await saveCategoryOrder(updates);
      await refresh();
      notify(`${dragged.name} moved.`);
    } catch (reorderError) {
      notify(reorderError instanceof Error ? `Reorder failed: ${reorderError.message}` : 'Reorder failed.');
    }
  };

  const renderCategoryRow = (category: CatalogueCategory, depth: number) => {
    const children = categories.filter((row) => row.parentId === category.id);
    const isOpen = expanded[category.id] ?? true;
    const isSelected = selectedCategoryId === category.id;
    return (
      <div key={category.id}>
        <div
          className={cx(
            'cat-row',
            isSelected && 'cat-row-active',
            dragId === category.id && 'cat-row-dragging',
            dragOverId === category.id && 'cat-row-over',
          )}
          style={{ paddingLeft: depth * 14 }}
          draggable={canReorder}
          onDragStart={(event) => {
            setDragId(category.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', category.id);
          }}
          onDragOver={(event) => {
            if (!canReorder || !dragId || dragId === category.id) return;
            event.preventDefault();
            setDragOverId(category.id);
          }}
          onDragLeave={() =>
            setDragOverId((current) => (current === category.id ? null : current))
          }
          onDrop={(event) => {
            event.preventDefault();
            const id = dragId ?? event.dataTransfer.getData('text/plain');
            setDragId(null);
            setDragOverId(null);
            if (id) void moveCategory(id, category.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setDragOverId(null);
          }}
        >
          {canReorder ? (
            <span className="cat-grip" aria-hidden="true">
              ⋮⋮
            </span>
          ) : null}
          {children.length > 0 ? (
            <button
              type="button"
              className="cat-caret"
              aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${category.name}`}
              onClick={() => setExpanded((current) => ({ ...current, [category.id]: !isOpen }))}
            >
              <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={13} />
            </button>
          ) : (
            <span className="cat-caret" />
          )}
          <button
            type="button"
            className="cat-select"
            onClick={() => setSelectedCategoryId(isSelected ? 'all' : category.id)}
          >
            <span>
              <strong>{category.name}</strong>
              <small>
                {category.slug} · {serviceCount(category.id)} service
                {serviceCount(category.id) === 1 ? '' : 's'}
              </small>
            </span>
            <StatusChip label={category.active ? 'Live' : 'Hidden'} tone={category.active ? 'success' : 'neutral'} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label={`Edit ${category.name}`}
            onClick={() => openCategory(category)}
          >
            <Icon name="settings" size={15} />
          </button>
        </div>
        {children.length > 0 && isOpen
          ? children.map((child) => renderCategoryRow(child, depth + 1))
          : null}
      </div>
    );
  };

  return (
    <div className="page catalogue-page">
      <PageHeader
        eyebrow="Catalogue"
        title="Service catalogue"
        subtitle="Categories and services the customer app books from. Hiding an item keeps its history intact."
        actions={
          <>
            <Button icon="refresh" disabled={loading} onClick={() => void refresh()}>
              {loading ? 'Refreshing…' : 'Reload'}
            </Button>
            <Button icon="plus" onClick={() => openCategory()}>
              Add category
            </Button>
            <Button variant="primary" icon="plus" onClick={() => openService()}>
              Add service
            </Button>
          </>
        }
      />

      <div className="kpis">
        <KpiCard
          label="Categories live"
          value={`${activeCategories}/${categories.length}`}
          detail="Hidden categories leave the catalogue"
          icon="services"
        />
        <KpiCard
          label="Services live"
          value={`${activeServices}/${services.length}`}
          detail="Bookable in the customer app"
          icon="bookings"
          tone="blue"
        />
        <KpiCard
          label="Quote-only services"
          value={String(quoteServices)}
          detail="Priced after inspection"
          icon="reports"
          tone="yellow"
        />
        <KpiCard
          label="Missing images"
          value={String(missingImages)}
          detail="Services still using the bundled art"
          icon="image"
          tone="rose"
        />
      </div>

      {error ? (
        <section className="card restricted" role="alert">
          <h2>Could not load the catalogue</h2>
          <p>{error}</p>
          <Button variant="primary" onClick={() => void refresh()}>
            Try again
          </Button>
        </section>
      ) : null}

      <div className="filter-bar">
        <label className="search-field">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search categories and services"
            aria-label="Search the catalogue"
          />
        </label>
        <span className="select-field">
          <select
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value as typeof activeFilter)}
            aria-label="Filter by visibility"
          >
            <option value="all">All items</option>
            <option value="active">Live only</option>
            <option value="hidden">Hidden only</option>
          </select>
        </span>
        {selectedCategoryId !== 'all' ? (
          <Button className="clear-filters" onClick={() => setSelectedCategoryId('all')}>
            Clear category filter
          </Button>
        ) : null}
        <span className="filter-note">
          {filteredServices.length} service{filteredServices.length === 1 ? '' : 's'} shown
        </span>
      </div>

      <div className="forms-layout">
        <aside className="forms-rail">
          <SectionCard
            title="Categories"
            meta={
              canReorder
                ? 'Drag a row to reorder it within its level; parents group the tree'
                : 'Parent categories group the tree'
            }
            action={
              <Button className="btn-small" icon="plus" onClick={() => openCategory()}>
                Add
              </Button>
            }
          >
            <div className="stack-list">
              <button
                type="button"
                className={cx('cat-row', 'cat-row-all', selectedCategoryId === 'all' && 'cat-row-active')}
                onClick={() => setSelectedCategoryId('all')}
              >
                <span className="cat-caret" />
                <span className="cat-select">
                  <span>
                    <strong>All services</strong>
                    <small>{services.length} in the catalogue</small>
                  </span>
                </span>
              </button>
              {filteredCategories
                .filter((category) => !category.parentId || !categories.some((row) => row.id === category.parentId))
                .map((category) => renderCategoryRow(category, 0))}
              {filteredCategories.length === 0 && categories.length > 0 ? (
                <p className="field-note">
                  <Icon name="search" size={14} />
                  No categories match this filter.
                </p>
              ) : null}
            </div>
          </SectionCard>

          <div className="source-card">
            <span className="source-icon">
              <Icon name="alert" size={18} />
            </span>
            <div>
              <strong>Deactivate, do not delete</strong>
              <p>
                Hiding a service or category removes it from new bookings. Past bookings, quotes and
                form snapshots keep pointing at it.
              </p>
            </div>
          </div>
        </aside>

        <div className="forms-main">
          <SectionCard
            title={selectedCategoryId === 'all' ? 'All services' : categoryName(selectedCategoryId)}
            meta="Pricing mode decides whether the customer pays, sees an hourly rate or requests a quote"
            action={
              <Button className="btn-small" icon="plus" onClick={() => openService()}>
                Add service
              </Button>
            }
          >
            {loading && !catalogue ? (
              <p className="page-loading" role="status">
                Loading the catalogue…
              </p>
            ) : filteredServices.length === 0 ? (
              <EmptyState
                icon="services"
                title="No services here"
                detail={
                  query || activeFilter !== 'all' || selectedCategoryId !== 'all'
                    ? 'Change the filters or add a service to this category.'
                    : 'Add the first service so customers can book it.'
                }
                action={
                  <Button variant="primary" icon="plus" onClick={() => openService()}>
                    Add service
                  </Button>
                }
              />
            ) : (
              <div className="table-scroll" role="region" aria-label="Catalogue services" tabIndex={0}>
                <table className="table" aria-label="Catalogue services">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Category</th>
                      <th>Pricing</th>
                      <th>Duration</th>
                      <th>Skill</th>
                      <th>Live</th>
                      <th className="align-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServices.map((service) => {
                      const url = catalogueImageUrl(service.imagePath);
                      return (
                        <tr key={service.id}>
                          <td>
                            <div className="cell-person">
                              {url ? (
                                <img className="catalogue-thumb" src={url} alt="" />
                              ) : (
                                <span className="catalogue-thumb catalogue-thumb-empty">
                                  <Icon name="image" size={15} />
                                </span>
                              )}
                              <span className="cell-main">
                                <strong>{service.name}</strong>
                                <span className="cell-sub">
                                  {service.slug}
                                  {service.tag ? ` · ${service.tag}` : ''}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td>{categoryName(service.categoryId)}</td>
                          <td>
                            <span className="cell-main price-cell">
                              <strong>{priceLabel(service)}</strong>
                              <span className="cell-sub">{pricingLabels[service.pricingType]}</span>
                            </span>
                          </td>
                          <td className="nowrap">{service.durationMinutes} min</td>
                          <td>
                            {catalogue?.skills.find((skill) => skill.id === service.requiredSkillId)?.name ??
                              'Any'}
                          </td>
                          <td>
                            <Toggle
                              checked={service.active}
                              label={`${service.active ? 'Hide' : 'Show'} ${service.name}`}
                              onChange={(next) => void toggleActive('service', service.id, next)}
                            />
                          </td>
                          <td>
                            <div className="row-actions">
                              <Button className="btn-small" onClick={() => openService(service)}>
                                Edit
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <Modal
        open={editor !== null}
        wide
        title={
          editor?.kind === 'category'
            ? editor.draft.id
              ? 'Edit category'
              : 'New category'
            : editor?.kind === 'service'
              ? editor.draft.id
                ? 'Edit service'
                : 'New service'
              : ''
        }
        description={
          editor?.kind === 'category'
            ? 'The category groups services and owns their default booking form.'
            : 'What the customer app shows on the service card and detail page.'
        }
        onClose={() => setEditor(null)}
        footer={
          <>
            <Button onClick={() => setEditor(null)}>Cancel</Button>
            {pricingChangeWarning ? (
              <Button
                variant="primary"
                icon="check"
                disabled={saving || uploading}
                onClick={() => void submit(true)}
              >
                {saving ? 'Saving…' : 'Save anyway'}
              </Button>
            ) : (
              <Button variant="primary" icon="check" disabled={saving || uploading} onClick={() => void submit()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            )}
          </>
        }
      >
        {editor?.kind === 'category' ? (
          <div className="form-grid">
            <Field label="Name" hint="Shown in the category chips and page title">
              <input
                className="text-input"
                value={editor.draft.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setEditor({
                    ...editor,
                    draft: {
                      ...editor.draft,
                      name,
                      slug: editor.draft.slugTouched ? editor.draft.slug : slugify(name),
                    },
                  });
                }}
              />
            </Field>
            <Field label="Slug" hint="Used by the mobile app routes; changing it breaks saved links">
              <input
                className="text-input"
                value={editor.draft.slug}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    draft: { ...editor.draft, slug: event.target.value, slugTouched: true },
                  })
                }
              />
            </Field>
            <Field label="Parent category" hint="Leave empty for a top-level category">
              <span className="select-field">
                <select
                  value={editor.draft.parentId ?? ''}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      draft: { ...editor.draft, parentId: event.target.value || null },
                    })
                  }
                >
                  <option value="">Top level</option>
                  {categories
                    .filter(
                      (category) =>
                        category.id !== editor.draft.id &&
                        !(editor.draft.id && descendantIds(editor.draft.id).has(category.id)),
                    )
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </span>
            </Field>
            <Field label="Display order" hint="Lower numbers appear first">
              <input
                className="text-input"
                type="number"
                min="0"
                value={editor.draft.displayOrder}
                onChange={(event) =>
                  setEditor({ ...editor, draft: { ...editor.draft, displayOrder: event.target.value } })
                }
              />
            </Field>
            <Field label="Description" hint="Short line under the category name">
              <textarea
                className="textarea"
                rows={3}
                value={editor.draft.description}
                onChange={(event) =>
                  setEditor({ ...editor, draft: { ...editor.draft, description: event.target.value } })
                }
              />
            </Field>
            <Field label="Image" hint="JPEG, PNG, WebP or SVG up to 2 MB">
              <div className="image-field">
                {catalogueImageUrl(editor.draft.imagePath) ? (
                  <img
                    className="image-field-preview"
                    src={catalogueImageUrl(editor.draft.imagePath) ?? ''}
                    alt=""
                  />
                ) : (
                  <span className="image-field-preview image-field-empty">
                    <Icon name="image" size={20} />
                  </span>
                )}
                <div className="image-field-actions">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadImage(file);
                      event.target.value = '';
                    }}
                  />
                  <Button
                    icon="image"
                    disabled={uploading}
                    onClick={() => fileInput.current?.click()}
                  >
                    {uploading ? 'Uploading…' : 'Upload image'}
                  </Button>
                  {editor.draft.imagePath ? (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setEditor({ ...editor, draft: { ...editor.draft, imagePath: null } })
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </Field>
            <div className="inline-field">
              <span>Visible to customers</span>
              <Toggle
                checked={editor.draft.active}
                label="Category visible to customers"
                onChange={(next) => setEditor({ ...editor, draft: { ...editor.draft, active: next } })}
              />
            </div>
            {formError ? (
              <p className="form-error">
                <Icon name="alert" size={14} />
                {formError}
              </p>
            ) : null}
          </div>
        ) : null}

        {editor?.kind === 'service' ? (
          <div className="form-grid">
            <Field label="Name">
              <input
                className="text-input"
                value={editor.draft.name}
                onChange={(event) => {
                  const name = event.target.value;
                  setEditor({
                    ...editor,
                    draft: {
                      ...editor.draft,
                      name,
                      slug: editor.draft.slugTouched ? editor.draft.slug : slugify(name),
                    },
                  });
                }}
              />
            </Field>
            <Field label="Slug" hint="Client route and API key for this service">
              <input
                className="text-input"
                value={editor.draft.slug}
                onChange={(event) =>
                  setEditor({
                    ...editor,
                    draft: { ...editor.draft, slug: event.target.value, slugTouched: true },
                  })
                }
              />
            </Field>
            <Field label="Category" hint="Controls grouping and the inherited booking form">
              <span className="select-field">
                <select
                  value={editor.draft.categoryId}
                  onChange={(event) =>
                    setEditor({ ...editor, draft: { ...editor.draft, categoryId: event.target.value } })
                  }
                >
                  <option value="">Choose a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.active ? '' : ' (hidden)'}
                    </option>
                  ))}
                </select>
              </span>
            </Field>
            <Field label="Required skill" hint="Availability only counts technicians with this skill">
              <span className="select-field">
                <select
                  value={editor.draft.requiredSkillId ?? ''}
                  onChange={(event) =>
                    setEditor({
                      ...editor,
                      draft: { ...editor.draft, requiredSkillId: event.target.value || null },
                    })
                  }
                >
                  <option value="">Any technician</option>
                  {(catalogue?.skills ?? []).map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </select>
              </span>
            </Field>
            <Field label="Pricing mode" hint="Hourly services are quoted from hours; quote-only services price after inspection">
              <div className="segmented">
                {(Object.keys(pricingLabels) as PricingType[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={cx('segmented-btn', editor.draft.pricingType === mode && 'segmented-btn-on')}
                    onClick={() =>
                      setEditor({ ...editor, draft: { ...editor.draft, pricingType: mode } })
                    }
                  >
                    {pricingLabels[mode]}
                  </button>
                ))}
              </div>
            </Field>
            <Field
              label={editor.draft.pricingType === 'hourly' ? 'Hourly rate (UGX)' : 'Price (UGX)'}
              hint={editor.draft.pricingType === 'quote' ? 'Quote services carry no price' : undefined}
            >
              <input
                className="text-input"
                type="number"
                min="0"
                step="500"
                disabled={editor.draft.pricingType === 'quote'}
                value={editor.draft.pricingType === 'quote' ? '' : editor.draft.price}
                onChange={(event) =>
                  setEditor({ ...editor, draft: { ...editor.draft, price: event.target.value } })
                }
              />
            </Field>
            <Field label="Duration (minutes)" hint="Default job length used for scheduling and slots">
              <input
                className="text-input"
                type="number"
                min="15"
                step="15"
                value={editor.draft.durationMinutes}
                onChange={(event) =>
                  setEditor({ ...editor, draft: { ...editor.draft, durationMinutes: event.target.value } })
                }
              />
            </Field>
            <Field label="Popular rank" hint="1–6 puts the service in the Home popular row; empty keeps it out">
              <input
                className="text-input"
                type="number"
                min="1"
                max="99"
                value={editor.draft.popularRank}
                onChange={(event) =>
                  setEditor({ ...editor, draft: { ...editor.draft, popularRank: event.target.value } })
                }
              />
            </Field>
            <Field label="Tag" hint="Optional badge, e.g. Popular or New">
              <input
                className="text-input"
                value={editor.draft.tag}
                onChange={(event) =>
                  setEditor({ ...editor, draft: { ...editor.draft, tag: event.target.value } })
                }
              />
            </Field>
            <Field label="Description" hint="One line shown on the service card">
              <textarea
                className="textarea"
                rows={3}
                value={editor.draft.description}
                onChange={(event) =>
                  setEditor({ ...editor, draft: { ...editor.draft, description: event.target.value } })
                }
              />
            </Field>
            <Field label="Image" hint="JPEG, PNG, WebP or SVG up to 2 MB">
              <div className="image-field">
                {catalogueImageUrl(editor.draft.imagePath) ? (
                  <img
                    className="image-field-preview"
                    src={catalogueImageUrl(editor.draft.imagePath) ?? ''}
                    alt=""
                  />
                ) : (
                  <span className="image-field-preview image-field-empty">
                    <Icon name="image" size={20} />
                  </span>
                )}
                <div className="image-field-actions">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadImage(file);
                      event.target.value = '';
                    }}
                  />
                  <Button
                    icon="image"
                    disabled={uploading}
                    onClick={() => fileInput.current?.click()}
                  >
                    {uploading ? 'Uploading…' : 'Upload image'}
                  </Button>
                  {editor.draft.imagePath ? (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setEditor({ ...editor, draft: { ...editor.draft, imagePath: null } })
                      }
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>
            </Field>
            <div className="inline-field">
              <span>Visible to customers</span>
              <Toggle
                checked={editor.draft.active}
                label="Service visible to customers"
                onChange={(next) => setEditor({ ...editor, draft: { ...editor.draft, active: next } })}
              />
            </div>
            {pricingChangeWarning ? (
              <p className="form-warning">
                <Icon name="alert" size={14} />
                {pricingChangeWarning}
              </p>
            ) : null}
            {formError ? (
              <p className="form-error">
                <Icon name="alert" size={14} />
                {formError}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
