/**
 * Server mutations surface as Error messages wrapped in Convex transport
 * noise: "[CONVEX M(challengeArenas:join)] [Request ID: …] Server Error
 * Uncaught Error: Arena not found at handler (../convex/… ) Called by client".
 * Players should only ever see the part the server actually threw
 * ("Arena not found") — or a friendly fallback.
 */
const CONVEX_NOISE = [
  /\[CONVEX [^\]]*\]/g,
  /\[Request ID: [^\]]*\]/g,
  /Server Error/g,
  /Uncaught Error:/g,
  /\bat (?:async )?[\w.<>]+ \([^)]*\)/g,
  /Called by client/g,
];

export function humanizeServerError(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  if (!raw) return fallback;
  let cleaned = raw;
  for (const pattern of CONVEX_NOISE) cleaned = cleaned.replace(pattern, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (!cleaned || !/[a-zA-Z]/.test(cleaned) || cleaned.length > 160) return fallback;
  return cleaned;
}
