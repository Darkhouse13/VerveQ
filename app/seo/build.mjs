/**
 * Static SEO layer generator.
 *
 * Runs at the end of `vite build` (vite.config.ts `seoStaticLayer` plugin, in
 * writeBundle, i.e. BEFORE vite-plugin-pwa builds the precache in closeBundle)
 * and standalone: `node seo/build.mjs [--dist dist] [--refresh-snapshot]`.
 *
 * Emits into dist/:
 *   index.html                 homepage: shell + home head + static block
 *   app-shell.html             SPA fallback for every other route (noindex)
 *   games/**, football-quiz/**, who-played-for/**, career-path-quiz/**
 *   sitemap.xml                every generated page
 *
 * The daily quiz archive comes from prod Convex (seoArchive:dailyQuizArchive)
 * when VITE_CONVEX_URL is set, falling back to the committed snapshot in
 * seo/snapshots/. The build never writes into the repo unless asked
 * (--refresh-snapshot): the deploy host refuses to build from a dirty tree.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ORIGIN, renderBody, renderHead } from "./lib.mjs";
import { buildGamePages } from "./pages/games.mjs";
import { buildQuizArchive } from "./pages/quizArchive.mjs";
import { buildPlayerPages } from "./pages/players.mjs";
import { buildHome } from "./pages/home.mjs";
import { buildIntlGamePages, LANG_GROUPS } from "./pages/gamesIntl.mjs";
import { loadPlayers } from "./data.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT = path.join(HERE, "snapshots", "daily-quiz-archive.json");

const HEAD_RE = /<!--seo:head:start-->[\s\S]*?<!--seo:head:end-->\n?/;
const BODY_MARK = "<!--seo:body-->";

async function fetchArchive(convexUrl) {
  const url = `${convexUrl.replace(/\/$/, "")}/api/query`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "seoArchive:dailyQuizArchive", args: {}, format: "json" }),
        signal: AbortSignal.timeout(20000),
      });
      const json = await res.json();
      if (json.status === "success" && Array.isArray(json.value?.days)) return json.value;
      throw new Error(`bad response: ${JSON.stringify(json).slice(0, 200)}`);
    } catch (err) {
      console.warn(`[seo] archive fetch attempt ${attempt} failed: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  return null;
}

async function loadArchive({ refreshSnapshot }) {
  const convexUrl = process.env.VITE_CONVEX_URL;
  // DEV deployments are a clone and can drift; only prod is the archive of record.
  const live = convexUrl && /different-lynx-153/.test(convexUrl) ? await fetchArchive(convexUrl) : null;
  if (live) {
    if (refreshSnapshot) {
      mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
      writeFileSync(SNAPSHOT, JSON.stringify(live));
      console.log(`[seo] snapshot refreshed (${live.days.length} days)`);
    }
    return { archive: live, source: "live" };
  }
  if (existsSync(SNAPSHOT)) return { archive: JSON.parse(readFileSync(SNAPSHOT, "utf8")), source: "snapshot" };
  return { archive: { days: [] }, source: "none" };
}

// ── Samples for the game pages ───────────────────────────────────────────────

function careerSamples(careerPaths) {
  const ids = ["cp-ronaldo", "cp-zlatan", "cp-anelka"];
  const picked = ids.map((id) => careerPaths.find((c) => c.id === id)).filter(Boolean);
  const fallback = careerPaths.filter((c) => c.clubs?.length >= 4);
  while (picked.length < 3 && fallback.length) picked.push(fallback.shift());
  return picked;
}

function sampleGrid(players) {
  const rows = ["Arsenal", "Chelsea", "Barcelona"];
  const cols = ["France", "Brazil", "Spain"];
  const cells = [];
  let n = 1;
  for (const r of rows) for (const c of cols) {
    const fits = players.filter((p) => p.nation === c && p.clubs.some((cl) => cl.name === r)).map((p) => p.name);
    if (fits.length === 0) return null;
    cells.push({ n: n++, row: r, col: c, players: fits.slice(0, 6) });
  }
  return { rows, cols, cells };
}

function initialsExamples() {
  const file = path.resolve(HERE, "../convex/data/survival_initials_map.json");
  const map = JSON.parse(readFileSync(file, "utf8")).initials_map;
  const famous = { TH: ["Thierry Henry"], MS: ["Mohamed Salah"], KD: ["Kevin De Bruyne"], DS: [], JM: [] };
  return Object.keys(famous)
    .filter((k) => map[k])
    .map((k) => {
      const list = map[k];
      const lead = famous[k].filter((f) => list.includes(f));
      const players = [...lead, ...list.filter((x) => !lead.includes(x))].slice(0, 3);
      return { initials: k, players, more: list.length - players.length };
    });
}

// ── Assembly ────────────────────────────────────────────────────────────────

/** hreflang: every member of a language group lists all members + x-default. */
function attachAlternates(pages) {
  const byPath = new Map(pages.map((p) => [p.path, p]));
  for (const group of Object.values(LANG_GROUPS)) {
    const alts = Object.entries(group).map(([lang, path]) => ({ lang, path }));
    alts.push({ lang: "x-default", path: group.en });
    for (const { path } of Object.entries(group).map(([, path]) => ({ path }))) {
      const page = byPath.get(path);
      if (!page) throw new Error(`[seo] hreflang group references missing page ${path}`);
      page.alternates = alts;
    }
  }
}

