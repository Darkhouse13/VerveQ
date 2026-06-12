/**
 * Generates the STATIC homepage OG card (`public/og/home.png`, 1200x630) so a
 * shared bare verveq.com link unfurls with a branded preview matching the
 * cold-entry positioning. Run from `app/`:
 *
 *   npx tsx scripts/renderHomeOgImage.ts
 *
 * Same design language and renderer as the per-duel taunt cards
 * (convex/lib/duelShareCard.ts + duelShareCardNode.ts): cream ground, hard
 * black frame, orange badge and accent bar, embedded Space Grotesk — the
 * output never depends on system fonts. The PNG is committed; rerun only when
 * the homepage positioning copy changes.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import {
  SHARE_CARD_FONT_BASE64,
  SHARE_CARD_FONT_FAMILY,
} from "../convex/lib/shareCardFontData";

const WIDTH = 1200;
const HEIGHT = 630;

const ACCENT = "PLAY FREE · NO SIGN-UP";

const svg = `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#FAEFDC"/>
  <rect x="14" y="14" width="1172" height="602" fill="none" stroke="#111111" stroke-width="10"/>
  <rect x="940" y="-60" width="200" height="760" fill="#F97A1F" opacity="0.16" transform="rotate(12 1040 315)"/>
  <g transform="rotate(-3 170 110)">
    <rect x="64" y="72" width="220" height="68" fill="#F97A1F" stroke="#111111" stroke-width="6"/>
    <rect x="72" y="80" width="220" height="68" fill="none" stroke="#111111" stroke-width="6"/>
    <text x="174" y="119" font-family="${SHARE_CARD_FONT_FAMILY}" font-size="34" font-weight="700" fill="#FFFFFF" text-anchor="middle">VERVEQ</text>
  </g>
  <text x="72" y="330" font-family="${SHARE_CARD_FONT_FAMILY}" font-size="124" font-weight="700" fill="#111111">Settle it.</text>
  <text x="72" y="404" font-family="${SHARE_CARD_FONT_FAMILY}" font-size="44" font-weight="700" fill="#111111">Prove you know more than your mates.</text>
  <g>
    <rect x="64" y="446" width="${Math.min(1060, 60 + ACCENT.length * 34)}" height="86" fill="#111111"/>
    <text x="94" y="506" font-family="${SHARE_CARD_FONT_FAMILY}" font-size="56" font-weight="700" fill="#F97A1F">${ACCENT}</text>
  </g>
  <text x="1128" y="584" font-family="${SHARE_CARD_FONT_FAMILY}" font-size="28" font-weight="700" fill="#111111" text-anchor="end">verveq.com</text>
</svg>`;

async function main() {
  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
  await initWasm(readFileSync(wasmPath));

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: {
      fontBuffers: [Buffer.from(SHARE_CARD_FONT_BASE64, "base64")],
      loadSystemFonts: false,
      defaultFontFamily: SHARE_CARD_FONT_FAMILY,
    },
  });
  const png = resvg.render().asPng();

  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../public/og/home.png",
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log(`Wrote ${outPath} (${png.byteLength} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
