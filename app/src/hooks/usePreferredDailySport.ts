/**
 * usePreferredDailySport — the single source of truth for which Daily Challenge
 * subject to serve a user.
 *
 * Resolution order: an explicit `?sport=` URL param → the user's saved
 * `preferredDailySport` (api.users.me) → "football" (the default).
 *
 * Every Daily entry point (banner, home card, compete tile) AND the play hooks
 * MUST resolve the sport through this helper. The `getAttemptStatus` query and
 * the navigation target are queried/built per-sport; if a card navigated to one
 * sport while its status query stayed on another, the "already played / resets
 * in" UI would lie. Funnelling both through the same value keeps them in
 * lockstep.
 */
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

// The subjects a user may pick for their Daily — a subset of the backend
// CLIENT_SPORTS allowlist (convex/lib/sports.ts). Football-first cut
// (2026-07): basketball/tennis left the picker — their content is a few
// hundred questions each and they diluted a football product. The backend
// still accepts and serves them (stored preferences keep working via direct
// URL), but isDailySubject now rejects them, so saved basketball/tennis
// preferences fall back to football on the home card and Settings.
export const DAILY_SUBJECTS = [
  "football",
  "knowledge",
] as const;

export type DailySubject = (typeof DAILY_SUBJECTS)[number];

export const DEFAULT_DAILY_SUBJECT: DailySubject = "football";

export function isDailySubject(value: unknown): value is DailySubject {
  return (
    typeof value === "string" &&
    (DAILY_SUBJECTS as readonly string[]).includes(value)
  );
}

export function usePreferredDailySport(): DailySubject {
  // Read off the user doc AuthContext already subscribes to (api.users.me) —
  // no extra query, and logged-out users resolve to the default without any
  // identity-scoped read.
  const { user } = useAuth();
  const [params] = useSearchParams();

  const fromUrl = params.get("sport");
  if (isDailySubject(fromUrl)) return fromUrl;

  if (isDailySubject(user?.preferredDailySport)) {
    return user.preferredDailySport;
  }

  return DEFAULT_DAILY_SUBJECT;
}
