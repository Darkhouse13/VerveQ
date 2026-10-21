/**
 * Renders the link-preview cards (1200×630) on the ink brand (VerveQ ONE
 * P2.4): the default/home card and one per shared entry path (Who's Older,
 * Missing Letters, THE WEEKEND, THE DRAW). Run from `app/`:
 *
 *   node scripts/renderOgCards.mjs
 *
 * Writes public/og/<OG_VERSION>/<id>.png (seo/entries.mjs owns the version,
 * the ids and which paths carry which card). The PNGs are committed; rerun
 * when a card's copy or artwork changes, and bump OG_VERSION when it does so
 * preview caches fetch the new image.
 *
 * Brand sources, so nothing drifts:
 *   - colors: the --ink / --cream / --lime tokens in src/index.css;
 *   - the mark and the VERVEQ wordmark: brandMark.geometry.json outlines (the
 *     same geometry <BrandMark /> and public/brand/*.svg use);
 *   - lettering: static 700 instances of the self-hosted fonts in
 *     scripts/og/fonts (resvg reads TTF, not the app's variable WOFF2s).
 *     No system font is ever consulted.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import { ENTRY_CARDS, HOME_CARD, OG_VERSION } from "../seo/entries.mjs";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 1200;
const H = 630;

// ── Brand tokens ────────────────────────────────────────────────────────────

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
  return "#" + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

const INK = token("ink");
const CREAM = token("cream");
const LIME = token("lime");
const RAISED = "#1F1F1F"; // ink card on the ink ground (--card in .theme-ink)
const BLUE = "#0084FF"; // Who's Older
const PINK = "#FF3DC5"; // Missing Letters

const HEAD = "Space Grotesk";
const MONO = "JetBrains Mono";

const geometry = JSON.parse(readFileSync(path.join(APP, "src/components/ui/brandMark.geometry.json"), "utf8"));

// ── Renderer ────────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
await initWasm(readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
const FONTS = ["space-grotesk-700.ttf", "jetbrains-mono-700.ttf"].map((f) =>
  Uint8Array.from(readFileSync(path.join(APP, "scripts/og/fonts", f))),
);

function resvg(svg) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: { fontBuffers: FONTS, loadSystemFonts: false, defaultFontFamily: HEAD },
  });
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Rendered width of one line of text (resvg's own layout, so fitting is exact). */
function measure(text, family, size, spacing = 0) {
  const r = resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 3}" height="400"><text x="0" y="300" font-family="${family}" font-weight="700" font-size="${size}" letter-spacing="${spacing}">${esc(text)}</text></svg>`,
  );
  const box = r.getBBox();
  r.free();
  return box ? box.width : 0;
}

/** Largest size ≤ `size` at which `text` fits `maxWidth`. */
function fit(text, family, size, maxWidth, spacing = 0) {
  let s = size;
  while (s > 20 && measure(text, family, s, spacing) > maxWidth) s -= 2;
  return s;
}

