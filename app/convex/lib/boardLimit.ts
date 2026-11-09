/** Public boards show at most this many rows (the clients ask for 50). */
export const MAX_BOARD_LIMIT = 100;

/** Caller-supplied board sizes are clamped to 1..MAX_BOARD_LIMIT. */
export function clampBoardLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 20;
  return Math.min(MAX_BOARD_LIMIT, Math.max(1, Math.floor(limit)));
}
