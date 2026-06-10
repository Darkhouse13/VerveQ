/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_CONVEX_SITE_URL?: string;
  /** When "true", reveals the Learn entry point on the homepage. Default OFF. */
  readonly VITE_LEARN_ENABLED?: string;
  /** When "1" in DEV builds only, the Learn runner serves the offline fixture deck. */
  readonly VITE_LEARN_FIXTURES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
