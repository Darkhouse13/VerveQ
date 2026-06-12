/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_CONVEX_SITE_URL?: string;
  /** Public base for duel share links (default https://verveq.com). */
  readonly VITE_SHARE_BASE_URL?: string;
  /** When "true", reveals the Learn entry point on the homepage. Default OFF. */
  readonly VITE_LEARN_ENABLED?: string;
  /** When "1" in DEV builds only, the Learn runner serves the offline fixture deck. */
  readonly VITE_LEARN_FIXTURES?: string;
  /** Public Sentry client DSN. Error monitoring inits only when PROD && set. */
  readonly VITE_SENTRY_DSN?: string;
  /** Build-injected release id (git short SHA — equals the deployed image SHA). */
  readonly VITE_RELEASE_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
