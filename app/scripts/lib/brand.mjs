/**
 * The VerveQ brand for Node-side painters (VerveQ ONE P4.4): app icons, the
 * SEO preview cards (seo/og.mjs) and the design-token export.
 *
 * Every value is read from its one source, so nothing here can drift:
 *   - colors: the HSL custom properties in src/index.css;
 *   - the mark and the VERVEQ wordmark: the glyph outlines in
 *     src/components/ui/brandMark.geometry.json (the same geometry
 *     <BrandMark /> and public/brand/*.svg use).
 *
 * All lettering here is outlines, so nothing depends on a font.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

export const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const geometry = JSON.parse(
  readFileSync(path.join(APP, "src/components/ui/brandMark.geometry.json"), "utf8"),
);

let cssCache = null;
function css() {
  cssCache ??= readFileSync(path.join(APP, "src/index.css"), "utf8");
  return cssCache;
}

/** `--name: H S% L%` from src/index.css (first declaration = `:root`), as [h, s, l]. */
export function tokenHsl(name) {
  const m = css().match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  if (!m) throw new Error(`token --${name} not found in src/index.css`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
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

/** A token as `#RRGGBB`. */
export function token(name) {
  return hslToHex(...tokenHsl(name));
}

export const INK = token("ink");
export const CREAM = token("cream");
export const LIME = token("lime");

// ── SVG pieces ──────────────────────────────────────────────────────────────

const r3 = (n) => Math.round(n * 1e5) / 1e5;

/**
 * The mark — ink rounded square tilted -4°, lime "VQ" — at `size` px with its
 * viewBox's top-left at (x, y). `rim` is the opacity of the faint cream inner
 * edge that keeps the ink square visible on an ink ground (0 = none).
 */
export function markSvg(x, y, size, { rim = 0.22 } = {}) {
  const { mark: m } = geometry;
  const k = size / m.viewBox;
  const half = m.viewBox / 2;
  const inset = (m.viewBox - m.square.size) / 2;
  const glyphs = m.letters.glyphs.map((g) => `<path transform="translate(${g.x} 0)" d="${g.d}"/>`).join("");
  return (
    `<g transform="translate(${r3(x)} ${r3(y)}) scale(${r3(k)})"><g transform="rotate(${m.tilt} ${half} ${half})">` +
    `<rect x="${inset}" y="${inset}" width="${m.square.size}" height="${m.square.size}" rx="${m.square.radius}" fill="${INK}"/>` +
    (rim > 0
      ? `<rect x="${inset + 0.75}" y="${inset + 0.75}" width="${m.square.size - 1.5}" height="${m.square.size - 1.5}" rx="${m.square.radius - 0.75}" fill="none" stroke="${CREAM}" stroke-opacity="${rim}" stroke-width="1.5"/>`
      : "") +
    `<g fill="${LIME}" transform="translate(${m.letters.x} ${m.letters.baseline}) scale(${m.letters.scale})">${glyphs}</g>` +
    `</g></g>`
  );
}

/**
 * Just the mark's lime "VQ", tilted with the mark, laid out exactly as it sits
 * in a mark whose ink square is `squarePx` wide, centered on (cx, cy) — for
 * surfaces where the ink square IS the canvas (app icons, the avatar). The
 * letters span ~70% of `squarePx`.
 */
export function markLettersSvg(cx, cy, squarePx) {
  const { mark: m } = geometry;
  const L = m.letters;
  const u = squarePx / m.square.size; // px per mark unit
  const half = m.viewBox / 2;
  const glyphs = L.glyphs.map((g) => `<path transform="translate(${g.x} 0)" d="${g.d}"/>`).join("");
  return (
    `<g transform="rotate(${m.tilt} ${r3(cx)} ${r3(cy)})">` +
    `<g fill="${LIME}" transform="translate(${r3(cx + (L.x - half) * u)} ${r3(cy + (L.baseline - half) * u)}) scale(${r3(L.scale * u)})">${glyphs}</g>` +
    `</g>`
  );
}

/**
 * The card ground: ink with a faint lime diagonal stripe — the same picture as
 * renderOgCards.mjs's `<pattern>` (22-wide bars every 56, rotated -30°), drawn
 * as plain rects because resvg rasterises a pattern fill ~7× slower.
 */
export function stripedGroundSvg(width, height) {
  const bars = [];
  const reach = Math.ceil((width + height) / 56) + 2;
  for (let k = -reach; k <= reach; k++) {
    bars.push(`<rect x="${k * 56}" y="${-2 * (width + height)}" width="22" height="${4 * (width + height)}"/>`);
  }
  return (
    `<rect width="${width}" height="${height}" fill="${INK}"/>` +
    `<g fill="${LIME}" fill-opacity="0.06" transform="rotate(-30)">${bars.join("")}</g>`
  );
}

/** VERVEQ in the wordmark outlines, cap height `cap` px, baseline-left at (x, y). */
export function wordmarkSvg(x, y, cap, fill = CREAM) {
  const { wordmark: w } = geometry;
  const k = cap / w.capHeight;
  const letters = [...w.text];
  const glyphs = letters
    .map((c, i) => `<path transform="translate(${i * (w.advance + w.tracking)} 0)" d="${w.glyphs[c]}"/>`)
    .join("");
  const width = (letters.length * w.advance + (letters.length - 1) * w.tracking) * k;
  return { svg: `<g fill="${fill}" transform="translate(${r3(x)} ${r3(y)}) scale(${r3(k)})">${glyphs}</g>`, width };
}

// ── Raster ──────────────────────────────────────────────────────────────────

let resvgReady = null;
/** resvg-wasm, initialised once. */
export async function loadResvg() {
  resvgReady ??= (async () => {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const resvg = await import("@resvg/resvg-wasm");
    await resvg.initWasm(readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
    return resvg;
  })();
  return resvgReady;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * Encode straight RGBA pixels as a PNG. `alpha: false` writes color type 2
 * (RGB, no alpha channel at all) — what iOS means by an opaque icon — and
 * requires every pixel to already be opaque.
 */
export function encodePng(rgba, width, height, { alpha = true } = {}) {
  const channels = alpha ? 4 : 3;
  const stride = width * channels + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const o = y * stride + 1 + x * channels;
      if (!alpha && rgba[i + 3] !== 255) throw new Error(`pixel ${x},${y} is not opaque`);
      raw[o] = rgba[i];
      raw[o + 1] = rgba[i + 1];
      raw[o + 2] = rgba[i + 2];
      if (alpha) raw[o + 3] = rgba[i + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = alpha ? 6 : 2; // RGBA : RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Rasterise an SVG to a PNG buffer at `width` px. */
export async function svgToPng(svg, width, { alpha = true, fontBuffers = [] } = {}) {
  const { Resvg } = await loadResvg();
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontBuffers, loadSystemFonts: false },
  });
  const img = r.render();
  const png = encodePng(img.pixels, img.width, img.height, { alpha });
  img.free();
  r.free();
  return png;
}
