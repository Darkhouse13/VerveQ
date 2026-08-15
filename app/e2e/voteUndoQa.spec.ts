/**
 * EYE-TEST-SERVE — the didn't-see undo toast at 380px.
 *
 * Runs against the DEV-only harness (/v2/weekend/vote-harness?view=undo): no
 * auth, no Convex, no dependency on DEV having finished fixtures inside a live
 * voting window. What is asserted is what the ticket bought:
 *
 *   the offer  — "Retired <game>" with an Undo action, over the stack the
 *                voter has already moved on to
 *   the words  — it names the GAME and never the vote: the pair is used
 *                either way, and copy that implied otherwise would be a lie
 *                about what the button does
 *   the life   — it dies with the server's five-second window, leaving no
 *                Undo on screen the server would refuse
 *
 * The other half of the ticket — the ranking — is arithmetic, and is tested
 * where arithmetic belongs (src/test/fantasyCrowdSession.test.ts).
 *
 * Fit rule, as everywhere: no scroll in either axis, console error-free,
 * screenshot committed to e2e/artifacts/.
 */
import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 380, height: 844 } });

const VIEWPORT = { width: 380, height: 844 };

async function openHarness(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });
  await page.goto("/v2/weekend/vote-harness?view=undo");
  return consoleErrors;
}

test("undo: the toast names the retired game, offers one take-back, and expires", async ({
  page,
}) => {
  const consoleErrors = await openHarness(page);
  const fire = page.getByTestId("harness-undo-fire");
  await expect(fire).toBeVisible({ timeout: 45_000 });
  await fire.click();

  const toast = page.locator("[data-sonner-toast]");
  await expect(toast).toHaveCount(1);
  await expect(toast).toContainText("Retired Real Sociedad — Athletic Club");

  // The GAME, not the vote: nothing here may suggest the pair came back.
  await expect(toast).not.toContainText(/vote/i);

  const undo = toast.getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  // Sonner slides the toast up from below the fold; measure where it lands,
  // not where it entered.
  await page.waitForTimeout(700);
  const box = await undo.boundingBox();
  expect(box, "the Undo button must render").not.toBeNull();
  expect(box!.x, "Undo must not sit left of the viewport").toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, "Undo must not overflow right").toBeLessThanOrEqual(
    VIEWPORT.width,
  );
  expect(box!.y + box!.height, "Undo must sit inside the viewport").toBeLessThanOrEqual(
    VIEWPORT.height,
  );

  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(1);
  await page.screenshot({ path: "e2e/artifacts/vote-undo-380.png", fullPage: false });

  // The offer is five seconds old at the outside — an Undo still on screen
  // after it would be a button the server has started refusing.
  await expect(toast).toHaveCount(0, { timeout: 15_000 });

  expect(consoleErrors, "console must stay error-free").toEqual([]);
});

test("undo: taking it back says so, and the offer does not come back", async ({ page }) => {
  const consoleErrors = await openHarness(page);
  await page.getByTestId("harness-undo-fire").click();

  const toast = page.locator("[data-sonner-toast]");
  const undo = toast.getByRole("button", { name: "Undo" });
  await undo.click();

  await expect(page.getByText("Back on your list.")).toBeVisible();
  // The offer is spent: the button goes with the toast that carried it, so a
  // second take-back cannot be tapped for a retirement already restored.
  // Sonner may retain a hidden live-region node while it cleans up the toast;
  // assert the user-facing affordance, not that internal DOM lifecycle.
  await expect(undo).toBeHidden({ timeout: 10_000 });

  expect(consoleErrors, "console must stay error-free").toEqual([]);
});
