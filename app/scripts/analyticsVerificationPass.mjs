/**
 * Scripted analytics verification pass.
 *
 * Drives the real production bundle in a real browser and lets the real
 * posthog-js decide what to send — the point is to observe what actually
 * leaves the page, not what the source implies should.
 *
 * MUST run against a build carrying VITE_ANALYTICS_TEST_MODE=1, so every event
 * is tagged is_test/env:test and filterable out of the shared project's
 * baseline. The pass asserts that tagging is live before it does anything else
 * and refuses to continue otherwise: firing untagged synthetic events into the
 * real dataset is the one outcome that cannot be undone.
 *
 * Two things learned the hard way, both encoded below:
 *  - posthog-js gzips its batches, so bodies must be read as Buffers.
 *  - sendBeacon traffic (exit_before_play, game_abandoned on pagehide) is NOT
 *    observable via page.on("request") once the document is tearing down.
 *    Those events are verified in PostHog itself, not here; this script only
 *    reports what it can honestly see.
 *
 *   node scripts/analyticsVerificationPass.mjs [baseUrl]
 */
import { chromium } from "@playwright/test";
import { gunzipSync } from "node:zlib";

const BASE = process.argv[2] || "http://localhost:4173";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// posthog batches on a ~3s poll; anything shorter reads as "never fired".
const FLUSH = 5000;

let sent = [];

const tryParse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

function decodeBatch(req) {
  const buf = req.postDataBuffer();
  if (!buf || !buf.length) return [];
  let text;
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      text = gunzipSync(buf).toString("utf8");
    } catch {
      return [];
    }
  } else {
    text = buf.toString("utf8");
    if (text.startsWith("data=")) {
      const raw = decodeURIComponent(text.slice(5));
      text = tryParse(raw) ? raw : Buffer.from(raw, "base64").toString("utf8");
    }
  }
  const parsed = tryParse(text);
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed : [parsed];
}

function attach(page) {
  page.on("request", (req) => {
    if (req.method() !== "POST" || !/posthog\.com/.test(req.url())) return;
    for (const ev of decodeBatch(req)) if (ev?.event) sent.push(ev);
  });
}

const seen = (n) => sent.filter((e) => e.event === n);
const props = (n) => seen(n).map((e) => e.properties || {});
const pick = (o, keys) =>
  Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));

