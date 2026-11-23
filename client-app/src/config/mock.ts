/**
 * Local demo behaviour that the backend will replace. Everything here is one switch so the
 * simulation (Phase 2 Stage 1, 12.3 and 12.4) can be deleted in one place.
 */
export const mock = {
  assignment: { enabled: true, delayMs: 6 * 60_000 },
  completion: {
    enabled: true,
    afterScheduleEnd: true,
    devButton: __DEV__,
    /** F6: a completed recurring job books its next visit on the same plan. */
    seedNextVisit: true,
  },
} as const;
