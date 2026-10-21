#!/usr/bin/env node
/**
 * Design floors (VerveQ ONE P1.8): the measurable minimums every screen must
 * meet, checked on real rendered pages at a phone size (390×664 — an iPhone
 * 12-class viewport with browser chrome taken out).
 *
 * Per route it reports:
 *   contrast  axe-core `color-contrast` violations (nodes). ANY ⇒ exit 1.
 *   tiny      visible text whose computed font-size is < 12px (elements).
 *   small     interactive elements (buttons, links, inputs, tabs…) whose box
 *             is < 44px tall. Links inside running text are excluded: the
 *             44px rule is for controls, not words in a sentence.
 *   fold      whether the screen's primary action is fully above the fold:
 *             `[data-primary-action]`; else the first visible button ≥160px
 *             wide with a text label (a CTA, not Back/Close chrome); else the
 *             first visible <button>. The report names which one it used.
 *
 * Routes that redirect (e.g. a game that needs a session → /v2/account) are
 * measured where they land; the report shows the final path.
 *
 *   npm run design:floors -- https://verveq.com
 *   npm run design:floors -- http://localhost:5173 --routes /older,/letters
 *   npm run design:floors -- https://verveq.com --json floors.json --verbose
 *
 * Analytics/monitoring hosts are blocked, and so is the anonymous-session
 * permit endpoint: the run only looks — it never creates a guest account.
 * Game routes that need a session therefore land on /v2/account; to measure
 * the games themselves, run against a DEV server started with the prod flags
 * (VITE_ANONYMOUS_FIRST_ENABLED=true, VITE_DRAW_ENABLED=true) and pass
 * `--allow-guest` (refused for verveq.com):
 *
 *   npm run design:floors -- http://localhost:5173 --allow-guest --routes /older,/letters,/v2/daily,/draw
 * axe-core is vendored (scripts/vendor/axe.min.js, 4.10.3, MPL-2.0) so the
 * check needs no network beyond the site itself.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AXE_PATH = path.join(HERE, "vendor", "axe.min.js");

export const VIEWPORT = { width: 390, height: 664 };
export const DEFAULT_ROUTES = [
  "/",
  "/older",
  "/letters",
  "/weekend",
  "/draw",
  "/compete",
  "/v2/daily",
  "/v2/career-path",
  "/games/",
];
const BLOCKED = [
  /posthog\.com/,
  /sentry\.io/,
  /ingest\.[a-z.]*sentry/,
  /googletagmanager\.com/,
  /google-analytics\.com/,
  /\/anonymous-onboarding\//,
];
const SETTLE_MS = 3000;

function parseArgs(argv) {
  const args = { base: "http://localhost:5173", routes: DEFAULT_ROUTES, json: null, verbose: false, allowGuest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--routes") args.routes = argv[++i].split(",").map((r) => r.trim()).filter(Boolean);
    else if (a === "--json") args.json = argv[++i];
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--allow-guest") args.allowGuest = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (!a.startsWith("-")) args.base = a.replace(/\/$/, "");
    else throw new Error(`unknown flag ${a}`);
  }
  return args;
}

/** Runs in the page: tiny text, small targets, primary action fold. */
function measureInPage(viewportHeight) {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
    }
    return true;
  };
  const label = (el) => {
    const t = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 48);
    const id = el.getAttribute("data-testid");
    return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ""} "${t}"`;
  };

  // Text under 12px: one entry per element that directly holds visible text.
  const tiny = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim()) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    if (["SCRIPT", "STYLE", "NOSCRIPT", "TITLE"].includes(el.tagName)) continue;
    if (el.closest("[aria-hidden='true'], .sr-only")) continue;
    if (!visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 12) tiny.push({ size, el: label(el) });
  }

  // Interactive boxes under 44px tall.
  const small = [];
  const controls = document.querySelectorAll(
    "button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=switch], [role=checkbox], [role=radio], [role=menuitem]",
  );
  for (const el of controls) {
    if (!visible(el)) continue;
    if (el.closest("[aria-hidden='true']")) continue;
    if (el.tagName === "A" && getComputedStyle(el).display === "inline") {
      // A link inside a sentence: its parent carries text besides the link.
      const parentText = (el.parentElement?.textContent || "").replace(/\s+/g, " ").trim();
      const ownText = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (parentText.length > ownText.length) continue;
    }
    const r = el.getBoundingClientRect();
    if (r.height < 44) small.push({ h: Math.round(r.height * 10) / 10, w: Math.round(r.width), el: label(el) });
  }

  // Primary action above the fold. Marked action first; else the first wide,
  // labelled button (a real CTA, not Back/Close/Exit chrome); else the first
  // button of any kind.
  const buttons = [...document.querySelectorAll("button, [role=button]")].filter(visible);
  const marked = [...document.querySelectorAll("[data-primary-action]")].find(visible);
  const cta = buttons.find((b) => b.getBoundingClientRect().width >= 160 && (b.textContent || "").trim().length > 1);
  const primary = marked ?? cta ?? buttons[0] ?? null;
  let fold = { found: false, above: false, via: null, el: null, bottom: null };
  if (primary) {
    const r = primary.getBoundingClientRect();
    fold = {
      found: true,
      above: r.top >= 0 && r.bottom <= viewportHeight,
      via: marked ? "data-primary-action" : primary === cta ? "first-cta" : "first-button",
      el: label(primary),
      bottom: Math.round(r.bottom + window.scrollY),
    };
  }
  return { tiny, small, fold };
}

export async function measureRoute(context, base, route) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  try {
    const res = await page.goto(base + route, { waitUntil: "load", timeout: 45_000 });
    await page.waitForFunction(() => document.querySelector("#root")?.childElementCount > 0 || document.querySelector("#seo"), null, {
      timeout: 20_000,
    }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    await page.evaluate(() => document.fonts?.ready);
    await page.addScriptTag({ content: readFileSync(AXE_PATH, "utf8") });
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast"] }, resultTypes: ["violations"] });
      return r.violations.flatMap((v) =>
        v.nodes.map((n) => ({
          target: n.target.join(" "),
          summary: (n.any?.[0]?.message || n.failureSummary || "").replace(/\s+/g, " ").slice(0, 160),
          html: n.html.slice(0, 120),
        })),
      );
    });
    const m = await page.evaluate(measureInPage, VIEWPORT.height);
    return {
      route,
      finalPath: new URL(page.url()).pathname,
      status: res?.status() ?? null,
      contrast: axe,
      tiny: m.tiny,
      small: m.small,
      fold: m.fold,
      errors,
    };
  } finally {
    await page.close();
  }
}

export async function runFloors({ base, routes, allowGuest = false }) {
  const blocked = allowGuest ? BLOCKED.filter((re) => !re.source.includes("anonymous")) : BLOCKED;
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 VerveQDesignFloors",
    reducedMotion: "reduce",
  });
  await context.route("**/*", (r) => (blocked.some((re) => re.test(r.request().url())) ? r.abort() : r.continue()));
  const results = [];
  try {
    for (const route of routes) {
      try {
        results.push(await measureRoute(context, base, route));
      } catch (err) {
        results.push({ route, error: String(err.message || err) });
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}

function report(results, { verbose }) {
  const pad = (s, n) => String(s).padEnd(n);
  console.log(`\n${pad("route", 18)}${pad("→ path", 22)}${pad("contrast", 10)}${pad("tiny<12", 9)}${pad("small<44", 10)}fold`);
  for (const r of results) {
    if (r.error) {
      console.log(`${pad(r.route, 18)}ERROR ${r.error}`);
      continue;
    }
    const fold = r.fold.found ? `${r.fold.above ? "above" : "BELOW"} (${r.fold.via})` : "no action found";
    console.log(
      `${pad(r.route, 18)}${pad(r.finalPath, 22)}${pad(r.contrast.length, 10)}${pad(r.tiny.length, 9)}${pad(r.small.length, 10)}${fold}`,
    );
  }
  for (const r of results.filter((x) => !x.error)) {
    const lim = verbose ? Infinity : 4;
    if (!r.contrast.length && !r.tiny.length && !r.small.length && (r.fold.above || !verbose)) continue;
    console.log(`\n── ${r.route}`);
    for (const c of r.contrast.slice(0, lim)) console.log(`  contrast  ${c.target} — ${c.summary}`);
    for (const t of r.tiny.slice(0, lim)) console.log(`  tiny      ${t.size}px ${t.el}`);
    for (const s of r.small.slice(0, lim)) console.log(`  small     ${s.h}px tall ${s.el}`);
    if (r.fold.found) console.log(`  fold      ${r.fold.above ? "above" : "BELOW"}: ${r.fold.el} (bottom ${r.fold.bottom}px)`);
    if (!verbose) {
      const more = Math.max(0, r.contrast.length - lim) + Math.max(0, r.tiny.length - lim) + Math.max(0, r.small.length - lim);
      if (more) console.log(`  … ${more} more (--verbose)`);
    }
  }
  const totals = results.reduce(
    (t, r) =>
      r.error
        ? { ...t, errors: t.errors + 1 }
        : {
            ...t,
            contrast: t.contrast + r.contrast.length,
            tiny: t.tiny + r.tiny.length,
            small: t.small + r.small.length,
            below: t.below + (r.fold.found && !r.fold.above ? 1 : 0),
          },
    { contrast: 0, tiny: 0, small: 0, below: 0, errors: 0 },
  );
  console.log(
    `\nTOTAL contrast ${totals.contrast} · tiny ${totals.tiny} · small ${totals.small} · primary below fold ${totals.below}/${results.length}${totals.errors ? ` · route errors ${totals.errors}` : ""}`,
  );
  return totals;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
    process.exit(0);
  }
  if (args.allowGuest && /(^|\.)verveq\.com$/.test(new URL(args.base).hostname)) {
    console.error("--allow-guest creates guest sessions; it is for DEV builds only, never verveq.com");
    process.exit(2);
  }
  console.log(`design floors · ${args.base} · ${VIEWPORT.width}×${VIEWPORT.height} · ${args.routes.length} routes`);
  const results = await runFloors(args);
  const totals = report(results, args);
  if (args.json) {
    writeFileSync(args.json, JSON.stringify({ base: args.base, viewport: VIEWPORT, at: new Date().toISOString(), totals, results }, null, 2));
    console.log(`wrote ${args.json}`);
  }
  process.exit(totals.contrast > 0 || totals.errors > 0 ? 1 : 0);
}
