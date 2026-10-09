import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  REMINDER_DORMANT_DAYS,
  addDaysToDateKey,
  challengeVerdict,
  computeDailyStreak,
  hoursMinutesUntilMidnightUTC,
  localHour,
  maskEmail,
  normalizeEmail,
  reminderDue,
  safeTimeZone,
} from "../../convex/lib/whosOlderRetention";
import { renderEmail } from "../../convex/whosOlderReminders";
import { scrubSearch } from "@/lib/analytics";

const appDir = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(appDir, rel), "utf8");

describe("Who's Older daily streak", () => {
  const today = "2026-10-09";

  it("counts consecutive finished dates ending today", () => {
    expect(computeDailyStreak(["2026-10-07", "2026-10-08", "2026-10-09"], today)).toEqual({
      current: 3,
      best: 3,
      playedToday: true,
    });
  });

  it("stays alive through today while yesterday was played", () => {
    expect(computeDailyStreak(["2026-10-07", "2026-10-08"], today)).toEqual({
      current: 2,
      best: 2,
      playedToday: false,
    });
  });

  it("breaks after a missed day but remembers the best run", () => {
    expect(computeDailyStreak(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-07"], today)).toEqual({
      current: 0,
      best: 3,
      playedToday: false,
    });
    expect(computeDailyStreak(["2026-10-01", "2026-10-02", "2026-10-09"], today).current).toBe(1);
  });

  it("ignores duplicates (two linked browsers on one date) and future dates", () => {
    expect(computeDailyStreak(["2026-10-08", "2026-10-08", "2026-10-09", "2026-10-10"], today)).toEqual({
      current: 2,
      best: 2,
      playedToday: true,
    });
  });

  it("is zero with no history", () => {
    expect(computeDailyStreak([], today)).toEqual({ current: 0, best: 0, playedToday: false });
  });

  it("steps dates across month and year ends in UTC", () => {
    expect(addDaysToDateKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDateKey("2027-01-01", -1)).toBe("2026-12-31");
  });
});

