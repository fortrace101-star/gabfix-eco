import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import {
  Button,
  EmptyState,
  PageHeader,
  SectionCard,
  StatusChip,
} from '../components/ui';
import {
  AUDIT_CSV_HEADER,
  AUDIT_EXPORT_LIMIT,
  auditChanges,
  auditCsvRows,
  auditSummary,
  emptyAuditFilters,
  entityLabel,
  loadAuditEntities,
  loadAuditExport,
  loadAuditPage,
  loadAuditSummary,
  roleLabel,
  type AuditAction,
  type AuditEntity,
  type AuditEntry,
  type AuditFilters,
  type AuditSummary,
} from '../lib/audit';
import { downloadCsv, formatDateTime } from '../lib/format';

const PAGE_SIZE = 25;

const ACTION_TONE: Record<AuditAction, 'success' | 'info' | 'danger'> = {
  INSERT: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
};

const ACTION_LABEL: Record<AuditAction, string> = {
  INSERT: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
};

const isFiltered = (filters: AuditFilters): boolean =>
  Boolean(filters.table || filters.action || filters.actor || filters.record || filters.from || filters.to);

export function AuditPage({ notify }: { notify: (message: string) => void }) {
  const [filters, setFilters] = useState<AuditFilters>(emptyAuditFilters);
  const [applied, setApplied] = useState<AuditFilters>(emptyAuditFilters);
  const [entities, setEntities] = useState<AuditEntity[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Typing a name or record id should not fire a query per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setApplied(filters), 300);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const loadPage = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const slice = await loadAuditPage(applied, PAGE_SIZE, nextPage * PAGE_SIZE);
        setEntries(slice.entries);
        setTotal(slice.total);
        setPage(nextPage);
        setExpanded(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not read the audit log.');
      } finally {
        setLoading(false);
      }
    },
    [applied],
  );

  useEffect(() => {
    void loadPage(0);
  }, [loadPage]);

  const loadFacets = useCallback(async () => {
    const [list, totals] = await Promise.all([
      loadAuditEntities().catch(() => [] as AuditEntity[]),
      loadAuditSummary().catch(() => null),
    ]);
    setEntities(list);
    setSummary(totals);
  }, []);

  useEffect(() => {
    void loadFacets();
  }, [loadFacets]);

  const refresh = () => {
    void loadPage(page);
    void loadFacets();
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { entries: rows, truncated } = await loadAuditExport(applied);
      if (rows.length === 0) {
        notify('Nothing matches those filters, so there is nothing to export.');
        return;
      }
      downloadCsv(`gabfix-audit-${new Date().toISOString().slice(0, 10)}.csv`, [
        AUDIT_CSV_HEADER,
        ...auditCsvRows(rows),
      ]);
      notify(
        truncated
          ? `Exported the first ${AUDIT_EXPORT_LIMIT.toLocaleString('en-UG')} event(s) — narrow the dates for the rest.`
          : `Exported ${rows.length.toLocaleString('en-UG')} event(s).`,
      );
    } catch (exportError) {
      notify(exportError instanceof Error ? `Export failed: ${exportError.message}` : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const change = (patch: Partial<AuditFilters>) =>
    setFilters((current) => ({ ...current, ...patch }));

  const first = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = Math.min(total, page * PAGE_SIZE + entries.length);
  const newest = summary?.newestAt ? formatDateTime(summary.newestAt) : '—';
  const tableCount = summary?.tables ?? entities.length;
  const deleted = summary?.deleted ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Operations · Governance"
        title="Audit log"
        subtitle="Every recorded change to bookings, money, jobs, people and support. Only the owner can read this, and entries cannot be edited."
        actions={
          <>
            <Button icon="refresh" onClick={refresh} disabled={loading}>
              Refresh
            </Button>
            <Button icon="download" variant="primary" onClick={() => void exportCsv()} disabled={exporting || loading}>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </>
        }
      />

      <div className="stat-strip">
        <div>
          <span>Matching events</span>
          <strong>{total.toLocaleString('en-UG')}</strong>
        </div>
        <div>
          <span>Newest event</span>
          <strong className="audit-stat-time">{newest}</strong>
        </div>
        <div>
          <span>Entities audited</span>
          <strong>{tableCount}</strong>
        </div>
        <div>
          <span>Deleted records</span>
          <strong>{deleted.toLocaleString('en-UG')}</strong>
        </div>
      </div>

      <SectionCard
        title="Change history"
        meta="Newest first. Open a row to see each field's before and after value."
      >
        <div className="filter-bar audit-filters">
          <label className="search-field">
            <Icon name="user" size={16} />
            <span className="sr-only">Filter by actor</span>
            <input
              value={filters.actor}
              onChange={(event) => change({ actor: event.target.value })}
              placeholder="Who made the change"
            />
          </label>
          <label className="search-field">
            <Icon name="search" size={16} />
            <span className="sr-only">Filter by record id</span>
            <input
              value={filters.record}
              onChange={(event) => change({ record: event.target.value })}
              placeholder="Record id"
            />
          </label>
          <label className="select-field">
            <span className="sr-only">Entity</span>
            <select value={filters.table} onChange={(event) => change({ table: event.target.value })}>
              <option value="">All entities</option>
              {entities.map((entity) => (
                <option key={entity.table} value={entity.table}>
                  {entity.label} ({entity.events})
                </option>
              ))}
            </select>
          </label>
          <label className="select-field">
            <span className="sr-only">Action</span>
            <select
              value={filters.action}
              onChange={(event) => change({ action: event.target.value as '' | AuditAction })}
            >
              <option value="">All actions</option>
              <option value="INSERT">Created</option>
              <option value="UPDATE">Updated</option>
              <option value="DELETE">Deleted</option>
            </select>
          </label>
          <label className="audit-date">
            <span>From</span>
            <input
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => change({ from: event.target.value })}
            />
          </label>
          <label className="audit-date">
            <span>To</span>
            <input
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => change({ to: event.target.value })}
            />
          </label>
          {isFiltered(filters) ? (
            <button type="button" className="text-btn clear-filters" onClick={() => setFilters(emptyAuditFilters)}>
              Clear filters
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="restricted" role="alert">
            <h3>Could not read the audit log</h3>
            <p>{error}</p>
            <Button onClick={refresh}>Try again</Button>
          </div>
        ) : loading && entries.length === 0 ? (
          <p className="page-loading" role="status">
            Reading the audit log…
          </p>
        ) : entries.length === 0 ? (
          <EmptyState
            icon="reports"
            title="No events match"
            detail="Changes appear here as soon as the desk, the app or the crew write to a recorded table. Widen the dates or clear the filters."
            action={
              isFiltered(filters) ? (
                <Button variant="secondary" onClick={() => setFilters(emptyAuditFilters)}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="table-scroll" role="region" aria-label="Audit log" tabIndex={0}>
              <table className="table audit-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Record</th>
                    <th>What changed</th>
                    <th className="align-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const open = expanded === entry.id;
                    return [
                      <tr key={entry.id} className={open ? 'audit-row open' : 'audit-row'}>
                        <td className="nowrap">{formatDateTime(entry.createdAt)}</td>
                        <td>
                          <span className="audit-actor">
                            <strong>{entry.actorName}</strong>
                            <small>{roleLabel(entry.actorRole)}</small>
                          </span>
                        </td>
                        <td>
                          <StatusChip label={ACTION_LABEL[entry.action]} tone={ACTION_TONE[entry.action]} />
                        </td>
                        <td>{entityLabel(entry.table)}</td>
                        <td className="audit-record" title={entry.recordId ?? undefined}>
                          {entry.recordId ? `${entry.recordId.slice(0, 8)}…` : '—'}
                        </td>
                        <td className="audit-summary">{auditSummary(entry)}</td>
                        <td className="align-right">
                          <button
                            type="button"
                            className="text-btn"
                            aria-expanded={open}
                            aria-label={`${open ? 'Hide' : 'Show'} before and after for event ${entry.id}`}
                            onClick={() => setExpanded(open ? null : entry.id)}
                          >
                            {open ? 'Hide' : 'Before / after'}
                          </button>
                        </td>
                      </tr>,
                      open ? (
                        <tr key={`${entry.id}-detail`} className="audit-detail">
                          <td colSpan={7}>
                            <AuditDiff entry={entry} />
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })}
                </tbody>
              </table>
            </div>
            <div className="audit-pager">
              <span>
                Showing {first.toLocaleString('en-UG')}–{last.toLocaleString('en-UG')} of{' '}
                {total.toLocaleString('en-UG')}
              </span>
              <div className="audit-pager-actions">
                <Button
                  variant="secondary"
                  disabled={loading || page === 0}
                  onClick={() => void loadPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  disabled={loading || last >= total}
                  onClick={() => void loadPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </>
  );
}

function AuditDiff({ entry }: { entry: AuditEntry }) {
  const changes = auditChanges(entry);
  return (
    <div className="audit-diff">
      <p className="audit-diff-meta">
        {ACTION_LABEL[entry.action]} · {entityLabel(entry.table)} ·{' '}
        <span className="audit-mono">{entry.recordId ?? 'no record id'}</span> · event #{entry.id}
      </p>
      {changes.length === 0 ? (
        <p className="audit-diff-empty">No field moved in this write.</p>
      ) : (
        <table className="audit-diff-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((change) => (
              <tr key={change.field}>
                <td className="audit-mono">{change.field}</td>
                <td className="audit-before">{change.before}</td>
                <td className="audit-after">{change.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
