/**
 * EYE-TEST-CONTEXT — the vote card's memory at 380px.
 *
 * Runs against the DEV-only harness (/v2/weekend/vote-harness): a fabricated
 * served pair, no auth, no dependency on DEV having finished fixtures inside
 * a live voting window. Asserts the ticket's fit rule — two FULL cards and
 * the DIDN'T WATCH button visible with NO scroll in either axis — plus every
 * new card fact (club · opponent · venue, league · day, oriented score with
 * the player's side marked, minutes, factual event glyphs), console-error-
 * free, screenshot committed to e2e/artifacts/.
 */
import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 380, height: 844 } });

/** Same formula as src/lib/weekendVoteCard.kickoffDayTag, evaluated in this
 *  process — node and the browser share the machine's timezone, so the
 *  expected tag is computed, not hard-coded (a late kickoff shifts days). */
function expectedDayTag(kickoffAt: number): string {
  return new Date(kickoffAt).toLocaleDateString("en", { weekday: "short" }).toUpperCase();
}

const SATURDAY_KICKOFF = Date.UTC(2026, 7, 15, 16, 30);
const SUNDAY_KICKOFF = Date.UTC(2026, 7, 16, 19, 0);

async function expectFullyInViewport(page: Page, locator: ReturnType<Page["locator"]>, label: string) {
  const box = await locator.boundingBox();
  expect(box, `${label} must render`).not.toBeNull();
  expect(box!.y, `${label} must start inside the viewport`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${label} must end inside the viewport`).toBeLessThanOrEqual(844);
  expect(box!.x, `${label} must not start left of the viewport`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${label} must not overflow right`).toBeLessThanOrEqual(380);
}

test("EYE-TEST-CONTEXT: two full context cards + DIDN'T WATCH fit 380px without scroll", async ({
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

  await page.goto("/v2/weekend/vote-harness");
  await expect(page.getByText("Who had the better game?")).toBeVisible({ timeout: 45_000 });

  // ── the memory, card by card ──
  const matchLines = page.getByTestId("vote-card-match");
  await expect(matchLines).toHaveCount(2);
  await expect(matchLines.nth(0)).toHaveText("Real Sociedad · vs Athletic Club (H)");
  await expect(matchLines.nth(1)).toHaveText("Borussia Mönchengladbach · vs Bayern München (A)");
  // toHaveText reads the DOM, which a CSS line-clamp leaves intact — assert
  // the lines are also VISUALLY whole, so the venue letter can't be cut off.
  for (const i of [0, 1]) {
    const clipped = await matchLines
      .nth(i)
      .evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(clipped, `match line ${i} must not be visually truncated`).toBeLessThanOrEqual(1);
  }

  const leagueLines = page.getByTestId("vote-card-league");
  await expect(leagueLines.nth(0)).toHaveText(`La Liga · ${expectedDayTag(SATURDAY_KICKOFF)}`);
  await expect(leagueLines.nth(1)).toHaveText(`Bundesliga · ${expectedDayTag(SUNDAY_KICKOFF)}`);

  // Score oriented to the player's side: 3–1 home winner reads 3 first; the
  // 4–0 away loser reads 0 first. The marked span is the player's number.
  const scoresUs = page.getByTestId("vote-card-score-us");
  await expect(scoresUs.nth(0)).toHaveText("3");
  await expect(scoresUs.nth(1)).toHaveText("0");
  await expect(page.getByTestId("vote-card-score").nth(0)).toHaveText("3–1");
  await expect(page.getByTestId("vote-card-score").nth(1)).toHaveText("0–4");

  const minutes = page.getByTestId("vote-card-minutes");
  await expect(minutes.nth(0)).toHaveText("90'");
  await expect(minutes.nth(1)).toHaveText("78'");

  // Factual events only: brace goals ×2 + assist on one card, red on the other.
  const events = page.getByTestId("vote-card-events");
  await expect(events.nth(0)).toContainText("⚽×2");
  await expect(events.nth(0)).toContainText("🅰️");
  await expect(events.nth(1)).toHaveText("🟥");

  // ── the fit rule: everything visible, nothing scrolls ──
  const cards = page.locator("button", { has: page.getByTestId("vote-card-match") });
  await expect(cards).toHaveCount(2);
  await expectFullyInViewport(page, cards.nth(0), "card A");
  await expectFullyInViewport(page, cards.nth(1), "card B");
  const didntWatch = page.getByRole("button", { name: /didn't watch/i });
  await expect(didntWatch).toBeVisible();
  await expectFullyInViewport(page, didntWatch, "DIDN'T WATCH");

  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { x: el.scrollWidth - el.clientWidth, top: el.scrollTop };
  });
  expect(overflow.x, "no horizontal scroll").toBeLessThanOrEqual(1);
  expect(overflow.top, "nothing was scrolled to satisfy the checks").toBe(0);

  await page.screenshot({ path: "e2e/artifacts/vote-card-context-380.png", fullPage: false });

  expect(consoleErrors, "console must stay error-free").toEqual([]);
});
