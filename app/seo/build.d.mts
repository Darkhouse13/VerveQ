/** Types for seo/build.mjs, imported by vite.config.ts. */
export function generate(options: {
  distDir: string;
  refreshSnapshot?: boolean;
  log?: (message: string) => void;
}): Promise<{ pages: Array<{ path: string }>; source: string }>;
