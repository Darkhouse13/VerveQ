/**
 * FW-IMMERSE Phase A — matchday at 380px against DEV.
 *
 *  A1. The picker filter bar scrolls horizontally ONLY: overflow-y is
 *      hidden and even a pressed chip (whose translate used to grow the
 *      scroll area) cannot scroll the row vertically.
 *  A2. The pitch reads as a place: SVG turf present, 13 shirt slots, a pick
 *      lands as a filled shirt with name and value plates.
 *  A3. Fixtures: grouped by day, league-tagged, localized kickoffs, count
 *      agrees with the server payload.
 *  A4. The matchday hub: countdown hero derived from the server's next
 *      kickoff, squad status card for a signed-in builder, fixtures rail,
 *      all-fixtures path, doors demoted to actions.
 *
 * Hygiene as ever: console-error-free, no horizontal page scroll,
 * screenshots committed, purgeUiRun owns everything simloop_*.
 */

import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const RUN_TAG = `simloop_uifwi${Date.now() % 100_000}`;

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

interface FixturesPayload {
  gwNumber: number;
  fixtures: {
    kickoffAt: number;
    status: string;
    homeName: string | null;
    awayName: string | null;
    leagueId: number;
  }[];
}

test("FW-IMMERSE A: filter bar axis, pitch, fixtures, matchday hub", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });

  const payload = convexRun("fantasyMarket:getWeekendFixtures") as FixturesPayload | null;
  expect(payload, "an open gameweek with fixtures must exist").not.toBeNull();
  const displayable = payload!.fixtures;
  expect(displayable.length).toBeGreaterThan(0);

  // ── A4: the hub is the weekend ──
  await page.goto("/v2/weekend");
  const boardLine = page.getByTestId("weekend-hub-board-line");
  await expect(boardLine).toBeVisible({ timeout: 45_000 });
  await expect(boardLine).toContainText(`Gameweek ${payload!.gwNumber} board is open`);

  const hero = page.getByTestId("matchday-hero");
  await expect(hero).toBeVisible({ timeout: 45_000 });
  // The countdown ticks against the server's next kickoff — check the shape
  // and that it changes within two seconds (a live clock, not a label).
  const upcoming = displayable.filter(
    (f) => f.status === "scheduled" && f.kickoffAt > Date.now(),
  );
  if (upcoming.length > 0) {
    const first = await page.getByTestId("matchday-countdown").textContent();
    expect(first).toMatch(/^\d{2,}:\d{2}:\d{2}$/);
    await page.waitForTimeout(2_100);
    const second = await page.getByTestId("matchday-countdown").textContent();
    expect(second, "the countdown must tick").not.toBe(first);
  }

  await expect(page.getByTestId("fixtures-rail")).toBeVisible();
  expect(await page.getByTestId("fixtures-rail-card").count()).toBeGreaterThan(0);
  // Doors are still the actions within the place.
  for (const door of ["squad", "crews", "vote", "court"]) {
    await expect(page.getByTestId(`weekend-door-${door}`)).toBeVisible();
  }
  await expectNoHorizontalScroll(page, "matchday hub");
  await page.screenshot({ path: "e2e/artifacts/fwi-hub-matchday-380.png", fullPage: true });

  // The rail's all-fixtures path lands on the fixtures screen.
  await page.getByTestId("fixtures-rail-all").click();
  await expect(page).toHaveURL(/\/v2\/weekend\/fixtures$/);
  await expect(page.getByTestId("fixture-card").first()).toBeVisible({ timeout: 45_000 });

  // ── A3: the fixtures screen ──
  expect(
    await page.getByTestId("fixture-card").count(),
    "every fixture the server returned renders",
  ).toBe(displayable.length);
  const dayHeadings = await page.getByTestId("fixture-day-heading").allTextContents();
  expect(dayHeadings.length).toBeGreaterThan(0);
  // Grouped by day: the number of distinct local days matches the payload.
  const expectedDays = new Set(
    displayable.map((f) => new Date(f.kickoffAt).toDateString()),
  );
  expect(dayHeadings.length).toBe(expectedDays.size);
  // League-tagged: the first card names a real covered league.
  await expect(
    page
      .getByTestId("fixture-card")
      .first()
      .getByText(
        /Premier League|La Liga|Serie A|Bundesliga|Ligue 1|Eredivisie|Liga Portugal|Championship/,
      ),
  ).toBeVisible();
  await expectNoHorizontalScroll(page, "fixtures screen");
  await page.screenshot({ path: "e2e/artifacts/fwi-fixtures-380.png", fullPage: true });

  // ── guest onboarding through the squad door ──
  await page.goto("/v2/weekend");
  await page.getByTestId("weekend-door-squad").click();
  await page.getByText("Play as a guest").click();
  await page.getByRole("textbox").first().fill(RUN_TAG);
  await page.getByRole("button", { name: "Start playing" }).click();
  await expect(page.getByText("Building for")).toBeVisible({ timeout: 45_000 });
  await page.getByText("Start building").click();

  // ── A2: the pitch ──
  const pitch = page.getByTestId("weekend-pitch");
  await expect(pitch).toBeVisible({ timeout: 45_000 });
  expect(await page.locator('[data-chip-state="empty"]').count()).toBe(13);
  expect(
    await pitch.locator("svg").count(),
    "the SVG turf (and 13 jersey silhouettes) are on the pitch",
  ).toBeGreaterThanOrEqual(14);
  await pitch.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "e2e/artifacts/fwi-pitch-empty-380.png", fullPage: true });

  // ── A1: the picker filter bar scrolls horizontally only ──
  await page.getByTestId("pitch-slot-0").click();
  const row = page.getByTestId("picker-filter-row");
  await expect(row).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(450);
  const axes = await row.evaluate((el) => ({
    overflowX: getComputedStyle(el).overflowX,
    overflowY: getComputedStyle(el).overflowY,
    horizontal: el.scrollWidth > el.clientWidth,
  }));
  expect(axes.overflowX, "chips stay reachable by horizontal scroll").toBe("auto");
  expect(axes.overflowY, "the vertical axis is clipped, not scrollable").toBe("hidden");
  expect(axes.horizontal, "the row genuinely overflows horizontally at 380px").toBe(true);

  // Even mid-press (the translate that caused the regression) the row cannot
  // scroll vertically.
  const chipBox = await page.getByTestId("picker-league-chip").boundingBox();
  await page.mouse.move(chipBox!.x + chipBox!.width / 2, chipBox!.y + chipBox!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const pressed = await row.evaluate((el) => {
    el.scrollTop = 50;
    const scrolled = el.scrollTop;
    el.scrollTop = 0;
    return { scrolled, overflow: el.scrollHeight - el.clientHeight };
  });
  await page.mouse.up();
  expect(pressed.scrolled, "no vertical scroll even while a chip is pressed").toBe(0);
  expect(pressed.overflow, "pressed translate stays inside the padding box").toBe(0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "e2e/artifacts/fwi-picker-filter-row-380.png" });

  // Close the league sheet the press opened, then the picker stays usable —
  // pick the first available player onto the pitch (A2 placement).
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Pick", exact: true }).first().click();
  const gkChip = page.getByTestId("pitch-slot-0");
  await expect(gkChip).not.toHaveAttribute("data-chip-state", "empty", {
    timeout: 30_000,
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "e2e/artifacts/fwi-pitch-pick-380.png", fullPage: true });
  await expectNoHorizontalScroll(page, "squad screen");

  // ── A4: the signed-in builder's hub carries the squad status card ──
  await page.goto("/v2/weekend");
  const status = page.getByTestId("squad-status-card");
  await expect(status).toBeVisible({ timeout: 45_000 });
  await expect(status).toContainText("12 spots still open");
  await page.screenshot({ path: "e2e/artifacts/fwi-hub-squad-status-380.png" });
  await status.click();
  await expect(page).toHaveURL(/\/v2\/weekend\/squad$/);

  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test.afterAll(() => {
  convexRun("fantasyIntegrationSim:purgeUiRun", {});
});