function text(x, y, str, { family = HEAD, size, fill = CREAM, anchor = "start", spacing = 0, opacity = 1 }) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-weight="700" font-size="${size}" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""} text-anchor="${anchor}"${spacing ? ` letter-spacing="${spacing}"` : ""}>${esc(str)}</text>`;
}

// ── Brand pieces (outlines from brandMark.geometry.json) ─────────────────────

/** The mark at `size` px, top-left at (x, y). `rim` keeps the ink square visible on ink. */
function mark(x, y, size, { rim = 0.22 } = {}) {
  const { mark: m } = geometry;
  const k = size / m.viewBox;
  const half = m.viewBox / 2;
  const inset = (m.viewBox - m.square.size) / 2;
  const glyphs = m.letters.glyphs.map((g) => `<path transform="translate(${g.x} 0)" d="${g.d}"/>`).join("");
  return (
    `<g transform="translate(${x} ${y}) scale(${k})"><g transform="rotate(${m.tilt} ${half} ${half})">` +
    `<rect x="${inset}" y="${inset}" width="${m.square.size}" height="${m.square.size}" rx="${m.square.radius}" fill="${INK}"/>` +
    `<rect x="${inset + 0.75}" y="${inset + 0.75}" width="${m.square.size - 1.5}" height="${m.square.size - 1.5}" rx="${m.square.radius - 0.75}" fill="none" stroke="${CREAM}" stroke-opacity="${rim}" stroke-width="1.5"/>` +
    `<g fill="${LIME}" transform="translate(${m.letters.x} ${m.letters.baseline}) scale(${m.letters.scale})">${glyphs}</g>` +
    `</g></g>`
  );
}

/** VERVEQ in the wordmark outlines, cap height `cap` px, baseline at (x, y). Returns { svg, width }. */
function wordmark(x, y, cap, fill = CREAM) {
  const { wordmark: w } = geometry;
  const k = cap / w.capHeight;
  const letters = [...w.text];
  const glyphs = letters
    .map((c, i) => `<path transform="translate(${i * (w.advance + w.tracking)} 0)" d="${w.glyphs[c]}"/>`)
    .join("");
  const width = (letters.length * w.advance + (letters.length - 1) * w.tracking) * k;
  return { svg: `<g fill="${fill}" transform="translate(${x} ${y}) scale(${k})">${glyphs}</g>`, width };
}

// ── Card layout ─────────────────────────────────────────────────────────────

const PAD = 72;
const LEFT_MAX = 640; // the copy column; the hero object owns the right side

function ground() {
  // The reel/story ground: ink with a faint lime diagonal stripe.
  return (
    `<defs><pattern id="stripe" width="56" height="56" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">` +
    `<rect width="22" height="56" fill="${LIME}" fill-opacity="0.06"/></pattern></defs>` +
    `<rect width="${W}" height="${H}" fill="${INK}"/>` +
    `<rect width="${W}" height="${H}" fill="url(#stripe)"/>`
  );
}

function lockup() {
  const size = 76;
  const wm = wordmark(PAD + size + 18, PAD + size / 2 + 11, 22);
  return mark(PAD - 4, PAD, size) + wm.svg;
}

/** The left column: eyebrow, headline, subline, the one lime action, the link. Laid out bottom-up from the action. */
function copy({ eyebrow, accent, headline, subline, url }) {
  const out = [];
  const ctaY = 478;
  const lines = Array.isArray(headline) ? headline : [headline];
  const hSize = Math.min(...lines.map((l) => fit(l, HEAD, lines.length > 1 ? 96 : 108, LEFT_MAX)));
  const sSize = fit(subline, HEAD, 34, LEFT_MAX);
  const subBase = ctaY - 34;
  const lastBase = subBase - sSize * 1.15 - 18;
  const firstBase = lastBase - (lines.length - 1) * hSize * 0.98;
  const eyebrowBase = firstBase - hSize * 0.8 - 26;
  out.push(text(PAD, Math.round(eyebrowBase), eyebrow, { family: MONO, size: 24, fill: accent, spacing: 4 }));
  lines.forEach((l, i) => out.push(text(PAD - 4, Math.round(firstBase + i * hSize * 0.98), l, { size: hSize, spacing: -2 })));
  out.push(text(PAD, Math.round(subBase), subline, { size: sSize, opacity: 0.78 }));

  // The one action: lime, ink lettering.
  const cta = "Can you beat it?";
  const ctaSize = 34;
  const ctaW = measure(cta, HEAD, ctaSize) + 64;
  out.push(
    `<rect x="${PAD}" y="${ctaY}" width="${Math.round(ctaW)}" height="76" rx="10" fill="${LIME}"/>`,
    text(PAD + 32, ctaY + 50, cta, { size: ctaSize, fill: INK }),
  );
  out.push(text(W - PAD, H - 52, url, { family: MONO, size: 22, opacity: 0.62, anchor: "end", spacing: 1 }));
  return out.join("");
}

// ── Hero objects (right side) ───────────────────────────────────────────────

const HERO = { x: 760, y: 120, w: 368, h: 380 };

function heroHome() {
  // The mark, big, with a lime outline offset behind it: the brand IS the card.
  const size = 330;
  const x = HERO.x + 10;
  const y = HERO.y + 6;
  return (
    `<g transform="rotate(-4 ${x + size / 2} ${y + size / 2})"><rect x="${x + 44}" y="${y + 44}" width="${size * 0.875}" height="${size * 0.875}" rx="${size * 0.1875}" fill="none" stroke="${LIME}" stroke-width="5"/></g>` +
    mark(x, y, size, { rim: 0.3 })
  );
}

