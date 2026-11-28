import * as FileSystem from 'expo-file-system/legacy';
import { useSyncExternalStore } from 'react';

import { readAccountCache, registerAccountCacheReset, writeAccountCache } from '@/lib/account-cache';

import {
  fetchBookingMessages,
  fetchBookingThreads,
  requestChatMediaUpload,
  sendBookingMessage,
  type ApiBookingThread,
} from '@/lib/api/chat';
import {
  fetchSupportThread,
  sendSupportMessage,
  type ApiSupportConversation,
  type ApiSupportMessage,
} from '@/lib/api/support';
import { playMessageSound } from '@/lib/message-sound';

const STORAGE_KEY = 'gabfix.messages.v1';

export type ChatSender = 'me' | 'them' | 'system';
export type ChatMessageStatus = 'sending' | 'sent' | 'failed';

export type ChatMessage = {
  id: string;
  text: string;
  atISO: string;
  from: ChatSender;
  /** Only used on outgoing messages. */
  status?: ChatMessageStatus;
  /** Image preview: a local file while sending, the signed URL once loaded. */
  imageUri?: string;
  mediaKind?: 'image' | 'video';
  mediaDurationMs?: number;
};

export type ChatAttachment = {
  uri: string;
  kind: 'image' | 'video';
  mimeType: string;
  bytes: number;
  durationMs?: number;
};

export type ChatThread = {
  id: string;
  name: string;
  initials: string;
  role: string;
  kind: 'support' | 'cleaner' | 'booking';
  /** Id of the server-side booking thread, when this chat is not local-only. */
  serverId?: string;
  unread: number;
  updatedAtISO: string;
  messages: ChatMessage[];
};