/**
 * Static pages paint from their own HTML + inline CSS alone. Everything the
 * app needs (its stylesheet, web fonts, the module bundle and its preloads) is
 * only needed once Play is tapped, so none of it may compete with first paint
 * on a slow phone:
 *   - stylesheets (app CSS, Google Fonts) load non-blocking;
 *   - modulepreloads are dropped;
 *   - the bundle is injected after `load` when the browser is idle, or at the
 *     first interaction, whichever comes first. A Play tap before it arrives is
 *     just a normal link into the game.
 */
function deferApp(html) {
  html = html.replace(
    /<link rel="stylesheet" (crossorigin )?href="([^"]+)" ?\/?>/g,
    (_m, co, href) =>
      `<link rel="preload" as="style" ${co ?? ""}href="${href}" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" ${co ?? ""}href="${href}"></noscript>`,
  );
  html = html.replace(/\s*<link rel="modulepreload"[^>]*>/g, "");
  const entry = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
  if (!entry) throw new Error("[seo] app entry script not found in the built shell");
  const loader = `<script>(function(){var d=0;function go(){if(d)return;d=1;var e=document.createElement("script");e.type="module";e.crossOrigin="";e.src=${JSON.stringify(entry[1])};document.head.appendChild(e);}addEventListener("load",function(){"requestIdleCallback"in window?requestIdleCallback(go,{timeout:2500}):setTimeout(go,1200)});["pointerdown","keydown","touchstart","scroll"].forEach(function(t){addEventListener(t,go,{once:true,passive:true})})})();</script>`;
  return html.replace(entry[0], loader);
}

function toHtml(template, page, { deferAppCss }) {
  let html = template.replace(HEAD_RE, `<!--seo:head:start-->\n${renderHead(page)}${page.extraHead ? `    ${page.extraHead}\n` : ""}    <!--seo:head:end-->\n`);
  if (!html.includes(BODY_MARK)) throw new Error("app shell is missing the <!--seo:body--> marker");
  html = html.replace(BODY_MARK, `${BODY_MARK}\n${renderBody(page)}`);
  if (page.lang && page.lang !== "en") html = html.replace(/<html lang="en">/, `<html lang="${page.lang}">`);
  if (deferAppCss) html = deferApp(html);
  return html;
}

