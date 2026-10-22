/**
 * Social / search preview cards (1200×630) for the static layer's game and
 * section pages, rendered at build time with resvg-wasm.
 *
 * The look is the per-game entry cards' (scripts/renderOgCards.mjs, VerveQ ONE
 * P2.4), moved here in P4.4: ink ground with a faint lime stripe, the mark +
 * VERVEQ lockup, a mono eyebrow, cream headline, the one lime action, the
 * tilted mark as the hero. Colors and the mark come from scripts/lib/brand.mjs
 * (src/index.css + brandMark.geometry.json); lettering uses the static 700
 * TTFs in scripts/og/fonts. No system font is ever consulted.
 *
 * The files land in dist/<OG_DIR>/. Preview caches key on the image URL, so
 * OG_DIR carries a version: bump it whenever the artwork changes.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { APP, CREAM, INK, LIME, loadResvg, markSvg, stripedGroundSvg, wordmarkSvg } from "../scripts/lib/brand.mjs";

/** Where the cards are written under dist/, and served from. */
export const OG_DIR = "og/pages-v2";

const W = 1200;
const H = 630;
const HEAD = "Space Grotesk";
const MONO = "JetBrains Mono";

let ready = null;
async function init() {
  ready ??= (async () => {
    const resvg = await loadResvg();
    // Plain Uint8Arrays, not Buffers: under vitest's jsdom realm resvg
    // rejects a Node Buffer passed as a font.
    // Space Grotesk: the full Bold the Convex share card embeds — the static
    // TTF in scripts/og/fonts is ASCII-only, and the FR/ES cards need é, ú, ñ…
    // JetBrains Mono: the static TTF; resvg falls back to Space Grotesk for
    // the few accented capitals an eyebrow may carry.
    const src = readFileSync(path.join(APP, "convex/lib/shareCardFontData.ts"), "utf8");
    const grotesk = Buffer.from(src.match(/SHARE_CARD_FONT_BASE64\s*=\s*"([^"]+)"/)[1], "base64");
    const mono = readFileSync(path.join(APP, "scripts/og/fonts/jetbrains-mono-700.ttf"));
    const fonts = [grotesk, mono].map((b) => Uint8Array.from(b));
    return { resvg, fonts };
  })();
  return ready;
}

const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function make(resvg, fonts, svg) {
  return new resvg.Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: HEAD },
  });
}

/** Rendered width of one line of text (resvg's own layout). */
function measure(ctx, str, family, size, spacing = 0) {
  const r = make(
    ctx.resvg,
    ctx.fonts,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 4}" height="400"><text x="0" y="300" font-family="${family}" font-weight="700" font-size="${size}" letter-spacing="${spacing}">${x(str)}</text></svg>`,
  );
  const box = r.getBBox();
  r.free();
  return box ? box.width : 0;
}

/** Largest size ≤ `size` at which `str` fits `maxWidth` (width scales ~linearly with size). */
function fit(ctx, str, family, size, maxWidth, spacing = 0) {
  const width = measure(ctx, str, family, size, spacing);
  return width <= maxWidth ? size : Math.floor((size * maxWidth) / width);
}

function text(px, py, str, { family = HEAD, size, fill = CREAM, anchor = "start", spacing = 0, opacity = 1 }) {
  return `<text x="${px}" y="${py}" font-family="${family}" font-weight="700" font-size="${size}" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""} text-anchor="${anchor}"${spacing ? ` letter-spacing="${spacing}"` : ""}>${x(str)}</text>`;
}

const PAD = 72;
const LEFT_MAX = 660; // the copy column; the mark owns the right side

