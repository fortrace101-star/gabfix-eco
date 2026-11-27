import { router } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { BackHandler } from 'react-native';

import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { deleteDraftMedia } from '@/lib/media';
import type { BookingDraftStep } from '@/lib/pricing';
import {
  draftIsDirty,
  getBookingDraft,
  resetDraft,
  saveDraftNow,
  setDraftStep,
  useBookingDraft,
} from '@/store/booking';

const SERVICES = '/(tabs)/services';
const HOME = '/(tabs)/home';

type Options = {
  step: BookingDraftStep;
  /** Set on screens that should not trip the guard while the draft is being cleared. */
  enabled?: boolean;
};

export type DraftExit = {
  /** Call from the X button and any in-screen cancel: offer to save the draft. */
  requestExit: () => void;
  /** Call from the header back arrow and hardware back: step back, prompt only at stage one. */
  requestBack: () => void;
  /** Render once, inside the screen. */
  sheet: ReactElement;
};

/** The first order step; backing out of it is leaving the flow. */
const FIRST_STEP: BookingDraftStep = 'details';

/**
 * One exit path for every order-flow step (Section 12.1): hardware back, header back and
 * X all share the "Save as draft?" drawer, and the drawer writes the draft before Home
 * reads it. Screens only call `requestExit()` and render `{sheet}`.
 */
export function useDraftExit({ step, enabled = true }: Options): DraftExit {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (enabled) setDraftStep(step);
  }, [enabled, step]);

  const save = useCallback(async () => {
    setOpen(false);
    await saveDraftNow();
    router.dismissTo(HOME);
  }, []);

  const discard = useCallback(() => {
    setOpen(false);
    deleteDraftMedia();
    resetDraft();
    router.dismissTo(SERVICES);
  }, []);

  const requestExit = useCallback(() => {
    const current = getBookingDraft();
    // No changes since the draft was created: leave quietly and keep nothing.
    if (!draftIsDirty(current)) {
      deleteDraftMedia();
      resetDraft();
      router.dismissTo(SERVICES);
      return;
    }
    setOpen(true);
  }, []);

  // Back is navigation, not an exit: it returns to the previous stage. Only backing
  // out of stage one (or the X) asks about saving the draft.
  const requestBack = useCallback(() => {
    if (step === FIRST_STEP || !router.canGoBack()) {
      requestExit();
      return;
    }
    router.back();
  }, [requestExit, step]);

  useEffect(() => {
    if (!enabled) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestBack();
      return true;
    });
    return () => subscription.remove();
  }, [enabled, requestBack]);

  const sheet = (
    <ConfirmSheet
      visible={open}
      title="Save as draft?"
      body="Your choices are kept so you can finish booking later."
      confirmLabel="Keep editing"
      destructive={false}
      icon={FileText}
      extraLabel="Discard"
      onExtra={discard}
      cancelLabel="Save draft"
      compact
      onConfirm={() => setOpen(false)}
      onCancel={() => {
        void save();
      }}
      onClose={() => setOpen(false)}
    />
  );

  return { requestExit, requestBack, sheet };
}

/**
 * If the draft for this slug is gone (after Discard, a deep link or a cold start), send the
 * customer to Services instead of rendering an empty screen. The details screen is the
 * entry point and creates a draft, so pass `entry: true` there to avoid a redirect race.
 */
export function useDraftGuard(slug: string, { entry = false }: { entry?: boolean } = {}): boolean {
  const draft = useBookingDraft();
  const ready = Boolean(draft && draft.serviceSlug === slug);

  useEffect(() => {
    if (entry || ready) return;
    router.dismissTo(SERVICES);
  }, [entry, ready]);

  return ready;
}
