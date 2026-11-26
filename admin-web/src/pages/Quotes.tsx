import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from '../components/ui';
import type { AdminUser } from '../lib/auth';
import { cx, formatDateTime, ugx } from '../lib/format';
import {
  addInspectionAddendum,
  loadQuoteQueue,
  requestInspection,
  scheduleInspection,
  sendQuote,
  type InspectionRow,
  type QuoteQueue,
  type QuoteRow,
  type QuoteStatus,
} from '../lib/quotes';

const statusLabels: Record<QuoteStatus, string> = {
  requested: 'Requested',
  inspection_required: 'Inspection needed',
  inspection_scheduled: 'Inspection booked',
  inspected: 'Inspected',
  quoted: 'Quote sent',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
};

const statusTones: Record<QuoteStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  requested: 'warning',
  inspection_required: 'warning',
  inspection_scheduled: 'info',
  inspected: 'info',
  quoted: 'info',
  accepted: 'success',
  declined: 'neutral',
  expired: 'neutral',
};

const inspectionLabels: Record<InspectionRow['status'], string> = {
  required: 'Needs scheduling',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  submitted: 'Report in',
  withdrawn: 'Withdrawn',
};

type Filter = 'open' | 'quoted' | 'closed' | 'all';

const openStatuses: QuoteStatus[] = [
  'requested',
  'inspection_required',
  'inspection_scheduled',
  'inspected',
];

const matchesFilter = (status: QuoteStatus, filter: Filter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'open') return openStatuses.includes(status);
  if (filter === 'quoted') return status === 'quoted';
  return status === 'accepted' || status === 'declined' || status === 'expired';
};

