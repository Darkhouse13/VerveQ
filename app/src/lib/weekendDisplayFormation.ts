/**
 * THE WEEKEND — per-squad display-formation memory (FW-POLISH-2 R2).
 *
 * The chosen display NAME (e.g. "4-2-3-1") is presentation only: the server
 * stores band counts and must never learn about it, so it lives client-side,
 * keyed by squadId. Losing it is harmless — resolveFormation falls back to
 * the band's first-listed name, which renders correctly.
 */

const key = (squadId: string) => `verveq_weekend_formation:${squadId}`;

export function loadDisplayFormation(squadId: string): string | null {
  try {
    return localStorage.getItem(key(squadId));
  } catch {
    return null;
  }
}

export function saveDisplayFormation(squadId: string, name: string): void {
  try {
    localStorage.setItem(key(squadId), name);
  } catch {
    // Private mode / quota — the reload default covers us.
  }
}
