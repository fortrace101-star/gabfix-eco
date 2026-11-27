import { env } from './env';
import { supabase } from './supabase';

/**
 * Asks the API to write a completed job's conversation to the JSONL archive and
 * delete the thread. Best effort: the job is already complete, and a failed
 * export must not surface as a failed completion.
 */
export async function archiveBookingChat(bookingId: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch(`${env.supabaseUrl}/functions/v1/api/bookings/${bookingId}/chat/archive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Offline or the function is down; the thread still leaves the inbox because
    // completed threads are filtered out.
  }
}