function heroOlder() {
  // Two player cards, the pair you choose between.
  const card = (cx, cy, rot) =>
    `<g transform="rotate(${rot} ${cx} ${cy})">` +
    `<rect x="${cx - 90 + 10}" y="${cy - 136 + 10}" width="180" height="272" rx="18" fill="${PINK}"/>` +
    `<rect x="${cx - 90}" y="${cy - 136}" width="180" height="272" rx="18" fill="${BLUE}" stroke="${INK}" stroke-width="6"/>` +
    `<circle cx="${cx}" cy="${cy - 30}" r="56" fill="${INK}" fill-opacity="0.2"/>` +
    text(cx, cy - 2, "?", { size: 88, fill: INK, anchor: "middle" }) +
    text(cx, cy + 92, "BORN", { family: MONO, size: 20, fill: INK, anchor: "middle", spacing: 3, opacity: 0.8 }) +
    text(cx, cy + 118, "????", { family: MONO, size: 22, fill: INK, anchor: "middle", spacing: 3 }) +
    `</g>`;
  const vs = `<circle cx="948" cy="318" r="40" fill="${CREAM}" stroke="${INK}" stroke-width="6"/>` + text(948, 330, "VS", { size: 32, fill: INK, anchor: "middle" });
  return card(846, 296, -6) + card(1050, 336, 5) + vs;
}

function heroLetters() {
  // A name with its gaps (K _ N E) on a raised card, nation clue under it.
  const bx = 752;
  const by = 150;
  const bw = 392;
  const bh = 330;
  const cx = bx + bw / 2;
  const box =
    `<rect x="${bx + 12}" y="${by + 12}" width="${bw}" height="${bh}" rx="22" fill="${PINK}"/>` +
    `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="22" fill="${RAISED}" stroke="${INK}" stroke-width="6"/>` +
    text(cx, by + 62, "NAME 4 / 10", { family: MONO, size: 22, anchor: "middle", spacing: 4, opacity: 0.7 });
  const letters = ["K", null, "N", "E"];
  const size = 78;
  const gap = 10;
  const total = letters.length * size + (letters.length - 1) * gap;
  const x0 = cx - total / 2;
  const y0 = by + 104;
  const tiles = letters
    .map((ch, i) => {
      const x = x0 + i * (size + gap);
      const rot = [-4, 3, -2, 4][i];
      const tx = x + size / 2;
      const ty = y0 + size / 2;
      return ch
        ? `<g transform="rotate(${rot} ${tx} ${ty})"><rect x="${x}" y="${y0}" width="${size}" height="${size}" rx="12" fill="${PINK}" stroke="${INK}" stroke-width="5"/>${text(tx, y0 + 58, ch, { size: 52, fill: INK, anchor: "middle" })}</g>`
        : `<g transform="rotate(${rot} ${tx} ${ty})"><rect x="${x + 3}" y="${y0 + 3}" width="${size - 6}" height="${size - 6}" rx="10" fill="${INK}" stroke="${PINK}" stroke-width="4" stroke-dasharray="12 8"/>${text(tx, y0 + 56, "?", { size: 48, fill: PINK, anchor: "middle" })}</g>`;
    })
    .join("");
  const clue =
    `<rect x="${cx - 100}" y="${by + 226}" width="200" height="50" rx="25" fill="none" stroke="${CREAM}" stroke-opacity="0.45" stroke-width="3"/>` +
    text(cx, by + 259, "ENGLAND", { family: MONO, size: 22, anchor: "middle", spacing: 4, opacity: 0.85 });
  return box + tiles + clue;
}

