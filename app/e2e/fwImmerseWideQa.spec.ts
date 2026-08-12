/**
 * FW-IMMERSE Phase B — one experience, every screen width (≥1280px QA).
 *
 * At 1366×900 against DEV:
 *  - hub: the fixtures panel rides beside the matchday column (the
 *    horizontal rail is gone), doors and hero intact;
 *  - fixtures screen: day groups tile two-up;
 *  - build screen: pitch and market side by side — idle panel is a read-only
 *    browse (no Pick buttons, no All-positions affordance), arming a slot
 *    scopes it (same slot question, Pick appears, NO modal), a pick lands
 *    and the panel returns to browse;
 *  - crew page: code/members/actions beside standings/crew table;
 *  - the picker filter row still scrolls horizontally only.
 * Hygiene: console-error-free, no horizontal page scroll, screenshots
 * committed, purgeUiRun owns everything simloop_*.
 */

import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const RUN_TAG = `simloop_uifwiw${Date.now() % 100_000}`;

test.use({ viewport: { width: 1366, height: 900 }, isMobile: false, hasTouch: false });

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

test("FW-IMMERSE B: wide hub, fixtures, side-by-side build, crew split", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });

  // ── hub: persistent fixtures panel, no horizontal rail ──
  await page.goto("/v2/weekend");
  const hero = page.getByTestId("matchday-hero");
  await expect(hero).toBeVisible({ timeout: 45_000 });
  const panel = page.getByTestId("hub-fixtures-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("fixtures-rail")).toHaveCount(0);
  const heroBox = (await hero.boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  expect(panelBox.x, "the fixtures panel sits beside the matchday column").toBeGreaterThan(
    heroBox.x + heroBox.width,
  );
  for (const door of ["squad", "crews", "vote", "court"]) {
    await expect(page.getByTestId(`weekend-door-${door}`)).toBeVisible();
  }
  await expectNoHorizontalScroll(page, "wide hub");
  await page.screenshot({ path: "e2e/artifacts/fwi-wide-hub-1366.png", fullPage: true });

  // ── fixtures screen: day groups two-up ──
  await page.getByTestId("fixtures-rail-all").click();
  await expect(page).toHaveURL(/\/v2\/weekend\/fixtures$/);
  // The hub side panel carries the same testids and stays mounted through
  // the lazy-route transition — wait for the hub to actually unmount.
  await expect(page.getByTestId("matchday-hero")).toHaveCount(0, { timeout: 45_000 });
  await expect(page.getByTestId("fixture-card").first()).toBeVisible({ timeout: 45_000 });
  // Atomic DOM read (locator handles can race a re-render).
  const dayTops = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="fixture-day"]')]
      .slice(0, 2)
      .map((el) => el.getBoundingClientRect().top),
  );
  if (dayTops.length >= 2) {
    expect(
      Math.abs(dayTops[0] - dayTops[1]),
      "the first two day groups share a row at xl",
    ).toBeLessThan(4);
  }
  await expectNoHorizontalScroll(page, "wide fixtures");
  await page.screenshot({ path: "e2e/artifacts/fwi-wide-fixtures-1366.png", fullPage: true });

  // ── guest onboarding through the squad door ──
  await page.goto("/v2/weekend");
  await page.getByTestId("weekend-door-squad").click();
  await page.getByText("Play as a guest").click();
  await page.getByRole("textbox").first().fill(RUN_TAG);
  await page.getByRole("button", { name: "Start playing" }).click();
  await expect(page.getByText("Building for")).toBeVisible({ timeout: 45_000 });
  await page.getByText("Start building").click();

  // ── the build screen: pitch and market side by side ──
  const pitch = page.getByTestId("weekend-pitch");
  await expect(pitch).toBeVisible({ timeout: 45_000 });
  const market = page.getByTestId("market-panel");
  await expect(market).toBeVisible();
  const pitchBox = (await pitch.boundingBox())!;
  const marketBox = (await market.boundingBox())!;
  expect(marketBox.x, "the market rides beside the pitch").toBeGreaterThan(
    pitchBox.x + pitchBox.width,
  );

  // Idle panel = read-only browse: browse prompt, market rows, no Pick.
  await expect(page.getByTestId("picker-prompt")).toHaveText("The weekend's market");
  await expect(page.getByTestId("picker-row").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Pick", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "e2e/artifacts/fwi-wide-squad-browse-1366.png", fullPage: false });

  // Arming a slot scopes the panel — same question, Pick appears, NO modal.
  await page.getByTestId("pitch-slot-0").click();
  await expect(page.getByTestId("picker-prompt")).toHaveText(
    "Who starts between the sticks?",
    { timeout: 30_000 },
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pick", exact: true }).first(),
  ).toBeVisible({ timeout: 30_000 });

  // The filter row keeps its one axis in the panel host too.
  const row = page.getByTestId("picker-filter-row");
  const axes = await row.evaluate((el) => ({
    overflowX: getComputedStyle(el).overflowX,
    overflowY: getComputedStyle(el).overflowY,
  }));
  expect(axes.overflowX).toBe("auto");
  expect(axes.overflowY).toBe("hidden");

  // Back to browsing disarms without picking.
  await page.getByTestId("market-panel-browse").click();
  await expect(page.getByTestId("picker-prompt")).toHaveText("The weekend's market");

  // Arm again and land the pick — the chip fills, the panel returns to browse.
  await page.getByTestId("pitch-slot-0").click();
  await page.getByRole("button", { name: "Pick", exact: true }).first().click();
  await expect(page.getByTestId("pitch-slot-0")).not.toHaveAttribute(
    "data-chip-state",
    "empty",
    { timeout: 30_000 },
  );
  await expect(page.getByTestId("picker-prompt")).toHaveText("The weekend's market");
  await page.waitForTimeout(600);
  await expectNoHorizontalScroll(page, "wide build screen");
  await page.screenshot({ path: "e2e/artifacts/fwi-wide-squad-pick-1366.png", fullPage: true });

  // ── crew page: two-up split ──
  await page.goto("/v2/weekend/crews");
  await expect(page.getByRole("button", { name: /Create crew/ })).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole("button", { name: /Create crew/ }).click();
  await page.getByPlaceholder("Sunday League Legends").fill("FWI WIDE QA");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const codeCard = page.getByText("Crew code");
  await expect(codeCard).toBeVisible({ timeout: 45_000 });
  const standings = page.getByText("Standings", { exact: true });
  await expect(standings).toBeVisible();
  const codeBox = (await codeCard.boundingBox())!;
  const standingsBox = (await standings.boundingBox())!;
  expect(
    standingsBox.x,
    "standings ride beside the crew card at xl",
  ).toBeGreaterThan(codeBox.x + 100);
  await expectNoHorizontalScroll(page, "wide crew page");
  await page.screenshot({ path: "e2e/artifacts/fwi-wide-crew-1366.png", fullPage: true });

  // Clean up the crew through the product flow (typed confirm).
  await page.getByTestId("crew-delete-open").click();
  await page.getByTestId("crew-delete-confirm-input").fill("DELETE");
  await page.getByTestId("crew-delete-confirm").click();
  await expect(page.getByRole("button", { name: /Create crew/ })).toBeVisible({
    timeout: 45_000,
  });

  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test.afterAll(() => {
  convexRun("fantasyIntegrationSim:purgeUiRun", {});
});