type MessagesState = {
  threads: ChatThread[];
  hydrated: boolean;
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** The inbox starts with the support thread and one local cleaner conversation. */
const seedThreads = (): ChatThread[] => [
  {
    id: 'support',
    name: 'Gabfix Support',
    initials: 'GS',
    role: 'Support team',
    kind: 'support',
    unread: 0,
    updatedAtISO: new Date().toISOString(),
    messages: [],
  },
  {
    id: 'rose-nakato',
    name: 'Rose Nakato',
    initials: 'RN',
    role: 'Your cleaner',
    kind: 'cleaner',
    unread: 0,
    updatedAtISO: minutesAgo(180),
    messages: [
      {
        id: 'rose-1',
        text: 'Hi, I’m looking forward to your clean tomorrow. Let me know if the gate code changes.',
        atISO: minutesAgo(240),
        from: 'them',
        status: 'sent',
      },
      {
        id: 'rose-2',
        text: 'Thank you! The gate code is still 1234.',
        atISO: minutesAgo(180),
        from: 'me',
        status: 'sent',
      },
    ],
  },
];

let state: MessagesState = { threads: seedThreads(), hydrated: false };
let activeThreadId: string | null = null;
let messageCounter = 0;

const listeners = new Set<() => void>();

const getState = () => state;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const persist = (threads: ChatThread[]) => {
  void writeAccountCache(STORAGE_KEY, threads);
};

const setThreads = (threads: ChatThread[]) => {
  state = { ...state, threads };
  listeners.forEach((listener) => listener());
  persist(threads);
};

const nextMessageId = () => {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
};

const isMessage = (value: unknown): value is ChatMessage => {
  const message = value as ChatMessage | null;
  return Boolean(
    message &&
      message.id &&
      typeof message.text === 'string' &&
      (message.from === 'me' || message.from === 'them' || message.from === 'system') &&
      typeof message.atISO === 'string',
  );
};

const normalizeThread = (value: unknown): ChatThread | null => {
  const thread = value as ChatThread | null;
  if (
    !thread ||
    !thread.id ||
    !thread.name ||
    !thread.initials ||
    (thread.kind !== 'support' && thread.kind !== 'cleaner' && thread.kind !== 'booking') ||
    !Array.isArray(thread.messages)
  ) {
    return null;
  }

  return {
    ...thread,
    role:
      thread.role ||
      (thread.kind === 'support'
        ? 'Support team'
        : thread.kind === 'booking'
          ? 'Job chat'
          : 'Your cleaner'),
    unread: typeof thread.unread === 'number' && thread.unread > 0 ? thread.unread : 0,
    updatedAtISO:
      typeof thread.updatedAtISO === 'string' ? thread.updatedAtISO : new Date().toISOString(),
    messages: thread.messages.filter(isMessage).map((message) => ({
      ...message,
      status: 'sent',
    })),
  };
};

/** Called once at boot and when the active account changes. */
export async function hydrateMessages(): Promise<void> {
  let threads = seedThreads();
  try {
    const parsed = await readAccountCache<unknown>(STORAGE_KEY);
    if (Array.isArray(parsed)) {
      const stored = parsed
        .map(normalizeThread)
        .filter((thread): thread is ChatThread => Boolean(thread));
      if (stored.length > 0) threads = stored;
    }
  } catch {
    threads = seedThreads();
  }
  state = { threads, hydrated: true };
  listeners.forEach((listener) => listener());
}

const resetMessages = () => {
  activeThreadId = null;
  state = { threads: seedThreads(), hydrated: false };
  listeners.forEach((listener) => listener());
};

registerAccountCacheReset(resetMessages);

/** Initials for a booking chat avatar, e.g. "Rose Nakato (Gabfix Team)" → "RN". */
const initialsOf = (name: string) =>
  name
    .replace(/\s*\([^)]*\)\s*$/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'GB';

/**
 * Maps the server thread into the inbox model. The customer's counterpart is the
 * assigned technician, named as they are in the ERP; staff see the customer.
 * A thread that has no technician yet falls back to "Gabfix team".
 */
const bookingThreadFromApi = (thread: ApiBookingThread, viewerId: string): ChatThread => {
  const viewerIsCustomer = thread.customer?.id === viewerId;
  const counterpart = viewerIsCustomer ? thread.lead : thread.customer;
  // The title carries the party's first name and designation: "Daniel (Gabfix Team)".
  const firstName = counterpart?.full_name?.trim().split(/\s+/)[0];
  const name = firstName
    ? `${firstName} (${viewerIsCustomer ? 'Gabfix Team' : 'Customer'})`
    : viewerIsCustomer
      ? 'Gabfix Team'
      : 'Customer';
  const role = viewerIsCustomer ? 'Your technician' : 'Customer';
  const last = thread.lastMessage;
  return {
    id: `booking:${thread.id}`,
    serverId: thread.id,
    name,
    initials: initialsOf(name),
    role: thread.reference ? `${role} · ${thread.reference}` : role,
    kind: 'booking',
    unread: thread.unread,
    updatedAtISO: last?.created_at ?? new Date().toISOString(),
    messages: last
      ? [
          {
            id: last.id,
            text: last.body,
            atISO: last.created_at,
            from: last.sender_id === viewerId ? 'me' : 'them',
            status: 'sent',
          },
        ]
      : [],
  };
};

const supportThreadFromApi = (
  conversation: ApiSupportConversation,
  messages: ApiSupportMessage[],
): ChatThread => {
  const last = messages[messages.length - 1];
  return {
    id: 'support',
    serverId: conversation.id,
    name: 'Gabfix Support',
    initials: 'GS',
    role: conversation.reference ? `Support team · ${conversation.reference}` : 'Support team',
    kind: 'support',
    unread: 0,
    updatedAtISO: last?.created_at ?? conversation.last_message_at,
    messages: messages.map((message) => ({
      id: message.id,
      text: message.body,
      atISO: message.created_at,
      // The conversation belongs to this customer, so their profile id is "me".
      from: message.sender_id === conversation.customer_id ? 'me' : 'them',
      status: 'sent',
    })),
  };
};

/**
 * Pulls the customer's support conversation (and the desk's replies) into the inbox.
 * Mirrors the booking chat: unread counts while the thread is closed, a message sound
 * for a new desk reply, and the last-known thread kept when offline.
 */
async function syncSupportThread(): Promise<boolean> {
  try {
    const { conversation, messages } = await fetchSupportThread();
    const mapped = supportThreadFromApi(conversation, messages);
    const existing = state.threads.find((thread) => thread.id === 'support');
    const seen = new Set((existing?.messages ?? []).map((message) => message.id));
    const incoming = mapped.messages.filter(
      (message) => message.from === 'them' && !seen.has(message.id),
    );
    mapped.unread =
      activeThreadId === 'support' ? 0 : (existing?.unread ?? 0) + incoming.length;

    const others = state.threads.filter((thread) => thread.id !== 'support');
    state = {
      ...state,
      threads: [...others, mapped].sort(
        (a, b) => new Date(b.updatedAtISO).getTime() - new Date(a.updatedAtISO).getTime(),
      ),
    };
    listeners.forEach((listener) => listener());
    persist(state.threads);
    if (incoming.length > 0) playMessageSound();
    return true;
  } catch {
    return false;
  }
}

/**
 * Pulls booking conversations from the API into the local inbox. Local-only
 * support/cleaner threads are kept; booking threads are replaced wholesale so
 * a removed assignment stops showing. Safe to call when offline.
 */
export async function syncBookingThreads(): Promise<boolean> {
  await syncSupportThread();
  try {
    const { threads, viewerId } = await fetchBookingThreads();
    const mapped = threads
      .filter((thread) => thread.status !== 'completed')
      .map((thread) => bookingThreadFromApi(thread, viewerId));
    const local = state.threads.filter((thread) => thread.kind !== 'booking');
    state = { ...state, threads: [...mapped, ...local].sort((a, b) =>
      new Date(b.updatedAtISO).getTime() - new Date(a.updatedAtISO).getTime(),
    ) };
    listeners.forEach((listener) => listener());
    persist(state.threads);
    return true;
  } catch {
    return false;
  }
}

/** Loads the full message history for a booking thread when it is opened. */
export async function loadBookingMessages(threadId: string): Promise<void> {
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread?.serverId) return;

  try {
    const { messages, viewerId } = await fetchBookingMessages(thread.serverId);
    const mapped: ChatMessage[] = messages.map((message) => ({
      id: message.id,
      text: message.body,
      atISO: message.created_at,
      from: message.sender_id === viewerId ? 'me' : 'them',
      status: 'sent',
      ...(message.media_kind
        ? {
            mediaKind: message.media_kind,
            mediaDurationMs: message.media_duration_ms ?? undefined,
            ...(message.media_kind === 'image' && message.mediaUrl
              ? { imageUri: message.mediaUrl }
              : {}),
          }
        : {}),
    }));
    const incoming = mapped.some(
      (message) =>
        message.from === 'them' && !thread.messages.some((existing) => existing.id === message.id),
    );
    setThreads(
      state.threads.map((item) =>
        item.id === threadId
          ? {
              ...item,
              messages: mapped,
              unread: 0,
              updatedAtISO: mapped[mapped.length - 1]?.atISO ?? item.updatedAtISO,
            }
          : item,
      ),
    );
    if (incoming) playMessageSound();
  } catch {
    // Keep the last-known message; the inbox still renders offline.
  }
}

