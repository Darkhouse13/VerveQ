// Client-held guest identity for zero-login Career Path play. Mirrors the duel
// guest-token pattern (app/src/lib/duel.ts): a random secret kept in
// localStorage, only ever sent to the server — which stores just its hash — so a
// logged-out visitor can play immediately and still "own" their session.
const STORAGE_KEY = "verveq_career_path_guest_token";
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

/** Stable per-browser guest token (>=16 chars); created on first use. */
export function getOrCreateCareerPathGuestToken(): string {
  if (typeof window === "undefined") return randomToken(24);
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing && existing.length >= 16) return existing;
  const fresh = randomToken(24);
  window.localStorage.setItem(STORAGE_KEY, fresh);
  return fresh;
}
