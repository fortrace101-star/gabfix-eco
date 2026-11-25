/**
 * Local demo behaviour that the backend will replace. Everything here is one switch so the
 * simulation (Phase 2 Stage 1, 12.3 and 12.4) can be deleted in one place.
 *
 * Both switches are off: assignment and completion are desk actions now, and the mock
 * versions invented crews and completed jobs the dashboard never saw.
 */
export const mock = {
  assignment: { enabled: false, delayMs: 6 * 60_000 },
  completion: {
    enabled: false,
    afterScheduleEnd: true,
    /** Dev-only "complete now" button for local UI work; it never ran in release builds. */
    devButton: false,
    /** F6: a completed recurring job books its next visit on the same plan. */
    seedNextVisit: false,
  },
} as const;