function appShell(template) {
  const head = [
    `<title>VerveQ — Football Trivia Games</title>`,
    `<meta name="description" content="Free football trivia games: daily quiz, career path, football grid, higher or lower and duels." />`,
    // The SPA's routes are not the indexable surface — the static pages are.
    `<meta name="robots" content="noindex, follow" />`,
    `<meta property="og:site_name" content="VerveQ" />`,
    `<meta property="og:title" content="VerveQ — Settle it" />`,
    `<meta property="og:description" content="Prove you know more than your mates — head-to-head football trivia. Play free, no sign-up." />`,
    `<meta property="og:image" content="${ORIGIN}/og/home.png" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ]
    .map((l) => `    ${l}`)
    .join("\n");
  return template.replace(HEAD_RE, `<!--seo:head:start-->\n${head}\n    <!--seo:head:end-->\n`);
}

function sitemapXml(entries) {
  const urls = entries
    .map((e) => `  <url>\n    <loc>${ORIGIN}${e.path}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ""}\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Every internal link on every page must resolve — no generated 404s. */
function checkLinks(pages, extraPaths) {
  const known = new Set([...pages.map((p) => p.path), ...extraPaths]);
  const broken = [];
  for (const p of pages) {
    const body = p.body ?? "";
    for (const m of body.matchAll(/href="(\/[^"#?]*)/g)) {
      const href = m[1];
      if (known.has(href)) continue;
      if (/^\/(v2|compete|privacy|terms|play|weekend)(\/|$)/.test(href)) continue;
      if (href === "/sitemap.xml") continue;
      broken.push(`${p.path} -> ${href}`);
    }
  }
  return broken;
}

export async function generate({ distDir, refreshSnapshot = false, log = console.log } = {}) {
  const templatePath = path.join(distDir, "index.html");
  // Re-runnable: a dist/ that was already processed gets its block stripped.
  const template = readFileSync(templatePath, "utf8").replace(/\n?    <!--seo:block-->[\s\S]*?<!--\/seo:block-->\n?/, "\n");
  if (!HEAD_RE.test(template)) throw new Error("app shell is missing the <!--seo:head:start/end--> markers");

  const { archive, source } = await loadArchive({ refreshSnapshot });
  const { players, careerPaths } = loadPlayers();
  const quiz = buildQuizArchive(archive);
  const playerPages = buildPlayerPages();
  const ctx = {
    recentQuizDays: quiz.recentDays,
    topicPages: quiz.topicPages,
    topPairPages: playerPages.topPairPages,
    careerSets: playerPages.careerSets,
    careerSamples: careerSamples(careerPaths),
    sampleGrid: sampleGrid(players),
    initialsExamples: initialsExamples(),
  };
  const home = buildHome(ctx);
  const gamePages = buildGamePages(ctx);
  const intlPages = buildIntlGamePages(ctx);
  const pages = [...gamePages, ...intlPages, ...quiz.pages, ...playerPages.pages];
  attachAlternates([home, ...pages]);

  const paths = new Set();
  for (const p of [home, ...pages]) {
    if (paths.has(p.path)) throw new Error(`[seo] duplicate page path ${p.path}`);
    paths.add(p.path);
  }
  const broken = checkLinks([home, ...pages], ["/"]);
  if (broken.length) throw new Error(`[seo] ${broken.length} broken internal links, e.g.\n${broken.slice(0, 20).join("\n")}`);

  for (const page of pages) {
    const out = path.join(distDir, page.path, "index.html");
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, toHtml(template, page, { deferAppCss: true }));
  }
  writeFileSync(path.join(distDir, "app-shell.html"), appShell(template));
  writeFileSync(templatePath, toHtml(template, home, { deferAppCss: false }));

  const today = new Date().toISOString().slice(0, 10);
  const entries = [home, ...pages].map((p) => {
    const day = p.path.match(/^\/football-quiz\/(\d{4}-\d{2}-\d{2})\/$/);
    return { path: p.path, lastmod: day ? day[1] : today };
  });
  entries.push({ path: "/privacy", lastmod: null }, { path: "/terms", lastmod: null });
  writeFileSync(path.join(distDir, "sitemap.xml"), sitemapXml(entries));

  log(
    `[seo] ${pages.length + 1} pages (archive: ${source}, ${quiz.recentDays.length} days; pairs ${playerPages.counts.pairs}, club×nation ${playerPages.counts.nations}, club hubs ${playerPages.counts.hubs}, career sets ${playerPages.counts.careerSets})`,
  );
  return { pages: [home, ...pages], source };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const distIdx = args.indexOf("--dist");
  const distDir = path.resolve(HERE, "..", distIdx >= 0 ? args[distIdx + 1] : "dist");
  generate({ distDir, refreshSnapshot: args.includes("--refresh-snapshot") }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
