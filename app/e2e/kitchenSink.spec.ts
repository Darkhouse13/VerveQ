/**
 * VerveQ ONE P1.8 — the design system's visual regression baseline.
 *
 * Screenshots the DEV-only kitchen sink (/dev/kitchen-sink: every primitive
 * in src/components/ui, side by side in :root and each .theme-*) at a phone
 * (390) and a desktop (1280) width, plus one open Dialog / Sheet / toast in
 * the ink palette. The page needs no backend: nothing on it reads Convex.
 *
 *   npx playwright test e2e/kitchenSink.spec.ts                       # compare
 *   npx playwright test e2e/kitchenSink.spec.ts --update-snapshots    # accept
 *
 * A primitive or token change shows up here as a diff; accept it with
 * --update-snapshots once the new look is the intended one.
 */
import { test, expect, type Page } from "@playwright/test";

const WIDTHS = [
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "1280", width: 1280, height: 800, mobile: false },
] as const;

async function openSink(page: Page) {
  // Stable frames: no motion, no blinking caret, fonts in.
  await page.emulateMedia({ reducedMotion: "reduce" });
  // The one-time language chooser would cover the page on a fresh profile.
  await page.addInitScript(() => localStorage.setItem("verveq_lang_chosen", "1"));
  await page.goto("/dev/kitchen-sink");
  await expect(page.getByTestId("kitchen-sink")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*{caret-color:transparent !important}" });
}

for (const vp of WIDTHS) {
  test.describe(`kitchen sink @ ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      locale: "en-US",
    });

    test("every primitive in every palette", async ({ page }) => {
      await openSink(page);
      await expect(page).toHaveScreenshot(`kitchen-sink-${vp.name}.png`, {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.002,
      });
    });

    test("overlays carry the ink palette", async ({ page }) => {
      await openSink(page);
      const ink = page.getByTestId("sink-ink");
      test.skip((await ink.count()) === 0, "no .theme-ink palette");

      await page.getByTestId("sink-ink-dialog").click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(page).toHaveScreenshot(`kitchen-sink-${vp.name}-dialog.png`, { animations: "disabled" });
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();

      await page.getByTestId("sink-ink-sheet").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page).toHaveScreenshot(`kitchen-sink-${vp.name}-sheet.png`, { animations: "disabled" });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();

      await page.getByTestId("sink-ink-toast").click();
      const toast = page.locator("[data-sonner-toast]").first();
      await expect(toast).toBeVisible();
      await expect(toast).toHaveScreenshot(`kitchen-sink-${vp.name}-toast.png`, { animations: "disabled" });
    });
  });
}
