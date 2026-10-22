/**
 * THE JOURNEY (VerveQ ONE P2.6) — the path most new players actually take,
 * walked end to end on a phone (390×664) against the DEV Convex deployment:
 *
 *   /older (the Instagram bio link) → play today's Who's Older to the end by
 *   tapping cards → its result screen → "Next today" → Missing Letters →
 *   Quit → the Play tab → start Career Path.
 *
 * At every step it asserts the design floors the plan promises:
 *   - the ground is ink: the computed background of <body> and of the screen's
 *     frame is rgb(18, 18, 18);
 *   - no visible text is smaller than 12px;
 *   - on a RESULT screen, exactly one visible control wears the lime primary
 *     (the one thing to tap next);
 * and takes a `toHaveScreenshot` per step. The dailies change every day, so
 * the screenshots are taken with text painted transparent and pictures hidden
 * (journey.screenshot.css): they compare layout, grounds and fills — the words
 * are covered by the assertions above.
 *
 * Not part of `npm run check` (same rule as every e2e spec): it boots the real
 * app against DEV and plays as a brand-new anonymous visitor, so it needs the
 * prod flags. One command, from app/:
 *
 *   E2E_PORT=5181 VITE_ANONYMOUS_FIRST_ENABLED=true VITE_DRAW_ENABLED=true \
 *     npx playwright test e2e/journey.spec.ts
 *
 * (E2E_PORT keeps it off a dev server another checkout already holds on 5173 —
 * playwright.config reuses whatever answers there.) Pixel baselines live in
 * e2e/journey.spec.ts-snapshots/; after an intended visual change, accept the
 * new look with `--update-snapshots`.
 *
 * It creates only what any visitor creates: an anonymous session and today's
 * daily attempts on DEV. No username, no squad.
 */
import { test, expect, type Page } from "@playwright/test";

const INK = "rgb(18, 18, 18)";
const SHOT = {
  animations: "disabled" as const,
  caret: "hide" as const,
  stylePath: "e2e/journey.screenshot.css",
  maxDiffPixelRatio: 0.03,
};

test.use({
  viewport: { width: 390, height: 664 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: "en-US",
  timezoneId: "Europe/London",
});

test.beforeEach(async ({ context }) => {
  // An English speaker who already picked a language: the first-run chooser
  // is a modal that would cover the game.
  await context.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
    localStorage.setItem("i18nextLng", "en");
  });
  // Analytics and monitoring stay out of a test run. Matched on the HOST: the
  // dev server serves /src/lib/sentry.ts, and blocking that blanks the app.
  await context.route(/^https?:\/\/[^/]*(posthog|sentry|googletagmanager|google-analytics)/, (route) =>
    route.abort(),
  );
});

/** Body and frame grounds: the frame is the fixed shell/stage column. */
async function grounds(page: Page) {
  return page.evaluate(() => {
    const bg = (el: Element | null) => (el ? getComputedStyle(el).backgroundColor : null);
    const frame = [...document.querySelectorAll(".shell-canvas-bg")].find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    return { body: bg(document.body), frame: bg(frame ?? null) };
  });
}

/** Every visible element whose own text renders below 12px. */
async function tinyText(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || seen.has(el) || !node.textContent?.trim()) continue;
      seen.add(el);
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const visible =
        r.width > 0 &&
        r.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        Number(style.opacity) > 0 &&
        !el.closest("[aria-hidden='true'], .sr-only");
      if (visible && parseFloat(style.fontSize) < 12) {
        out.push(`${style.fontSize} "${node.textContent.trim().slice(0, 40)}"`);
      }
    }
    return out;
  });
}

/** Visible controls (buttons, links) filled with the lime primary. */
async function limePrimaries(page: Page) {
  return page.evaluate(() => {
    // Resolve the token the way the page does, rather than hardcoding a
    // rounding of hsl(75 100% 55%).
    const probe = document.createElement("div");
    probe.style.backgroundColor = "hsl(var(--lime))";
    document.body.appendChild(probe);
    const lime = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return [...document.querySelectorAll("button, a, [role='button']")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.backgroundColor === lime
        );
      })
      .map((el) => el.textContent?.trim().slice(0, 40) ?? "");
  });
}

