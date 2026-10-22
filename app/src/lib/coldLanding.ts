/**
 * Is this route the document's landing (a visitor arriving from outside the
 * app), rather than an in-app navigation?
 *
 * react-router keys the first location of a document "default". A redirect
 * hop that should still count as the landing (the old `/v2` URLs, which an
 * installed PWA answers itself) passes COLD_LANDING_STATE along.
 */
export const COLD_LANDING_STATE = { coldLanding: true } as const;

export function isColdLanding(location: { key: string; state: unknown }): boolean {
  if (location.key === "default") return true;
  const state = location.state as { coldLanding?: unknown } | null;
  return state?.coldLanding === true;
}
