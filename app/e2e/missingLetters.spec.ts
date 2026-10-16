/**
 * MISSING LETTERS — the daily, the end game (streak, reminder, challenge) and
 * endless, end to end against the DEV Convex deployment. Not part of
 * `npm run check` (same rule as the other e2e specs): run on demand with the
 * shell + anonymous-first flags:
 *
 *   VITE_ANONYMOUS_FIRST_ENABLED=true VITE_V2_SHELL_ENABLED=true \
 *     npx playwright test e2e/missingLetters.spec.ts
 *
 * Three cold visitors, each a fresh context (= a fresh anonymous account):
 *   A gives up round one and guesses the rest blind (mostly wrong) → sees the
 *     streak, shares a CHALLENGE, signs up for the reminder (pending);
 *   B opens A's challenge link and — knowing the names from A's result card —
 *     types every blank right on a physical keyboard: 10/10, head-to-head won,
 *     A's card lists B; then B plays ENDLESS until a miss;
 *   C opens the CONFIRMATION link in another browser → reminders on.
 * Then the hourly sender's due-list is read for TOMORROW morning (a Missing
 * Letters row, streak 1, one friend) and the one-click unsubscribe names the
 * game. The address is Resend's test sink: no real inbox gets mail.
 */
import { test, expect, type Browser, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = "e2e/artifacts/missing-letters";
const DEV_SITE = "https://admired-warthog-495.eu-west-1.convex.site";

function convex(args: string[]): string {
  return execFileSync("npx", ["convex", ...args], { cwd: APP_DIR, encoding: "utf8" });
}

/** A fresh visitor whose `navigator.share` records what it was handed. */
async function visitor(browser: Browser, viewport = { width: 390, height: 844 }, userAgent?: string): Promise<Page> {
  const context = await browser.newContext({ timezoneId: "Europe/London", viewport, ...(userAgent ? { userAgent } : {}) });
  await context.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
    localStorage.setItem("i18nextLng", "en");
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as unknown as { __shared: ShareData }).__shared = data;
      },
    });
  });
  return context.newPage();
}

const board = (page: Page) => page.getByTestId("missing-letters-board");
const check = (page: Page) => page.getByTestId("missing-letters-check");

/** Wait for a pending board (keyboard visible) or the end of the run. */
async function nextBoard(page: Page): Promise<boolean> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await page.getByTestId("missing-letters-keyboard").isVisible().catch(() => false)) return true;
    if (await page.getByText(/Run over|Missing Letters #\d+/).first().isVisible().catch(() => false)) {
      if (!(await board(page).isVisible().catch(() => false))) return false;
    }
    // A reveal is on screen: tap through it.
    if (await page.getByTestId("missing-letters-answer").isVisible().catch(() => false)) {
      await page.waitForTimeout(600);
      await board(page).click({ timeout: 1_000 }).catch(() => {});
    }
    await page.waitForTimeout(250);
  }
  throw new Error("no board and no result");
}

/** Fill every blank with the on-screen A key, then Check. */
async function guessBlind(page: Page) {
  const blanks = await page.getByTestId("missing-letters-blank").count();
  expect(await check(page).isDisabled()).toBe(true);
  for (let i = 0; i < blanks; i++) await page.getByTestId("missing-letters-key-A").click();
  await expect(check(page)).toBeEnabled();
  await check(page).click();
  await expect(page.getByTestId("missing-letters-answer")).toBeVisible({ timeout: 10_000 });
}

/** The letters each blank needs, given the full name: tiles render in name order, spaces dropped. */
async function blanksFor(page: Page, name: string): Promise<string> {
  const letters = [...name.toUpperCase()].filter((c) => c !== " ");
  const kinds = await board(page).evaluate((el) =>
    [...el.querySelectorAll(":scope > div > *")].map((t) => t.getAttribute("data-testid") === "missing-letters-blank"),
  );
  expect(kinds.length, `board for ${name}`).toBe(letters.length);
  return kinds.flatMap((blank, i) => (blank ? [letters[i]] : [])).join("");
}

