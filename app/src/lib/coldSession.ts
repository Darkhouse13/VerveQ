/**
 * Anonymous, tab-local identity for the cold-entry taste round.
 *
 * The taste round (see `pages/shell/ColdEntryScreen` + `lib/tasteRound.ts`) is
 * deliberately serverless — but we still want to know, server-side, whether
 * cold visitors actually play. This token gives those funnel events
 * (`taste_round_started` / `taste_round_completed`) a stable per-visitor id so
 * they can be deduped and later joined to downstream activity.
 *
 * It mirrors the duel guest-token mechanism (crypto-random string in
 * localStorage — see `lib/duel.ts`), but is NOT tied to any duel link, so it
 * lives under its own fixed key. No PII: the token is random, and the server
 * only ever stores a hash of it.
 */

const COLD_SESSION_KEY = "verveq_cold_session_token";
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

/**
 * Stable per-visitor token for this browser. Reused across rounds and reloads
 * so the started/completed pair (and replays) dedupe to one session. Falls
 * back to an ephemeral token when localStorage is unavailable (e.g. SSR).
 */
export function getOrCreateColdSessionToken(): string {
  if (typeof window === "undefined") return randomToken(24);
  try {
    const existing = window.localStorage.getItem(COLD_SESSION_KEY);
    if (existing && existing.length >= 16) return existing;
    const fresh = randomToken(24);
    window.localStorage.setItem(COLD_SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Private-mode / blocked storage: still produce a usable token.
    return randomToken(24);
  }
}

/**
 * Coarse traffic source for cold attribution: `utm_source`, else `ref`, else
 * undefined. Lets X / ad / direct cold traffic be separated later without any
 * UTM plumbing elsewhere.
 */
export function readColdSource(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  return params.get("utm_source") ?? params.get("ref") ?? undefined;
}