function heroWeekend() {
  // A half pitch in lime outline, a squad on it.
  const x = HERO.x + 14;
  const y = 112;
  const w = 340;
  const h = 400;
  const cx = x + w / 2;
  const line = `fill="none" stroke="${LIME}" stroke-width="4"`;
  const pitch =
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" ${line}/>` +
    `<line x1="${x}" y1="${y + h / 2}" x2="${x + w}" y2="${y + h / 2}" stroke="${LIME}" stroke-width="4" stroke-opacity="0.5"/>` +
    `<circle cx="${cx}" cy="${y + h / 2}" r="46" fill="none" stroke="${LIME}" stroke-width="4" stroke-opacity="0.5"/>` +
    `<rect x="${cx - 90}" y="${y + h - 70}" width="180" height="70" ${line}/>` +
    `<rect x="${cx - 90}" y="${y}" width="180" height="70" ${line} stroke-opacity="0.5"/>`;
  const spots = [
    [0.5, 0.9], [0.18, 0.7], [0.39, 0.72], [0.61, 0.72], [0.82, 0.7],
    [0.25, 0.47], [0.5, 0.42], [0.75, 0.47], [0.22, 0.2], [0.5, 0.16], [0.78, 0.2],
  ];
  const dots = spots
    .map(([fx, fy]) => `<circle cx="${x + fx * w}" cy="${y + fy * h}" r="17" fill="${CREAM}" stroke="${INK}" stroke-width="4"/>`)
    .join("");
  return pitch + dots;
}

function heroDraw() {
  // A fanned hand of cards in lime outline; the top one is today's board.
  const cx = HERO.x + HERO.w / 2 + 4;
  const cy = 318;
  const cardW = 196;
  const cardH = 280;
  const card = (rot, dx, top) =>
    `<g transform="rotate(${rot} ${cx} ${cy + 260})"><rect x="${cx - cardW / 2 + dx}" y="${cy - cardH / 2}" width="${cardW}" height="${cardH}" rx="18" fill="${RAISED}" stroke="${LIME}" stroke-width="${top ? 5 : 4}" stroke-opacity="${top ? 1 : 0.55}"/>` +
    (top
      ? text(cx + dx, cy - 76, "DRAFT", { family: MONO, size: 22, anchor: "middle", spacing: 4, opacity: 0.75 }) +
        text(cx + dx, cy + 44, "6", { family: MONO, size: 132, fill: LIME, anchor: "middle" }) +
        text(cx + dx, cy + 100, "PLAYERS", { family: MONO, size: 22, anchor: "middle", spacing: 4, opacity: 0.75 })
      : "") +
    `</g>`;
  return card(-16, -10, false) + card(14, 10, false) + card(0, 0, true);
}

// ── Cards ───────────────────────────────────────────────────────────────────

const DESIGNS = {
  home: {
    eyebrow: "DAILY FOOTBALL GAMES",
    accent: LIME,
    headline: ["Daily football", "games."],
    subline: "Who's Older, Missing Letters, Career Path and more.",
    url: "verveq.com",
    hero: heroHome,
  },
  older: {
    eyebrow: "WHO'S OLDER · DAILY",
    accent: BLUE,
    headline: "Who's older?",
    subline: "Ten football pairs a day.",
    url: "verveq.com/older",
    hero: heroOlder,
  },
  letters: {
    eyebrow: "MISSING LETTERS · DAILY",
    accent: PINK,
    headline: ["Missing", "Letters"],
    subline: "Name the footballer from the gaps.",
    url: "verveq.com/letters",
    hero: heroLetters,
  },
  weekend: {
    eyebrow: "THE WEEKEND · FANTASY",
    accent: LIME,
    headline: "The Weekend",
    subline: "Pick a squad. Real matches score it.",
    url: "verveq.com/weekend",
    hero: heroWeekend,
  },
  draw: {
    eyebrow: "THE DRAW · ONE BOARD A DAY",
    accent: LIME,
    headline: "The Draw",
    subline: "Draft six players. Run the gauntlet.",
    url: "verveq.com/draw",
    hero: heroDraw,
  },
};

function cardSvg(d) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    ground() + d.hero() + lockup() + copy(d) +
    `</svg>`
  );
}

const outDir = path.join(APP, "public/og", OG_VERSION);
mkdirSync(outDir, { recursive: true });
for (const card of [HOME_CARD, ...ENTRY_CARDS]) {
  const design = DESIGNS[card.id];
  if (!design) throw new Error(`no design for card "${card.id}"`);
  const r = resvg(cardSvg(design));
  const png = r.render().asPng();
  r.free();
  const out = path.join(APP, "public", card.image);
  writeFileSync(out, png);
  console.log(`wrote public${card.image} (${png.byteLength} bytes)`);
}