test("daily, challenge, reminder and endless", async ({ browser }) => {
  test.setTimeout(240_000);
  const runId = Date.now().toString(36);
  const email = `delivered+ml${runId}@resend.dev`;

  // ── A: the daily — gives up round one, guesses the rest blind ──
  const a = await visitor(browser);
  await a.goto("/letters?utm_source=ig&utm_medium=reel");
  await expect(a).toHaveURL(/\/v2\/missing-letters\?/);
  await expect(board(a)).toBeVisible({ timeout: 30_000 });
  await expect(a.getByTestId("missing-letters-tier")).toHaveText(/easy/i);
  await expect(a.getByTestId("missing-letters-clue")).not.toBeEmpty();
  await a.screenshot({ path: `${SHOTS}/a-round1.png` });
  await a.getByTestId("missing-letters-give-up").click();
  await expect(a.getByText("Gave up")).toBeVisible({ timeout: 10_000 });
  await a.screenshot({ path: `${SHOTS}/a-reveal.png` });
  let rounds = 1;
  while (await nextBoard(a)) {
    rounds++;
    if (rounds === 10) {
      await expect(a.getByTestId("missing-letters-tier")).toHaveText(/impossible/i);
      await a.screenshot({ path: `${SHOTS}/a-impossible.png` });
    }
    await guessBlind(a);
  }
  expect(rounds).toBe(10);
  await expect(a.getByTestId("missing-letters-streak")).toContainText(/1-day streak/i, { timeout: 15_000 });
  // The email reminder starts as one line (RETURN_LOOP).
  await expect(a.getByTestId("missing-letters-reminder-expand")).toBeVisible();
  await expect(a.getByTestId("missing-letters-reminder-form")).toHaveCount(0);
  await a.screenshot({ path: `${SHOTS}/a-result.png`, fullPage: true });
  const names = (await a.getByTestId("missing-letters-answers").locator("li").allInnerTexts()).map(
    (t) => t.split("·")[0].trim(),
  );
  expect(names).toHaveLength(10);

  // ── A: challenge a friend ──
  await a.getByTestId("missing-letters-challenge-share").click();
  await expect(a.getByTestId("missing-letters-share-sheet")).toBeVisible();
  await a.screenshot({ path: `${SHOTS}/a-share-sheet.png` });
  await a.getByTestId("missing-letters-share-friend").click();
  await expect
    .poll(() => a.evaluate(() => (window as unknown as { __shared?: ShareData }).__shared?.url ?? null))
    .toMatch(/\/letters\?c=[a-z0-9]+&ref=missing_letters_challenge$/);
  const shared = await a.evaluate(() => (window as unknown as { __shared: ShareData }).__shared);
  expect(shared.text).toMatch(/^Missing Letters #\d+ · \d+\/10\n[🟩🟥]{3} [🟩🟥]{3} [🟩🟥]{3} [🟩🟥](\nBetter than \d+% of today's players)?$/u);
  // ── A: the story image (no file sharing in headless Chromium → the save sheet) ──
  await a.getByRole("button", { name: "Close" }).click();
  await a.getByTestId("missing-letters-challenge-share").click();
  await a.getByTestId("missing-letters-share-story").click();
  await expect(a.getByTestId("missing-letters-story-image")).toBeVisible();
  await a.screenshot({ path: `${SHOTS}/a-story-sheet.png` });
  await a.getByRole("button", { name: "Close" }).click();
  const challengePath = new URL(shared.url!).pathname + new URL(shared.url!).search;

  // ── A: reminder sign-up (pending until confirmed) ──
  await a.getByTestId("missing-letters-reminder-expand").click();
  await a.getByPlaceholder("you@email.com").fill(email);
  await a.getByRole("button", { name: "Remind me" }).click();
  await expect(a.getByTestId("missing-letters-reminder-pending")).toContainText("@resend.dev");

  // ── B: the challenge link, every blank right, on a real keyboard ──
  const b = await visitor(browser, { width: 1280, height: 800 });
  await b.goto(challengePath);
  await expect(b.getByTestId("missing-letters-challenge-banner")).toContainText(/scored \d+\/10 on #\d+\. Beat it\./, {
    timeout: 30_000,
  });
  for (let i = 0; i < 10; i++) {
    expect(await nextBoard(b)).toBe(true);
    const letters = await blanksFor(b, names[i]);
    await b.keyboard.type(letters.toLowerCase());
    if (i === 0) await b.screenshot({ path: `${SHOTS}/b-typed.png` });
    await b.keyboard.press("Enter");
    await expect(b.getByText("Correct")).toBeVisible({ timeout: 10_000 });
    await expect(b.getByTestId("missing-letters-answer")).toHaveText(names[i]);
  }
  await expect(b.getByTestId("missing-letters-head-to-head")).toContainText(/You beat/i, { timeout: 30_000 });
  await expect(b.getByText(/^10\/10$|10\s*\/10/).first()).toBeVisible();
  await b.screenshot({ path: `${SHOTS}/b-head-to-head.png`, fullPage: true });

  // A's card picks up B's answer live.
  await expect(a.getByTestId("missing-letters-challenge-results")).toContainText(/A friend 10\/10/, { timeout: 15_000 });
  await expect(a.getByTestId("missing-letters-challenge-results")).toContainText(/Beat you/i);
  await a.screenshot({ path: `${SHOTS}/a-challenge-results.png`, fullPage: true });

  // ── B: endless until the first miss ──
  await b.getByTestId("missing-letters-endless").click();
  await expect(board(b)).toBeVisible({ timeout: 15_000 });
  await expect(b.getByText(/^Endless$/).first()).toBeVisible();
  await expect(b.getByTestId("missing-letters-tier")).toHaveText(/easy/i);
  await guessBlind(b);
  // Blind A's are almost surely wrong; if not, keep going until they are.
  for (let i = 0; i < 5 && (await nextBoard(b)); i++) await guessBlind(b);
  await expect(b.getByText("Run over")).toBeVisible({ timeout: 15_000 });
  await expect(b.getByText(/^It was /)).toBeVisible();
  await b.screenshot({ path: `${SHOTS}/b-endless-over.png` });

  // ── C: the confirmation link, opened in another browser ──
  const rows = convex(["data", "whosOlderReminders", "--limit", "500", "--format", "jsonLines"])
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as { email: string; token: string; game?: string; confirmedAt?: number });
  const row = rows.find((r) => r.email === email);
  expect(row, "reminder row stored").toBeTruthy();
  expect(row!.game).toBe("letters");
  expect(row!.confirmedAt, "nothing is on before confirmation").toBeUndefined();

  const c = await visitor(browser);
  await c.goto(`/letters?rt=${row!.token}&confirm=1&utm_source=email&utm_medium=confirm`);
  await expect(c.getByText("Reminders on. See you tomorrow 🔥")).toBeVisible({ timeout: 30_000 });
  expect(c.url()).not.toContain("rt=");
  await expect(a.getByTestId("missing-letters-reminder-on")).toBeVisible({ timeout: 15_000 });

  // ── The hourly sender, as it will run tomorrow at 10:00 UTC ──
  const now = new Date();
  const tomorrow10 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 10);
  const due = JSON.parse(convex(["run", "whosOlderReminders:dueReminders", JSON.stringify({ nowMs: tomorrow10 })])) as {
    due: Array<{ email: string; game: string; streak: number; friends: number }>;
  };
  const mine = due.due.find((d) => d.email === email);
  expect(mine, "due tomorrow morning").toBeTruthy();
  expect(mine!.game).toBe("letters");
  expect(mine!.streak).toBe(1);
  expect(mine!.friends).toBe(1);
  const today = JSON.parse(convex(["run", "whosOlderReminders:dueReminders", JSON.stringify({ nowMs: Date.now() })])) as {
    due: Array<{ email: string }>;
  };
  expect(today.due.some((d) => d.email === email)).toBe(false);

  // ── One-click unsubscribe names the game ──
  const res = await fetch(`${DEV_SITE}/whos-older/unsubscribe?t=${row!.token}`);
  expect(res.status).toBe(200);
  const page = await res.text();
  expect(page).toContain("You're unsubscribed.");
  expect(page).toContain("No more Missing Letters reminders");
  expect(page).toContain("https://verveq.com/letters");
});

