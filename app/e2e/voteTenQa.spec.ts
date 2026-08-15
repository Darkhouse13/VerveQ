/**
 * EYE-TEST-TEN — the vote session's new surfaces at 380px.
 *
 * Runs against the DEV-only harness (/v2/weekend/vote-harness?view=…): no
 * auth, no Convex, no dependency on DEV having finished fixtures inside a live
 * voting window. What is asserted is what the ticket bought:
 *
 *   picker  — the question, a selectable fixture grid, ONE continue, and the
 *             zero-selection state offered as an answer rather than an error
 *   stack   — per-card "didn't see him" on a pair spanning two fixtures and NO
 *             combined button; the combined one only when they share a game;
 *             "N of 10" and never "/ 300"
 *   reveal  — the post-vote line, a percentage only above the sample floor
 *   done    — the checkmark card and the quiet uncounted "keep going"
 *
 * Fit rule, everywhere: no scroll in either axis, console error-free,
 * screenshots committed to e2e/artifacts/.
 */
import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 380, height: 844 } });

const VIEWPORT = { width: 380, height: 844 };

async function openHarness(page: Page, view: string): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });
  await page.goto(`/v2/weekend/vote-harness?view=${view}`);
  return consoleErrors;
}

async function expectFullyInViewport(
  page: Page,
  locator: ReturnType<Page["locator"]>,
  label: string,
) {
  const box = await locator.boundingBox();
  expect(box, `${label} must render`).not.toBeNull();
  expect(box!.y, `${label} must start inside the viewport`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${label} must end inside the viewport`).toBeLessThanOrEqual(
    VIEWPORT.height,
  );
  expect(box!.x, `${label} must not start left of the viewport`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${label} must not overflow right`).toBeLessThanOrEqual(
    VIEWPORT.width,
  );
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(1);
}

test("picker: the question, the grid, one continue — and zero selections is an answer", async ({
  page,
}) => {
  const consoleErrors = await openHarness(page, "picker");

  await expect(page.getByText("Which games did you catch this weekend?")).toBeVisible({
    timeout: 45_000,
  });
  await expect(
    page.getByText("We'll only ask about players you actually saw."),
  ).toBeVisible();

  const fixtures = page.getByTestId("picker-fixture");
  await expect(fixtures).toHaveCount(3);
  // The harness starts with the first game picked.
  await expect(fixtures.nth(0)).toHaveAttribute("data-selected", "1");
  await expect(fixtures.nth(1)).toHaveAttribute("data-selected", "0");
  await expect(fixtures.nth(0)).toHaveAttribute("aria-pressed", "true");

  // Multi-select: a second game joins the first, neither replaces it.
  await fixtures.nth(1).click();
  await expect(fixtures.nth(0)).toHaveAttribute("data-selected", "1");
  await expect(fixtures.nth(1)).toHaveAttribute("data-selected", "1");

  // ONE continue, always enabled.
  const cont = page.getByTestId("picker-continue");
  await expect(cont).toHaveCount(1);
  await expect(cont).toBeEnabled();
  await expect(cont).toHaveText(/continue/i);

  // A game already retired by a didn't-see is shown as answered-for and is
  // NOT a control: tapping it must neither select it nor pretend to.
  const retired = fixtures.nth(2);
  await expect(retired).toHaveAttribute("data-retired", "1");
  await expect(retired).toContainText("you didn't see this one");
  await retired.click();
  await expect(retired).toHaveAttribute("data-selected", "0");

  await expectFullyInViewport(page, cont, "CONTINUE");
  await expectNoHorizontalScroll(page);
  // Shot in the state a voter actually sits in: two picked, one retired.
  await page.screenshot({ path: "e2e/artifacts/vote-picker-380.png", fullPage: false });

  // Zero selections is an ANSWER — the button says so, it is not disabled and
  // it is not an error.
  await fixtures.nth(0).click();
  await fixtures.nth(1).click();
  await expect(cont).toBeEnabled();
  await expect(cont).toHaveText(/didn't watch any/i);
  await page.screenshot({ path: "e2e/artifacts/vote-picker-none-380.png", fullPage: false });

  expect(consoleErrors, "console must stay error-free").toEqual([]);
});

test("stack: per-card didn't-see across two fixtures, N of 10, no /300", async ({ page }) => {
  const consoleErrors = await openHarness(page, "stack");
  await expect(page.getByText("Who had the better game?")).toBeVisible({ timeout: 45_000 });

  // The pair spans two fixtures: one affordance per card, and NOTHING that
  // would retire a game the voter never spoke about.
  await expect(page.getByTestId("didnt-see-a")).toBeVisible();
  await expect(page.getByTestId("didnt-see-b")).toBeVisible();
  await expect(page.getByTestId("didnt-see-both")).toHaveCount(0);

  // Today's Ten replaced the treadmill everywhere on this screen.
  await expect(page.getByTestId("vote-progress")).toHaveText("3 of 10");
  await expect(page.getByText(/\/\s*300/)).toHaveCount(0);
  await expect(page.getByText(/pairs this weekend/i)).toHaveCount(0);

  // The whole session control surface still fits, unscrolled.
  const cards = page.locator("button", { has: page.getByTestId("vote-card-match") });
  await expect(cards).toHaveCount(2);
  await expectFullyInViewport(page, cards.nth(0), "card A");
  await expectFullyInViewport(page, cards.nth(1), "card B");
  await expectFullyInViewport(page, page.getByTestId("didnt-see-a"), "didn't see A");
  await expectFullyInViewport(page, page.getByTestId("vote-progress"), "progress");

  const scrolled = await page.evaluate(
    () => (document.scrollingElement ?? document.documentElement).scrollTop,
  );
  expect(scrolled, "nothing was scrolled to satisfy the checks").toBe(0);
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: "e2e/artifacts/vote-stack-ten-380.png", fullPage: false });
  expect(consoleErrors, "console must stay error-free").toEqual([]);
});