describe("Who's Older reminder rules", () => {
  // 2026-10-09 10:00 UTC
  const ten = Date.UTC(2026, 9, 9, 10, 0);
  const base = {
    nowMs: ten,
    todayKey: "2026-10-09",
    timeZone: "UTC",
    lastSentDateKey: "2026-10-08",
    playedToday: false,
    lastFinishedDateKey: "2026-10-08",
    confirmedAt: Date.UTC(2026, 9, 1),
  };

  it("is due once per edition, in the local morning window", () => {
    expect(reminderDue(base)).toBe(true);
    expect(reminderDue({ ...base, lastSentDateKey: "2026-10-09" })).toBe(false);
    // 10:00 UTC is 03:00 in Los Angeles — too early; 19:00 in Tokyo — fine.
    expect(reminderDue({ ...base, timeZone: "America/Los_Angeles" })).toBe(false);
    expect(reminderDue({ ...base, timeZone: "Asia/Tokyo" })).toBe(true);
    // 10:00 UTC is 23:00 in Auckland — past the window.
    expect(reminderDue({ ...base, timeZone: "Pacific/Auckland" })).toBe(false);
  });

  it("never mails a player who already played today", () => {
    expect(reminderDue({ ...base, playedToday: true })).toBe(false);
  });

  it("goes quiet for dormant subscribers", () => {
    const longAgo = addDaysToDateKey("2026-10-09", -(REMINDER_DORMANT_DAYS + 1));
    expect(reminderDue({ ...base, lastFinishedDateKey: longAgo, confirmedAt: Date.UTC(2026, 8, 1) })).toBe(false);
    // A new subscriber who never finished a daily still gets their first weeks.
    expect(reminderDue({ ...base, lastFinishedDateKey: null, confirmedAt: Date.UTC(2026, 9, 8) })).toBe(true);
  });

  it("validates, normalises and masks addresses", () => {
    expect(normalizeEmail("  Jo.Smith@Example.COM ")).toBe("jo.smith@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail(`${"x".repeat(250)}@ex.com`)).toBeNull();
    expect(maskEmail("jo.smith@example.com")).toBe("jo***@example.com");
    expect(maskEmail("ab@example.com")).toBe("ab*@example.com");
  });

  it("falls back to UTC for a missing or bogus browser zone", () => {
    expect(safeTimeZone("Europe/London")).toBe("Europe/London");
    expect(safeTimeZone("Mars/Olympus")).toBe("UTC");
    expect(safeTimeZone(undefined)).toBe("UTC");
    expect(localHour(ten, "Europe/Istanbul")).toBe(13);
  });

  it("counts down to the UTC midnight the streak breaks at", () => {
    expect(hoursMinutesUntilMidnightUTC(ten)).toBe("14h 00m");
    expect(hoursMinutesUntilMidnightUTC(Date.UTC(2026, 9, 9, 23, 59, 30))).toBe("0h 00m");
  });

  it("escapes everything it puts into the email HTML", () => {
    const { html, text } = renderEmail({
      heading: "Who's <Older>",
      lines: ['a "quoted" & <b>bold</b> line'],
      button: "Play",
      href: "https://verveq.com/older?rt=abc&x=1",
      footer: "footer",
      unsubscribe: "https://x.convex.site/whos-older/unsubscribe?t=abc",
    });
    expect(html).not.toContain("<Older>");
    expect(html).toContain("Who&#39;s &lt;Older&gt;");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain('href="https://verveq.com/older?rt=abc&amp;x=1"');
    expect(text).toContain("Unsubscribe: https://x.convex.site/whos-older/unsubscribe?t=abc");
  });
});

describe("Who's Older challenge", () => {
  it("is judged from the challenged player's side", () => {
    expect(challengeVerdict(9, 8)).toBe("won");
    expect(challengeVerdict(7, 8)).toBe("lost");
    expect(challengeVerdict(8, 8)).toBe("tie");
  });

  it("never lets a challenge id or reminder token into analytics", () => {
    expect(scrubSearch("?c=k57abc&rt=secrettoken&confirm=1&ref=whos_older_challenge")).toBe(
      "?ref=whos_older_challenge",
    );
  });
});

describe("Who's Older retention wiring", () => {
  const reminders = read("convex/whosOlderReminders.ts");
  const screen = read("src/pages/shell/play/WhosOlderPlayScreen.tsx");

  it("is double opt-in: the daily send reads confirmed, subscribed rows only", () => {
    expect(reminders).toMatch(/q\.eq\("unsubscribedAt", undefined\)\.gt\("confirmedAt", 0\)/);
    // sign-up mails the confirmation, never the daily reminder
    const subscribe = reminders.slice(reminders.indexOf("export const subscribe"), reminders.indexOf("export const claimToken"));
    expect(subscribe).toContain("sendConfirmation");
    expect(subscribe).not.toContain("sendDueReminders");
  });

  it("caps sign-ups and confirmation re-sends per player", () => {
    expect(reminders).toContain("REMINDER_SIGNUPS_PER_DAY");
    expect(reminders).toContain("REMINDER_CONFIRM_RESEND_MS");
    expect(reminders).toContain('code: "rate_limited"');
  });

  it("carries a one-click unsubscribe on every email", () => {
    expect(reminders).toContain('"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"');
    const http = read("convex/http.ts");
    expect(http).toMatch(/path: "\/whos-older\/unsubscribe",\s+method: "GET"/);
    expect(http).toMatch(/path: "\/whos-older\/unsubscribe",\s+method: "POST"/);
  });

  it("sends hourly from the cron table", () => {
    expect(read("convex/crons.ts")).toMatch(
      /crons\.cron\("whos-older-reminders", "13 \* \* \* \*", internal\.whosOlderReminders\.sendDueReminders/,
    );
  });

  it("strips the reminder token from the address bar once claimed", () => {
    expect(screen).toContain('url.searchParams.delete("rt")');
    expect(screen).toContain("window.history.replaceState");
  });

  it("shares a challenge link, not a bare result", () => {
    expect(screen).toContain("createChallengeMut({ sessionId: daily.sessionId })");
    expect(screen).toMatch(/\/older\?c=\$\{challengeId\}&ref=whos_older_challenge/);
  });

  it("reads the challenged score from the session, never from the client", () => {
    const whosOlder = read("convex/whosOlder.ts");
    const record = whosOlder.slice(whosOlder.indexOf("export const recordChallengeResult"));
    expect(record).toContain("args: { challengeId: v.id(\"whosOlderChallenges\"), sessionId: v.id(\"whosOlderSessions\") }");
    expect(record).toContain("score: session.score");
  });
});
