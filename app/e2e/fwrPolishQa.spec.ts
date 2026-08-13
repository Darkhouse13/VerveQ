/**
 * FW-RECEIPT Part 1 — the four polish fixes, at 380px against DEV.
 *
 *  P1  One "This weekend" on the hub: the leagues chip/expander IS the
 *      fixtures-rail header — no standalone duplicate above the hero.
 *  P2  Copy law: a crew with no drafts reads "no drafts yet" in standings,
 *      never "awaiting data" (reserved for drafted-but-unscored weekends).
 *  P3  Fixture-card club names wrap to two lines before truncating —
 *      line-clamp-2 on both the fixtures page and the hub rail cards.
 *  P4  How to Play carries its three inline figures (pitch shape, chess
 *      clock, ×0.75 dampener), static SVG on theme tokens.
 *
 * Hygiene: console-error-free, no horizontal scroll, screenshots committed,
 * created guests/crews purged (purgeUiRun owns simloop_*).
 */

import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const RUN_TAG = `simloop_fwrp${Date.now() % 100_000}`;

test.use({ viewport: { width: 380, height: 844 } });

function convexRun(fn: string, args: Record<string, unknown> = {}): unknown {
  const out = execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, `${label} must not scroll horizontally`).toBeLessThanOrEqual(1);
}

test("FW-RECEIPT P1-P4: one header, honest copy, wrapped names, figures", async ({ page }) => {
  test.setTimeout(240_000);
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });

  // ── P1: the hub says "This weekend" exactly once, inside the rail header ──
  await page.goto("/v2/weekend");
  await expect(page.getByTestId("fixtures-rail")).toBeVisible({ timeout: 45_000 });
  const leaguesLine = page.getByTestId("weekend-hub-leagues-line");
  await expect(leaguesLine).toBeVisible();
  // The line lives INSIDE the rail header now.
  await expect(
    page.getByTestId("fixtures-rail").getByTestId("weekend-hub-leagues-line"),
  ).toBeVisible();
  // And no other element on the hub opens with the phrase.
  const thisWeekendCount = await page
    .getByText(/^This weekend/i)
    .count();
  expect(thisWeekendCount, "one 'This weekend' on the hub, not two").toBe(1);
  await expectNoHorizontalScroll(page, "hub");
  await page.screenshot({ path: "e2e/artifacts/fwr-p1-hub-380.png", fullPage: false });

  // ── P3: club names clamp at two lines instead of one-line ellipsis ──
  await page.goto("/v2/weekend/fixtures");
  const firstCard = page.getByTestId("fixture-card").first();
  await expect(firstCard).toBeVisible({ timeout: 45_000 });
  const clamped = await firstCard
    .locator("p")
    .first()
    .evaluate((el) => getComputedStyle(el).webkitLineClamp);
  expect(clamped, "fixture-card names carry line-clamp-2").toBe("2");
  await expectNoHorizontalScroll(page, "fixtures");
  await page.screenshot({ path: "e2e/artifacts/fwr-p3-fixtures-380.png", fullPage: false });

  // ── P4: the three figures, present and static ──
  await page.goto("/v2/weekend/how-to-play");
  await expect(page.getByTestId("how-to-play")).toBeVisible({ timeout: 45_000 });
  for (const figure of ["htp-figure-clock", "htp-figure-shape", "htp-figure-mismatch"]) {
    await page.getByTestId(figure).scrollIntoViewIfNeeded();
    await expect(page.getByTestId(figure)).toBeVisible();
  }
  await expectNoHorizontalScroll(page, "how to play");
  await page.getByTestId("htp-figure-shape").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "e2e/artifacts/fwr-p4-howtoplay-380.png", fullPage: false });

  // ── P2: a crew with no drafts says so in draft language ──
  await page.goto("/v2/weekend/crews");
  await page.getByText("Play as a guest").click();
  await page.getByRole("textbox").first().fill(RUN_TAG);
  await page.getByRole("button", { name: "Start playing" }).click();
  await expect(page.getByRole("button", { name: /Create crew/ })).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole("button", { name: /Create crew/ }).click();
  await page.getByPlaceholder("Sunday League Legends").fill("FW-O5 SIM");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  // Exact: the standings row's own copy (the crew-table empty state opens
  // with "No drafts yet — …" and is a different, pre-existing sentence).
  await expect(page.getByText("no drafts yet", { exact: true })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText("awaiting data")).toHaveCount(0);
  await page.screenshot({ path: "e2e/artifacts/fwr-p2-crew-380.png", fullPage: true });

  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test.afterAll(() => {
  convexRun("fantasyIntegrationSim:purgeUiRun", {});
});