test("stack: the combined button appears only when both cards share a fixture", async ({
  page,
}) => {
  const consoleErrors = await openHarness(page, "same");
  await expect(page.getByText("Who had the better game?")).toBeVisible({ timeout: 45_000 });

  await expect(page.getByTestId("didnt-see-a")).toBeVisible();
  await expect(page.getByTestId("didnt-see-b")).toBeVisible();
  const both = page.getByTestId("didnt-see-both");
  await expect(both).toBeVisible();
  await expect(both).toHaveText(/didn't see this game/i);

  await expectFullyInViewport(page, both, "combined didn't-see");
  await expectNoHorizontalScroll(page);
  await page.screenshot({
    path: "e2e/artifacts/vote-stack-same-fixture-380.png",
    fullPage: false,
  });
  expect(consoleErrors, "console must stay error-free").toEqual([]);
});

test("reveal: the voter's own share, majority and minority", async ({ page }) => {
  const consoleErrors = await openHarness(page, "reveal");
  const line = page.getByTestId("vote-reveal-line");
  await expect(line).toHaveText("68% went with you", { timeout: 45_000 });
  await expect(page.getByTestId("vote-reveal")).toHaveAttribute("data-tone", "with");
  await expect(page.getByTestId("vote-reveal-bar")).toBeVisible();
  await expectFullyInViewport(page, page.getByTestId("vote-reveal"), "reveal");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: "e2e/artifacts/vote-reveal-380.png", fullPage: false });

  await page.goto("/v2/weekend/vote-harness?view=reveal-minority");
  await expect(page.getByTestId("vote-reveal-line")).toHaveText("You're with the 32%");
  await expect(page.getByTestId("vote-reveal")).toHaveAttribute("data-tone", "against");

  expect(consoleErrors, "console must stay error-free").toEqual([]);
});

test("reveal: below the sample floor there is no percentage at all", async ({ page }) => {
  const consoleErrors = await openHarness(page, "reveal-first");
  await expect(page.getByTestId("vote-reveal-line")).toHaveText(
    "You're one of the first on this one.",
    { timeout: 45_000 },
  );
  // No fake precision, and no bar to draw a share that does not exist.
  await expect(page.getByText(/%/)).toHaveCount(0);
  await expect(page.getByTestId("vote-reveal-bar")).toHaveCount(0);
  await page.screenshot({ path: "e2e/artifacts/vote-reveal-first-380.png", fullPage: false });
  expect(consoleErrors, "console must stay error-free").toEqual([]);
});

test("done: today's ten closes, and keeping on is framed as uncounted", async ({ page }) => {
  const consoleErrors = await openHarness(page, "done");
  await expect(page.getByText("That's today's ten.")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("The crowd thanks you.")).toBeVisible();

  const keepGoing = page.getByTestId("vote-keep-going");
  await expect(keepGoing).toBeVisible();
  await expect(keepGoing).toContainText(/don't count/i);

  await expectFullyInViewport(page, page.getByTestId("vote-done"), "done card");
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: "e2e/artifacts/vote-done-380.png", fullPage: false });
  expect(consoleErrors, "console must stay error-free").toEqual([]);
});
