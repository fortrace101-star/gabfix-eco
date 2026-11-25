import { supabase } from './supabase';

/**
 * G3 job costs. The desk enters costs from the ERP; the console approves or rejects
 * them through `decide_job_cost`, and `job_cost_overview` is what any payout screen
 * trusts for the commission, so the numbers cannot drift between pages.
 */

export type JobCostStatus = 'submitted' | 'approved' | 'rejected';

export type JobCostLine = {
  id: string;
  bookingId: string;
  reference: string;
  description: string;
  amount: number;
  status: JobCostStatus;
  enteredBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  note: string | null;
  createdAt: string;
};

export type JobCostJob = {
  bookingId: string;
  reference: string;
  customer: string;
  status: string;
  scheduledStart: string;
  revenue: number;
  costs: number;
  pendingCosts: number;
  technicians: string;
  commissionRate: number;
  commission: number;
  margin: number;
  commissionReady: boolean;
};

export type JobCostBoard = {
  jobs: JobCostJob[];
  lines: JobCostLine[];
};

type OverviewRow = {
  booking_id: string;
  reference: string;
  customer_name: string | null;
  status: string;
  scheduled_start: string;
  revenue: number | string | null;
  costs: number | string | null;
  pending_costs: number;
  technicians: string | null;
  commission_rate: number | string | null;
  commission: number | string | null;
  margin: number | string | null;
  commission_ready: boolean;
};

type LineRow = {
  id: string;
  booking_id: string;
  reference: string;
  description: string;
  amount: number | string;
  status: JobCostStatus;
  entered_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  decision_note: string | null;
  created_at: string;
};

const num = (value: number | string | null): number =>
  value === null ? 0 : typeof value === 'string' ? Number(value) : value;

export async function loadJobCostBoard(): Promise<JobCostBoard> {
  const [overviewRes, linesRes] = await Promise.all([
    supabase.rpc('job_cost_overview'),
    supabase.rpc('job_cost_lines'),
  ]);

  const failure = overviewRes.error ?? linesRes.error;
  if (failure) throw new Error(failure.message);

  const jobs = ((overviewRes.data ?? []) as OverviewRow[]).map((row) => ({
    bookingId: row.booking_id,
    reference: row.reference,
    customer: row.customer_name ?? 'Customer',
    status: row.status,
    scheduledStart: row.scheduled_start,
    revenue: num(row.revenue),
    costs: num(row.costs),
    pendingCosts: Number(row.pending_costs ?? 0),
    technicians: row.technicians ?? 'Unassigned',
    commissionRate: num(row.commission_rate),
    commission: num(row.commission),
    margin: num(row.margin),
    commissionReady: Boolean(row.commission_ready),
  }));

  const lines = ((linesRes.data ?? []) as LineRow[]).map((row) => ({
    id: row.id,
    bookingId: row.booking_id,
    reference: row.reference,
    description: row.description,
    amount: num(row.amount),
    status: row.status,
    enteredBy: row.entered_by_name ?? 'Desk',
    approvedBy: row.approved_by_name,
    approvedAt: row.approved_at,
    note: row.decision_note,
    createdAt: row.created_at,
  }));

  return { jobs, lines };
}

export async function decideJobCost(
  costId: string,
  approve: boolean,
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc('decide_job_cost', {
    p_cost: costId,
    p_approve: approve,
    p_note: note.trim() || undefined,
  });
  if (error) throw new Error(error.message);
}

/** Records a cost from the console for the rare case the ERP app is not to hand. */
export async function addJobCost(
  bookingId: string,
  description: string,
  amount: number,
): Promise<void> {
  if (!description.trim()) throw new Error('Describe the cost.');
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter the amount.');
  const { error } = await supabase.rpc('add_job_cost', {
    p_booking: bookingId,
    p_description: description.trim(),
    p_amount: amount,
  });
  if (error) throw new Error(error.message);
}
