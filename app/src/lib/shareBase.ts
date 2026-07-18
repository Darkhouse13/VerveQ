/**
 * Canonical public origin for OUTBOUND share links (Ticket I, extracted from
 * lib/duel.ts). Share/copy builders must use this, never
 * window.location.origin: the app can render on localhost, a preview host, or
 * an embedded webview, and a link built from the render origin is a link that
 * dies outside it.
 */

const DEFAULT_SHARE_BASE_URL = "https://verveq.com";

export function getShareBaseUrl(): string {
  const configured = import.meta.env.VITE_SHARE_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return DEFAULT_SHARE_BASE_URL;
}
