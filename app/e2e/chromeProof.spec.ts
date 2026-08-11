/**
 * FW-POLISH-2 R3/R4 — before/after chrome proofs (temporary, run on demand):
 * the shared bottom nav + non-WEEKEND zero-diff evidence at 380px.
 * `PROOF=before|after` names the artifacts.
 */
import { test, type Page } from "@playwright/test";

const TAG = process.env.PROOF ?? "before";

test.use({ viewport: { width: 380, height: 844 } });

async function shoot(page: Page, path: string, name: string) {
  await page.goto(path);
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: `e2e/artifacts/${name}-380-${TAG}.png`,
    fullPage: false,
  });
}

test("chrome proof shots", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });
  await shoot(page, "/v2", "chrome-home");
  await shoot(page, "/compete", "chrome-compete");
  await shoot(page, "/v2/quiz", "chrome-quiz");
  await shoot(page, "/v2/weekend", "chrome-weekend-hub");
});
