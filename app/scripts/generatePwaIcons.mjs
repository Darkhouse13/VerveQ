// One-off generator for the PWA / apple-touch icon set (ticket PWA-1).
//
// Source of truth is public/vq-logo.png — a 512x512 RGBA lime disc carrying the
// near-black "VQ" wordmark, with transparent corners outside the disc. Every
// output below is derived from it, so the icons can never drift from the logo.
//
// Outputs are COMMITTED to public/. sharp is deliberately NOT a dependency of
// app/package.json: production builds run `npm ci` on the deploy host
// (deploy/build-and-run.sh), and adding a native binary to that path risks
// breaking a release for a step that only ever needs to run when the logo
// changes. Run this by hand instead:
//
//   npm --prefix /tmp/vq-icongen install sharp@0.35.3
//   NODE_PATH=/tmp/vq-icongen/node_modules node scripts/generatePwaIcons.mjs
//
// Backgrounds: BRAND_INK is the repo's near-black token (--foreground /
// --border / --neo-shadow-color = `0 0% 7%` in src/index.css), matching the
// manifest's theme_color and background_color.

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(appDir, "public");
const SOURCE = path.join(publicDir, "vq-logo.png");

// hsl(0 0% 7%) -> #121212
const BRAND_INK = { r: 18, g: 18, b: 18, alpha: 1 };

// Maskable icons may be cropped to the central 80% by the platform's mask, so
// the artwork is inset to fit that safe zone with the disc fully intact.
const MASKABLE_SAFE_RATIO = 0.8;

/**
 * The disc's lime, read out of the source rather than hardcoded.
 *
 * It has to be the LOGO's exact lime, not the `--accent` token: the token is
 * hsl(75 100% 55%) = rgb(198,255,26) while the disc is rgb(198,255,0), and
 * filling a full-bleed field with the token would leave the disc's rim
 * visible as a ring — precisely what full-bleed has to avoid. Sampling keeps
 * the field welded to the artwork if the logo is ever redrawn.
 *
 * Sampled mid-height, 6% in from the left: inside the inscribed disc, clear of
 * both the transparent corners and the VQ letterforms.
 */
async function discColor() {
  const { data, info } = await sharp(SOURCE).raw().toBuffer({ resolveWithObject: true });
  const x = Math.round(info.width * 0.06);
  const y = Math.round(info.height * 0.5);
  const i = (y * info.width + x) * info.channels;
  if (data[i + 3] !== 255) throw new Error("sample point is not opaque — logo geometry changed");
  return { r: data[i], g: data[i + 1], b: data[i + 2], alpha: 1 };
}

/** Transparent-background resize, for contexts that honour alpha. */
async function writeTransparent(size, outName) {
  const out = path.join(publicDir, outName);
  await sharp(SOURCE)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  return out;
}

/**
 * Flatten the logo onto a solid near-black field. `scale` shrinks the artwork
 * within the canvas — 1 for edge-to-edge, MASKABLE_SAFE_RATIO for maskable.
 */
async function writeOnInk(size, outName, scale) {
  const out = path.join(publicDir, outName);
  const artwork = Math.round(size * scale);
  const logo = await sharp(SOURCE).resize(artwork, artwork, { fit: "contain" }).png().toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_INK },
  })
    .composite([{ input: logo, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  return out;
}

/**
 * Full-bleed icon for iOS. iOS reads apple-touch-icon (never the manifest's
 * icon list), ignores alpha, and applies its own corner mask — so it wants
 * artwork that fills the square edge to edge. The PWA-1 disc-on-a-field
 * version read as a small logo stranded in a dead square.
 *
 * The trick is that the field IS the disc's own lime: compositing the logo
 * over it makes the disc dissolve into the background and leaves only the VQ
 * mark, so the lime runs to all four edges while the mark keeps the exact
 * proportions it has in the maskable icon (same `scale`).
 */
async function writeFullBleed(size, outName, scale) {
  const out = path.join(publicDir, outName);
  const lime = await discColor();
  const artwork = Math.round(size * scale);
  const logo = await sharp(SOURCE).resize(artwork, artwork, { fit: "contain" }).png().toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background: lime } })
    .composite([{ input: logo, gravity: "centre" }])
    // Drop the alpha channel outright — "opaque" for iOS means no alpha at
    // all, not merely alpha=255. flatten() composites any transparency onto
    // the field; removeAlpha() then drops the now-redundant channel, which
    // flatten() on its own does not do for a 4-channel pipeline.
    .flatten({ background: lime })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out);
  return out;
}

const written = [
  // Standard any-purpose icons. Transparency preserved so the disc reads as a
  // disc wherever the launcher paints its own background.
  await writeTransparent(192, "pwa-192x192.png"),
  await writeTransparent(512, "pwa-512x512.png"),
  // Maskable: opaque field + inset artwork, so no mask shape can clip the mark.
  await writeOnInk(512, "pwa-maskable-512x512.png", MASKABLE_SAFE_RATIO),
  // iOS home screen. Same mark scale as the maskable icon above, on a lime
  // field that reaches every edge.
  await writeFullBleed(180, "apple-touch-icon.png", MASKABLE_SAFE_RATIO),
  // Superseded by apple-touch-icon.png above and no longer referenced by
  // index.html; still emitted because vite.config.ts's `includeAssets` names
  // it, and that file is outside this ticket's scope.
  await writeOnInk(180, "apple-touch-icon-180x180.png", 1),
];

for (const file of written) {
  const { width, height, channels } = await sharp(file).metadata();
  console.log(`${path.relative(appDir, file)} ${width}x${height} ch=${channels}`);
}
