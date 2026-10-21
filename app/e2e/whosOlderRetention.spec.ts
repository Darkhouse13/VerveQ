/**
 * WHO'S OLDER? retention loop — streak, email reminder, challenge — end to end
 * against the DEV Convex deployment. Not part of `npm run check` (same rule as
 * the other e2e specs): run on demand with the anonymous-first flag:
 *
 *   VITE_ANONYMOUS_FIRST_ENABLED=true \
 *     npx playwright test e2e/whosOlderRetention.spec.ts
 *
 * Three cold visitors, each a fresh context (= a fresh anonymous account):
 *   A finishes today's daily → sees the streak, shares a CHALLENGE, signs up
 *     for the reminder (pending until confirmed);
 *   B opens A's challenge link → plays under the score-to-beat banner and
 *     finishes on the head-to-head; A's card then lists B's result;
 *   C opens the CONFIRMATION link (a different browser, like the phone's own
 *     after Instagram's) → reminders switch on and C is linked to A's address.
 * Then the hourly sender's due-list is read for TOMORROW morning (A's streak
 * alive at 1, one friend took the challenge) and the one-click unsubscribe
 * empties it. The address is Resend's test sink: no real inbox gets mail.
 */
import { test, expect, type Browser, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = "e2e/artifacts/whos-older-retention";
const DEV_SITE = "https://admired-warthog-495.eu-west-1.convex.site";

function convex(args: string[]): string {
  return execFileSync("npx", ["convex", ...args], { cwd: APP_DIR, encoding: "utf8" });
}

/** A fresh visitor whose `navigator.share` records what it was handed. */
async function visitor(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ timezoneId: "Europe/London" });
  await context.addInitScript(() => {
    // An English speaker who already picked a language: the first-run
    // chooser (FirstRunLanguagePrompt) is a modal that would cover the game.
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

/** Answer (always the top card) until the result screen replaces the round. */
async function playThrough(page: Page) {
  const cardA = page.getByTestId("whos-older-card-a");
  await expect(cardA).toBeVisible({ timeout: 30_000 });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (!(await cardA.isVisible().catch(() => false))) return;
    if (await cardA.isEnabled().catch(() => false)) await cardA.click({ timeout: 2_000 }).catch(() => {});
    await page.waitForTimeout(650);
  }
  throw new Error("the daily never finished");
}

test("streak, challenge and reminder loop", async ({ browser }) => {
  const runId = Date.now().toString(36);
  const email = `delivered+wo${runId}@resend.dev`;

  // ── A: finish the daily ──
  const a = await visitor(browser);
  await a.goto("/older?utm_source=ig&utm_medium=bio");
  await playThrough(a);
  await expect(a.getByTestId("whos-older-streak")).toContainText(/1-day streak/i, { timeout: 15_000 });
  // The email reminder starts as one line (RETURN_LOOP).
  await expect(a.getByTestId("whos-older-reminder-expand")).toBeVisible();
  await expect(a.getByTestId("whos-older-reminder-form")).toHaveCount(0);
  await a.screenshot({ path: `${SHOTS}/a-result.png`, fullPage: true });

  // ── A: challenge a friend ──
  await a.getByTestId("whos-older-challenge-share").click();
  await expect(a.getByTestId("whos-older-share-sheet")).toBeVisible();
  await a.screenshot({ path: `${SHOTS}/a-share-sheet.png` });
  await a.getByTestId("whos-older-share-friend").click();
  await expect.poll(() => a.evaluate(() => (window as unknown as { __shared?: ShareData }).__shared?.url ?? null)).toMatch(
    /\/older\?c=[a-z0-9]+&ref=whos_older_challenge$/,
  );
  const shared = await a.evaluate(() => (window as unknown as { __shared: ShareData }).__shared);
  expect(shared.text).toMatch(/^Who's Older\? #\d+ · \d+\/10\n[🟩🟥]{3} [🟩🟥]{3} [🟩🟥]{3} [🟩🟥](\nBetter than \d+% of today's players)?$/u);
  // ── A: the story image (no file sharing in headless Chromium → the save sheet) ──
  await a.getByRole("button", { name: "Close" }).click();
  await a.getByTestId("whos-older-challenge-share").click();
  await a.getByTestId("whos-older-share-story").click();
  await expect(a.getByTestId("whos-older-story-image")).toBeVisible();
  await a.screenshot({ path: `${SHOTS}/a-story-sheet.png` });
  await a.getByRole("button", { name: "Close" }).click();
  const challengePath = new URL(shared.url!).pathname + new URL(shared.url!).search;

  // ── A: reminder sign-up (pending until confirmed) ──
  await a.getByTestId("whos-older-reminder-expand").click();
  await a.getByPlaceholder("you@email.com").fill(email);
  await a.getByRole("button", { name: "Remind me" }).click();
  await expect(a.getByTestId("whos-older-reminder-pending")).toContainText("@resend.dev");

  // ── B: the challenge link ──
  const b = await visitor(browser);
  await b.goto(challengePath);
  await expect(b.getByTestId("whos-older-challenge-banner")).toContainText(/scored \d+\/10 on #\d+\. Beat it\./, {
    timeout: 30_000,
  });
  await b.screenshot({ path: `${SHOTS}/b-banner.png` });
  await playThrough(b);
  await expect(b.getByTestId("whos-older-head-to-head")).toBeVisible({ timeout: 15_000 });
  await b.screenshot({ path: `${SHOTS}/b-head-to-head.png`, fullPage: true });

  // A's card picks up B's answer live.
  await expect(a.getByTestId("whos-older-challenge-results")).toContainText(/A friend \d+\/10/, { timeout: 15_000 });
  await a.screenshot({ path: `${SHOTS}/a-challenge-results.png`, fullPage: true });

  // ── C: the confirmation link, opened in another browser ──
  const rows = convex(["data", "whosOlderReminders", "--limit", "200", "--format", "jsonLines"])
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as { email: string; token: string; confirmedAt?: number; unsubscribedAt?: number });
  const row = rows.find((r) => r.email === email);
  expect(row, "reminder row stored").toBeTruthy();
  expect(row!.confirmedAt, "nothing is on before confirmation").toBeUndefined();

  const c = await visitor(browser);
  await c.goto(`/older?rt=${row!.token}&confirm=1&utm_source=email&utm_medium=confirm`);
  await expect(c.getByText("Reminders on. See you tomorrow 🔥")).toBeVisible({ timeout: 30_000 });
  expect(c.url()).not.toContain("rt=");
  // The email linked C to A, who already finished today: C opens on A's result.
  await expect(c.getByTestId("whos-older-card-a")).toHaveCount(0);
  await expect(c.getByTestId("whos-older-reminder-on")).toContainText("@resend.dev", { timeout: 15_000 });
  // A sees the confirmation too (same address, reactive).
  await expect(a.getByTestId("whos-older-reminder-on")).toBeVisible({ timeout: 15_000 });

  // ── The hourly sender, as it will run tomorrow at 10:00 UTC ──
  const now = new Date();
  const tomorrow10 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 10);
  const due = JSON.parse(convex(["run", "whosOlderReminders:dueReminders", JSON.stringify({ nowMs: tomorrow10 })])) as {
    due: Array<{ email: string; streak: number; friends: number }>;
  };
  const mine = due.due.find((d) => d.email === email);
  expect(mine, "due tomorrow morning").toBeTruthy();
  expect(mine!.streak).toBe(1);
  expect(mine!.friends).toBe(1);
  // …but not today: A already played.
  const today = JSON.parse(convex(["run", "whosOlderReminders:dueReminders", JSON.stringify({ nowMs: Date.now() })])) as {
    due: Array<{ email: string }>;
  };
  expect(today.due.some((d) => d.email === email)).toBe(false);

  // ── One-click unsubscribe ──
  const res = await fetch(`${DEV_SITE}/whos-older/unsubscribe?t=${row!.token}`);
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("You're unsubscribed.");
  const after = JSON.parse(convex(["run", "whosOlderReminders:dueReminders", JSON.stringify({ nowMs: tomorrow10 })])) as {
    due: Array<{ email: string }>;
  };
  expect(after.due.some((d) => d.email === email)).toBe(false);
});

