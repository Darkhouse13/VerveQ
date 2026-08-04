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

const written = [
  // Standard any-purpose icons. Transparency preserved so the disc reads as a
  // disc wherever the launcher paints its own background.
  await writeTransparent(192, "pwa-192x192.png"),
  await writeTransparent(512, "pwa-512x512.png"),
  // Maskable: opaque field + inset artwork, so no mask shape can clip the mark.
  await writeOnInk(512, "pwa-maskable-512x512.png", MASKABLE_SAFE_RATIO),
  // iOS ignores alpha and composites onto black; flattening here makes the
  // home-screen result deterministic instead of device-dependent.
  await writeOnInk(180, "apple-touch-icon-180x180.png", 1),
];

for (const file of written) {
  const { width, height, channels } = await sharp(file).metadata();
  console.log(`${path.relative(appDir, file)} ${width}x${height} ch=${channels}`);
}