/** Refreshes whichever conversation is open, by kind. */
export async function loadThreadMessages(threadId: string): Promise<void> {
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread) return;
  if (thread.kind === 'support') {
    await syncSupportThread();
    markThreadRead(threadId);
    return;
  }
  await loadBookingMessages(threadId);
}

export function useThreads(): ChatThread[] {
  return useSyncExternalStore(subscribe, () => getState().threads, () => getState().threads);
}

export function useThread(id: string): ChatThread | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getState().threads.find((thread) => thread.id === id),
    () => getState().threads.find((thread) => thread.id === id),
  );
}

export function useMessagesHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => getState().hydrated,
    () => getState().hydrated,
  );
}

export function markThreadRead(id: string): void {
  const thread = state.threads.find((item) => item.id === id);
  if (!thread || thread.unread === 0) return;
  setThreads(
    state.threads.map((item) => (item.id === id ? { ...item, unread: 0 } : item)),
  );
}

/** Marks a thread as open so a simulated reply does not raise an unread badge. */
export function openThread(id: string): void {
  activeThreadId = id;
  markThreadRead(id);
}

export function closeThread(id: string): void {
  if (activeThreadId === id) activeThreadId = null;
}

const appendMessage = (threadId: string, message: ChatMessage, unread: number) => {
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread) return;
  setThreads(
    state.threads.map((item) =>
      item.id === threadId
        ? {
            ...item,
            unread,
            updatedAtISO: message.atISO,
            messages: [...item.messages, message],
          }
        : item,
    ),
  );
};

