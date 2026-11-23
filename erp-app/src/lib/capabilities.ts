import type { Database } from './database.types';

export type Role = Database['public']['Enums']['app_role'];

export const ALL_CAPABILITIES = [
  'assign_jobs',
  'confirm_bookings',
  'cancel_bookings',
  'request_cancellations',
  'record_payments',
  'confirm_cash',
  'enter_job_costs',
  'manage_staff',
  'manage_catalogue',
  'create_bookings',
  'view_customers',
  'view_reports',
  'manage_leads',
] as const;

export type Capability = (typeof ALL_CAPABILITIES)[number];

/**
 * Fallback used only while `role_capabilities` cannot be read. The database
 * policy is still the real gate; this map exists so the UI does not flash
 * empty while the capability query is in flight.
 */
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  admin: [...ALL_CAPABILITIES],
  manager: [
    'assign_jobs',
    'confirm_bookings',
    'cancel_bookings',
    'record_payments',
    'confirm_cash',
    'create_bookings',
    'view_customers',
    'view_reports',
    'manage_leads',
  ],
  customer_relations: ['create_bookings', 'request_cancellations', 'view_customers'],
  sales_operator: ['create_bookings', 'request_cancellations', 'manage_leads'],
  technician: [],
  laundry_operator: [],
  customer: [],
};

export function hasCapability(
  capabilities: readonly string[],
  capability: Capability,
): boolean {
  return capabilities.includes(capability);
}
