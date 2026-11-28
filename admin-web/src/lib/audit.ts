import { supabase } from './supabase';

/**
 * M2 audit log. Reads go through `audit_log_page` / `audit_log_tables`, which refuse
 * anyone who is not an owner, so the page can show personal and financial changes
 * without widening the table's RLS. `audit_log` is append-only; nothing here writes.
 */

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export type AuditFilters = {
  /** Audited table name, or '' for every entity. */
  table: string;
  action: '' | AuditAction;
  /** Actor name fragment. */
  actor: string;
  /** Record id fragment. */
  record: string;
  /** Inclusive yyyy-mm-dd, or ''. */
  from: string;
  /** Inclusive yyyy-mm-dd, or ''. */
  to: string;
};

export const emptyAuditFilters: AuditFilters = {
  table: '',
  action: '',
  actor: '',
  record: '',
  from: '',
  to: '',
};

export type AuditEntry = {
  id: number;
  actorId: string | null;
  actorName: string;
  actorRole: string | null;
  action: AuditAction;
  table: string;
  recordId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

export type AuditPageSlice = {
  entries: AuditEntry[];
  total: number;
};

export type AuditEntity = {
  table: string;
  label: string;
  events: number;
};

type PageRow = {
  id: number | string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: AuditAction;
  table_name: string;
  record_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  total: number | string;
};

type EntityRow = { table_name: string; events: number | string };

const ENTITY_LABELS: Record<string, string> = {
  bookings: 'Booking',
  payments: 'Payment',
  quotes: 'Quote',
  inspections: 'Inspection',
  cancellation_requests: 'Cancellation request',
  job_costs: 'Job cost',
  job_cost_lines: 'Job cost line',
  profiles: 'Person',
  support_conversations: 'Support conversation',
  support_messages: 'Support message',
  reviews: 'Review',
  booking_media: 'Booking media',
  booking_threads: 'Booking chat',
  booking_messages: 'Chat message',
  laundry_orders: 'Laundry order',
  services: 'Service',
  categories: 'Category',
};

export const entityLabel = (table: string): string =>
  ENTITY_LABELS[table] ?? table.replaceAll('_', ' ');

const ROLE_LABELS: Record<string, string> = {
  admin: 'Owner',
  manager: 'Operations',
  customer_relations: 'Support',
  technician: 'Technician',
  laundry_operator: 'Laundry',
  sales_operator: 'Sales',
  customer: 'Customer',
};

export const roleLabel = (role: string | null): string =>
  role ? (ROLE_LABELS[role] ?? role.replaceAll('_', ' ')) : 'System';

/** Converts a filter-only input into the RPC's timestamp arguments. */
const startOfDayIso = (date: string): string | null => {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

/** `to` is inclusive in the UI, exclusive in the query, so add a day. */
const endOfDayIso = (date: string): string | null => {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setDate(parsed.getDate() + 1);
  return parsed.toISOString();
};

// Omitted arguments fall back to the SQL defaults (null = no filter).
const rpcArgs = (filters: AuditFilters, limit: number, offset: number) => ({
  p_table: filters.table || undefined,
  p_action: filters.action || undefined,
  p_actor: filters.actor.trim() || undefined,
  p_from: startOfDayIso(filters.from) ?? undefined,
  p_to: endOfDayIso(filters.to) ?? undefined,
  p_search: filters.record.trim() || undefined,
  p_limit: limit,
  p_offset: offset,
});

const toEntry = (row: PageRow): AuditEntry => ({
  id: Number(row.id),
  actorId: row.actor_id,
  actorName: row.actor_name ?? 'System',
  actorRole: row.actor_role,
  action: row.action,
  table: row.table_name,
  recordId: row.record_id,
  before: row.old_value,
  after: row.new_value,
  createdAt: row.created_at,
});

export async function loadAuditPage(
  filters: AuditFilters,
  limit: number,
  offset: number,
): Promise<AuditPageSlice> {
  const { data, error } = await supabase.rpc('audit_log_page', rpcArgs(filters, limit, offset));
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PageRow[];
  return {
    entries: rows.map(toEntry),
    total: rows.length ? Number(rows[0].total) : 0,
  };
}

export type AuditSummary = {
  events: number;
  created: number;
  updated: number;
  deleted: number;
  tables: number;
  newestAt: string | null;
};

export async function loadAuditSummary(): Promise<AuditSummary> {
  const { data, error } = await supabase.rpc('audit_log_summary');
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    events: Number(row.events ?? 0),
    created: Number(row.created ?? 0),
    updated: Number(row.updated ?? 0),
    deleted: Number(row.deleted ?? 0),
    tables: Number(row.tables ?? 0),
    newestAt: typeof row.newestAt === 'string' ? row.newestAt : null,
  };
}

export async function loadAuditEntities(): Promise<AuditEntity[]> {
  const { data, error } = await supabase.rpc('audit_log_tables');
  if (error) throw new Error(error.message);
  return ((data ?? []) as EntityRow[]).map((row) => ({
    table: row.table_name,
    label: entityLabel(row.table_name),
    events: Number(row.events),
  }));
}

export const AUDIT_EXPORT_LIMIT = 5000;

/**
 * The export runs the same filters as the table, page by page, and stops at
 * `AUDIT_EXPORT_LIMIT`. `truncated` tells the caller to say so instead of silently
 * handing over a short file.
 */
export async function loadAuditExport(
  filters: AuditFilters,
): Promise<{ entries: AuditEntry[]; truncated: boolean }> {
  const pageSize = 500;
  const entries: AuditEntry[] = [];
  for (let offset = 0; offset < AUDIT_EXPORT_LIMIT; offset += pageSize) {
    const slice = await loadAuditPage(filters, pageSize, offset);
    entries.push(...slice.entries);
    if (entries.length >= slice.total || slice.entries.length < pageSize) {
      return { entries, truncated: false };
    }
  }
  return { entries: entries.slice(0, AUDIT_EXPORT_LIMIT), truncated: true };
}

/** Housekeeping columns that move on every write and say nothing about the change. */
const NOISY_FIELDS = new Set(['updated_at', 'created_at', 'last_read_by_staff_at', 'last_read_by_customer_at']);

/** Fields whose value actually moved, with meaningful fields first. */
export function auditChanges(
  entry: AuditEntry,
): { field: string; before: string; after: string }[] {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: { field: string; before: string; after: string }[] = [];
  for (const field of fields) {
    const oldValue = before[field];
    const newValue = after[field];
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;
    changes.push({ field, before: displayValue(oldValue), after: displayValue(newValue) });
  }
  return changes.sort((a, b) => {
    const noisyA = NOISY_FIELDS.has(a.field) ? 1 : 0;
    const noisyB = NOISY_FIELDS.has(b.field) ? 1 : 0;
    return noisyA - noisyB || a.field.localeCompare(b.field);
  });
}

export function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** One line for the table row: the first moves, then a count of the rest. */
export function auditSummary(entry: AuditEntry): string {
  if (entry.action === 'INSERT') {
    return entry.after && typeof entry.after.reference === 'string'
      ? `Created ${entry.after.reference}`
      : `Created ${entityLabel(entry.table).toLowerCase()}`;
  }
  if (entry.action === 'DELETE') {
    return entry.before && typeof entry.before.reference === 'string'
      ? `Deleted ${entry.before.reference}`
      : `Deleted ${entityLabel(entry.table).toLowerCase()}`;
  }
  const all = auditChanges(entry);
  const meaningful = all.filter((change) => !NOISY_FIELDS.has(change.field));
  const changes = meaningful.length ? meaningful : all;
  if (changes.length === 0) return 'Saved with no visible field change';
  const shown = changes.slice(0, 2).map(
    (change) => `${change.field.replaceAll('_', ' ')} ${short(change.before)} → ${short(change.after)}`,
  );
  const rest = changes.length - shown.length;
  return `${shown.join(' · ')}${rest > 0 ? ` · +${rest} more` : ''}`;
}

const short = (value: string, max = 28): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

/** A stable CSV header for the export, matching `auditCsvRows`. */
export const AUDIT_CSV_HEADER = [
  'Time',
  'Actor',
  'Actor role',
  'Action',
  'Entity',
  'Record',
  'Changed fields',
  'Before',
  'After',
];

export function auditCsvRows(entries: AuditEntry[]): (string | number)[][] {
  return entries.map((entry) => {
    const changes = auditChanges(entry);
    return [
      new Date(entry.createdAt).toISOString(),
      entry.actorName,
      roleLabel(entry.actorRole),
      entry.action,
      entityLabel(entry.table),
      entry.recordId ?? '',
      changes.map((change) => change.field).join(' | '),
      JSON.stringify(entry.before ?? {}),
      JSON.stringify(entry.after ?? {}),
    ];
  });
}
