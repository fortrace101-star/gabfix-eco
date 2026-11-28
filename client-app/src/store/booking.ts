import { useSyncExternalStore } from 'react';

import { readAccountCache, registerAccountCacheReset, removeAccountCache, writeAccountCache } from '@/lib/account-cache';
import { emptyScope, migrateScope } from '@/lib/booking-scope';
import { validateMomo, type MomoNetwork } from '@/lib/momo';
import {
  emptyDraft,
  type BookingDetails,
  type BookingDraft,
  type BookingDraftStep,
  type BookingMedia,
  type BookingMediaItem,
  type BookingScope,
} from '@/lib/pricing';

/**
 * Order-flow draft (Gabfix_App_Ui_2.md, Section 6.0). Each P8–P12 screen reads and writes
 * this store, so a draft survives navigation, app restarts and a cancelled payment.
 */
const STORAGE_KEY = 'gabfix.booking.draft.v2';
const LEGACY_STORAGE_KEY = 'gabfix.booking.draft.v1';

type BookingState = {
  draft: BookingDraft | null;
  hydrated: boolean;
};

let state: BookingState = { draft: null, hydrated: false };
const listeners = new Set<() => void>();

const getState = () => state;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const persist = (draft: BookingDraft | null) => {
  // Fire-and-forget: a failed write must not block the form. The draft stays in memory.
  void (draft ? writeAccountCache(STORAGE_KEY, draft) : removeAccountCache(STORAGE_KEY));
};

const migratePayment = (payment: unknown): BookingDraft['payment'] => {
  if (!payment || typeof payment !== 'object') return undefined;
  const p = payment as Record<string, unknown> & {
    payerPhone?: unknown;
    payerPhones?: Partial<Record<MomoNetwork, string>>;
    savedMomoIds?: Partial<Record<MomoNetwork, string | 'new'>>;
    saveNumber?: Partial<Record<MomoNetwork, boolean>>;
  };

  const plan = p.plan;
  const balanceMethod = p.balanceMethod;
  if (
    (plan !== 'full_now' && plan !== 'deposit' && plan !== 'after_service') ||
    typeof balanceMethod !== 'string'
  ) {
    return undefined;
  }

  const payerPhones: Partial<Record<MomoNetwork, string>> = { ...(p.payerPhones ?? {}) };
  // 11.2 migration: old single payerPhone is copied only if it validates for a network.
  if (typeof p.payerPhone === 'string' && p.payerPhone.trim()) {
    const digits = p.payerPhone.replace(/\D/g, '').replace(/^256/, '').replace(/^0/, '').slice(0, 9);
    const local = `0${digits}`;
    (['mtn_momo', 'airtel_money'] as const).forEach((network) => {
      if (!payerPhones[network] && validateMomo(network, local) === null) {
        payerPhones[network] = local;
      }
    });
  }

  const { payerPhone: _legacy, ...rest } = p;
  const next: BookingDraft['payment'] = {
    ...(rest as BookingDraft['payment']),
    plan,
    balanceMethod: balanceMethod as NonNullable<BookingDraft['payment']>['balanceMethod'],
    payerPhones: Object.keys(payerPhones).length > 0 ? payerPhones : undefined,
    savedMomoIds:
      p.savedMomoIds && Object.keys(p.savedMomoIds).length > 0 ? p.savedMomoIds : undefined,
    saveNumber:
      p.saveNumber && Object.keys(p.saveNumber).length > 0 ? p.saveNumber : undefined,
  };
  return next;
};

const withScopeDefaults = (draft: BookingDraft): BookingDraft => {
  const base = emptyDraft(draft.serviceSlug);
  return {
    ...base,
    ...draft,
    details: { ...base.details, ...draft.details },
    addOns: Array.isArray(draft.addOns) ? draft.addOns : [],
    // Old fixed-field drafts are mapped onto the seed schema's answers (never wiped).
    scope: migrateScope(draft.scope, draft.serviceSlug),
    media: { items: draft.media?.items ?? [], uploaded: draft.media?.uploaded ?? false },
    payment: migratePayment(draft.payment),
  };
};

const setDraft = (draft: BookingDraft | null) => {
  state = { ...state, draft: draft ? withScopeDefaults(draft) : null };
  listeners.forEach((listener) => listener());
  persist(state.draft);
};