function svg(ctx, { tag, headline, subline, bar }) {
  // Ground: ink with a faint lime diagonal stripe (the entry cards' ground).
  const ground = stripedGroundSvg(W, H);

  // Hero: the mark, big and tilted, a lime outline offset behind it.
  const size = 330;
  const hx = 780;
  const hy = 126;
  const hero =
    `<g transform="rotate(-4 ${hx + size / 2} ${hy + size / 2})"><rect x="${hx + 44}" y="${hy + 44}" width="${size * 0.875}" height="${size * 0.875}" rx="${size * 0.1875}" fill="none" stroke="${LIME}" stroke-width="5"/></g>` +
    markSvg(hx, hy, size, { rim: 0.3 });

  const lockup = markSvg(PAD - 4, PAD, 76) + wordmarkSvg(PAD + 76 + 18, PAD + 38 + 11, 22).svg;

  // Copy, laid out bottom-up from the action.
  const ctaY = 478;
  const hSize = fit(ctx, headline, HEAD, 100, LEFT_MAX, -2);
  const sSize = fit(ctx, subline, HEAD, 34, LEFT_MAX);
  const subBase = ctaY - 34;
  const headBase = Math.round(subBase - sSize * 1.15 - 18);
  const eyebrowBase = Math.round(headBase - hSize * 0.8 - 26);
  const eyebrow = tag.toUpperCase();
  const eSize = fit(ctx, eyebrow, MONO, 24, LEFT_MAX, 4);
  const ctaSize = fit(ctx, bar, HEAD, 34, LEFT_MAX - 64);
  const ctaW = Math.round(measure(ctx, bar, HEAD, ctaSize) + 64);

  const copy =
    text(PAD, eyebrowBase, eyebrow, { family: MONO, size: eSize, fill: LIME, spacing: 4 }) +
    text(PAD - 4, headBase, headline, { size: hSize, spacing: -2 }) +
    text(PAD, subBase, subline, { size: sSize, opacity: 0.78 }) +
    `<rect x="${PAD}" y="${ctaY}" width="${ctaW}" height="76" rx="10" fill="${LIME}"/>` +
    text(PAD + 32, ctaY + 50, bar, { size: ctaSize, fill: INK }) +
    text(W - PAD, H - 52, "verveq.com", { family: MONO, size: 22, opacity: 0.62, anchor: "end", spacing: 1 });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${ground}${hero}${lockup}${copy}</svg>`;
}

/** Renders every card; returns { id: "/<OG_DIR>/<id>.png" }. */
export async function renderCards(distDir, cards) {
  const ctx = await init();
  const outDir = path.join(distDir, OG_DIR);
  mkdirSync(outDir, { recursive: true });
  const urls = {};
  for (const [id, card] of Object.entries(cards)) {
    const r = make(ctx.resvg, ctx.fonts, svg(ctx, card));
    const img = r.render();
    writeFileSync(path.join(outDir, `${id}.png`), img.asPng());
    img.free();
    r.free();
    urls[id] = `/${OG_DIR}/${id}.png`;
  }
  return urls;
}

const EN = "Play free · no sign-up";
const FR = "Gratuit · sans inscription";
const ES = "Gratis · sin registro";

export const CARDS = {
  "game-daily": { tag: "Daily quiz", headline: "Daily Football Quiz", subline: "10 questions. Same for everyone. One shot.", bar: EN },
  "game-grid": { tag: "Football grid", headline: "Nine cells. Nine guesses.", subline: "Find the player who fits club and country.", bar: EN },
  "game-career": { tag: "Career path", headline: "Guess the Footballer", subline: "Read the clubs. Name the player.", bar: EN },
  "game-hol": { tag: "Higher or lower", headline: "Higher or Lower?", subline: "Real league stats. One wrong call ends it.", bar: EN },
  "game-survival": { tag: "Initials quiz", headline: "Two initials.", subline: "Name any footballer who fits. Three lives.", bar: EN },
  "game-blitz": { tag: "60 seconds", headline: "Beat the clock.", subline: "As many football questions as you can.", bar: EN },
  "game-duels": { tag: "Duels", headline: "Settle it 1v1.", subline: "Send a link. Same questions. Who knows more?", bar: EN },
  "games-hub": { tag: "All games", headline: "Free Football Games", subline: "Quiz, grid, career path, higher or lower.", bar: EN },
  "section-quiz": { tag: "Quiz archive", headline: "Football Quiz Q&A", subline: "Every daily quiz, with the answers.", bar: EN },
  "section-grid": { tag: "Grid answers", headline: "Who played for both?", subline: "Football grid answers, club by club.", bar: EN },
  "section-career": { tag: "Career path quiz", headline: "Guess the Player", subline: "Ten careers. Clubs in order. Answers hidden.", bar: EN },
  "fr-daily": { tag: "Quiz du jour", headline: "Quiz Foot du Jour", subline: "10 questions. Les mêmes pour tous.", bar: FR },
  "fr-grid": { tag: "Grille foot", headline: "9 cases. 9 essais.", subline: "Le joueur qui colle au club et au pays.", bar: FR },
  "fr-career": { tag: "Parcours", headline: "Devine le joueur", subline: "Ses clubs dans l'ordre. À toi de trouver.", bar: FR },
  "fr-hol": { tag: "Plus ou moins", headline: "Plus ou moins ?", subline: "Vraies stats. Une erreur et c'est fini.", bar: FR },
  "fr-survival": { tag: "Initiales", headline: "Deux initiales.", subline: "Cite un joueur qui colle. Trois vies.", bar: FR },
  "fr-blitz": { tag: "60 secondes", headline: "Contre la montre.", subline: "Un max de questions foot en une minute.", bar: FR },
  "fr-duels": { tag: "Duel", headline: "Règle ça en 1v1.", subline: "Un lien. Les mêmes questions.", bar: FR },
  "fr-hub": { tag: "Tous les jeux", headline: "Jeux de foot gratuits", subline: "Quiz, grille, parcours, plus ou moins.", bar: FR },
  "es-daily": { tag: "Quiz diario", headline: "Quiz de Fútbol Diario", subline: "10 preguntas. Las mismas para todos.", bar: ES },
  "es-grid": { tag: "Grid de fútbol", headline: "9 casillas. 9 intentos.", subline: "El jugador que encaja en club y país.", bar: ES },
  "es-career": { tag: "Trayectoria", headline: "Adivina el futbolista", subline: "Sus clubes en orden. ¿Quién es?", bar: ES },
  "es-hol": { tag: "Mayor o menor", headline: "¿Mayor o menor?", subline: "Estadísticas reales. Un fallo y se acabó.", bar: ES },
  "es-survival": { tag: "Iniciales", headline: "Dos iniciales.", subline: "Nombra un futbolista que encaje.", bar: ES },
  "es-blitz": { tag: "60 segundos", headline: "Contra el reloj.", subline: "Todas las preguntas que puedas.", bar: ES },
  "es-duels": { tag: "Duelo", headline: "Resuélvelo 1v1.", subline: "Un enlace. Las mismas preguntas.", bar: ES },
  "es-hub": { tag: "Todos los juegos", headline: "Juegos de fútbol gratis", subline: "Quiz, grid, trayectorias y más.", bar: ES },
};

/** Card id for a page path. */
export function cardFor(pagePath) {
  const map = {
    "/games/daily-football-quiz/": "game-daily",
    "/games/football-grid/": "game-grid",
    "/games/career-path/": "game-career",
    "/games/higher-or-lower/": "game-hol",
    "/games/football-survival/": "game-survival",
    "/games/60-second-football-quiz/": "game-blitz",
    "/games/football-duels/": "game-duels",
    "/games/": "games-hub",
  };
  if (map[pagePath]) return map[pagePath];
  if (pagePath.startsWith("/football-quiz/")) return "section-quiz";
  if (pagePath.startsWith("/who-played-for/")) return "section-grid";
  if (pagePath.startsWith("/career-path-quiz/")) return "section-career";
  return null;
}
