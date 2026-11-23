import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'gabfix.reviews.v1';

export type SavedReview = {
  id: string;
  bookingId: string;
  cleanerId?: string;
  cleanerName: string;
  /** 1–5 when the customer rated the job itself (S1 12.4). */
  jobStars?: number;
  /** 1–5 when the customer rated the person who did the work. */
  cleanerStars?: number;
  tags: string[];
  comment: string;
  /** Local photo URIs/data URLs; uploads wait on the reviews API. */
  photos: string[];
  createdAtISO: string;
};

type ReviewsState = {
  reviews: SavedReview[];
  hydrated: boolean;
};

let state: ReviewsState = { reviews: [], hydrated: false };
const listeners = new Set<() => void>();

const getState = () => state;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const persist = (reviews: SavedReview[]) => {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reviews)).catch(() => undefined);
};

const setReviews = (reviews: SavedReview[]) => {
  state = { reviews, hydrated: true };
  listeners.forEach((listener) => listener());
  persist(reviews);
};

const readStars = (value: unknown): number | undefined =>
  Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5
    ? (value as number)
    : undefined;

/** Accepts the new optional pair and migrates the old single `stars` value into both. */
const migrateReview = (value: unknown): SavedReview | undefined => {
  const item = value as (Partial<SavedReview> & { stars?: unknown }) | null;
  if (
    !item ||
    !item.id ||
    !item.bookingId ||
    !item.cleanerName ||
    !item.createdAtISO ||
    typeof item.comment !== 'string' ||
    !Array.isArray(item.tags) ||
    !Array.isArray(item.photos)
  ) {
    return undefined;
  }
  const legacy = readStars(item.stars);
  const jobStars = readStars(item.jobStars) ?? legacy;
  const cleanerStars = readStars(item.cleanerStars) ?? legacy;
  if (!jobStars && !cleanerStars && item.comment.trim().length === 0) return undefined;

  return {
    id: item.id,
    bookingId: item.bookingId,
    cleanerId: item.cleanerId,
    cleanerName: item.cleanerName,
    jobStars,
    cleanerStars,
    tags: item.tags,
    comment: item.comment,
    photos: item.photos,
    createdAtISO: item.createdAtISO,
  };
};

/** Called once at boot from the root layout. */
export async function hydrateReviews(): Promise<void> {
  let reviews: SavedReview[] = [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed)) {
      reviews = parsed
        .map(migrateReview)
        .filter((review): review is SavedReview => review !== undefined);
    }
  } catch {
    reviews = [];
  }
  state = { reviews, hydrated: true };
  listeners.forEach((listener) => listener());
}

/** One review per booking; a repeat submit returns the first saved entry. */
export function addReview(review: Omit<SavedReview, 'id' | 'createdAtISO'>): SavedReview {
  const existing = state.reviews.find((item) => item.bookingId === review.bookingId);
  if (existing) return existing;

  const saved: SavedReview = {
    ...review,
    id: `RV-${Date.now()}`,
    createdAtISO: new Date().toISOString(),
  };
  setReviews([saved, ...state.reviews]);
  return saved;
}

export function getReviewForBooking(bookingId: string): SavedReview | undefined {
  return state.reviews.find((item) => item.bookingId === bookingId);
}

export function useReviews(): SavedReview[] {
  return useSyncExternalStore(subscribe, getState, getState).reviews;
}

export function useReviewsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getState, getState).hydrated;
}
