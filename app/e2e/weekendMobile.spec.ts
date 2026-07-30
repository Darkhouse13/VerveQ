/**
 * THE WEEKEND on a phone (FW-LAUNCH O5, H1): both squad views, driven on a
 * 390×844 viewport against the DEV backend, through the REAL flows — guest
 * onboarding, budget build with the real GW market, and the crew sheet of a
 * server-drafted room. Every screen is asserted to fit the viewport (no
 * horizontal scroll — mission rule 7's mobile-first discipline).
 *
 * DEV writes are owned: the browser user carries the simloop_ prefix and
 * the suite's last step purges everything through the sim's own purge. One
 * test, one session — the guest identity lives in the browser context.
 */
import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const RUN_TAG = `simloop_ui${Date.now() % 1_000_000}`;

function convexRun(fn: string, args: Record<string, unknown> = {}): unknown {
  const out = execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], {
    cwd: process.cwd(),
    encoding: "utf8",
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

test("THE WEEKEND on a phone: budget build + crew sheet", async ({ page }) => {
  // Pre-choose the language so the first-run prompt's overlay never sits
  // between the test and the account chooser.
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });

  // ── guest onboarding, straight at the budget screen ──
  await page.goto("/v2/weekend/squad");
  await page.getByText("Play as a guest").click();
  await page.getByRole("textbox").first().fill(RUN_TAG);
  await page.getByRole("button", { name: "Start playing" }).click();

  // ── budget: the formation picker on the real open gameweek ──
  await expect(page.getByText("Building for")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("XI: 11 of 11")).toBeVisible();
  await expectNoHorizontalScroll(page, "create view");
  await page.getByText("Start building").click();

  // ── the squad view: budget bar and the empty 13 ──
  await expect(page.getByText("/ 91.0")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Starting XI")).toBeVisible();
  await expect(page.getByText("91.0 left")).toBeVisible();
  await expectNoHorizontalScroll(page, "squad view");

  // ── the market: open a slot, pick the priciest player, money moves ──
  await page.getByLabel("Add").first().click();
  await expect(page.getByText(/Pick for the/)).toBeVisible();
  const firstPick = page.getByRole("button", { name: "Pick", exact: true }).first();
  await expect(firstPick).toBeVisible({ timeout: 45_000 });
  await firstPick.click();
  // The server accepted the pick: the remaining budget is no longer 91.0.
  await expect(page.getByText("91.0 left")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByText(/\d+\.\d left/)).toBeVisible();
  await page.screenshot({ path: "e2e/artifacts/budget-squad-mobile.png", fullPage: true });

  // ── crew: draft a real room for this same user, server-side ──
  const drafted = convexRun("fantasyIntegrationSim:draftSheetForUser", {
    username: RUN_TAG,
  }) as { roomId: string };
  expect(drafted.roomId).toBeTruthy();

  // ── the sheet: 13 drafted players, swap-only affordances, settled fit ──
  await page.goto(`/v2/weekend/sheet/${drafted.roomId}`);
  await expect(page.getByText("the 13 are the 13 — arrange, don't re-man")).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText("Starting XI")).toBeVisible();
  await expect(page.getByText("Finishers")).toBeVisible();
  // Players are fixed: Move exists, Add/Clear must not.
  expect(await page.getByLabel("Move").count()).toBeGreaterThan(0);
  expect(await page.getByLabel("Add").count()).toBe(0);
  expect(await page.getByLabel("Clear").count()).toBe(0);

  // A real swap through the atomic setFormation: arm slot 1, tap slot 2.
  await page.getByLabel("Move").nth(0).click();
  await expect(page.getByText(/Tap another slot to swap/)).toBeVisible();
  await page.getByLabel("Move").nth(1).click();
  await expect(page.getByText(/Tap another slot to swap/)).toHaveCount(0, {
    timeout: 30_000,
  });

  await page.screenshot({ path: "e2e/artifacts/crew-sheet-mobile.png", fullPage: true });
  await expectNoHorizontalScroll(page, "crew sheet");
});

test.afterAll(() => {
  convexRun("fantasyIntegrationSim:purgeUiRun", {});
});
