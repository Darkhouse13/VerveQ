/**
 * Feature flags.
 *
 * Flags are read from Vite build-time env vars (`import.meta.env`), matching the
 * existing config pattern (see `VITE_CONVEX_URL` in `App.tsx`). A flag is ON only
 * when its env var is exactly the string `"true"`; anything else (unset, empty,
 * "false") leaves it OFF. Default OFF means flipping nothing keeps the live app
 * visually unchanged.
 *
 * To enable Learn locally or in a deploy, set `VITE_LEARN_ENABLED=true` in the
 * environment (e.g. `app/.env.local`) and rebuild.
 */

/** Gates the Learn entry point (homepage card) that routes to the `/learn` node picker. */
export const LEARN_ENABLED = import.meta.env.VITE_LEARN_ENABLED === "true";