/**
 * A challenge from a PAST date replays the sender's frozen pairs as a
 * "challenge" run (not today's daily), ends on the head-to-head, and points
 * the player at today's edition. Needs a past-date challenge id on DEV:
 *   WO_PAST_CHALLENGE_ID=<whosOlderChallenges id> npx playwright test …
 */
test("a past-date challenge plays the sender's pairs, then today's daily", async ({ browser }) => {
  const challengeId = process.env.WO_PAST_CHALLENGE_ID;
  test.skip(!challengeId, "set WO_PAST_CHALLENGE_ID to a past-date challenge on DEV");
  const p = await visitor(browser);
  await p.goto(`/older?c=${challengeId}&ref=whos_older_challenge`);
  await expect(p.getByTestId("whos-older-challenge-banner")).toBeVisible({ timeout: 30_000 });
  await expect(p.getByText(/Challenge · #\d+/)).toBeVisible();
  await playThrough(p);
  await expect(p.getByTestId("whos-older-head-to-head")).toBeVisible({ timeout: 15_000 });
  // A past date is not today's result: no streak, and the way on is today.
  await expect(p.getByTestId("whos-older-streak")).toHaveCount(0);
  await p.screenshot({ path: `${SHOTS}/past-challenge-result.png`, fullPage: true });
  await p.getByTestId("whos-older-play-today").click();
  await expect(p.getByText(/Daily #\d+/)).toBeVisible({ timeout: 30_000 });
  await expect(p.getByTestId("whos-older-card-a")).toBeVisible();
});
