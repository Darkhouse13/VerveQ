/**
 * Shared building blocks for the static SEO layer (see seo/build.mjs).
 *
 * Every page this layer emits is the BUILT app shell (dist/index.html, hashed
 * bundle and all) with a page-specific <head> block and a server-rendered
 * content block after #root. Crawlers read real HTML; humans get that same
 * HTML instantly, and the app bundle loads underneath so a "Play" tap opens the
 * game with no page load (src/components/seo/SeoPageHost.tsx).
 *
 * Plain .mjs on purpose: it runs as a post-build step on the deploy host,
 * which has node but no tsx.
 */

import { uiFor } from "./pages/gamesIntl.mjs";

export const ORIGIN = "https://verveq.com";
export const SITE_NAME = "VerveQ";
export const DEFAULT_OG_IMAGE = `${ORIGIN}/og/home.png`;

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Lowercase ASCII slug: "Atlético Madrid" -> "atletico-madrid". */
export function slugify(value) {
  return String(value)
    .replace(/['’]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/[œŒ]/g, "oe")
    .replace(/ß/g, "ss")
    .replace(/[łŁ]/g, "l")
    .replace(/[đĐ]/g, "d")
    .replace(/ı/g, "i")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function abs(path) {
  return path.startsWith("http") ? path : `${ORIGIN}${path}`;
}

/** "a, b and c" */
export function listJoin(items) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function jsonLd(data) {
  // `</` inside a string would close the script element early.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/<\//g, "<\\/")}</script>`;
}

export function breadcrumbLd(crumbs) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}

export function faqLd(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) },
    })),
  };
}

export function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** The site-wide <head> block for one page. */
export function renderHead(page) {
  const url = abs(page.path);
  const ogImage = page.ogImage ? abs(page.ogImage) : DEFAULT_OG_IMAGE;
  const ogTitle = page.ogTitle ?? page.title;
  const ogDescription = page.ogDescription ?? page.description;
  const lines = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
  ];
  // Indexable pages allow large image previews (search thumbnails, Discover).
  lines.push(`<meta name="robots" content="${esc(page.robots ?? "max-image-preview:large")}" />`);
  for (const alt of page.alternates ?? []) {
    lines.push(`<link rel="alternate" hreflang="${esc(alt.lang)}" href="${esc(abs(alt.path))}" />`);
  }
  lines.push(
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${esc(page.ogType ?? "website")}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(ogTitle)}" />`,
    `<meta property="og:description" content="${esc(ogDescription)}" />`,
    `<meta property="og:image" content="${esc(ogImage)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(ogTitle)}" />`,
    `<meta name="twitter:description" content="${esc(ogDescription)}" />`,
    `<meta name="twitter:image" content="${esc(ogImage)}" />`,
  );
  if (page.lang && page.lang !== "en") lines.push(`<meta http-equiv="content-language" content="${esc(page.lang)}" />`);
  for (const data of page.jsonLd ?? []) lines.push(jsonLd(data));
  lines.push(`<style>${SEO_CSS}</style>`);
  return lines.map((l) => `    ${l}`).join("\n") + "\n";
}

// ── Chrome ───────────────────────────────────────────────────────────────────

const NAV = {
  en: [
    { href: "/games/", label: "Games" },
    { href: "/football-quiz/", label: "Quiz archive" },
    { href: "/career-path-quiz/", label: "Career path quiz" },
    { href: "/who-played-for/", label: "Who played for" },
    { href: "/fr/jeux/", label: "FR" },
    { href: "/es/juegos/", label: "ES" },
  ],
};

const FOOTER_LINKS = [
  { href: "/games/daily-football-quiz/", label: "Daily football quiz" },
  { href: "/games/football-grid/", label: "Football grid" },
  { href: "/games/career-path/", label: "Guess the footballer" },
  { href: "/games/higher-or-lower/", label: "Higher or lower football" },
  { href: "/games/football-survival/", label: "Footballer initials quiz" },
  { href: "/games/60-second-football-quiz/", label: "60-second football quiz" },
  { href: "/games/football-duels/", label: "Football quiz with friends" },
  { href: "/football-quiz/", label: "Football quiz questions" },
  { href: "/career-path-quiz/", label: "Career path quiz" },
  { href: "/who-played-for/", label: "Who played for both clubs" },
];