/** Instagram's in-app browser on an iPhone, as PostHog records it. */
const INSTAGRAM_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.25.112 (iPhone15,2; iOS 18_0; en_US; en; scale=3.00; 1179x2556)";

// RETURN_LOOP part C: a streak built inside Instagram's browser follows the
// player to their phone's own browser through a copied link.
test("streak link carries the streak to another browser", async ({ browser }) => {
  test.setTimeout(180_000);
  const startedAt = Date.now();

  // ── A: the daily, inside Instagram's in-app browser ──
  const a = await visitor(browser, undefined, INSTAGRAM_UA);
  await a.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:5173" });
  await a.goto("/letters?utm_source=ig&utm_medium=bio");
  await expect(board(a)).toBeVisible({ timeout: 30_000 });
  while (await nextBoard(a)) await guessBlind(a);
  await expect(a.getByTestId("missing-letters-streak")).toContainText(/1-day streak/i, { timeout: 15_000 });
  await expect(a.getByTestId("missing-letters-follow")).toBeVisible();
  await expect(a.getByTestId("missing-letters-streak-link")).toBeVisible();
  await a.screenshot({ path: `${SHOTS}/streak-link-offer.png`, fullPage: true });

  await a.getByTestId("missing-letters-streak-link-copy").click();
  const linkBox = a.getByTestId("missing-letters-streak-link-url");
  await expect(linkBox).toBeVisible({ timeout: 15_000 });
  const link = await linkBox.inputValue();
  expect(link).toMatch(/\/letters\?st=[a-f0-9]{64}&ref=streak_link$/);
  await a.screenshot({ path: `${SHOTS}/streak-link-copied.png` });

  // ── B: the phone's own browser opens it ──
  const b = await visitor(browser);
  const target = new URL(link);
  await b.goto(`${target.pathname}${target.search}`);
  await expect(b.getByText("Streak connected. It follows you here now.")).toBeVisible({ timeout: 30_000 });
  await expect(b).not.toHaveURL(/st=/);
  await b.screenshot({ path: `${SHOTS}/streak-link-claimed.png` });

  // The two browsers are now one streak group.
  const rows = convex(["data", "dailyStreakLinks", "--limit", "200", "--format", "jsonLines"])
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { groupId: string; userId: string; createdAt: number })
    .filter((r) => r.createdAt >= startedAt);
  const groups = new Map<string, string[]>();
  for (const r of rows) groups.set(r.groupId, [...(groups.get(r.groupId) ?? []), r.userId]);
  expect([...groups.values()].some((members) => members.length === 2)).toBe(true);

  // ── B: today's daily is already done in A — B opens on that result, not a new board ──
  await expect(b.getByTestId("missing-letters-streak")).toContainText(/1-day streak/i, { timeout: 30_000 });
  await expect(b.getByTestId("missing-letters-answers").locator("li")).toHaveCount(10);
  await expect(b.getByTestId("missing-letters-keyboard")).toHaveCount(0);
  // Not inside Instagram: no follow card, no streak-link offer.
  await expect(b.getByTestId("missing-letters-streak-link")).toHaveCount(0);
  await expect(b.getByTestId("missing-letters-follow")).toHaveCount(0);
  await b.screenshot({ path: `${SHOTS}/streak-link-b-result.png`, fullPage: true });
  // Endless stays unlocked from A's finished daily.
  await b.getByTestId("missing-letters-endless").click();
  await expect(board(b)).toBeVisible({ timeout: 15_000 });
  await expect(b.getByText(/^Endless$/).first()).toBeVisible();
});

