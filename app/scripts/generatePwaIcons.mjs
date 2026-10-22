/**
 * Generates every app icon from the brand mark (VerveQ ONE P4.4; first written
 * for PWA-1 off the old lime "VQ" disc PNG, now retired as a source).
 *
 * Source of truth: the mark's geometry and the brand tokens, through
 * scripts/lib/brand.mjs (src/components/ui/brandMark.geometry.json +
 * src/index.css). Rasterised with resvg-wasm, which is already a dependency —
 * no native image library on the deploy path. Run from `app/` when the mark
 * changes:
 *
 *   node scripts/generatePwaIcons.mjs
 *
 * Outputs are COMMITTED to public/ and keep their file names; the references
 * carry a `?v=` (index.html, vite.config.ts, the legal pages) because nginx
 * serves PNGs `immutable` for 30 days — bump ICON_VERSION in vite.config.ts
 * and the html links together when the artwork changes again.
 *
 * Two kinds of icon:
 *  - THE MARK (transparent): the tilted ink square with lime VQ, for contexts
 *    that honour alpha and draw their own background — browser tabs, the
 *    manifest's `any` icons.
 *  - THE TILE (opaque, ink to every edge): for contexts that apply their own
 *    mask — iOS (reads apple-touch-icon, ignores alpha, rounds the corners),
 *    Android maskable icons, the Instagram avatar's circle crop. Here the
 *    platform's mask IS the ink square, so only the lime VQ is drawn on it,
 *    tilted -4° with the mark. iOS wants no alpha channel at all, so the
 *    opaque files are written as RGB PNGs.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { APP, INK, markLettersSvg, markSvg, svgToPng } from "./lib/brand.mjs";

const PUBLIC = path.join(APP, "public");

/** The mark on transparent, filling the canvas (its tilted square stays inside the 64-unit box). */
function markIcon(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${markSvg(0, 0, size, { rim: 0.22 })}</svg>`;
}

/**
 * Ink to every edge, lime VQ in the middle. `fill` is how much of the canvas
 * the mark's square would cover: the letters span ~70% of that.
 *  - 0.86 for iOS and the Instagram avatar (letters ≈ 60% of the icon; their
 *    corners stay well inside Instagram's circle crop);
 *  - 0.78 for maskable: every corner of the letters stays inside the
 *    80%-diameter safe circle.
 */
function tileIcon(size, fill) {
  const c = size / 2;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<rect width="${size}" height="${size}" fill="${INK}"/>` +
    markLettersSvg(c, c, size * fill) +
    `</svg>`
  );
}

const ICONS = [
  // Browser tab / generic. favicon.svg is the crisp vector; vq-logo.png the
  // raster fallback (and the old link target, kept for anything that hard-codes it).
  { file: "vq-logo.png", size: 512, svg: markIcon(512), alpha: true },
  { file: "favicon-48x48.png", size: 48, svg: markIcon(48), alpha: true },
  // Manifest `any`: launchers that honour alpha show the mark itself.
  { file: "pwa-192x192.png", size: 192, svg: markIcon(192), alpha: true },
  { file: "pwa-512x512.png", size: 512, svg: markIcon(512), alpha: true },
  // Manifest `maskable`: opaque, letters inside the safe circle.
  { file: "pwa-maskable-512x512.png", size: 512, svg: tileIcon(512, 0.78), alpha: false },
  // iOS home screen: opaque, full-bleed. apple-touch-icon-180x180.png is the
  // name vite.config.ts's includeAssets/globPatterns precache; same artwork.
  { file: "apple-touch-icon.png", size: 180, svg: tileIcon(180, 0.86), alpha: false },
  { file: "apple-touch-icon-180x180.png", size: 180, svg: tileIcon(180, 0.86), alpha: false },
  // Instagram profile picture (uploaded by hand): circle-cropped; the letters'
  // corners stay well inside the circle at the iOS proportion.
  { file: "brand/instagram-avatar.png", size: 1080, svg: tileIcon(1080, 0.86), alpha: false },
];

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${markSvg(0, 0, 64, { rim: 0.22 })}</svg>\n`;

mkdirSync(path.join(PUBLIC, "brand"), { recursive: true });
writeFileSync(path.join(PUBLIC, "favicon.svg"), FAVICON_SVG);
console.log(`wrote public/favicon.svg (${FAVICON_SVG.length} bytes)`);
for (const icon of ICONS) {
  const png = await svgToPng(icon.svg, icon.size, { alpha: icon.alpha });
  writeFileSync(path.join(PUBLIC, icon.file), png);
  console.log(`wrote public/${icon.file} ${icon.size}x${icon.size} ${icon.alpha ? "RGBA" : "RGB"} (${png.byteLength} bytes)`);
}

export { ICONS };
