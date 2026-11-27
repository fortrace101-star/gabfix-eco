import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import {
  Avatar,
  Button,
  EmptyState,
  KpiCard,
  Modal,
  PageHeader,
  SectionCard,
  StatusChip,
} from '../components/ui';
import { cashOlderThan } from '../data';
import { downloadCsv, formatShortDate, ugx } from '../lib/format';
import type { CashCollection, Cleaner, PendingHandover } from '../types';

type CashTab = 'All' | 'Pending' | 'Remitted' | 'Disputes' | 'Approvals';

export function CashPage({
  cash,
  cleaners,
  pendingHandovers,
  reminderHours,
  onApproveHandover,
  onMarkRemitted,
  onResolveDispute,
  notify,
}: {
  cash: CashCollection[];
  cleaners: Cleaner[];
  /** Technician handovers the desk has not approved; none of them reduce cash due yet. */
  pendingHandovers: PendingHandover[];
  reminderHours: number;
  onApproveHandover: (id: string) => void;
  onMarkRemitted: (id: string) => void;
  onResolveDispute: (id: string) => void;
  notify: (message: string) => void;
}) {
  const [tab, setTab] = useState<CashTab>('All');
  const [query, setQuery] = useState('');
  const [dispute, setDispute] = useState<CashCollection | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return cash.filter((entry) => {
      const matchesTab =
        tab === 'All' ||
        (tab === 'Pending' && !entry.remitted && !entry.dispute) ||
        (tab === 'Remitted' && entry.remitted) ||
        (tab === 'Disputes' && Boolean(entry.dispute)) ||
        (tab === 'Approvals' && !entry.remitted && Boolean(entry.pendingCount));
      const matchesQuery =
        !term || [entry.cleaner, entry.id, entry.period].join(' ').toLowerCase().includes(term);
      return matchesTab && matchesQuery;
    });
  }, [cash, query, tab]);

  const pending = cash.filter((entry) => !entry.remitted);
  const disputes = cash.filter((entry) => entry.dispute);
  const flagged = cash.filter(
    (entry) => !entry.remitted && !entry.dispute && cashOlderThan(entry.confirmedOn, reminderHours),
  );
  const pendingTotal = pendingHandovers.reduce((sum, entry) => sum + entry.amount, 0);
  const totalDue = pending.reduce((sum, entry) => sum + entry.amountDue, 0);
  const totalRemitted = cash
    .filter((entry) => entry.remitted)
    .reduce((sum, entry) => sum + entry.amountDue, 0);

  const exportRows = () => {
    downloadCsv('gabfix-cash-collections-2026-11-20.csv', [
      ['Reference', 'Cleaner', 'Period', 'Cash confirmed', 'Amount due UGX', 'Remitted', 'Dispute'],
      ...cash.map((entry) => [
        entry.id,
        entry.cleaner,
        entry.period,
        entry.confirmedOn,
        entry.amountDue,
        entry.remitted ? 'Yes' : 'No',
        entry.dispute ?? '',
      ]),
    ]);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Cash operations"
        title="Cash collections"
        subtitle="Every cash job has to end with a confirmed amount and a clean remittance trail."
        actions={
          <>
            <Button icon="download" onClick={exportRows}>
              Export CSV
            </Button>
            <Button
              variant="primary"
              icon="bell"
              onClick={() =>
                notify(
                  flagged.length
                    ? `Reminder sent to ${flagged.length} cleaner${flagged.length === 1 ? '' : 's'}.`
                    : 'No cash reminders are due.',
                )
              }
            >
              Send reminders ({flagged.length})
            </Button>
          </>
        }
      />

      <div className="kpis">
        <KpiCard
          label="Cash due to Gabfix"
          value={ugx(totalDue)}
          detail={`${pending.length} collections open${pendingHandovers.length ? ` · ${pendingHandovers.length} awaiting approval` : ''}`}
          icon="cash"
        />
        <KpiCard
          label="Confirmed cash"
          value="UGX 4.57m"
          detail="14 – 20 Nov · 9 cleaners"
          trend="up"
          trendLabel="6.8%"
          icon="check"
          tone="blue"
        />
        <KpiCard
          label="Remitted"
          value={ugx(totalRemitted)}
          detail="Banked and reconciled"
          icon="payments"
          tone="yellow"
        />
        <KpiCard
          label="Disputes"
          value={String(disputes.length)}
          detail={disputes.length ? 'Needs an operations decision' : 'No open disputes'}
          icon="alert"
          tone="rose"
        />
      </div>

      <SectionCard>
        <div className="tab-row" role="tablist" aria-label="Cash views">
          {(['All', 'Pending', 'Remitted', 'Disputes', 'Approvals'] as CashTab[]).map((option) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === option}
              key={option}
              className={`tab${tab === option ? ' active' : ''}`}
              onClick={() => setTab(option)}
            >
              {option}
              {option === 'Disputes' && disputes.length ? <span>{disputes.length}</span> : null}
              {option === 'Approvals' && pendingHandovers.length ? (
                <span>{pendingHandovers.length}</span>
              ) : null}
            </button>
          ))}
          <label className="search-field tab-search">
            <Icon name="search" size={16} />
            <span className="sr-only">Search cash collections</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search cleaner or period"
            />
          </label>
        </div>

        {tab === 'Approvals' ? (
          pendingHandovers.length ? (
            <div className="table-scroll" role="region" aria-label="Handovers awaiting approval" tabIndex={0}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Cleaner</th>
                    <th>Handed over</th>
                    <th>Note</th>
                    <th>Recorded</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {pendingHandovers.map((handover) => {
                    const cleaner = cleaners.find((item) => item.id === handover.cleanerId);
                    return (
                      <tr key={handover.id}>
                        <td>
                          <div className="cell-person">
                            <Avatar
                              name={handover.cleaner}
                              tone={cleaner?.tone ?? '#E8F6EE'}
                              size="sm"
                            />
                            <span>
                              <strong>{handover.cleaner}</strong>
                              <small>{handover.id}</small>
                            </span>
                          </div>
                        </td>
                        <td className="nowrap"><strong>{ugx(handover.amount)}</strong></td>
                        <td>{handover.note ?? <span className="muted-small">No note</span>}</td>
                        <td className="nowrap">{formatShortDate(handover.recordedOn)}</td>
                        <td className="align-right">
                          <Button
                            className="btn-small"
                            variant="primary"
                            icon="check"
                            onClick={() => onApproveHandover(handover.id)}
                          >
                            Approve
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="check"
              title="No handovers awaiting approval"
              detail="Handovers recorded in the technician app appear here before they count against cash due."
              action={<Button onClick={() => setTab('All')}>Show all</Button>}
            />
          )
        ) : filtered.length ? (
          <div className="table-scroll" role="region" aria-label="Cash collections" tabIndex={0}>
            <table className="table">
              <thead>
                <tr>
                  <th>Cleaner</th>
                  <th>Period</th>
                  <th>Cash confirmed</th>
                  <th>Aging</th>
                  <th className="align-right">Amount due</th>
                  <th>Remittance</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const cleaner = cleaners.find((item) => item.id === entry.cleanerId);
                  const isAged =
                    !entry.remitted &&
                    !entry.dispute &&
                    cashOlderThan(entry.confirmedOn, reminderHours);
                  return (
                    <tr key={entry.id}>
                      <td>
                        <div className="cell-person">
                          <Avatar
                            name={entry.cleaner}
                            tone={cleaner?.tone ?? '#E8F6EE'}
                            size="sm"
                          />
                          <span>
                            <strong>{entry.cleaner}</strong>
                            <small>{entry.id}</small>
                          </span>
                        </div>
                      </td>
                      <td>{entry.period}</td>
                      <td className="nowrap">{formatShortDate(entry.confirmedOn)}</td>
                      <td>
                        {entry.dispute ? (
                          <StatusChip label="Disputed" />
                        ) : entry.remitted ? (
                          <StatusChip label="Settled" tone="success" />
                        ) : isAged ? (
                          <StatusChip label="Unconfirmed >24h" />
                        ) : (
                          <StatusChip label="On time" tone="info" />
                        )}
                      </td>
                      <td className="align-right nowrap"><strong>{ugx(entry.amountDue)}</strong></td>
                      <td>
                        {entry.remitted ? (
                          <StatusChip label="Remitted" />
                        ) : entry.pendingCount ? (
                          <StatusChip label="Awaiting approval" tone="info" />
                        ) : (
                          <StatusChip label="Due" tone="warning" />
                        )}
                        {!entry.remitted && entry.pendingCount ? (
                          <small className="muted-small">
                            {ugx(entry.pendingAmount ?? 0)} handed over
                          </small>
                        ) : null}
                      </td>
                      <td className="align-right">
                        {entry.dispute ? (
                          <Button className="btn-small" icon="alert" onClick={() => setDispute(entry)}>
                            Review
                          </Button>
                        ) : entry.remitted ? (
                          <span className="muted-small">No action</span>
                        ) : entry.pendingCount ? (
                          <Button
                            className="btn-small"
                            icon="check"
                            onClick={() => setTab('Approvals')}
                          >
                            Review handover
                          </Button>
                        ) : (
                          <Button
                            className="btn-small"
                            variant="primary"
                            icon="check"
                            onClick={() => onMarkRemitted(entry.id)}
                          >
                            Mark remitted
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="cash"
            title="No collections in this view"
            detail="Try another filter or clear the search."
            action={<Button onClick={() => { setTab('All'); setQuery(''); }}>Show all</Button>}
          />
        )}
      </SectionCard>

      {pendingHandovers.length ? (
        <div className="info-panel warning">
          <span className="info-icon"><Icon name="clock" size={18} /></span>
          <div>
            <strong>
              {pendingHandovers.length} handover{pendingHandovers.length === 1 ? '' : 's'} awaiting approval ·{' '}
              {ugx(pendingTotal)}
            </strong>
            <p>
              Cash handed over in the technician app stays part of the cleaner&apos;s balance until
              the desk approves it. Check the cash, then approve from the Approvals tab.
            </p>
          </div>
        </div>
      ) : null}

      {flagged.length ? (
        <div className="info-panel warning">
          <span className="info-icon"><Icon name="clock" size={18} /></span>
          <div>
            <strong>{flagged.length} cash collection{flagged.length === 1 ? '' : 's'} need a reminder.</strong>
            <p>
              Cash remains unconfirmed for more than {reminderHours} hours after the cleaner reported
              receipt. Remind the cleaner before releasing new cash jobs.
            </p>
            <div className="info-actions">
              {flagged.map((entry) => (
                <Button
                  key={entry.id}
                  className="btn-small"
                  icon="bell"
                  onClick={() => notify(`Reminder sent to ${entry.cleaner}.`)}
                >
                  {entry.cleaner} · {ugx(entry.amountDue)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={Boolean(dispute)}
        title="Cash dispute"
        description={dispute ? `${dispute.cleaner} · ${ugx(dispute.amountDue)} · ${dispute.period}` : undefined}
        onClose={() => setDispute(null)}
        footer={
          <>
            <Button onClick={() => setDispute(null)}>Keep open</Button>
            <Button
              variant="primary"
              icon="check"
              onClick={() => {
                if (dispute) {
                  onResolveDispute(dispute.id);
                  setDispute(null);
                }
              }}
            >
              Resolve and accept amount
            </Button>
          </>
        }
      >
        {dispute ? (
          <div className="dispute-box">
            <span className="dispute-icon"><Icon name="alert" size={20} /></span>
            <div>
              <strong>Customer claim</strong>
              <p>{dispute.dispute}</p>
              <p className="muted-small">
                Resolving accepts the amount recorded by the cleaner and clears the flag. A finance
                adjustment is outside this local build.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