export function renderBreadcrumbs(crumbs) {
  if (!crumbs || crumbs.length < 2) return "";
  const parts = crumbs.map((c, i) =>
    i === crumbs.length - 1
      ? `<span aria-current="page">${esc(c.name)}</span>`
      : `<a href="${esc(c.path)}">${esc(c.name)}</a>`,
  );
  return `<nav class="crumbs" aria-label="Breadcrumb">${parts.join(" <span aria-hidden=\"true\">/</span> ")}</nav>`;
}

/**
 * The server-rendered content block. `data-seo-path` lets the SPA hide it the
 * moment the visitor navigates into the app (a Play tap), and show it again on
 * Back — the block lives outside #root, so React never owns it.
 */
export function renderBody(page) {
  const ui = page.lang && page.lang !== "en" ? uiFor(page.lang) : null;
  const nav = (ui ? ui.nav : NAV.en)
    .map((n) => `<a href="${n.href}">${esc(n.label)}</a>`)
    .join("");
  const footer = (ui ? ui.nav : FOOTER_LINKS).map((l) => `<a href="${l.href}">${esc(l.label)}</a>`).join("");
  const footerIntro = ui ? esc(ui.footerIntro) : "VerveQ: free football trivia games in your browser.";
  return `    <!--seo:block-->
    <div id="seo" data-seo-path="${esc(page.path)}">
      ${page.hideHeader ? "" : `<header class="seo-top">
        <a class="seo-brand" href="/" aria-label="VerveQ home"><span class="seo-mark" aria-hidden="true">V</span><span class="seo-word">Verve<span>Q</span></span></a>
        <nav class="seo-nav" aria-label="Main">${nav}</nav>
      </header>`}
      <main class="seo-main">
        ${renderBreadcrumbs(page.breadcrumbs)}
${page.body}
      </main>
      <footer class="seo-foot">
        <nav class="seo-foot-links" aria-label="Football games">${footer}</nav>
        <p>${footerIntro} <a href="/">Play</a> · <a href="/about/">About</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
      </footer>
    </div>
    <!--/seo:block-->
`;
}

/** A launch button. `data-spa` lets the app route it client-side (no reload). */
export function cta(href, label, { secondary = false } = {}) {
  return `<a class="seo-cta${secondary ? " seo-cta-2" : ""}" data-spa href="${esc(href)}">${esc(label)}</a>`;
}

export function faqSection(faqs, heading = "FAQ") {
  const items = faqs
    .map((f) => `<details class="seo-faq"><summary>${esc(f.q)}</summary><div>${f.a}</div></details>`)
    .join("\n");
  return `<section><h2>${esc(heading)}</h2>\n${items}\n</section>`;
}

export function linkGrid(links) {
  return `<ul class="seo-links">${links
    .map((l) => `<li><a href="${esc(l.href)}"><strong>${esc(l.label)}</strong>${l.note ? `<span>${esc(l.note)}</span>` : ""}</a></li>`)
    .join("")}</ul>`;
}

