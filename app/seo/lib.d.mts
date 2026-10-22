/** Types for the parts of seo/lib.mjs the tests import. */
export const BRAND_LOCKUP_SVG: string;
export const SEO_CSS: string;
export function renderBody(page: {
  path: string;
  body: string;
  lang?: string;
  hideHeader?: boolean;
  breadcrumbs?: Array<{ name: string; path: string }> | null;
}): string;
