const GUEST_TOKEN_STORAGE_PREFIX = "verveq_duel_guest_token::";
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomToken(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

export function getOrCreateGuestDuelToken(linkCode: string): string {
  const key = `${GUEST_TOKEN_STORAGE_PREFIX}${linkCode}`;
  if (typeof window === "undefined") return randomToken(24);
  const existing = window.localStorage.getItem(key);
  if (existing && existing.length >= 16) return existing;
  const fresh = randomToken(24);
  window.localStorage.setItem(key, fresh);
  return fresh;
}

export function readGuestDuelToken(linkCode: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${GUEST_TOKEN_STORAGE_PREFIX}${linkCode}`);
}

export function clearGuestDuelToken(linkCode: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${GUEST_TOKEN_STORAGE_PREFIX}${linkCode}`);
}

const PENDING_KEY = "verveq_pending_duel_attach";

export interface PendingDuelAttach {
  duelId: string;
  linkCode: string;
  guestToken: string;
  savedAt: number;
}

export function rememberPendingDuelAttach(value: PendingDuelAttach): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(value));
}

export function takePendingDuelAttach(): PendingDuelAttach | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  window.localStorage.removeItem(PENDING_KEY);
  try {
    const parsed = JSON.parse(raw) as PendingDuelAttach;
    if (parsed && parsed.duelId && parsed.guestToken && parsed.linkCode) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function peekPendingDuelAttach(): PendingDuelAttach | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingDuelAttach;
  } catch {
    return null;
  }
}

const DEFAULT_SHARE_BASE_URL = "https://verveq.com";

function getShareBaseUrl(): string {
  const configured = import.meta.env.VITE_SHARE_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return DEFAULT_SHARE_BASE_URL;
}

// Duel links are shared on the vanity host: verveq.com/s/d/:linkCode, which
// nginx proxies to the Convex .site share route — an OG taunt card for
// link-preview crawlers, a 302 to /duel/:linkCode for humans. Same linkCode,
// so the guest bridge is untouched.
export function buildShareUrl(linkCode: string): string {
  return `${getShareBaseUrl()}/s/d/${linkCode}`;
}

export function formatModeLabel(mode: string): string {
  if (mode === "came_first") return "Which Came First";
  if (mode === "quiz") return "Quiz";
  return mode.replace(/_/g, " ");
}

export function formatCategoryLabel(category: string | null): string {
  if (!category) return "";
  return category
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRelativeTime(ms: number): string {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return diff >= 0 ? "now" : "just now";
  if (minutes < 60) return diff >= 0 ? `in ${minutes}m` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return diff >= 0 ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return diff >= 0 ? `in ${days}d` : `${days}d ago`;
}

export type DuelOutcomeForMe = boolean | "draw" | null;

export function duelSummaryHeadline(s: {
  type: string;
  sport: string | null;
  category: string | null;
  mode: string;
}): string {
  if (s.mode === "came_first") return "Which Came First";
  if (s.type === "knowledge") {
    return s.category ? formatCategoryLabel(s.category) : "Knowledge";
  }
  const sport = s.sport ?? "sport";
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

export function duelStatusBadge(
  status: string,
  winnerForMe: DuelOutcomeForMe,
): { label: string; color: "blue" | "muted" | "success" | "destructive" } {
  if (status === "awaiting_opponent") return { label: "Open", color: "blue" };
  if (status === "declined") return { label: "Declined", color: "muted" };
  if (status === "expired") return { label: "Expired", color: "muted" };
  if (winnerForMe === true) return { label: "Win", color: "success" };
  if (winnerForMe === false) return { label: "Loss", color: "destructive" };
  if (winnerForMe === "draw") return { label: "Draw", color: "blue" };
  return { label: "Done", color: "muted" };
}

export function duelOpponentLabel(username: string): string {
  // Link duels have no opponent yet; the server placeholder is "Link opponent".
  return username === "Link opponent" ? "Open invite" : `vs @${username}`;
}
