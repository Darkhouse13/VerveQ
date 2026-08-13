/**
 * FW-RECEIPT — the DEV settlement proof, through the REAL surfaces at 380px.
 *
 * A browser-onboarded guest gets the sim's six-pick budget squad in the
 * synthetic gameweek (SYNTH-O5-LOOP GW905), flanked by two weaker rivals and
 * five crowd voters. The spec then watches, in order, exactly what the
 * mission demands proven end-to-end:
 *
 *  1. LEDGER, mid-flight: the squad screen's Ledger tab narrates the scored
 *     fixture in match language, provisional throughout.
 *  2. REVISION, honestly: a feed correction (tackles 2→5) lands as a
 *     "revised" entry carrying the term-level diff — not a silent re-total.
 *  3. SETTLEMENT: the real settleGameweeks driver runs (crowd factors →
 *     finalize → stamp → settle → the FW-RECEIPT percentile call-site), and
 *     receiptQaSettle asserts the stamped rollup (population 3, guest beats
 *     2) server-side.
 *  4. RECEIPT, rendered: the receipt chip appears on the squad screen, the
 *     receipt screen renders the settled card — total, the 13's finals,
 *     factual best/worst, the percentile banner — and is captured as an
 *     actual screenshot at 380px (that IS the product), plus a wide capture.
 *
 * Hygiene: console-error-free, no horizontal scroll, screenshots committed,
 * everything created purged (purgeLoopData + purgeSynthetic + purgeUiRun).
 */

import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const RUN_TAG = `simloop_fwr${Date.now() % 100_000}`;
const SALT = `fwr${Date.now() % 10_000}`;

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

let gameweekId: string | null = null;

test("FW-RECEIPT: ledger through settlement into a rendered receipt", async ({ page }) => {
  test.setTimeout(360_000);
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });

  // ── guest onboarding through the crews door (the shipped flow) ──
  await page.goto("/v2/weekend");
  await expect(page.getByTestId("weekend-door-crews")).toBeVisible({ timeout: 45_000 });
  await page.getByTestId("weekend-door-crews").click();
  await page.getByText("Play as a guest").click();
  await page.getByRole("textbox").first().fill(RUN_TAG);
  await page.getByRole("button", { name: "Start playing" }).click();
  await expect(page.getByRole("button", { name: /Create crew/ })).toBeVisible({
    timeout: 45_000,
  });

  // ── the synthetic weekend assembles around the guest ──
  const setup = convexRun("fantasyIntegrationSim:receiptQaSetup", {
    guestUsername: RUN_TAG,
    salt: SALT,
  }) as { gameweekId: string };
  gameweekId = setup.gameweekId;

  // ── 1 · the ledger, mid-flight ──
  await page.goto("/v2/weekend/squad");
  await expect(page.getByTestId("squad-tabs")).toBeVisible({ timeout: 45_000 });
  await page.getByTestId("squad-tab-ledger").click();
  await expect(page.getByTestId("squad-ledger")).toBeVisible({ timeout: 45_000 });
  // Six scored slots → six scored entries, plus the squad's construction.
  await expect(page.getByTestId("ledger-entry-scored")).toHaveCount(6, { timeout: 45_000 });
  await expect(page.getByTestId("ledger-entry-squad_built")).toHaveCount(1);
  // Match language, no database words on the surface.
  const ledgerText = await page.getByTestId("squad-ledger").innerText();
  expect(ledgerText).not.toMatch(/baseScores|statHash|crowdFactor|CS_BONUS/);
  await expectNoHorizontalScroll(page, "ledger tab");
  await page.screenshot({ path: "e2e/artifacts/fwr-ledger-380.png", fullPage: true });

  // ── 2 · a revision lands as an honest diff ──
  convexRun("fantasyIntegrationSim:receiptQaRevise", {});
  const revised = page.getByTestId("ledger-entry-revised");
  await expect(revised).toHaveCount(1, { timeout: 45_000 });
  // The engine's own label, lowercased, with the honest movement and delta.
  await expect(revised).toContainText(/tackles.*2→5, \+1\.2/);
  await page.screenshot({ path: "e2e/artifacts/fwr-ledger-revised-380.png", fullPage: true });

  // ── 3 · settlement: the real driver, the real call-site ──
  const settle = convexRun("fantasyIntegrationSim:receiptQaSettle", { gameweekId }) as {
    stamps: { beatCount: number; population: number }[];
  };
  expect(settle.stamps).toHaveLength(3);
  expect(settle.stamps[0].beatCount).toBe(2);

  // ── 4 · the receipt, rendered ──
  // The settled gameweek's board is closed; the squad screen offers the way
  // back through the receipt chip (latestReceiptRef).
  await page.goto("/v2/weekend/squad");
  const chip = page.getByTestId("squad-receipt-chip");
  await expect(chip).toBeVisible({ timeout: 45_000 });
  await expect(chip).toContainText("Gameweek 905 settled");
  await page.screenshot({ path: "e2e/artifacts/fwr-receipt-chip-380.png", fullPage: false });
  await chip.click();

  const card = page.getByTestId("receipt-card");
  await expect(card).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("receipt-total")).toBeVisible();
  // The stamped standing: beat 2 of 3 → 67%.
  await expect(page.getByTestId("receipt-percentile")).toContainText(
    "Beat 67% of budget squads",
  );
  // Factual superlatives, both present (six scored slots).
  await expect(page.getByTestId("receipt-best")).toBeVisible();
  await expect(page.getByTestId("receipt-worst")).toBeVisible();
  // The 13's finals: six named rows (the empty seven carry no row).
  const slotRows = page.getByTestId("receipt-slots").locator("div.flex");
  expect(await slotRows.count()).toBe(6);
  // Share/download affordances exist (not driven — a share sheet is native UI).
  await expect(page.getByTestId("receipt-share")).toBeVisible();
  await expect(page.getByTestId("receipt-download")).toBeVisible();

  await expectNoHorizontalScroll(page, "receipt screen");
  // THE screenshot: the share card as actually captured at 380px.
  await card.screenshot({ path: "e2e/artifacts/fwr-receipt-card-380.png" });
  await page.screenshot({ path: "e2e/artifacts/fwr-receipt-screen-380.png", fullPage: true });

  // A wide look at the same receipt — the card stays a card, no stretching.
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(card).toBeVisible();
  await expectNoHorizontalScroll(page, "receipt screen (wide)");
  await page.screenshot({ path: "e2e/artifacts/fwr-receipt-wide-1366.png", fullPage: false });

  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test.afterAll(() => {
  if (gameweekId !== null) {
    convexRun("fantasyIntegrationSim:purgeLoopData", { gameweekId });
  }
  convexRun("fantasyScoringDev:purgeSynthetic", { season: "SYNTH-O5-LOOP" });
  convexRun("fantasyIntegrationSim:purgeUiRun", {});
});
