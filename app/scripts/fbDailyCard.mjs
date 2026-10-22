/**
 * The Facebook daily card (owner, 2026-10-22): the first pair of a day's
 * Who's Older as a 4:5 image, plus a caption whose link opens that day's game.
 * Facebook-only — it can carry a clickable link, which an Instagram post
 * can't — and it runs alongside the reels, which keep going to both.
 *
 *   node app/scripts/fbDailyCard.mjs --date 2026-10-23 --out <queue>/<date>/fbdaily
 *
 * Writes card.jpg and post.json ({ platforms: ["facebook"] }) into --out, the
 * layout tools/social/publish.mjs reads. The pair comes from the game's own
 * code (convex/lib/whosOlder.ts buildDailyPairs over the same player pool), so
 * the card always shows the pair the game deals first that day. Names only:
 * no birth dates, nothing that gives the answer away.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { APP, CREAM, INK, LIME, markSvg, stripedGroundSvg, svgToPng, wordmarkSvg, loadResvg } from "./lib/brand.mjs";

const argv = process.argv.slice(2);
const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const date = arg("--date");
const out = arg("--out");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !out) {
  throw new Error("usage: fbDailyCard.mjs --date YYYY-MM-DD --out <dir>");
}

// ── The day's first pair, from the game's own code ──────────────────────────

const scratch = mkdtempSync(path.join(tmpdir(), "fb-daily-"));
let lib;
try {
  const bundled = path.join(scratch, "whosOlder.mjs");
  await build({
    entryPoints: [path.join(APP, "convex/lib/whosOlder.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: bundled,
    logLevel: "silent",
  });
  lib = await import(pathToFileURL(bundled).href);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
const pool = JSON.parse(readFileSync(path.join(APP, "convex/data/whos_older_players.json"), "utf8"));
const [first] = lib.buildDailyPairs(pool, date);
if (!first) throw new Error(`no Who's Older pair for ${date}`);
const edition = lib.editionNumberForDate(date);
const [a, b] = [first.a.name, first.b.name];

// ── The card ────────────────────────────────────────────────────────────────

const W = 1080;
const H = 1350;
const BLUE = "#0084FF"; // Who's Older's mode color (decision 12); text on it is ink
const HEAD = "Space Grotesk";
const MONO = "JetBrains Mono";
const FONTS = ["space-grotesk-700.ttf", "jetbrains-mono-700.ttf"].map((f) =>
  Uint8Array.from(readFileSync(path.join(APP, "scripts/og/fonts", f))),
);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const { Resvg } = await loadResvg();
/** Largest size ≤ `size` at which one line of `str` fits `maxWidth` (resvg's own layout). */
function fit(str, family, size, maxWidth) {
  for (let s = size; s > 24; s -= 2) {
    const r = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 3}" height="300"><text x="0" y="200" font-family="${family}" font-weight="700" font-size="${s}">${esc(str)}</text></svg>`,
      { font: { fontBuffers: FONTS, loadSystemFonts: false } },
    );
    const width = r.getBBox()?.width ?? 0;
    r.free();
    if (width <= maxWidth) return s;
  }
  return 24;
}
const text = (x, y, str, { family = HEAD, size, fill = CREAM, anchor = "middle", spacing = 0, opacity = 1 }) =>
  `<text x="${x}" y="${y}" font-family="${family}" font-weight="700" font-size="${size}" fill="${fill}"` +
  `${opacity < 1 ? ` fill-opacity="${opacity}"` : ""} text-anchor="${anchor}"${spacing ? ` letter-spacing="${spacing}"` : ""}>${esc(str)}</text>`;

const PAD = 90;
const CARD_W = W - 2 * PAD;
const CARD_H = 250;
function nameCard(y, name) {
  const size = fit(name, HEAD, 92, CARD_W - 80);
  return (
    `<rect x="${PAD + 8}" y="${y + 8}" width="${CARD_W}" height="${CARD_H}" rx="18" fill="#000"/>` +
    `<rect x="${PAD}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="18" fill="${BLUE}" stroke="${INK}" stroke-width="4"/>` +
    text(W / 2, y + CARD_H / 2 + size * 0.35, name, { size, fill: INK })
  );
}

const lockupMark = 76;
const word = wordmarkSvg(0, 0, 30);
const lockupW = lockupMark + 18 + word.width;
const lx = (W - lockupW) / 2;
const brand = markSvg(lx, 70, lockupMark) + wordmarkSvg(lx + lockupMark + 18, 70 + lockupMark / 2 + 15, 30).svg;

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  stripedGroundSvg(W, H) +
  brand +
  text(W / 2, 236, `WHO'S OLDER? · DAILY #${edition}`, { family: MONO, size: 30, spacing: 4, opacity: 0.7 }) +
  text(W / 2, 352, "Who's older?", { size: 112 }) +
  nameCard(430, a) +
  text(W / 2, 768, "or", { size: 56, opacity: 0.7 }) +
  nameCard(810, b) +
  text(W / 2, 1172, "Play today's 10 pairs, free", { size: 44 }) +
  text(W / 2, 1240, "verveq.com/older", { family: MONO, size: 40, fill: LIME }) +
  `</svg>`;

mkdirSync(out, { recursive: true });
const pngPath = path.join(out, "card.png");
writeFileSync(pngPath, await svgToPng(svg, W, { alpha: false, fontBuffers: FONTS }));
// Postiz (and Instagram, should this ever go there) take JPG, not PNG.
const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", pngPath, "-q:v", "2", path.join(out, "card.jpg")]);
if (ff.status !== 0) throw new Error(`ffmpeg failed: ${ff.stderr}`);
rmSync(pngPath);

const caption = [
  `Who's older: ${a} or ${b}?`,
  "Say it in the comments, then check yourself 👇",
  "https://verveq.com/older?ref=fb_daily",
  "Today's 10 pairs, free, no sign-up.",
].join("\n");
writeFileSync(
  path.join(out, "post.json"),
  JSON.stringify({ kind: "fbdaily", media: ["card.jpg"], platforms: ["facebook"], caption }, null, 2) + "\n",
);
console.log(`[fb-daily] ${date}: #${edition} ${a} vs ${b} → ${out}`);
