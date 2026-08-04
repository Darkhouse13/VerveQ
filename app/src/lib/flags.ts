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

/**
 * Gates ANONYMOUS-FIRST identity (FR-1B): a cold visitor gets a silently
 * minted Convex anonymous session on entry to a session-requiring surface,
 * and the name claim moves AFTER play (the post-result claim prompt) instead
 * of before it (the account chooser).
 *
 * Default OFF, and OFF must be byte-for-byte the pre-FR-1B behaviour:
 * `SessionRoute` falls back to the username gate and the claim prompt never
 * renders. This is not a taste flag — it is the DEPLOYMENT.md ordering rule
 * (docs/DEPLOYMENT.md, "What a master push does"). A master push publishes the
 * frontend immediately while the Convex backend is a manual owner deploy, so
 * between those two events the new bundle would be talking to a backend whose
 * daily/blitz/grid handlers still demand a username — every silently-minted
 * visitor would hit a hard `Username required` on their first action. With the
 * flag OFF that window is a no-op; the owner flips it to `true` only after the
 * backend is live (see the runbook in the FR-1B report).
 */
export const ANONYMOUS_FIRST_ENABLED =
  import.meta.env.VITE_ANONYMOUS_FIRST_ENABLED === "true";