/** Called once at boot from the root layout, before the first screen renders. */
export async function hydrateBookingDraft(): Promise<void> {
  let draft: BookingDraft | null = null;
  try {
    const stored = await readAccountCache<BookingDraft>(STORAGE_KEY);
    const legacy = stored ? null : await readAccountCache<BookingDraft>(LEGACY_STORAGE_KEY);
    const parsed = stored ?? legacy;
    if (parsed?.serviceSlug && parsed.details) {
      const normalized = withScopeDefaults(parsed);
      draft = {
        ...normalized,
        media: {
          ...normalized.media,
          items: dedupeMediaItems(normalized.media?.items ?? []),
        },
      };
      void writeAccountCache(STORAGE_KEY, draft);
      if (legacy) void removeAccountCache(LEGACY_STORAGE_KEY);
    }
  } catch {
    draft = null;
  }
  state = { draft, hydrated: true };
  listeners.forEach((listener) => listener());
}

const resetBookingDraft = () => {
  state = { draft: null, hydrated: false };
  listeners.forEach((listener) => listener());
};

registerAccountCacheReset(resetBookingDraft);

export const getBookingDraft = () => state.draft;

/** Start or replace the draft when a service card is tapped. */
export function startDraft(serviceSlug: string, pricing?: BookingDraft['pricing']): void {
  setDraft({ ...emptyDraft(serviceSlug, pricing), scope: emptyScope(serviceSlug) });
}

/** P18: replace the draft with one prefilled from an earlier booking. */
export function startRebookDraft(draft: BookingDraft): void {
  setDraft(draft);
}

export function patchDraft(changes: Partial<Omit<BookingDraft, 'serviceSlug'>>): void {
  if (!state.draft) return;
  setDraft({ ...state.draft, ...changes });
}

export function patchDetails(changes: Partial<BookingDetails>): void {
  if (!state.draft) return;
  setDraft({ ...state.draft, details: { ...state.draft.details, ...changes } });
}

export function patchScope(changes: Partial<BookingScope>): void {
  if (!state.draft) return;
  setDraft({ ...state.draft, scope: { ...(state.draft.scope as BookingScope), ...changes } });
}

function dedupeMediaItems(items: BookingMediaItem[]): BookingMediaItem[] {
  const seen = new Set<string>();
  const out: BookingMediaItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function setMedia(media: BookingMedia): void {
  if (!state.draft) return;
  setDraft({ ...state.draft, media: { ...media, items: dedupeMediaItems(media.items) } });
}

/** P8b: append picked photos/videos and clear the “uploaded” marker. */
export function addMedia(items: BookingMediaItem[]): void {
  if (!state.draft || items.length === 0) return;
  const existing = state.draft.media?.items ?? [];
  setMedia({ items: [...existing, ...items], uploaded: false });
}

export function removeMedia(id: string): void {
  if (!state.draft) return;
  const items = state.draft.media?.items ?? [];
  setMedia({ items: items.filter((item) => item.id !== id), uploaded: false });
}

export function toggleAddOn(id: string): void {
  if (!state.draft) return;
  const selected = state.draft.addOns.includes(id);
  setDraft({
    ...state.draft,
    addOns: selected ? state.draft.addOns.filter((addOn) => addOn !== id) : [...state.draft.addOns, id],
  });
}

export function setPromoCode(promoCode: string | undefined): void {
  if (!state.draft) return;
  const code = promoCode?.trim() ? promoCode.trim().toUpperCase() : undefined;
  setDraft({ ...state.draft, promoCode: code });
}

export function resetDraft(): void {
  setDraft(null);
}

/** True when the draft differs from a freshly started one (12.1 "has changes"). */
export function draftIsDirty(draft: BookingDraft | null): boolean {
  if (!draft) return false;
  const strip = (value: BookingDraft) => {
    const copy = { ...value };
    delete copy.lastStep;
    return JSON.stringify(copy);
  };
  return strip(draft) !== strip(emptyDraft(draft.serviceSlug));
}

/** Awaits the account-cache write so Home never reads a stale draft after Save draft. */
export async function saveDraftNow(): Promise<void> {
  if (!state.draft) return;
  await writeAccountCache(STORAGE_KEY, state.draft);
}

/** Remembers the step the customer reached so Home's draft card resumes there. */
export function setDraftStep(step: BookingDraftStep): void {
  if (!state.draft || state.draft.lastStep === step) return;
  setDraft({ ...state.draft, lastStep: step });
}

/** Route for Home's Continue card; older drafts without a step open Details. */
export function lastStepRoute(draft: BookingDraft | null): string {
  return `/book/[slug]/${draft?.lastStep ?? 'details'}`;
}

export function useBookingDraft(): BookingDraft | null {
  return useSyncExternalStore(subscribe, getState, getState).draft;
}

export function useBookingDraftHydrated(): boolean {
  return useSyncExternalStore(subscribe, getState, getState).hydrated;
}
