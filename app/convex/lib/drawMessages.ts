/**
 * THE DRAW — error strings shared by the server and the client.
 *
 * These live here, and not in convex/draw.ts, for the same reason
 * lib/drawDaily.ts does: draw.ts imports _generated/server and must never be
 * reachable from the client bundle, but the UI has to recognise the exact
 * sentences the server throws in order to translate them. Before this module
 * the gate string was duplicated in the screen and kept honest by a test —
 * one copy is better than a copy plus a test.
 *
 * No imports: safe from the Convex runtime, the browser, and Node tests alike.
 */

/** Thrown when the mode is disabled and the caller is not a tester. */
export const DRAW_DISABLED_MESSAGE = "THE DRAW is not open yet";

/** Thrown when no authenticated identity reaches a draw function. */
export const DRAW_SIGN_IN_REQUIRED = "Sign in required";