/**
 * The floors every step holds; `result` adds the one-lime-primary rule.
 * `maskMain` masks the stage's content in the pixel comparison, for a screen
 * whose very layout is random (a Career Path round's club list).
 */
async function step(page: Page, name: string, opts: { result?: boolean; maskMain?: boolean } = {}) {
  await page.evaluate(() => document.fonts.ready);
  // Let the cards that load on their own land first (Today's Draw reads its
  // board after mount): the floors must judge the screen a player sees, not
  // the first paint.
  await page.waitForTimeout(2_000);
  const g = await grounds(page);
  expect(g.body, `${name}: body ground`).toBe(INK);
  expect(g.frame, `${name}: frame ground`).toBe(INK);
  expect(await tinyText(page), `${name}: text under 12px`).toEqual([]);
  if (opts.result) {
    const lime = await limePrimaries(page);
    expect(lime, `${name}: lime primaries`).toHaveLength(1);
  }
  await expect(page).toHaveScreenshot(`${name}.png`, {
    ...SHOT,
    ...(opts.maskMain ? { mask: [page.locator("main")] } : {}),
  });
}

test("new visitor: Who's Older → Missing Letters → Play → Career Path", async ({ page }) => {
  test.setTimeout(240_000);

  // 1 · The bio link drops a cold visitor straight into today's Who's Older.
  await page.goto("/older?utm_source=ig&utm_medium=bio");
  const cardA = page.getByTestId("whos-older-card-a");
  await expect(cardA).toBeVisible({ timeout: 45_000 });
  await step(page, "01-older-round");

  // 2 · Play it to the end by tapping cards (always the top one).
  const result = page.getByTestId("whos-older-result");
  const deadline = Date.now() + 120_000;
  while (!(await result.isVisible().catch(() => false))) {
    if (Date.now() > deadline) throw new Error("the daily never finished");
    if (await cardA.isEnabled().catch(() => false)) await cardA.click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(650);
  }
  await expect(page.getByTestId("whos-older-next-today")).toBeVisible({ timeout: 15_000 });
  await step(page, "02-older-result", { result: true });

  // 3 · "Next today" → the other daily.
  await page.getByTestId("whos-older-next-today").click();
  await expect(page).toHaveURL(/\/missing-letters/);
  await expect(page.getByTestId("missing-letters-keyboard")).toBeVisible({ timeout: 45_000 });
  await step(page, "03-letters-board");

  // 4 · Quit (a daily resumes later, so it leaves without asking) → Play.
  await page.getByTestId("stage-exit").click();
  await expect(page).toHaveURL(/\/home(\?|#|$)/);
  await expect(page.getByTestId("home-whos-older-card")).toBeVisible({ timeout: 30_000 });
  await step(page, "04-play");

  // 5 · The Play tab (decision 10) — already home, and it says so.
  const playTab = page.getByRole("button", { name: "Play", exact: true });
  await expect(playTab).toBeVisible();
  await playTab.click();
  await expect(page).toHaveURL(/\/home(\?|#|$)/);

  // 6 · Start Career Path — the Featured mode.
  await page.getByTestId("home-career-path-card").click();
  await expect(page).toHaveURL(/\/career-path/);
  await expect(page.getByText("Pick your challenge")).toBeVisible({ timeout: 30_000 });
  await step(page, "05-career-path-pick");
  await page.getByText("One At A Time").click();
  await expect(page.getByPlaceholder("Enter player name...")).toBeVisible({ timeout: 45_000 });
  // A random player's path: the club list's length IS the layout, so the
  // pixels compare the stage chrome only (the floors above still cover it).
  await step(page, "06-career-path-round", { maskMain: true });
});
