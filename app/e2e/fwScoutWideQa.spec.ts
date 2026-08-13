/**
 * FW-SCOUT — the player detail sheet on the wide (≥1280px) build layout.
 *
 * At 1366×900 against DEV: the persistent market panel's row body opens the
 * sheet over the side-by-side layout (browse mode — no Pick buttons, facts
 * only), the seeded per-90 block renders, and dismissing leaves the panel
 * browsing. Hygiene: console-error-free, no horizontal page scroll,
 * screenshot committed, purgeUiRun owns everything simloop_*.
 */

import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const RUN_TAG = `simloop_uifwsw${Date.now() % 100_000}`;

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

test("FW-SCOUT wide: sheet from the persistent market panel", async ({ page }) => {
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

  // The wide layout: pitch + persistent market panel side by side.
  const panel = page.getByTestId("market-panel");
  await expect(panel).toBeVisible({ timeout: 45_000 });

  // Browse mode is facts-only: no Pick buttons — the row body still opens
  // the sheet (informed browsing IS the idle panel's job).
  await panel.getByPlaceholder("Search name or club…").fill("Drommel");
  const row = panel.getByTestId("picker-row-body").first();
  await expect(row).toContainText("J. Drommel", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Pick", exact: true })).toHaveCount(0);
  await row.click();

  const sheet = page.getByTestId("player-sheet");
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(sheet).toContainText("Keeper · Twente");
  await expect(page.getByTestId("player-sheet-last-season")).toContainText("4.09");
  await page.waitForTimeout(450);
  await page.screenshot({ path: "e2e/artifacts/fws-sheet-wide.png" });
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(panel).toBeVisible();
  await expectNoHorizontalScroll(page, "wide build screen");

  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test.afterAll(() => {
  convexRun("fantasyIntegrationSim:purgeUiRun", {});
});
