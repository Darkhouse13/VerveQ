/**
 * FW-SCOUT — the player detail sheet at 380px against DEV.
 *
 *  S1. Picker row body opens the sheet; the sheet shows seeded 2025-26 per-90
 *      facts for a known player (Drommel: 139 saves / 3060' = 4.09 per 90,
 *      club rates labelled per match) and the pool provenance line.
 *  S2. A flagged player reads "not enough football on record" — words, not
 *      zeros — reached through the one out-of-position affordance.
 *  S3. The sheet dismisses cleanly and PICK still works: the tap grammar
 *      never collides (row body = facts, PICK = action).
 *  S4. A manned pitch chip's slot dialog gains "Season stats & form" and the
 *      full sheet stacks over it (this same path serves the crew sheet).
 *  S5. Crew sheet of a server-drafted room: the sheet opens from a fixed
 *      player (the SquadView path under playersFixed).
 *  S6. Sparse-history honesty: before any settled gameweek, VerveQ points
 *      reads "history builds as weekends settle"; ownership renders NOTHING
 *      below the 10-squad floor.
 *
 * Hygiene as ever: console-error-free, no horizontal page scroll,
 * screenshots committed, purgeUiRun owns everything simloop_*.
 */

import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const RUN_TAG = `simloop_uifws${Date.now() % 100_000}`;

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

test("FW-SCOUT: sheet from picker, pitch and crew sheet at 380px", async ({ page }) => {
  test.setTimeout(300_000);
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });

  // ── guest onboarding through the squad door ──
  await page.goto("/v2/weekend");
  await page.getByTestId("weekend-door-squad").click();
  await page.getByText("Play as a guest").click();
  await page.getByRole("textbox").first().fill(RUN_TAG);
  await page.getByRole("button", { name: "Start playing" }).click();
  await expect(page.getByText("Building for")).toBeVisible({ timeout: 45_000 });
  await page.getByText("Start building").click();
  await expect(page.getByTestId("weekend-pitch")).toBeVisible({ timeout: 45_000 });

  // ── S1: row body → the sheet, seeded facts ──
  await page.getByTestId("pitch-slot-0").click(); // GK slot → GK pre-filter
  await expect(page.getByTestId("picker-prompt")).toBeVisible({ timeout: 30_000 });
  await page.getByPlaceholder("Search name or club…").fill("Drommel");
  const drommelRow = page.getByTestId("picker-row-body").first();
  await expect(drommelRow).toContainText("J. Drommel", { timeout: 30_000 });
  await drommelRow.click();

  const sheet = page.getByTestId("player-sheet");
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(sheet).toContainText("J. Drommel");
  await expect(sheet).toContainText("Keeper · Twente");
  await expect(page.getByTestId("player-sheet-pool")).toContainText(
    "Priced from 2025-26 Eredivisie form",
  );
  // 139 saves × 90 / 3060' — the seeded artifact rendered per 90.
  const lastSeason = page.getByTestId("player-sheet-last-season");
  await expect(lastSeason).toContainText("4.09");
  await expect(lastSeason).toContainText("Club clean sheets");
  await expect(sheet).toContainText("34 apps · 3060′");
  // S6: sparse-history + ownership floor honesty.
  await expect(page.getByTestId("player-sheet-no-history")).toContainText(
    "history builds as weekends settle",
  );
  await expect(page.getByTestId("player-sheet-ownership")).toHaveCount(0);
  await page.waitForTimeout(450);
  await page.screenshot({ path: "e2e/artifacts/fws-sheet-drommel-380.png" });
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();

  // ── S2: a flagged player, through the one out-of-position affordance ──
  await page.getByTestId("picker-league-chip").click();
  await expect(page.getByTestId("picker-filter-sheet")).toBeVisible();
  await page.getByTestId("picker-all-positions").click();
  await page.getByRole("button", { name: "Show all" }).click();
  await page.getByPlaceholder("Search name or club…").fill("Kownacki");
  const flaggedRow = page.getByTestId("picker-row-body").first();
  await expect(flaggedRow).toContainText("Kownacki", { timeout: 30_000 });
  await flaggedRow.click();
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("player-sheet-pool")).toContainText("floor priced");
  await expect(page.getByTestId("player-sheet-no-season")).toContainText(
    "Not enough football on record",
  );
  await expect(page.getByTestId("player-sheet-last-season")).toHaveCount(0);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "e2e/artifacts/fws-sheet-flagged-380.png" });
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();

  // ── S3: the picker is unharmed — PICK still lands a player ──
  // Restore the slot's defaults first: with Show all + All positions still
  // on, the top-40 by price are fixtureless stars and carry no PICK.
  await page.getByTestId("picker-all-positions-chip").click();
  await page.getByRole("button", { name: "Show all" }).click();
  await page.getByPlaceholder("Search name or club…").fill("");
  await page.getByRole("button", { name: "Pick", exact: true }).first().click();
  const gkChip = page.getByTestId("pitch-slot-0");
  await expect(gkChip).not.toHaveAttribute("data-chip-state", "empty", { timeout: 30_000 });

  // ── S4: the manned chip's slot dialog → full stats sheet stacked ──
  await gkChip.click();
  const statsButton = page.getByTestId("slot-sheet-stats");
  await expect(statsButton).toBeVisible({ timeout: 30_000 });
  await statsButton.click();
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("player-sheet-weekend")).toBeVisible();
  await page.waitForTimeout(450);
  await page.screenshot({ path: "e2e/artifacts/fws-sheet-pitch-380.png" });
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expectNoHorizontalScroll(page, "squad screen");

  // ── S5: the crew sheet path (SquadView under playersFixed) ──
  const drafted = convexRun("fantasyIntegrationSim:draftSheetForUser", {
    username: RUN_TAG,
  }) as { roomId: string };
  expect(drafted.roomId).toBeTruthy();
  await page.goto(`/v2/weekend/sheet/${drafted.roomId}`);
  const crewChip = page.locator('[data-chip-state]:not([data-chip-state="empty"])').first();
  await expect(crewChip).toBeVisible({ timeout: 45_000 });
  await crewChip.click();
  await expect(page.getByTestId("slot-sheet-stats")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("slot-sheet-stats").click();
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(450);
  await page.screenshot({ path: "e2e/artifacts/fws-sheet-crew-380.png" });
  await page.keyboard.press("Escape");
  await expectNoHorizontalScroll(page, "crew sheet");

  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test.afterAll(() => {
  convexRun("fantasyIntegrationSim:purgeUiRun", {});
});
