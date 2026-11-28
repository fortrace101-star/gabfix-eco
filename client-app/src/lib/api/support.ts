import { apiRequest } from './client';

export type ApiSupportConversation = {
  id: string;
  reference: string;
  customer_id: string;
  subject: string | null;
  category: 'booking' | 'payment' | 'service' | 'account' | 'other';
  status: 'open' | 'waiting_on_customer' | 'resolved';
  last_message_at: string;
  last_read_by_customer_at: string | null;
};

export type ApiSupportMessage = {
  id: string;
  sender_id: string;
  body: string;
  booking_id: string | null;
  created_at: string;
};

export type SupportThreadResponse = {
  conversation: ApiSupportConversation;
  messages: ApiSupportMessage[];
};

/**
 * The customer's single support conversation (`GET /support/conversation`). The API opens
 * the conversation on first read, so the desk sees the thread as soon as chat is opened.
 */
export async function fetchSupportThread(): Promise<SupportThreadResponse> {
  return apiRequest<SupportThreadResponse>('/support/conversation');
}

export async function sendSupportMessage(
  body: string,
  bookingId?: string,
): Promise<{ message: ApiSupportMessage }> {
  return apiRequest<{ message: ApiSupportMessage }>('/support/messages', {
    method: 'POST',
    body: { body, ...(bookingId ? { bookingId } : {}) },
  });
}
