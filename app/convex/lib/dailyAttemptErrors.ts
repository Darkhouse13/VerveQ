import { ConvexError } from "convex/values";

/**
 * "You already played today's daily." Thrown as a ConvexError because
 * production Convex redacts a plain Error's message to "Server Error"; only a
 * ConvexError's `data` reaches the browser, so the client matches on `code`.
 * The message stays in `data` (and so in `error.message`) for dev and tests.
 */
export const ALREADY_ATTEMPTED_CODE = "already_attempted";

export function alreadyAttemptedError() {
  return new ConvexError({
    code: ALREADY_ATTEMPTED_CODE,
    message: "Already attempted today's challenge",
  });
}
