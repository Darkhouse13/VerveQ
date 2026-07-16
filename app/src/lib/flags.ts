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

/**
 * Gates the v2 unified shell: the new category-first Home (two pillars), the
 * Compete category/sport/mode-grid flow, the Ranks placeholder, and shell nav.
 * Default OFF so the current `/home` stays live and the new shell is testable
 * side-by-side at its own routes. Set `VITE_V2_SHELL_ENABLED=true` and rebuild.
 *
 * The shell only adds NEW routes and reuses existing mode deep links — no
 * existing game screen, schema, or auth path changes when this is OFF or ON.
 */
export const V2_SHELL_ENABLED = import.meta.env.VITE_V2_SHELL_ENABLED === "true";

/**
 * Gates the `/draw` route (THE DRAW). Default OFF; set `VITE_DRAW_ENABLED=true`
 * in `app/.env.local` and restart the dev server to see it. Deliberately NOT
 * exported in the production build vars (see docs/DEPLOYMENT.md), so the route
 * does not exist in prod.
 *
 * This is only HALF the gate, and the weaker half — it decides whether the
 * route renders at all. The mode's real gate is server-side and unbypassable
 * from the client: every draw function checks `drawSettings.enabled` or tester
 * membership. Flipping this flag alone opens nothing. The double gate stays
 * until the Home ticket links the mode.
 */
export const DRAW_ENABLED = import.meta.env.VITE_DRAW_ENABLED === "true";
