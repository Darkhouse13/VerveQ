/**
 * THE DRAW — board numbering (shared, pure date math).
 *
 * "BOARD #37" is a SERVER-derived label: convex/draw.ts stamps it onto every
 * getToday/run payload and the client renders what it is given. This module
 * exists so the LocalMockApi can compute the identical number without a
 * second copy of the epoch arithmetic drifting from the server's — the mock
 * imports the same constant and the same function.
 *
 * Placement: convex/lib (next to daily.ts, which src/pages already imports)
 * rather than convex/draw.ts, because draw.ts pulls in _generated/server and
 * must never be reachable from the client bundle. draw.ts re-exports the
 * constant so the owner-facing knob still reads from the module that owns
 * the mode.
 *
 * No engine import, no server import, no ambient clock: safe from both sides.
 */

import { midnightUTCTimestamp } from "./daily";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The UTC day BOARD #1 goes live on. Boards count up by one per UTC day, so
 * this constant is what every historical board number is measured against.
 *
 * OWNER-SETTABLE — must be fixed before the flag opens to non-testers. Moving
 * it after launch renumbers every board (shared screenshots and the "#N" in
 * share text stop matching), so it is safe to change only while the mode is
 * dark. Set to the real launch day (Ticket K); 2026-07-18 is BOARD #1.
 */
export const DRAW_LAUNCH_EPOCH_DATE_KEY = "2026-07-18";

/**
 * Human board number for a UTC dateKey. The launch epoch day is BOARD #1;
 * days before it number <= 0 (only reachable in dev, with a back-dated clock).
 */
export function boardNumberForDate(
  dateKey: string,
  epochDateKey: string = DRAW_LAUNCH_EPOCH_DATE_KEY,
): number {
  const days = Math.round(
    (midnightUTCTimestamp(dateKey) - midnightUTCTimestamp(epochDateKey)) / MS_PER_DAY,
  );
  return days + 1;
}

/** Epoch ms when the board AFTER `dateKey` goes live (result-screen countdown). */
export function nextBoardAtForDate(dateKey: string): number {
  return midnightUTCTimestamp(dateKey) + MS_PER_DAY;
}