const toLocalDateTime = (iso: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const latestInspection = (inspections: InspectionRow[], quoteId: string): InspectionRow | null =>
  inspections.find((row) => row.quoteId === quoteId) ?? null;

export function QuotesPage({
  user,
  notify,
  refreshKey,
}: {
  user: AdminUser;
  notify: (message: string) => void;
  refreshKey?: number;
}) {
  const [queue, setQueue] = useState<QuoteQueue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [inspectionNote, setInspectionNote] = useState('');
  const [inspectorId, setInspectorId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [addendum, setAddendum] = useState('');
  const [savingAddendum, setSavingAddendum] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await loadQuoteQueue());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not read the quote queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const quotes = queue?.quotes ?? [];
  const canWrite = user.role === 'admin' || user.role === 'operations';
  const selected = quotes.find((quote) => quote.id === selectedId) ?? null;
  const selectedBooking = selected ? queue?.bookings[selected.bookingId] : undefined;
  const selectedInspection = selected && queue ? latestInspection(queue.inspections, selected.id) : null;
  const hasSentQuote = selected !== null && (selected.quotedAt !== null || selected.amount !== null);

  const openQuote = (quote: QuoteRow) => {
    setFormError('');
    setAddendum('');
    setSelectedId(quote.id);
    setDescription(quote.description);
    setAmount(quote.amount === null ? '' : String(quote.amount));
    setExpiresAt(quote.expiresAt ? quote.expiresAt.slice(0, 10) : '');
    setInspectionNote('');
    const inspection = queue ? latestInspection(queue.inspections, quote.id) : null;
    setInspectorId(inspection?.inspectorId ?? '');
    setScheduledAt(toLocalDateTime(inspection?.scheduledAt ?? null));
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotes.filter((quote) => {
      if (!matchesFilter(quote.status, filter)) return false;
      if (!term) return true;
      const booking = queue?.bookings[quote.bookingId];
      return `${booking?.reference ?? ''} ${booking?.customerName ?? ''} ${booking?.serviceName ?? ''} ${
        booking?.area ?? ''
      }`
        .toLowerCase()
        .includes(term);
    });
  }, [quotes, filter, search, queue]);

  const awaitingPrice = quotes.filter((quote) => openStatuses.includes(quote.status)).length;
  const quoted = quotes.filter((quote) => quote.status === 'quoted').length;
  const inspectionsToBook = (queue?.inspections ?? []).filter((row) => row.status === 'required').length;
  const accepted = quotes.filter((quote) => quote.status === 'accepted').length;

  const run = async (action: () => Promise<void>, message: string) => {
    setSaving(true);
    setFormError('');
    try {
      await action();
      await refresh();
      notify(message);
    } catch (actionError) {
      setFormError(actionError instanceof Error ? actionError.message : 'That update failed.');
    } finally {
      setSaving(false);
    }
  };

  const submitQuote = () => {
    if (!selected) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError('Enter the amount the customer will pay.');
      return;
    }
    void run(
      async () => {
        await sendQuote(selected.id, {
          description,
          amount: value,
          expiresAt: expiresAt ? `${expiresAt}T23:59:00+03:00` : null,
          preparedBy: user.id,
        });
      },
      `Quote sent for ${selectedBooking?.reference ?? 'the booking'}.`,
    );
  };

  const addInspection = () => {
    if (!selected) return;
    void run(
      async () => {
        await requestInspection({
          quoteId: selected.id,
          bookingId: selected.bookingId,
          note: inspectionNote,
          requiredBy: user.id,
        });
      },
      'Inspection requested.',
    );
  };

  const submitAddendum = async () => {
    if (!selectedInspection) return;
    setSavingAddendum(true);
    setFormError('');
    try {
      await addInspectionAddendum({
        inspectionId: selectedInspection.id,
        authorId: user.id,
        note: addendum,
      });
      setAddendum('');
      await refresh();
      notify('Addendum saved on the report.');
    } catch (addendumError) {
      setFormError(
        addendumError instanceof Error ? addendumError.message : 'The addendum was not saved.',
      );
    } finally {
      setSavingAddendum(false);
    }
  };

  const saveSchedule = () => {
    if (!selected || !selectedInspection) return;
    if (!inspectorId) {
      setFormError('Choose the inspector.');
      return;
    }
    if (!scheduledAt) {
      setFormError('Choose the inspection date and time.');
      return;
    }
    void run(
      async () => {
        await scheduleInspection({
          inspectionId: selectedInspection.id,
          quoteId: selected.id,
          inspectorId,
          scheduledAt: new Date(scheduledAt).toISOString(),
        });
      },
      'Inspection scheduled.',
    );
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations"
        title="Quotes & inspections"
        subtitle="Price the jobs the catalogue cannot quote blind, and book the inspections that decide them."
        actions={
          <Button icon="refresh" disabled={loading} onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Reload'}
          </Button>
        }
      />

      <div className="kpis">
        <KpiCard
          label="Awaiting a price"
          value={String(awaitingPrice)}
          detail="Requested, inspected or inspection booked"
          icon="bookings"
          tone="yellow"
        />
        <KpiCard
          label="Quotes with the customer"
          value={String(quoted)}
          detail="Waiting for an answer"
          icon="payments"
          tone="blue"
        />
        <KpiCard
          label="Inspections to book"
          value={String(inspectionsToBook)}
          detail="No inspector or time yet"
          icon="cleaners"
        />
        <KpiCard
          label="Accepted"
          value={String(accepted)}
          detail="Confirmed into the booking flow"
          icon="check"
          tone="rose"
        />
      </div>

      {error ? (
        <section className="card restricted" role="alert">
          <h2>Could not load the quote queue</h2>
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
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reference, customer, service or area"
            aria-label="Search the quote queue"
          />
        </label>
        <label className="select-field">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
            aria-label="Filter quotes"
          >
            <option value="open">Open quotes</option>
            <option value="quoted">With the customer</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </label>
        <span className="filter-note">
          {filtered.length} quote{filtered.length === 1 ? '' : 's'} shown
        </span>
      </div>

      <SectionCard
        title="Quote queue"
        meta="Newest requests first · customer answers arrive in the app"
        action={
          !canWrite ? <StatusChip label="Read-only for support" tone="neutral" /> : undefined
        }
      >
        {loading && !queue ? (
          <p className="page-loading" role="status">
            Loading quotes…
          </p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="payments"
            title="Nothing in this view"
            detail={
              search || filter !== 'all'
                ? 'Change the filter or search term to see more quotes.'
                : 'Quote requests appear here as soon as a customer asks for one.'
            }
          />
        ) : (
          <div className="table-scroll" role="region" aria-label="Quote queue" tabIndex={0}>
            <table className="table" aria-label="Quote queue">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Requested</th>
                  <th>Amount</th>
                  <th>Inspection</th>
                  <th>Status</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((quote) => {
                  const booking = queue?.bookings[quote.bookingId];
                  const inspection = queue ? latestInspection(queue.inspections, quote.id) : null;
                  return (
                    <tr key={quote.id}>
                      <td>
                        <span className="cell-main">
                          <strong>{booking?.reference ?? 'Booking'}</strong>
                          <span className="cell-sub">
                            {booking ? formatDateTime(booking.scheduledStart) : '—'}
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="cell-main">
                          <strong>{booking?.customerName ?? 'Customer'}</strong>
                          <span className="cell-sub">{booking?.area ?? '—'}</span>
                        </span>
                      </td>
                      <td>{booking?.serviceName ?? '—'}</td>
                      <td className="nowrap">{formatDateTime(quote.createdAt)}</td>
                      <td>{quote.amount === null ? '—' : ugx(quote.amount)}</td>
                      <td>
                        {inspection ? (
                          <StatusChip
                            label={inspectionLabels[inspection.status]}
                            tone={inspection.status === 'submitted' ? 'success' : 'info'}
                          />
                        ) : (
                          <span className="cell-sub">None</span>
                        )}
                      </td>
                      <td>
                        <StatusChip label={statusLabels[quote.status]} tone={statusTones[quote.status]} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <Button className="btn-small" onClick={() => openQuote(quote)}>
                            {quote.status === 'requested' || quote.status === 'inspection_required'
                              ? 'Prepare'
                              : 'Open'}
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

      <Modal
        open={selected !== null}
        wide
        title={`Quote${selectedBooking ? ` · ${selectedBooking.reference}` : ''}`}
        description="Priced quotes are sent to the customer; inspections are booked when the job cannot be priced from the submission."
        onClose={() => setSelectedId(null)}
        footer={
          <>
            <Button onClick={() => setSelectedId(null)}>Close</Button>
            {canWrite && selected && !hasSentQuote ? (
              <Button variant="primary" icon="check" disabled={saving} onClick={submitQuote}>
                {saving ? 'Saving…' : 'Send quote'}
              </Button>
            ) : null}
          </>
        }
      >
        {selected && selectedBooking ? (
          <div className="quote-detail">
            <div className="quote-facts">
              <div>
                <span>Customer</span>
                <strong>{selectedBooking.customerName}</strong>
                <small>{selectedBooking.phone}</small>
              </div>
              <div>
                <span>Service</span>
                <strong>{selectedBooking.serviceName}</strong>
                <small>{selectedBooking.area}</small>
              </div>
              <div>
                <span>Scheduled</span>
                <strong>{formatDateTime(selectedBooking.scheduledStart)}</strong>
                <small>Booking total {ugx(selectedBooking.total)}</small>
              </div>
              <div>
                <span>State</span>
                <StatusChip label={statusLabels[selected.status]} tone={statusTones[selected.status]} />
                <small>Requested {formatDateTime(selected.createdAt)}</small>
              </div>
            </div>

            {hasSentQuote && selected.amount !== null ? (
              <div className="quote-sent">
                <p>
                  <strong>{ugx(selected.amount)}</strong> sent {selected.quotedAt ? formatDateTime(selected.quotedAt) : ''}
                  {selected.expiresAt ? ` · expires ${formatDateTime(selected.expiresAt)}` : ''}
                </p>
                {selected.description ? <p className="quote-note">{selected.description}</p> : null}
              </div>
            ) : (
              <div className="form-grid">
                <Field label="Amount (UGX)" hint="What the customer pays once they accept">
                  <input
                    className="text-input"
                    type="number"
                    min="0"
                    step="500"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </Field>
                <Field label="Quote expires" hint="Optional; the customer sees this deadline">
                  <input
                    className="text-input"
                    type="date"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                  />
                </Field>
                <Field label="What the quote covers" hint="Shown with the amount in the app">
                  <textarea
                    className="textarea"
                    rows={3}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>
              </div>
            )}

            <SectionCard
              title="Inspection"
              meta="One active inspection per quote · the technician submits the report in the ERP app"
            >
              {selectedInspection ? (
                <div className="inspection-block">
                  <div className="quote-facts">
                    <div>
                      <span>State</span>
                      <StatusChip
                        label={inspectionLabels[selectedInspection.status]}
                        tone={selectedInspection.status === 'submitted' ? 'success' : 'info'}
                      />
                    </div>
                    <div>
                      <span>Inspector</span>
                      <strong>
                        {queue?.inspectors.find((inspector) => inspector.id === selectedInspection.inspectorId)
                          ?.name ?? 'Not assigned'}
                      </strong>
                    </div>
                    <div>
                      <span>Scheduled</span>
                      <strong>
                        {selectedInspection.scheduledAt
                          ? formatDateTime(selectedInspection.scheduledAt)
                          : 'Not booked'}
                      </strong>
                    </div>
                    {selectedInspection.status === 'submitted' ? (
                      <div>
                        <span>Recommendation</span>
                        <strong>
                          {selectedInspection.recommendedHours
                            ? `${selectedInspection.recommendedHours} h`
                            : 'No hours given'}
                          {selectedInspection.recommendedCrew
                            ? ` · ${selectedInspection.recommendedCrew} cleaner${
                                selectedInspection.recommendedCrew === 1 ? '' : 's'
                              }`
                            : ''}
                        </strong>
                      </div>
                    ) : null}
                  </div>
                  {selectedInspection.requiredNote ? (
                    <p className="field-note">
                      <Icon name="alert" size={14} />
                      {selectedInspection.requiredNote}
                    </p>
                  ) : null}
                  {canWrite && selectedInspection.status !== 'submitted' ? (
                    <div className="form-grid">
                      <Field label="Inspector">
                        <span className="select-field">
                          <select
                            value={inspectorId}
                            onChange={(event) => setInspectorId(event.target.value)}
                          >
                            <option value="">Choose an inspector</option>
                            {(queue?.inspectors ?? []).map((inspector) => (
                              <option key={inspector.id} value={inspector.id}>
                                {inspector.name}
                              </option>
                            ))}
                          </select>
                        </span>
                      </Field>
                      <Field label="Inspection date and time">
                        <input
                          className="text-input"
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(event) => setScheduledAt(event.target.value)}
                        />
                      </Field>
                      <div className="inline-field">
                        <span>Save the schedule</span>
                        <Button icon="check" disabled={saving} onClick={saveSchedule}>
                          Save schedule
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {selectedInspection.status === 'submitted' ? (
                    <div className="inspection-report">
                      <p className="inspection-report-meta">
                        Report submitted{' '}
                        {selectedInspection.submittedAt
                          ? formatDateTime(selectedInspection.submittedAt)
                          : 'from the ERP app'}
                      </p>
                      {selectedInspection.notes ? (
                        <p className="quote-note">{selectedInspection.notes}</p>
                      ) : null}
                      {selectedInspection.checklist.length ? (
                        <ul className="inspection-checks">
                          {selectedInspection.checklist.map((item) => (
                            <li
                              key={item.label}
                              className={cx(
                                'inspection-check',
                                item.status === 'issue' && 'inspection-check-issue',
                              )}
                            >
                              <Icon name={item.status === 'issue' ? 'alert' : 'check'} size={13} />
                              {item.label}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {Object.keys(selectedInspection.measurements).length ? (
                        <div className="inspection-measures">
                          {Object.entries(selectedInspection.measurements).map(([label, value]) => (
                            <span key={label}>
                              <strong>{label}</strong>
                              {String(value)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {selectedInspection.media.length ? (
                        <div className="inspection-photos">
                          {selectedInspection.media.map((item) =>
                            item.url && item.kind === 'video' ? (
                              <video
                                key={item.id}
                                className="inspection-video"
                                src={item.url}
                                controls
                                preload="metadata"
                                aria-label={item.caption || 'Inspection video'}
                              />
                            ) : item.url ? (
                              <a
                                key={item.id}
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                title={item.caption || 'Inspection photo'}
                              >
                                <img src={item.url} alt={item.caption || 'Inspection photo'} />
                              </a>
                            ) : (
                              <span key={item.id} className="inspection-photo-missing">
                                <Icon name={item.kind === 'video' ? 'camera' : 'image'} size={14} />
                                No preview
                              </span>
                            ),
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedInspection.status === 'submitted' && selectedInspection.addenda.length ? (
                    <div className="inspection-addenda">
                      <p className="inspection-report-meta">
                        Addenda · the report above stays exactly as the inspector sent it
                      </p>
                      <ul>
                        {selectedInspection.addenda.map((entry) => (
                          <li key={entry.id}>
                            <span>{entry.note}</span>
                            <small>
                              {entry.authorName} · {formatDateTime(entry.createdAt)}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {canWrite && selectedInspection.status === 'submitted' ? (
                    <div className="inspection-addendum-form">
                      <Field
                        label="Add an addendum"
                        hint="Kept next to the report; the inspector sees it in the ERP app"
                      >
                        <textarea
                          className="textarea"
                          rows={2}
                          value={addendum}
                          onChange={(event) => setAddendum(event.target.value)}
                          placeholder="What changed since the visit?"
                        />
                      </Field>
                      <div className="inline-field">
                        <span>For corrections the desk and the customer need on record</span>
                        <Button
                          icon="plus"
                          disabled={savingAddendum || !addendum.trim()}
                          onClick={() => void submitAddendum()}
                        >
                          {savingAddendum ? 'Saving…' : 'Save addendum'}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : canWrite ? (
                <div className="form-grid">
                  <Field label="Why is an inspection needed?" hint="Sent to the assigned technician">
                    <textarea
                      className="textarea"
                      rows={3}
                      value={inspectionNote}
                      onChange={(event) => setInspectionNote(event.target.value)}
                    />
                  </Field>
                  <div className="inline-field">
                    <span>Create an inspection for a technician to schedule</span>
                    <Button icon="plus" disabled={saving} onClick={addInspection}>
                      Request inspection
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="field-note">
                  <Icon name="alert" size={14} />
                  No inspection has been requested for this quote.
                </p>
              )}
            </SectionCard>

            {formError ? (
              <p className="form-error">
                <Icon name="alert" size={14} />
                {formError}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="field-note">
            <Icon name="alert" size={14} />
            The booking behind this quote could not be loaded.
          </p>
        )}
      </Modal>
    </div>
  );
}
