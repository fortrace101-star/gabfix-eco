import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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
import type { AdminRole } from '../lib/auth';
import {
  addJobCost,
  decideJobCost,
  loadJobCostBoard,
  type JobCostBoard,
  type JobCostLine,
} from '../lib/costs';
import { formatDateTime, ugx } from '../lib/format';

type Decision = { line: JobCostLine; approve: boolean } | null;

const realised = (status: string): boolean => status === 'completed';

export function CostsPage({
  role,
  notify,
  refreshKey,
}: {
  role: AdminRole;
  notify: (message: string) => void;
  refreshKey?: number;
}) {
  const [board, setBoard] = useState<JobCostBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [draftDescription, setDraftDescription] = useState('');
  const [draftAmount, setDraftAmount] = useState('');
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const toggleJobCosts = (bookingId: string) => {
    setExpandedJobs((current) => {
      const next = new Set(current);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  };

  const canApprove = role === 'admin' || role === 'operations';
  const canEnter = role === 'admin';

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setBoard(await loadJobCostBoard());
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Could not read the job costs.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const jobs = board?.jobs ?? [];
  const lines = board?.lines ?? [];
  const pending = lines.filter((line) => line.status === 'submitted');
  const openReview = jobs.filter((job) => job.pendingCosts > 0);
  const ready = jobs.filter((job) => job.commissionReady);
  const commissionDue = ready.reduce((sum, job) => sum + job.commission, 0);
  const pendingValue = pending.reduce((sum, line) => sum + line.amount, 0);

  const linesByBooking = useMemo(() => {
    const map = new Map<string, JobCostLine[]>();
    for (const line of lines) {
      const list = map.get(line.bookingId) ?? [];
      list.push(line);
      map.set(line.bookingId, list);
    }
    return map;
  }, [lines]);

  const submitDecision = async () => {
    if (!decision) return;
    setSaving(true);
    setFormError('');
    try {
      await decideJobCost(decision.line.id, decision.approve, note);
      notify(
        decision.approve
          ? `${decision.line.description} approved · ${ugx(decision.line.amount)}.`
          : `${decision.line.description} rejected.`,
      );
      setDecision(null);
      setNote('');
      await refresh();
    } catch (decisionError) {
      setFormError(
        decisionError instanceof Error ? decisionError.message : 'That decision failed.',
      );
    } finally {
      setSaving(false);
    }
  };

  const submitCost = async (bookingId: string) => {
    setSaving(true);
    setFormError('');
    try {
      await addJobCost(bookingId, draftDescription, Number(draftAmount));
      notify(`Cost recorded on the job · ${ugx(Number(draftAmount) || 0)}.`);
      setAdding(null);
      setDraftDescription('');
      setDraftAmount('');
      await refresh();
    } catch (addError) {
      setFormError(addError instanceof Error ? addError.message : 'Could not save that cost.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        variant="hero"
        eyebrow="Business"
        title="Job costs and commission"
        subtitle="What a completed job cost, what the technician earns and whether that commission may be released. Costs are entered in the operations app; approving them happens here."
        actions={
          <Button icon="refresh" disabled={loading} onClick={() => void refresh()}>
            {loading ? 'Refreshing…' : 'Reload'}
          </Button>
        }
      />

      <div className="kpis">
        <KpiCard
          label="Costs to approve"
          value={String(pending.length)}
          detail={`${ugx(pendingValue)} waiting on a manager`}
          icon="payments"
          tone="yellow"
        />
        <KpiCard
          label="Jobs with open costs"
          value={String(openReview.length)}
          detail="Commission is held until every cost on the job is approved"
          icon="bookings"
          tone="blue"
        />
        <KpiCard
          label="Commission payable"
          value={ugx(commissionDue)}
          detail={`${ready.length} completed job${ready.length === 1 ? '' : 's'} with all costs approved`}
          icon="check"
          tone="green"
        />
        <KpiCard
          label="Costs recorded"
          value={ugx(lines.reduce((sum, line) => sum + line.amount, 0))}
          detail={`${lines.length} line${lines.length === 1 ? '' : 's'} across ${jobs.length} job${jobs.length === 1 ? '' : 's'}`}
          icon="reports"
        />
      </div>

      {error ? (
        <section className="card restricted" role="alert">
          <h2>Could not load job costs</h2>
          <p>{error}</p>
          <Button variant="primary" onClick={() => void refresh()}>
            Try again
          </Button>
        </section>
      ) : null}

      <SectionCard
        title="Costs waiting for a decision"
        meta="Rejecting keeps the line on the job with your note, so the margin explains itself"
      >
        {loading && !board ? (
          <p className="page-loading" role="status">
            Loading job costs…
          </p>
        ) : pending.length === 0 ? (
          <EmptyState
            icon="check"
            title="Nothing waiting"
            detail="When a technician enters a cost on a job it lands here for approval."
          />
        ) : (
          <div className="table-scroll" role="region" aria-label="Job costs to approve" tabIndex={0}>
            <table className="table" aria-label="Job costs to approve">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Cost</th>
                  <th>Entered by</th>
                  <th>Recorded</th>
                  <th className="align-right">Amount</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <span className="cell-main">
                        <strong>{line.reference}</strong>
                        <span className="cell-sub">
                          {jobs.find((job) => job.bookingId === line.bookingId)?.customer ??
                            'Customer'}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="cell-main">{line.description}</span>
                    </td>
                    <td className="nowrap">{line.enteredBy}</td>
                    <td className="nowrap">{formatDateTime(line.createdAt)}</td>
                    <td className="align-right price-cell">{ugx(line.amount)}</td>
                    <td>
                      <div className="row-actions">
                        <Button
                          className="btn-small"
                          variant="primary"
                          icon="check"
                          disabled={!canApprove}
                          onClick={() => {
                            setDecision({ line, approve: true });
                            setNote('');
                            setFormError('');
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          className="btn-small"
                          variant="danger"
                          disabled={!canApprove}
                          onClick={() => {
                            setDecision({ line, approve: false });
                            setNote('');
                            setFormError('');
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!canApprove ? (
          <p className="field-hint">
            Only a manager or the owner can approve job costs. You can still read them.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Jobs, margin and commission"
        meta="Commission is the lead technician's rate on the job total, released only when the job is completed and every cost is approved"
      >
        {jobs.length === 0 && !loading ? (
          <EmptyState
            icon="payments"
            title="No jobs in this window"
            detail="Completed and in-progress jobs appear here with their revenue, costs and commission."
          />
        ) : (
          <div className="table-scroll" role="region" aria-label="Job costs and commission" tabIndex={0}>
            <table className="table" aria-label="Job costs and commission">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Crew</th>
                  <th className="align-right">Revenue</th>
                  <th className="align-right">Approved costs</th>
                  <th className="align-right">Commission</th>
                  <th className="align-right">Margin</th>
                  <th>Commission status</th>
                  <th className="align-right">Costs</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const jobLines = linesByBooking.get(job.bookingId) ?? [];
                  const expanded = expandedJobs.has(job.bookingId);
                  return (
                    <Fragment key={job.bookingId}>
                        <tr>
                          <td>
                            <span className="cell-main">
                              <strong>{job.reference}</strong>
                              <span className="cell-sub">
                                {job.customer} · {formatDateTime(job.scheduledStart)}
                              </span>
                            </span>
                          </td>
                          <td>
                            <span className="cell-main">{job.technicians}</span>
                            <span className="cell-sub">{job.commissionRate}% commission</span>
                          </td>
                          <td className="align-right price-cell">{ugx(job.revenue)}</td>
                          <td className="align-right price-cell">
                            {ugx(job.costs)}
                            {job.pendingCosts > 0 ? (
                              <span className="cell-sub">{job.pendingCosts} awaiting approval</span>
                            ) : null}
                          </td>
                          <td className="align-right price-cell">{ugx(job.commission)}</td>
                          <td className="align-right price-cell">{ugx(job.margin)}</td>
                          <td>
                            <StatusChip
                              label={
                                job.commissionReady
                                  ? 'Ready'
                                  : realised(job.status)
                                    ? 'Held · costs open'
                                    : 'Not completed'
                              }
                              tone={job.commissionReady ? 'success' : 'warning'}
                            />
                          </td>
                          <td>
                            <div className="row-actions">
                              <Button
                                className="btn-small"
                                icon="plus"
                                disabled={!canEnter}
                                onClick={() => {
                                  setAdding(adding === job.bookingId ? null : job.bookingId);
                                  setDraftDescription('');
                                  setDraftAmount('');
                                  setFormError('');
                                }}
                              >
                                {adding === job.bookingId ? 'Close' : 'Add cost'}
                              </Button>
                              {jobLines.length > 0 ? (
                                <Button
                                  className="btn-small"
                                  onClick={() => toggleJobCosts(job.bookingId)}
                                  aria-expanded={expanded}
                                  aria-controls={`job-costs-${job.bookingId}`}
                                >
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                    }}
                                  >
                                    <Icon
                                      name="chevronRight"
                                      size={14}
                                      style={{
                                        transform: expanded ? 'rotate(90deg)' : undefined,
                                        transition: 'transform 0.15s ease',
                                      }}
                                    />
                                    {expanded ? 'Hide' : 'View'} costs ({jobLines.length})
                                  </span>
                                </Button>
                              ) : null}
                            </div>
                            {adding === job.bookingId ? (
                              <div className="inline-cost-form">
                                <Field label="Cost" hint="Fuel, materials, transport">
                                  <input
                                    className="input"
                                    value={draftDescription}
                                    onChange={(event) => setDraftDescription(event.target.value)}
                                    placeholder="e.g. Fuel to Ntinda"
                                  />
                                </Field>
                                <Field label="Amount (UGX)">
                                  <input
                                    className="input"
                                    inputMode="numeric"
                                    value={draftAmount}
                                    onChange={(event) =>
                                      setDraftAmount(event.target.value.replace(/[^\d]/g, ''))
                                    }
                                    placeholder="15000"
                                  />
                                </Field>
                                <Button
                                  className="btn-small"
                                  variant="primary"
                                  disabled={saving}
                                  onClick={() => void submitCost(job.bookingId)}
                                >
                                  Save cost
                                </Button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                        {expanded && jobLines.length > 0 ? (
                          <tr id={`job-costs-${job.bookingId}`}>
                            <td colSpan={8} style={{ paddingTop: 0 }}>
                              <div
                                style={{
                                  background: 'var(--surface-2, #f8fafc)',
                                  borderRadius: 8,
                                  padding: '12px 16px',
                                  margin: '4px 0 8px',
                                }}
                              >
                                <strong style={{ display: 'block', marginBottom: 8 }}>
                                  Cost breakdown
                                </strong>
                                <div className="table-scroll">
                                  <table className="table" aria-label={`Costs for ${job.reference}`}>
                                    <thead>
                                      <tr>
                                        <th>Cost</th>
                                        <th>Status</th>
                                        <th>Entered by</th>
                                        <th>Recorded</th>
                                        <th className="align-right">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {jobLines.map((line) => (
                                        <tr key={line.id}>
                                          <td>
                                            <span className="cell-main">{line.description}</span>
                                            {line.note ? (
                                              <span className="cell-sub">{line.note}</span>
                                            ) : null}
                                          </td>
                                          <td>
                                            <StatusChip
                                              label={
                                                line.status === 'approved'
                                                  ? 'Approved'
                                                  : line.status === 'rejected'
                                                    ? 'Rejected'
                                                    : 'Pending'
                                              }
                                              tone={
                                                line.status === 'approved'
                                                  ? 'success'
                                                  : line.status === 'rejected'
                                                    ? 'danger'
                                                    : 'warning'
                                              }
                                            />
                                          </td>
                                          <td className="nowrap">{line.enteredBy}</td>
                                          <td className="nowrap">{formatDateTime(line.createdAt)}</td>
                                          <td className="align-right price-cell">{ugx(line.amount)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {formError && adding ? (
          <p className="form-error">
            <Icon name="alert" size={14} />
            {formError}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Cost history" meta="Every line, approved or rejected, newest first">
        {lines.length === 0 ? (
          <EmptyState
            icon="reports"
            title="No costs recorded"
            detail="Costs entered in the operations app appear here with their decision."
          />
        ) : (
          <div className="table-scroll" role="region" aria-label="Cost history" tabIndex={0}>
            <table className="table" aria-label="Cost history">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Decided by</th>
                  <th className="align-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <span className="cell-main">
                        <strong>{line.reference}</strong>
                        <span className="cell-sub">{formatDateTime(line.createdAt)}</span>
                      </span>
                    </td>
                    <td>
                      <span className="cell-main">{line.description}</span>
                      {line.note ? <span className="cell-sub">{line.note}</span> : null}
                    </td>
                    <td>
                      <StatusChip
                        label={
                          line.status === 'approved'
                            ? 'Approved'
                            : line.status === 'rejected'
                              ? 'Rejected'
                              : 'Pending'
                        }
                        tone={
                          line.status === 'approved'
                            ? 'success'
                            : line.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                        }
                      />
                    </td>
                    <td>
                      <span className="cell-main">{line.approvedBy ?? '—'}</span>
                      {line.approvedAt ? (
                        <span className="cell-sub">{formatDateTime(line.approvedAt)}</span>
                      ) : null}
                    </td>
                    <td className="align-right price-cell">{ugx(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        open={decision !== null}
        title={
          decision
            ? `${decision.approve ? 'Approve' : 'Reject'} ${decision.line.description}`
            : ''
        }
        description={
          decision?.approve
            ? 'Approved costs count against the job margin; commission is released once every cost on a completed job is approved.'
            : 'The line stays on the job as rejected with your note, and it does not reduce the margin.'
        }
        onClose={() => setDecision(null)}
        footer={
          <>
            <Button onClick={() => setDecision(null)}>Close</Button>
            <Button
              variant={decision?.approve ? 'primary' : 'danger'}
              icon={decision?.approve ? 'check' : 'alert'}
              disabled={saving}
              onClick={() => void submitDecision()}
            >
              {saving ? 'Saving…' : decision?.approve ? 'Approve cost' : 'Reject cost'}
            </Button>
          </>
        }
      >
        {decision ? (
          <div className="quote-detail">
            <div className="quote-facts">
              <div>
                <span>Job</span>
                <strong>{decision.line.reference}</strong>
                <small>{formatDateTime(decision.line.createdAt)}</small>
              </div>
              <div>
                <span>Cost</span>
                <strong>{decision.line.description}</strong>
                <small>Entered by {decision.line.enteredBy}</small>
              </div>
              <div>
                <span>Amount</span>
                <strong>{ugx(decision.line.amount)}</strong>
                <small>{decision.line.status}</small>
              </div>
            </div>
            <div className="form-grid">
              <Field label="Decision note" hint="Optional; the desk sees it on the job">
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
