/**
 * FR-1B-R — the Daily-family claim prompt, rendered.
 *
 * The string this replaces ("…on leaderboards, in duels and arenas") was
 * refuted by blind verification O-FR1B: the Daily has no board of its own, so
 * any board word in its prompt is a promise the product cannot keep. Source
 * greps prove the strings; only a render proves the DAILY path actually
 * selects the no-board variant rather than falling through to the Blitz one.
 *
 * Run with the flag on, against DEV:
 *   VITE_ANONYMOUS_FIRST_ENABLED=true VITE_V2_SHELL_ENABLED=true \
 *     npx playwright test e2e/claimCopy.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";

const SHOTS = "e2e/artifacts/fr1b";

/** Pre-existing first-run modal; a real <dialog>, so it hides the a11y tree. */
async function dismissLanguagePrompt(page: Page) {
  const close = page.getByRole("button", { name: "Close" });
  if (await close.count()) await close.first().click().catch(() => {});
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Every word the Daily prompt is forbidden from using, in any locale. */
const BOARD_WORDS =
  /board|leaderboard|duel|arena|tabla|clasific|classement|duelo|arène/i;

async function assertNoBoardPromise(page: Page, label: string) {
  const card = page
    .locator("div")
    .filter({ hasText: /claim my name/i })
    .last();
  const copy = await card.innerText();
  // Scope to the prompt card: the surrounding result screen legitimately
  // contains other words, and asserting on the whole body would be noise.
  const promptCopy = copy
    .split(/\n/)
    .filter((l) => l.trim() && !/^(username|3–24)/i.test(l.trim()))
    .join(" | ");
  console.log(`${label} PROMPT COPY = ${promptCopy}`);
  expect(promptCopy, `${label} prompt must not name a board`).not.toMatch(
    BOARD_WORDS,
  );
  expect(promptCopy).toContain("This run isn't saved to a name");
  expect(promptCopy).toContain(
    "Claim a name and your streak and history stick with you.",
  );
  expect(promptCopy).toContain("CLAIM MY NAME");
  expect(promptCopy).toContain("keep playing");
}

test("daily quiz: claim prompt names no board", async ({ page }) => {
  test.slow();
  await page.goto("/v2/daily?sport=football");
  await dismissLanguagePrompt(page);
  await expect(page.getByText(/Q \d+\/10/)).toBeVisible({ timeout: 45_000 });

  // Play the 10-question daily out. Answering is the only way to reach the
  // result screen the prompt lives on.
  for (let i = 0; i < 12; i++) {
    if (await page.getByText(/daily challenge complete/i).count()) break;
    if (page.url().includes("/daily-results")) break;
    const choice = page
      .locator('button:has(span:text-matches("^[ABCD]$"))')
      .first();
    if (!(await choice.count())) {
      await page.waitForTimeout(1_500);
      continue;
    }
    await choice.click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(2_200);
  }

  await expect(page).toHaveURL(/\/daily-results/, { timeout: 60_000 });
  await expect(page.getByText(/claim my name/i)).toBeVisible({
    timeout: 30_000,
  });
  await assertNoBoardPromise(page, "DAILY-QUIZ");
  await page.screenshot({
    path: `${SHOTS}/r1-daily-quiz-prompt.png`,
    fullPage: true,
  });
});

test("daily survival: claim prompt names no board", async ({ page }) => {
  test.slow();
  await page.goto("/v2/daily-survival");
  await dismissLanguagePrompt(page);

  await expect(page.getByPlaceholder("Type player name...")).toBeVisible({
    timeout: 45_000,
  });

  // Cash out to bank the run and reach the result screen. A banked run is a
  // completed daily attempt — exactly the state the prompt is written for —
  // and it gets there without depending on knowing any answers.
  await page.getByRole("button", { name: /cash out/i }).click();
  for (let i = 0; i < 20 && !page.url().includes("/daily-results"); i++) {
    // Some builds confirm the cash-out; accept either shape.
    const confirm = page.getByRole("button", { name: /cash out|confirm|yes/i });
    if (await confirm.count()) await confirm.last().click().catch(() => {});
    await page.waitForTimeout(1_500);
  }

  await expect(page).toHaveURL(/\/daily-results/, { timeout: 60_000 });
  await expect(page.getByText(/claim my name/i)).toBeVisible({
    timeout: 30_000,
  });
  await assertNoBoardPromise(page, "DAILY-SURVIVAL");
  await page.screenshot({
    path: `${SHOTS}/r2-daily-survival-prompt.png`,
    fullPage: true,
  });
});
