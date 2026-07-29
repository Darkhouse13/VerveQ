/**
 * THE WEEKEND — small client helpers shared by the FW-3 draft surfaces.
 */

/** A chess-clock bank as m:ss, rounded UP so 1ms left still shows 0:01. */
export function formatBank(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
