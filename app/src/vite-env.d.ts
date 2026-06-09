/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_CONVEX_SITE_URL?: string;
  /** When "true", reveals the Learn entry point on the homepage. Default OFF. */
  readonly VITE_LEARN_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