// Scoped to #seo so the app's Tailwind preflight (same document) can't leak in
// or out. Brand tokens mirror src/index.css. System fonts only: the app's web
// fonts load late (after first paint) and swapping them in reflowed every
// heading — measured CLS 0.13 on the live pages.
export const SEO_CSS = `
html,body{margin:0;background:#FFF7F0}
#seo{--ink:#121212;--cream:#FFF7F0;--lime:#C6FF1A;--orange:#FF6A00;--yellow:#FFCD1A;--muted:#555;color:var(--ink);background:var(--cream);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6;font-size:16px}
#seo *{box-sizing:border-box}
#seo a{color:var(--ink)}
#seo .seo-top{max-width:880px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
#seo .seo-brand{display:flex;align-items:center;gap:10px;text-decoration:none}
#seo .seo-mark{width:34px;height:34px;border:3px solid var(--ink);border-radius:8px;background:var(--ink);color:var(--lime);font:900 19px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:grid;place-items:center;transform:rotate(-4deg)}
#seo .seo-word{font:900 21px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:-.5px}
#seo .seo-word span{color:var(--orange)}
#seo .seo-nav{display:flex;gap:14px;flex-wrap:wrap;font:600 14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#seo .seo-nav a{text-decoration:none;border-bottom:2px solid transparent}
#seo .seo-nav a:hover{border-color:var(--ink)}
#seo .seo-main{max-width:880px;margin:0 auto;padding:8px 20px 48px}
#seo .crumbs{font-size:13px;color:var(--muted);margin:4px 0 14px}
#seo .crumbs a{color:var(--muted)}
#seo h1,#seo h2,#seo h3{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.15;margin:0}
#seo h1{font-size:clamp(28px,6vw,40px);font-weight:700;text-transform:uppercase;margin:6px 0 12px}
#seo h2{font-size:22px;font-weight:700;text-transform:uppercase;margin:34px 0 10px}
#seo h3{font-size:18px;font-weight:700;margin:20px 0 6px}
#seo p{margin:0 0 12px}
#seo ul,#seo ol{margin:0 0 14px 22px;padding:0}#seo ul{list-style:disc}#seo ol{list-style:decimal}#seo .seo-scroll{overflow-x:auto;margin:8px 0 18px}#seo .seo-scroll table{margin:0;min-width:520px}
#seo li{margin-bottom:6px}
#seo .seo-tag{display:inline-block;border:2px solid var(--ink);border-radius:999px;background:var(--yellow);font:700 11px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-transform:uppercase;letter-spacing:.08em;padding:2px 10px}
#seo .seo-lede{font-size:18px;max-width:680px}
#seo .seo-cta{display:inline-block;border:3px solid var(--ink);border-radius:10px;background:var(--lime);color:var(--ink);font:700 16px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-transform:uppercase;padding:14px 26px;text-decoration:none;box-shadow:4px 4px 0 var(--ink);margin:6px 10px 6px 0}
#seo .seo-cta-2{background:#fff}
#seo .seo-cta:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 var(--ink)}
#seo .seo-box{border:3px solid var(--ink);border-radius:12px;background:#fff;box-shadow:5px 5px 0 var(--ink);padding:16px 18px;margin:18px 0}
#seo .seo-hero{margin:4px 0 8px}
#seo .seo-note{font-size:14px;color:var(--muted)}
#seo .seo-links{list-style:none;margin:10px 0 18px;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
#seo .seo-links a{display:block;height:100%;border:2px solid var(--ink);border-radius:10px;background:#fff;padding:10px 12px;text-decoration:none}
#seo .seo-links a:hover{background:var(--lime)}
#seo .seo-links span{display:block;font-size:13px;color:var(--muted)}
#seo .seo-faq{border:2px solid var(--ink);border-radius:10px;background:#fff;margin:0 0 10px;padding:0}
#seo .seo-faq summary{cursor:pointer;font-weight:700;padding:12px 14px}
#seo .seo-faq>div{padding:0 14px 12px}
#seo table{width:100%;border-collapse:collapse;margin:8px 0 18px;background:#fff;border:2px solid var(--ink);font-size:15px}
#seo th,#seo td{text-align:left;padding:8px 10px;border-bottom:1px solid #ddd;vertical-align:top}
#seo th{background:var(--ink);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-weight:600}
#seo .seo-path{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0}
#seo .seo-club{border:2px solid var(--ink);border-radius:8px;background:#fff;padding:3px 9px;font-weight:600;font-size:14px}
#seo .seo-arrow{color:var(--muted)}
#seo .seo-q{border:2px solid var(--ink);border-radius:12px;background:#fff;padding:14px 16px;margin:0 0 14px}
#seo .seo-q h3{margin:0 0 8px}
#seo .seo-q ol{list-style:upper-alpha}
#seo .seo-reveal summary{cursor:pointer;font-weight:700;color:var(--orange)}
#seo .seo-reveal[open] summary{color:var(--ink)}
#seo .seo-grid3{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;max-width:440px;margin:10px 0 16px}
#seo .seo-grid3 div{border:2px solid var(--ink);border-radius:8px;background:#fff;min-height:58px;display:grid;place-items:center;text-align:center;font-size:13px;font-weight:700;padding:4px}
#seo .seo-grid3 .h{background:var(--yellow)}
#seo .seo-grid3 .x{background:transparent;border-color:transparent}
#seo .seo-foot{max-width:880px;margin:0 auto;padding:20px;font-size:13px;color:var(--muted);border-top:2px solid #ddd}
#seo .seo-foot-links{display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:10px}
#seo .seo-foot a{color:var(--ink)}
@media (max-width:520px){#seo .seo-nav{gap:10px;font-size:13px}#seo .seo-cta{display:block;text-align:center;margin:8px 0}}
`
  .replace(/\n/g, "")
  .trim();
