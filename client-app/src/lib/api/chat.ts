import { apiRequest } from './client';

export type ApiChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  media_path?: string | null;
  media_kind?: 'image' | 'video' | null;
  media_duration_ms?: number | null;
  mediaUrl?: string | null;
};

export type ChatUploadTarget = {
  path: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAtISO: string;
};

export type ApiBookingThread = {
  id: string;
  bookingId: string;
  reference: string | null;
  status: string | null;
  scheduledStart: string | null;
  customer: { id: string; full_name: string } | null;
  lead: { id: string; full_name: string } | null;
  lastMessage: ApiChatMessage | null;
  unread: number;
};

type ThreadsResponse = { threads: ApiBookingThread[]; viewerId: string };

export type ThreadMessagesResponse = {
  thread: {
    id: string;
    booking_id: string;
    customer_id: string;
    lead_id: string | null;
    bookings: { reference: string; status: string; customer_name: string | null } | null;
  };
  messages: (ApiChatMessage & { profiles: { full_name: string } | null })[];
  viewerId: string;
};

/** Booking conversations for the signed-in customer (empty when the API is off). */
export async function fetchBookingThreads(): Promise<ThreadsResponse> {
  return apiRequest<ThreadsResponse>('/threads');
}

export async function fetchBookingMessages(threadId: string): Promise<ThreadMessagesResponse> {
  return apiRequest<ThreadMessagesResponse>(`/threads/${threadId}/messages`);
}

export type ChatMediaInput = {
  path: string;
  kind: 'image' | 'video';
  mimeType: string;
  bytes: number;
  durationMs?: number;
};

export async function sendBookingMessage(
  threadId: string,
  body: string,
  media?: ChatMediaInput,
): Promise<{ message: ApiChatMessage & { sender_name: string } }> {
  return apiRequest(`/threads/${threadId}/messages`, {
    method: 'POST',
    body: {
      body,
      ...(media
        ? {
            mediaPath: media.path,
            mediaKind: media.kind,
            mediaMime: media.mimeType,
            mediaBytes: media.bytes,
            mediaDurationMs: media.durationMs,
          }
        : {}),
    },
  });
}

/** Signed PUT target for one photo or short video in a booking chat. */
export async function requestChatMediaUpload(
  threadId: string,
  input: { kind: 'image' | 'video'; mimeType: string; bytes: number; durationMs?: number },
): Promise<ChatUploadTarget> {
  const { upload } = await apiRequest<{ upload: ChatUploadTarget }>(`/threads/${threadId}/media`, {
    method: 'POST',
    body: input,
  });
  return upload;
}
