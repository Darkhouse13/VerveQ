/**
 * Performance budget for the reel-traffic entry routes (VerveQ ONE, P5.3).
 *
 *   node scripts/perfBudget.mjs [baseUrl=https://verveq.com] [--runs 2]
 *
 * Lab profile used by the 2026-10 audit: a mid-range phone (4x CPU throttle),
 * 1.6 Mbps down / 150 ms RTT, cold cache, Instagram in-app user agent.
 * Measures the time until the first real game content is visible, LCP and
 * CLS, takes the median over runs, and exits 1 when a budget is missed.
 * Analytics/monitoring hosts are blocked; the run does open a guest session
 * on the target (the games need one), but creates no username or squad.
 */
import { chromium } from "playwright";
import { appendFileSync } from "node:fs";

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "https://verveq.com").replace(/\/$/, "");
const runsIdx = args.indexOf("--runs");
const RUNS = runsIdx >= 0 ? Number(args[runsIdx + 1]) : 2;

// Budgets from the plan's spec ("Floors every screen must pass").
const ROUTES = [
  { name: "Who's Older", path: "/older", ready: '[data-testid^="whos-older-card-"]', contentMs: 2500, cls: 0.05 },
  { name: "Missing Letters", path: "/letters", ready: '[data-testid="missing-letters-board"]', contentMs: 2500, cls: 0.05 },
  { name: "THE WEEKEND", path: "/weekend", ready: '[data-testid="matchday-hero"]', contentMs: 3000, cls: 0.1 },
];

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0";

const observe = (sel) => `(() => {
  window.__m = { lcp: 0, cls: 0, content: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  const tick = () => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (el && el.getBoundingClientRect().height > 0 && (el.innerText || "").trim().length > 1) { window.__m.content = performance.now(); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const browser = await chromium.launch();
const rows = [];
let failed = false;
for (const route of ROUTES) {
  const content = [];
  const lcp = [];
  const cls = [];
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA });
    await ctx.addInitScript(() => {
      try { localStorage.setItem("verveq.language.chosen", "1"); } catch { /* ignore */ }
    });
    const page = await ctx.newPage();
    await page.addInitScript(observe(route.ready));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.setBlockedURLs", { urls: ["*posthog*", "*sentry.io*", "*google-analytics*", "*googletagmanager*"] });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    try {
      await page.goto(base + route.path, { waitUntil: "load", timeout: 90000 });
      await page.waitForFunction(() => window.__m && window.__m.content > 0, null, { timeout: 40000, polling: 250 });
    } catch {
      // Content never appeared: recorded as a miss below.
    }
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => window.__m);
    content.push(m.content || 99999);
    lcp.push(m.lcp);
    cls.push(m.cls);
    await ctx.close();
  }
  const row = { ...route, contentMed: Math.round(median(content)), lcpMed: Math.round(median(lcp)), clsMed: +median(cls).toFixed(3) };
  row.ok = row.contentMed <= route.contentMs && row.clsMed <= route.cls;
  if (!row.ok) failed = true;
  rows.push(row);
}
await browser.close();

const lines = [
  `## Performance budget — ${base} (median of ${RUNS}, throttled phone)`,
  "",
  "| Route | First game content | Budget | LCP | CLS | Budget | |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.name} \`${r.path}\` | ${r.contentMed} ms | ${r.contentMs} ms | ${r.lcpMed} ms | ${r.clsMed} | ${r.cls} | ${r.ok ? "pass" : "**MISS**"} |`),
];
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
process.exit(failed ? 1 : 0);
