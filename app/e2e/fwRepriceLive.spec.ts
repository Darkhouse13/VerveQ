/**
 * FW-REPRICE — the live spot-check the mission requires.
 *
 * "Live spot-check on verveq.com: Porto GK picker shows the corrected spread."
 *
 * Runs against PROD by design (BASE_URL, default https://verveq.com), because
 * the claim being checked is about what a real user sees, not about what a
 * local build renders. It reads prices out of the picker itself rather than
 * out of the API — the API was already asserted by the seed's `--verify`, and
 * a price that is right in Convex and wrong on the screen is still wrong.
 *
 * The assertion is the mission's own sentence, not a hard-coded number: FC
 * Porto's most-played keeper must OUTPRICE every other Porto keeper. Before
 * this mission all four sat at the 6.0 GK ceiling.
 *
 * Guest is tagged simloop_* so purgeUiRun owns the cleanup.
 *
 *   BASE_URL=https://verveq.com npx playwright test e2e/fwRepriceLive.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "https://verveq.com";
const RUN_TAG = `simloop_rp${Date.now() % 100_000}`;

/** The keeper who actually plays, and the three who do not. */
const STARTER = "Diogo Costa";
const BACKUPS = ["Cláudio Ramos", "J. Afonso", "Andorinha"];

test.use({ viewport: { width: 380, height: 844 }, baseURL: BASE });

async function priceOf(page: Page, name: string): Promise<number> {
  const search = page.getByPlaceholder(/search/i).first();
  await search.fill("");
  await search.fill(name);
  const row = page.getByTestId("picker-row").filter({ hasText: name }).first();
  await expect(row, `${name} should appear in the picker`).toBeVisible({ timeout: 30_000 });
  // The price is the row's only tabular-nums span; the PICK button is a sibling.
  const text = await row.locator("span.tabular-nums").first().innerText();
  const value = Number.parseFloat(text.trim());
  expect(Number.isFinite(value), `could not read a price for ${name} (got "${text}")`).toBe(true);
  return value;
}

test("FC Porto's starting keeper outprices his backups, live", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });

  await page.goto("/v2/weekend/squad");

  // A first visit to prod opens the language chooser over everything; the
  // local dev harness has it dismissed already, which is why the other specs
  // do not carry this step.
  const language = page.getByRole("button", { name: "English", exact: true });
  if (await language.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await language.click();
  }

  await page.getByText("Play as a guest").click();
  await page.getByRole("textbox").first().fill(RUN_TAG);
  await page.getByRole("button", { name: "Start playing" }).click();

  // Build a squad so the picker is reachable, then open the GK slot.
  const start = page.getByRole("button", { name: /Start building/i });
  await expect(start).toBeVisible({ timeout: 45_000 });
  await start.click();

  // pitch-slot-0 is the GK slot in every shape, and opens the picker
  // pre-filtered to keepers — which is exactly the surface under test.
  await expect(page.getByTestId("pitch-slot-0")).toBeVisible({ timeout: 45_000 });
  await page.getByTestId("pitch-slot-0").click();
  await expect(page.getByTestId("picker-prompt")).toBeVisible({ timeout: 30_000 });

  const starterPrice = await priceOf(page, STARTER);
  const backupPrices: Record<string, number> = {};
  for (const name of BACKUPS) backupPrices[name] = await priceOf(page, name);

  console.log(
    `LIVE ${BASE} — ${STARTER} ${starterPrice.toFixed(1)}; ` +
      BACKUPS.map((n) => `${n} ${backupPrices[n].toFixed(1)}`).join("; "),
  );
  await page.screenshot({ path: "e2e/artifacts/fw-reprice-porto-live-380.png", fullPage: false });

  for (const name of BACKUPS) {
    expect(
      starterPrice,
      `${STARTER} (2,907') must outprice ${name} — this is the case FW-REPRICE exists for`,
    ).toBeGreaterThan(backupPrices[name]);
  }
  // And the flattening is actually gone: they are not all at the ceiling.
  expect(new Set([starterPrice, ...Object.values(backupPrices)]).size).toBeGreaterThan(1);

  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});
