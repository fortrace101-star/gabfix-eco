import { apiRequest } from './client';

/**
 * C2 permanent account deletion. The server decides whether deletion is allowed and
 * checks the password; nothing here can bypass either.
 */

export type DeletionStatus = {
  canDelete: boolean;
  upcomingBookings: number;
  /** UGX still owed on the customer's bookings. */
  outstandingBalance: number;
  openDisputes: number;
};

export async function fetchDeletionStatus(): Promise<DeletionStatus> {
  const { status } = await apiRequest<{ status: DeletionStatus }>('/account/deletion');
  return status;
}

export async function deleteAccount(password: string): Promise<{ bookingsKept: number }> {
  return apiRequest<{ bookingsKept: number }>('/account/delete', {
    method: 'POST',
    body: { password },
  });
}
