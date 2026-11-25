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
import {
  assignBookingTechnician,
  cancelStaffBooking,
  confirmStaffBooking,
  decideCancellation,
  loadApprovalsQueue,
  type ApprovalsQueue,
  type CancellationRequest,
  type PendingBooking,
} from '../lib/approvals';
import { formatDateTime, ugx } from '../lib/format';

type Decision =
  | { kind: 'confirm'; booking: PendingBooking }
  | { kind: 'cancel'; booking: PendingBooking }
  | { kind: 'decide'; request: CancellationRequest; approve: boolean }
  | null;

const sourceLabels: Record<string, string> = {
  staff: 'Desk booking',
  sales: 'Sales proposal',
  app: 'Customer app',
};

const bookingStatusLabels: Record<string, string> = {
  requested: 'Requested',
  awaiting_confirmation: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  scheduled: 'Scheduled',
  on_the_way: 'On the way',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const ageInDays = (iso: string): number => {
  if (!iso) return 0;
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return days < 0 ? 0 : Math.floor(days);
};

export function ApprovalsPage({
  user,
  notify,
}: {
  user: AdminUser;
  notify: (message: string) => void;
}) {
  const [queue, setQueue] = useState<ApprovalsQueue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState<Decision>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [technician, setTechnician] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await loadApprovalsQueue());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not read the decision queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canDecide = user.role === 'admin' || user.role === 'operations';
  const pending = queue?.bookings ?? [];
  const cancellations = queue?.cancellations ?? [];

  const term = search.trim().toLowerCase();
  const matches = (values: string[]): boolean =>
    term === '' || values.join(' ').toLowerCase().includes(term);
  const visibleBookings = useMemo(
    () =>
      pending.filter((booking) =>
        matches([
          booking.reference,
          booking.customerName,
          booking.phone,
          booking.serviceName,
          booking.area,
        ]),
      ),
    // `matches` only depends on the search term above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending, term],
  );
  const visibleCancellations = useMemo(
    () =>
      cancellations.filter((request) =>
        matches([
          request.bookingReference,
          request.customerName,
          request.phone,
          request.reason,
          request.serviceName,
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cancellations, term],
  );

  const valueToConfirm = pending.reduce((sum, booking) => sum + booking.total, 0);
  const oldest = pending.reduce((days, booking) => Math.max(days, ageInDays(booking.createdAt)), 0);

  const openDecision = (next: Decision) => {
    setDecision(next);
    setNote('');
    setReason('');
    setTechnician('');
    setFormError('');
  };

  const submit = async () => {
    if (!decision) return;
    setFormError('');
    setSaving(true);
    try {
      if (decision.kind === 'confirm') {
        await confirmStaffBooking(decision.booking.id, note);
        const chosen = queue?.technicians.find((row) => row.id === technician) ?? null;
        if (chosen) {
          try {
            await assignBookingTechnician(decision.booking.id, chosen.id, 'lead');
            notify(`${decision.booking.reference} confirmed and assigned to ${chosen.name}.`);
          } catch (assignError) {
            notify(
              `${decision.booking.reference} confirmed, but the assignment failed: ${
                assignError instanceof Error ? assignError.message : 'unknown error'
              } Assign from Bookings.`,
            );
          }
        } else {
          notify(`${decision.booking.reference} confirmed.`);
        }
      } else if (decision.kind === 'cancel') {
        if (!reason.trim()) {
          setFormError('Say why this booking is being cancelled.');
          return;
        }
        await cancelStaffBooking(decision.booking.id, reason, note);
        notify(`${decision.booking.reference} cancelled.`);
      } else {
        await decideCancellation(decision.request.id, decision.approve, note);
        notify(
          decision.approve
            ? `${decision.request.bookingReference} cancelled as requested.`
            : `Cancellation of ${decision.request.bookingReference} declined.`,
        );
      }
      setDecision(null);
      await refresh();
    } catch (decisionError) {
      setFormError(decisionError instanceof Error ? decisionError.message : 'That decision failed.');
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = (): string => {
    if (!decision) return '';
    if (decision.kind === 'confirm') return `Confirm ${decision.booking.reference}`;
    if (decision.kind === 'cancel') return `Cancel ${decision.booking.reference}`;
    return decision.approve
      ? `Approve cancellation · ${decision.request.bookingReference}`
      : `Decline cancellation · ${decision.request.bookingReference}`;
  };

  const modalDescription = (): string => {
    if (!decision) return '';
    if (decision.kind === 'confirm') {
      return 'Confirming moves the booking into the schedule and records the decision in its history.';
    }
    if (decision.kind === 'cancel') {
      return 'The booking is cancelled for the customer and the reason is kept with it. Nothing is deleted.';
    }
    return decision.approve
      ? 'Approving cancels the booking and closes the request. The requester sees the decision.'
      : 'Declining leaves the booking as it is and closes the request.';
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations"
        title="Approvals"
        subtitle="Staff-created bookings wait here for a manager, and cancellations raised by the desk need a decision."
        actions={
          <Button icon="refresh" disabled={loading} onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Reload'}
          </Button>
        }
      />

      <div className="kpis">
        <KpiCard
          label="Awaiting confirmation"
          value={String(pending.length)}
          detail="Staff and sales bookings the customer is expecting"
          icon="bookings"
          tone="yellow"
        />
        <KpiCard
          label="Cancellation requests"
          value={String(cancellations.length)}
          detail="Raised by customer relations or sales"
          icon="alert"
          tone="rose"
        />
        <KpiCard
          label="Value to confirm"
          value={ugx(valueToConfirm)}
          detail="Total of the bookings in this queue"
          icon="payments"
          tone="blue"
        />
        <KpiCard
          label="Oldest waiting"
          value={oldest === 0 ? 'Today' : `${oldest} day${oldest === 1 ? '' : 's'}`}
          detail="How long the longest waiting booking needs a decision"
          icon="clock"
        />
      </div>

      {error ? (
        <section className="card restricted" role="alert">
          <h2>Could not load the decision queue</h2>
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
            aria-label="Search the decision queue"
          />
        </label>
        <span className="filter-note">
          {visibleBookings.length + visibleCancellations.length} decision
          {visibleBookings.length + visibleCancellations.length === 1 ? '' : 's'} waiting
        </span>
      </div>

      {!canDecide ? (
        <section className="card restricted" role="alert">
          <h2>Decisions are for managers</h2>
          <p>
            Your role can raise cancellation requests, but only a manager or the owner can confirm or
            cancel a booking.
          </p>
        </section>
      ) : null}

      <SectionCard
        title="Bookings to confirm"
        meta="Oldest first · confirming books the job without touching its price"
      >
        {loading && !queue ? (
          <p className="page-loading" role="status">
            Loading decisions…
          </p>
        ) : visibleBookings.length === 0 ? (
          <EmptyState
            icon="bookings"
            title="No bookings waiting"
            detail={
              pending.length === 0
                ? 'When customer relations or sales book a job for a customer it lands here.'
                : 'No booking matches this search.'
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table" aria-label="Bookings to confirm">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Visit</th>
                  <th>Status</th>
                  <th className="align-right">Total</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>
                      <span className="cell-main">
                        <strong>{booking.reference}</strong>
                        <span className="cell-sub">
                          {sourceLabels[booking.source] ?? 'Staff booking'} ·{' '}
                          {ageInDays(booking.createdAt) === 0
                            ? 'raised today'
                            : `${ageInDays(booking.createdAt)}d ago`}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="cell-main">
                        <strong>{booking.customerName}</strong>
                        <span className="cell-sub">
                          {booking.phone || 'No phone'} · {booking.area}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="cell-main">
                        <strong>{booking.serviceName}</strong>
                        {booking.note ? <span className="cell-sub">{booking.note}</span> : null}
                      </span>
                    </td>
                    <td className="nowrap">{formatDateTime(booking.scheduledStart)}</td>
                    <td>
                      <StatusChip
                        label={bookingStatusLabels[booking.status] ?? booking.status}
                        tone="warning"
                      />
                    </td>
                    <td className="align-right price-cell">{ugx(booking.total)}</td>
                    <td>
                      <div className="row-actions">
                        <Button
                          className="btn-small"
                          variant="primary"
                          icon="check"
                          disabled={!canDecide}
                          onClick={() => openDecision({ kind: 'confirm', booking })}
                        >
                          Confirm
                        </Button>
                        <Button
                          className="btn-small"
                          variant="danger"
                          disabled={!canDecide}
                          onClick={() => openDecision({ kind: 'cancel', booking })}
                        >
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Cancellation requests"
        meta="Approving cancels the booking; declining keeps it and closes the request"
      >
        {loading && !queue ? (
          <p className="page-loading" role="status">
            Loading decisions…
          </p>
        ) : visibleCancellations.length === 0 ? (
          <EmptyState
            icon="check"
            title="Nothing to decide"
            detail={
              cancellations.length === 0
                ? 'Customer relations and sales raise cancellations here when a confirmed job has to change.'
                : 'No request matches this search.'
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="table" aria-label="Cancellation requests">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Reason</th>
                  <th>Requested</th>
                  <th>Booking status</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCancellations.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <span className="cell-main">
                        <strong>{request.bookingReference}</strong>
                        <span className="cell-sub">
                          {request.serviceName} · {formatDateTime(request.scheduledStart)}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="cell-main">
                        <strong>{request.customerName}</strong>
                        <span className="cell-sub">
                          {request.phone || 'No phone'} · {ugx(request.total)}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="cell-main">
                        <strong>{request.reason}</strong>
                        <span className="cell-sub">
                          {request.requestedBy
                            ? (queue?.requesterNames[request.requestedBy] ?? 'Desk')
                            : 'Desk'}
                        </span>
                      </span>
                    </td>
                    <td className="nowrap">{formatDateTime(request.createdAt)}</td>
                    <td>
                      <StatusChip
                        label={bookingStatusLabels[request.bookingStatus] ?? request.bookingStatus}
                        tone="neutral"
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <Button
                          className="btn-small"
                          variant="primary"
                          disabled={!canDecide}
                          onClick={() => openDecision({ kind: 'decide', request, approve: true })}
                        >
                          Approve
                        </Button>
                        <Button
                          className="btn-small"
                          disabled={!canDecide}
                          onClick={() => openDecision({ kind: 'decide', request, approve: false })}
                        >
                          Decline
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        open={decision !== null}
        title={modalTitle()}
        description={modalDescription()}
        onClose={() => setDecision(null)}
        footer={
          <>
            <Button onClick={() => setDecision(null)}>Close</Button>
            <Button
              variant={decision?.kind === 'cancel' || (decision?.kind === 'decide' && decision.approve) ? 'danger' : 'primary'}
              icon="check"
              disabled={saving}
              onClick={() => void submit()}
            >
              {saving
                ? 'Saving…'
                : decision?.kind === 'confirm'
                  ? 'Confirm booking'
                  : decision?.kind === 'cancel'
                    ? 'Cancel booking'
                    : decision?.approve
                      ? 'Approve cancellation'
                      : 'Decline request'}
            </Button>
          </>
        }
      >
        {decision && (decision.kind === 'confirm' || decision.kind === 'cancel') ? (
          <div className="quote-detail">
            <div className="quote-facts">
              <div>
                <span>Customer</span>
                <strong>{decision.booking.customerName}</strong>
                <small>{decision.booking.phone || 'No phone'}</small>
              </div>
              <div>
                <span>Service</span>
                <strong>{decision.booking.serviceName}</strong>
                <small>{decision.booking.area}</small>
              </div>
              <div>
                <span>Visit</span>
                <strong>{formatDateTime(decision.booking.scheduledStart)}</strong>
                <small>{ugx(decision.booking.total)}</small>
              </div>
              <div>
                <span>Source</span>
                <strong>{sourceLabels[decision.booking.source] ?? 'Staff booking'}</strong>
                <small>{bookingStatusLabels[decision.booking.status] ?? decision.booking.status}</small>
              </div>
            </div>

            <div className="form-grid">
              {decision.kind === 'confirm' && (queue?.technicians.length ?? 0) > 0 ? (
                <Field
                  label="Assign a technician"
                  hint="Optional · the booking is confirmed either way; the crew can be set later from Bookings"
                >
                  <select
                    className="input"
                    value={technician}
                    aria-label="Technician for this booking"
                    onChange={(event) => setTechnician(event.target.value)}
                  >
                    <option value="">Assign later</option>
                    {(queue?.technicians ?? []).map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} · {row.role.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              {decision.kind === 'cancel' ? (
                <Field label="Why is this booking cancelled?" hint="Kept with the booking and sent to the customer">
                  <textarea
                    className="textarea"
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </Field>
              ) : null}
              <Field label="Note for the history" hint="Optional; the desk and ERP see it on the job">
                <textarea
                  className="textarea"
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
            </div>

            {formError ? (
              <p className="form-error">
                <Icon name="alert" size={14} />
                {formError}
              </p>
            ) : null}
          </div>
        ) : null}

        {decision?.kind === 'decide' ? (
          <div className="quote-detail">
            <div className="quote-facts">
              <div>
                <span>Booking</span>
                <strong>{decision.request.bookingReference}</strong>
                <small>{formatDateTime(decision.request.scheduledStart)}</small>
              </div>
              <div>
                <span>Customer</span>
                <strong>{decision.request.customerName}</strong>
                <small>{decision.request.phone || 'No phone'}</small>
              </div>
              <div>
                <span>Reason given</span>
                <strong>{decision.request.reason}</strong>
                <small>
                  {decision.request.requestedBy
                    ? (queue?.requesterNames[decision.request.requestedBy] ?? 'Desk')
                    : 'Desk'}
                </small>
              </div>
              <div>
                <span>Current status</span>
                <StatusChip
                  label={
                    bookingStatusLabels[decision.request.bookingStatus] ?? decision.request.bookingStatus
                  }
                  tone="neutral"
                />
                <small>{ugx(decision.request.total)}</small>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Decision note" hint="Optional; recorded on the request">
                <textarea
                  className="textarea"
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </Field>
            </div>
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