const markMessageFailed = (threadId: string, messageId: string) => {
  setThreads(
    state.threads.map((item) =>
      item.id === threadId
        ? {
            ...item,
            messages: item.messages.map((message) =>
              message.id === messageId ? { ...message, status: 'failed' } : message,
            ),
          }
        : item,
    ),
  );
};

const markMessageSent = (threadId: string, messageId: string) => {
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread?.messages.some((message) => message.id === messageId)) return;
  setThreads(
    state.threads.map((item) =>
      item.id === threadId
        ? {
            ...item,
            messages: item.messages.map((message) =>
              message.id === messageId ? { ...message, status: 'sent' } : message,
            ),
          }
        : item,
    ),
  );
};

/**
 * Sends one photo or short video with an optional caption. The bytes go to a
 * signed upload URL, then the message row carries the attachment path.
 */
export async function sendMediaMessage(
  threadId: string,
  rawText: string,
  attachment: ChatAttachment,
): Promise<void> {
  const text = rawText.trim();
  const thread = state.threads.find((item) => item.id === threadId);
  if (!thread) return;

  const localId = nextMessageId();
  appendMessage(
    threadId,
    {
      id: localId,
      text,
      atISO: new Date().toISOString(),
      from: 'me',
      status: 'sending',
      mediaKind: attachment.kind,
      mediaDurationMs: attachment.durationMs,
      ...(attachment.kind === 'image' ? { imageUri: attachment.uri } : {}),
    },
    0,
  );

  // Only booking chats take attachments today; support is text-only.
  if (thread.kind !== 'booking' || !thread.serverId) {
    markMessageFailed(threadId, localId);
    return;
  }

  try {
    const target = await requestChatMediaUpload(thread.serverId, {
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      bytes: attachment.bytes,
      durationMs: attachment.durationMs,
    });
    const result = await FileSystem.uploadAsync(target.uploadUrl, attachment.uri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: target.headers,
    });
    if (result.status < 200 || result.status >= 300) throw new Error('Upload failed');
    await sendBookingMessage(thread.serverId, text, {
      path: target.path,
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      bytes: attachment.bytes,
      durationMs: attachment.durationMs,
    });
    markMessageSent(threadId, localId);
  } catch {
    markMessageFailed(threadId, localId);
  }
}

/** Optimistic send; the demo confirms locally and support replies after a short delay. */
export function sendMessage(threadId: string, rawText: string, imageUri?: string): void {
  const text = rawText.trim();
  const thread = state.threads.find((item) => item.id === threadId);
  if ((!text && !imageUri) || !thread) return;

  const atISO = new Date().toISOString();
  const message: ChatMessage = {
    id: nextMessageId(),
    text,
    atISO,
    from: 'me',
    status: 'sending',
    ...(imageUri ? { imageUri } : {}),
  };
  appendMessage(threadId, message, 0);

  // Support chat is the real conversation the desk answers in the console.
  if (thread.kind === 'support') {
    void (async () => {
      try {
        // The API opens the conversation on first read, so make sure it exists.
        if (!thread.serverId) await syncSupportThread();
        await sendSupportMessage(text || 'photo attached');
        markMessageSent(threadId, message.id);
        await syncSupportThread();
      } catch {
        markMessageFailed(threadId, message.id);
      }
    })();
    return;
  }

  // Booking chats are real: write to the API, then flip the tick. The thread
  // screen loads the full history when it opens.
  if (thread.serverId) {
    if (!text) {
      markMessageSent(threadId, message.id);
      return;
    }
    void sendBookingMessage(thread.serverId, text)
      .then(() => markMessageSent(threadId, message.id))
      .catch(() => markMessageFailed(threadId, message.id));
    return;
  }

  setTimeout(() => markMessageSent(threadId, message.id), 550);
}
