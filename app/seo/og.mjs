/**
 * Social / search preview cards (1200×630) for the static layer, in the style
 * of public/og/home.png. Rendered at build time with resvg-wasm and the Space
 * Grotesk Bold the Convex share-card renderer already embeds.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let ready = null;
async function init() {
  if (ready) return ready;
  ready = (async () => {
    const resvg = await import("@resvg/resvg-wasm");
    const wasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
    await resvg.initWasm(readFileSync(wasmPath));
    const src = readFileSync(path.resolve(HERE, "../convex/lib/shareCardFontData.ts"), "utf8");
    const b64 = src.match(/SHARE_CARD_FONT_BASE64\s*=\s*"([^"]+)"/)[1];
    // A plain Uint8Array, not a Buffer: under vitest's jsdom realm resvg
    // rejects a Node Buffer passed as a font.
    return { resvg, font: Uint8Array.from(Buffer.from(b64, "base64")) };
  })();
  return ready;
}

const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svg({ tag, headline, subline, bar }) {
  const size = headline.length > 18 ? 84 : 104;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FAF0E1"/>
  <polygon points="1010,0 1200,0 1200,630 870,630" fill="#F9DEC0"/>
  <rect x="6" y="6" width="1188" height="618" fill="none" stroke="#121212" stroke-width="12"/>
  <g transform="rotate(-2 170 105)">
    <rect x="66" y="74" width="${Math.max(220, tag.length * 23 + 70)}" height="62" fill="#FF7A1A" stroke="#121212" stroke-width="5"/>
  </g>
  <text x="${66 + 34}" y="118" font-family="Space Grotesk" font-size="34" fill="#FFFFFF" letter-spacing="1">${x(tag.toUpperCase())}</text>
  <text x="70" y="330" font-family="Space Grotesk" font-size="${size}" fill="#121212">${x(headline)}</text>
  <text x="72" y="405" font-family="Space Grotesk" font-size="38" fill="#121212">${x(subline)}</text>
  <rect x="64" y="446" width="${Math.max(560, bar.length * 29 + 70)}" height="86" fill="#121212"/>
  <text x="96" y="506" font-family="Space Grotesk" font-size="48" fill="#FF7A1A">${x(bar.toUpperCase())}</text>
  <text x="1128" y="584" text-anchor="end" font-family="Space Grotesk" font-size="26" fill="#121212">verveq.com</text>
</svg>`;
}

/** Renders every card; returns { id: "/og/<id>.png" }. */
export async function renderCards(distDir, cards) {
  const { resvg, font } = await init();
  const outDir = path.join(distDir, "og");
  mkdirSync(outDir, { recursive: true });
  const urls = {};
  for (const [id, card] of Object.entries(cards)) {
    const r = new resvg.Resvg(svg(card), {
      font: { fontBuffers: [font], defaultFontFamily: "Space Grotesk", loadSystemFonts: false },
      fitTo: { mode: "width", value: 1200 },
    });
    writeFileSync(path.join(outDir, `${id}.png`), r.render().asPng());
    urls[id] = `/og/${id}.png`;
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
  "games-hub": { tag: "VerveQ", headline: "Free Football Games", subline: "Quiz, grid, career path, higher or lower.", bar: EN },
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
  "fr-hub": { tag: "VerveQ", headline: "Jeux de foot gratuits", subline: "Quiz, grille, parcours, plus ou moins.", bar: FR },
  "es-daily": { tag: "Quiz diario", headline: "Quiz de Fútbol Diario", subline: "10 preguntas. Las mismas para todos.", bar: ES },
  "es-grid": { tag: "Grid de fútbol", headline: "9 casillas. 9 intentos.", subline: "El jugador que encaja en club y país.", bar: ES },
  "es-career": { tag: "Trayectoria", headline: "Adivina el futbolista", subline: "Sus clubes en orden. ¿Quién es?", bar: ES },
  "es-hol": { tag: "Mayor o menor", headline: "¿Mayor o menor?", subline: "Estadísticas reales. Un fallo y se acabó.", bar: ES },
  "es-survival": { tag: "Iniciales", headline: "Dos iniciales.", subline: "Nombra un futbolista que encaje.", bar: ES },
  "es-blitz": { tag: "60 segundos", headline: "Contra el reloj.", subline: "Todas las preguntas que puedas.", bar: ES },
  "es-duels": { tag: "Duelo", headline: "Resuélvelo 1v1.", subline: "Un enlace. Las mismas preguntas.", bar: ES },
  "es-hub": { tag: "VerveQ", headline: "Juegos de fútbol gratis", subline: "Quiz, grid, trayectorias y más.", bar: ES },
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
