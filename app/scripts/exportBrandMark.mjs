/**
 * Writes the VerveQ brand as standalone SVGs (VerveQ ONE decision 3), from the
 * same geometry the app's <BrandMark /> renders, so icons, OG images and any
 * other off-app use can be generated from one source:
 *
 *   public/brand/verveq-mark.svg          the mark (ink square, lime VQ)
 *   public/brand/verveq-lockup.svg        mark + VERVEQ, ink wordmark (cream grounds)
 *   public/brand/verveq-lockup-cream.svg  mark + VERVEQ, cream wordmark (ink grounds)
 *
 * Colors come from the `--ink` / `--lime` / `--cream` tokens in src/index.css,
 * converted to hex so every SVG renderer reads them. All lettering is outlines:
 * the files need no fonts.
 *
 *   node scripts/exportBrandMark.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const geometry = JSON.parse(
  readFileSync(path.join(APP, "src/components/ui/brandMark.geometry.json"), "utf8"),
);
const css = readFileSync(path.join(APP, "src/index.css"), "utf8");

function token(name) {
  const m = css.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  if (!m) throw new Error(`token --${name} not found in src/index.css`);
  return hslToHex(Number(m[1]), Number(m[2]) / 100, Number(m[3]) / 100);
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

const INK = token("ink");
const LIME = token("lime");
const CREAM = token("cream");

const { mark, wordmark } = geometry;
const VIEW = mark.viewBox;
const HALF = VIEW / 2;
const INSET = (VIEW - mark.square.size) / 2;

/** The mark's drawing, in a VIEW×VIEW box at the origin. */
function markGroup() {
  const L = mark.letters;
  const glyphs = L.glyphs
    .map((g) => `<path transform="translate(${g.x} 0)" d="${g.d}"/>`)
    .join("");
  return (
    `<g transform="rotate(${mark.tilt} ${HALF} ${HALF})">` +
    `<rect x="${INSET}" y="${INSET}" width="${mark.square.size}" height="${mark.square.size}" rx="${mark.square.radius}" fill="${INK}"/>` +
    `<g fill="${LIME}" transform="translate(${L.x} ${L.baseline}) scale(${L.scale})">${glyphs}</g>` +
    `</g>`
  );
}

// Lockup: wordmark cap height ≈ 30% of the mark, vertically centered on it.
const WORD_SIZE = 26; // px per em
const WORD_GAP = 16;
const wScale = WORD_SIZE / wordmark.upm;
const letters = [...wordmark.text];
const wordWidth =
  (letters.length * wordmark.advance + (letters.length - 1) * wordmark.tracking) * wScale;
const wordBaseline = HALF + (wordmark.capHeight * wScale) / 2;

function wordGroup(fill) {
  const glyphs = letters
    .map(
      (c, i) =>
        `<path transform="translate(${i * (wordmark.advance + wordmark.tracking)} 0)" d="${wordmark.glyphs[c]}"/>`,
    )
    .join("");
  return `<g fill="${fill}" transform="translate(${VIEW + WORD_GAP} ${round(wordBaseline)}) scale(${wScale})">${glyphs}</g>`;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function svg(width, height, body) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="VerveQ">` +
    `<title>VerveQ</title>${body}</svg>\n`
  );
}

const lockupWidth = Math.ceil(VIEW + WORD_GAP + wordWidth);
const OUT = path.join(APP, "public/brand");
mkdirSync(OUT, { recursive: true });

const files = {
  "verveq-mark.svg": svg(VIEW, VIEW, markGroup()),
  "verveq-lockup.svg": svg(lockupWidth, VIEW, markGroup() + wordGroup(INK)),
  "verveq-lockup-cream.svg": svg(lockupWidth, VIEW, markGroup() + wordGroup(CREAM)),
};
for (const [name, content] of Object.entries(files)) {
  writeFileSync(path.join(OUT, name), content);
  console.log(`wrote public/brand/${name} (${content.length} bytes)`);
}
console.log({ ink: INK, lime: LIME, cream: CREAM });
