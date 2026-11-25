import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { fetchMyQuoteRequests, type ServerQuoteRequest } from '@/lib/api/quotes';
import type { BookingFrequency } from '@/lib/pricing';

/**
 * P25 quote requests. Requests made through the booking flow live on the server and are
 * mirrored here for Bookings → Requests; the custom request form also keeps a device copy
 * so the list still works offline.
 */
const STORAGE_KEY = 'gabfix.quotes.v1';

export type QuoteSize = 'small' | 'medium' | 'large';
export type QuotePropertyType = 'house' | 'apartment' | 'office' | 'shop' | 'institution';
/**
 * D9 request stages. Inspection is optional (D6a) and sits between the request and the
 * quote; the customer only ever sees the appointment and the price, never the report.
 */
export type QuoteStatus =
  | 'pending'
  | 'inspection_needed'
  | 'inspection_scheduled'
  | 'inspected'
  | 'quoted'
  | 'accepted'
  | 'declined';

export type QuoteRequestInput = {
  serviceSlug: string;
  serviceName: string;
  /** What the customer needs cleaned; required for a custom request. */
  details: string;
  propertyType: QuotePropertyType;
  size: QuoteSize;
  frequency: BookingFrequency;
  /** First date the customer would like the work to start (YYYY-MM-DD). */
  preferredDateISO: string;
  areaName: string;
  contactName: string;
  contactPhone: string;
  /** Up to five local photo attachments (data URIs) for the job. */
  photos?: string[];
};

export type QuoteRequest = QuoteRequestInput & {
  id: string;
  createdAtISO: string;
  status: QuoteStatus;
  /** Set when an inspection is scheduled; the customer sees this appointment only. */
  inspectionAtISO?: string;
};

type QuotesState = {
  requests: QuoteRequest[];
  /** Requests the desk already has, straight from `GET /quotes`. */
  serverRequests: ServerQuoteRequest[];
  serverSynced: boolean;
  syncing: boolean;
  hydrated: boolean;
};

let state: QuotesState = {
  requests: [],
  serverRequests: [],
  serverSynced: false,
  syncing: false,
  hydrated: false,
};
const listeners = new Set<() => void>();

const getState = () => state;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const persist = (requests: QuoteRequest[]) => {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(requests)).catch(() => undefined);
};

const setRequests = (requests: QuoteRequest[]) => {
  state = { ...state, requests };
  listeners.forEach((listener) => listener());
  persist(requests);
};

/** Called once at boot from the root layout. */
export async function hydrateQuotes(): Promise<void> {
  let requests: QuoteRequest[] = [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed)) {
      requests = parsed.filter((item): item is QuoteRequest =>
        Boolean(item && typeof item === 'object' && (item as QuoteRequest).id),
      );
    }
  } catch {
    requests = [];
  }
  state = { ...state, requests, hydrated: true };
  listeners.forEach((listener) => listener());
}

/**
 * Pulls the desk's view of this customer's quote requests. Safe to call on every
 * focus: a failure keeps the last list and never blocks the tab.
 */
export async function syncQuoteRequests(): Promise<void> {
  if (state.syncing) return;
  state = { ...state, syncing: true };
  listeners.forEach((listener) => listener());
  try {
    const serverRequests = await fetchMyQuoteRequests();
    state = { ...state, serverRequests, serverSynced: true, syncing: false };
  } catch {
    state = { ...state, syncing: false };
  }
  listeners.forEach((listener) => listener());
}

export function addQuoteRequest(input: QuoteRequestInput): QuoteRequest {
  const request: QuoteRequest = {
    ...input,
    id: `QR-${String(Date.now()).slice(-6)}`,
    createdAtISO: new Date().toISOString(),
    status: 'pending',
  };
  setRequests([request, ...state.requests]);
  return request;
}

export function useQuoteRequests(): QuoteRequest[] {
  return useSyncExternalStore(subscribe, getState, getState).requests;
}

export function useQuotesHydrated(): boolean {
  return useSyncExternalStore(subscribe, getState, getState).hydrated;
}

/** Quote requests the desk has on file, newest first. */
export function useServerQuoteRequests(): ServerQuoteRequest[] {
  return useSyncExternalStore(subscribe, getState, getState).serverRequests;
}

export function useQuoteRequestsSynced(): boolean {
  return useSyncExternalStore(subscribe, getState, getState).serverSynced;
}