const results = [];
function report(label, ok, detail) {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `\n        ${detail}` : ""}`);
}

async function fresh(browser) {
  sent = [];
  const ctx = await browser.newContext();
  // Suppress the first-run language modal: it overlays whatever screen loads
  // first, and these assertions are about the game loop, not the modal. The
  // double-start it used to cause on Career Path is fixed and pinned by
  // careerPathModeContract; the first-run flow itself is exercised there and by
  // the repro in that fix, not here.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("verveq_lang_chosen", "1");
    } catch {
      /* private mode */
    }
  });
  const page = await ctx.newPage();
  attach(page);
  return { ctx, page };
}

/** The one-time language chooser overlays whatever screen loads first in a
 *  fresh context, and swallows clicks meant for the screen beneath it. */
async function dismissLanguagePrompt(page) {
  for (const name of [/^english$/i, /^close$/i]) {
    const btn = page.getByRole("button", { name }).first();
    if (await btn.count().catch(() => 0)) {
      await btn.click().catch(() => {});
      await wait(600);
      return;
    }
  }
}

/** Play Career Path to a real terminal state by burning its three guesses.
 *  The guess field carries no type attribute, so it must be matched by role. */
async function playCareerPathOut(page) {
  for (let i = 0; i < 5 && seen("game_completed").length === 0; i++) {
    const input = page.locator("input").first();
    if (!(await input.count())) break;
    await input.fill(`wrong-guess-${i}`);
    await input.press("Enter");
    await wait(3000);
  }
  await wait(FLUSH);
}

async function claimUsername(page) {
  const username = `tvq${Date.now().toString().slice(-9)}`;
  await page.goto(`${BASE}/v2/welcome`, { waitUntil: "networkidle" });
  await wait(2500);
  await dismissLanguagePrompt(page);
  const field = page.locator("input").first();
  if (!(await field.count())) return null;
  await field.fill(username);
  const go = page.getByRole("button", { name: /start playing/i }).first();
  if (await go.count()) await go.click();
  else await page.keyboard.press("Enter");
  await wait(9000);
  return username;
}

async function main() {
  const browser = await chromium.launch();

  // ── 1. Career Path: a real game, played to a real finish ──────────────────
  {
    const { ctx, page } = await fresh(browser);
    await page.goto(`${BASE}/v2/career-path?ref=play`, { waitUntil: "networkidle" });
    // Dismiss BEFORE asserting: the prompt overlays the screen and swallows
    // clicks meant for it. Career Path's arrival is idempotent, so a locale
    // switch no longer mints a second session — but the modal is still in the
    // way, and these blocks are about the game loop, not the modal.
    await dismissLanguagePrompt(page);
    await wait(FLUSH + 2000);

    const started = props("game_started")[0];
    if (!started) {
      console.error("ABORT: no game_started — the backend is not serving games.");
      await browser.close();
      process.exit(1);
    }
    if (started.is_test !== true || started.env !== "test") {
      console.error("ABORT: events NOT tagged is_test/env:test. Refusing to continue.");
      await browser.close();
      process.exit(1);
    }
    report("career-path game_started (tagged, on session mint)", seen("game_started").length === 1,
      JSON.stringify(pick(started, ["mode", "entry_source", "is_authenticated", "account_state", "start_trigger", "is_test", "env"])));

    await playCareerPathOut(page);
    const done = props("game_completed")[0];
    report("career-path game_completed after real play", seen("game_completed").length === 1,
      JSON.stringify(pick(done, ["mode", "score", "questions_answered", "duration_seconds", "result", "is_test"])));
    report("a completed game emits NO abandon", seen("game_abandoned").length === 0);
    await ctx.close();
  }

  // ── 2. Career Path: leave mid-game -> abandoned, never completed ──────────
  {
    const { ctx, page } = await fresh(browser);
    await page.goto(`${BASE}/v2/career-path?ref=play`, { waitUntil: "networkidle" });
    // Dismiss BEFORE asserting: the prompt overlays the screen and swallows
    // clicks meant for it. Career Path's arrival is idempotent, so a locale
    // switch no longer mints a second session — but the modal is still in the
    // way, and these blocks are about the game loop, not the modal.
    await dismissLanguagePrompt(page);
    await wait(FLUSH + 2000);
    const started = seen("game_started").length === 1;
    // Full navigation: tears the document down mid-game, exercising the
    // pagehide abandon path (the common real exit; React runs no cleanup).
    await page.goto(`${BASE}/compete`, { waitUntil: "networkidle" });
    await wait(FLUSH);
    report("career-path abandon: a game did start first", started);
    report("career-path abandon emits NO completion", seen("game_completed").length === 0,
      "game_abandoned rides sendBeacon and is verified in PostHog, not here");
    await ctx.close();
  }

  // ── 3. Navigating without playing must be SILENT ──────────────────────────
  // Meaningful only now that the backend genuinely serves games (block 1).
  {
    const { ctx, page } = await fresh(browser);
    await page.goto(`${BASE}/compete`, { waitUntil: "networkidle" });
    await wait(2000);
    await page.goto(`${BASE}/v2/ranks`, { waitUntil: "networkidle" });
    await wait(FLUSH);
    report("route changes fire NO game_started / game_completed",
      seen("game_started").length === 0 && seen("game_completed").length === 0,
      `game_started=${seen("game_started").length} game_completed=${seen("game_completed").length} pageviews=${seen("$pageview").length}`);
    await ctx.close();
  }

  // ── 4. Identity: anonymous history -> claim -> identify merge ─────────────
  {
    const { ctx, page } = await fresh(browser);
    // Build anonymous history FIRST so the merge has something to attribute.
    await page.goto(`${BASE}/v2/career-path?ref=play`, { waitUntil: "networkidle" });
    // Dismiss BEFORE asserting: the prompt overlays the screen and swallows
    // clicks meant for it. Career Path's arrival is idempotent, so a locale
    // switch no longer mints a second session — but the modal is still in the
    // way, and these blocks are about the game loop, not the modal.
    await dismissLanguagePrompt(page);
    await wait(FLUSH + 2000);

    const anonId = seen("game_started")[0]?.properties?.distinct_id;
    report("anonymous distinct_id is test-scoped", String(anonId || "").startsWith("test_anon_"), String(anonId));
    const anonEvents = sent.length;

    const username = await claimUsername(page);
    await wait(FLUSH);

    const claimed = props("username_claimed")[0];
    report("username_claimed on a real claim", seen("username_claimed").length === 1,
      JSON.stringify(pick(claimed, ["entry_source", "via_invite", "is_test", "env"])));

    // posthog nests distinct_id inside properties, not at the event root.
    const ident = sent.find((e) => e.event === "$identify");
    const newId = ident?.properties?.distinct_id ?? ident?.distinct_id;
    const anonOf = ident?.properties?.$anon_distinct_id;
    const merged = !!ident && anonOf === anonId && newId !== anonId && !!newId;
    report("identify() merged anonymous -> known", merged,
      ident
        ? `$anon_distinct_id=${anonOf}\n        -> distinct_id=${newId}  (username=${username}, ${anonEvents} anon events precede the claim)`
        : "no $identify observed");
    report("identified id is the Convex users doc id, never guest_tab",
      !!newId && newId !== "guest_tab" && !/guest_tab/.test(JSON.stringify(sent)),
      `id=${newId}`);

    // ── 5. A username-only account can play the casual modes ───────────────
    for (const [route, mode] of [
      ["/v2/blitz?sport=football", "blitz"],
      ["/v2/higher-lower?sport=football", "higher-lower"],
      ["/v2/verve-grid?sport=football", "verve-grid"],
      ["/v2/daily?sport=football", "daily"],
    ]) {
      sent = [];
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await wait(FLUSH + 3000);
      const s = props("game_started")[0];
      report(`${mode} game_started`, seen("game_started").length >= 1,
        s ? JSON.stringify(pick(s, ["mode", "entry_source", "is_authenticated", "account_state", "start_trigger"])) : "not started");
    }

    // ── 6. Logout resets the identity ──────────────────────────────────────
    sent = [];
    await page.goto(`${BASE}/v2/settings`, { waitUntil: "networkidle" });
    await wait(2500);
    const out = page.getByRole("button", { name: /sign out|log ?out/i }).first();
    if (await out.count()) {
      await out.click();
      await wait(FLUSH);
      report("logout observed (reset() drops the person binding)", true,
        `events after logout: ${sent.map((e) => e.event).join(", ") || "(none)"}`);
    } else {
      report("logout control found on /v2/settings", false, "could not locate a sign-out button");
    }
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
