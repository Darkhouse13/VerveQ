import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import players from "../../convex/data/missing_letters_players.json";
import {
  DAILY_TIERS,
  MISSING_LETTERS_DAILY_ROUNDS,
  TIER_RULES,
  bandOf,
  boardText,
  buildDailyBoards,
  endlessTierFor,
  isCorrectGuess,
  lettersEditionForDate,
  normalizeGuess,
  pickEndlessBoard,
  pickHidden,
  publicTiles,
} from "../../convex/lib/missingLetters";
import { seededRandom } from "../../convex/lib/whosOlder";
import { missingLettersShortLinkTarget } from "@/lib/playShortLink";

const appDir = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(appDir, rel), "utf8");

const days = (n: number, from = 0) =>
  Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 9, 12 + from + i)).toISOString().slice(0, 10));

describe("Missing Letters pool", () => {
  it("has one row per person, a nation clue and a fame rank", () => {
    expect(players.length).toBeGreaterThanOrEqual(150);
    expect(new Set(players.map((p) => p.id)).size).toBe(players.length);
    for (const p of players) {
      expect(p.id).toMatch(/^Q\d+$/);
      expect(p.nation.length).toBeGreaterThan(1);
      expect(p.fame).toBeGreaterThanOrEqual(1);
      expect(p.fame).toBeLessThanOrEqual(300);
    }
  });

  it("can deal every band a full day", () => {
    for (const band of ["famous", "known", "deep"] as const) {
      const perDay = DAILY_TIERS.filter((t) => TIER_RULES[t].band === band).length;
      expect(players.filter((p) => bandOf(p.fame) === band).length).toBeGreaterThanOrEqual(perDay * 5);
    }
  });
});

describe("Missing Letters boards", () => {
  it("only ever blanks plain A–Z letters, keeps two letters showing, and keeps initials below IMPOSSIBLE", () => {
    for (const p of players) {
      for (const tier of ["easy", "medium", "hard", "impossible"] as const) {
        const chars = boardText(p.name);
        const hidden = pickHidden(p.name, tier, seededRandom(`${p.id}:${tier}`));
        expect(hidden.length).toBeGreaterThanOrEqual(1);
        for (const i of hidden) expect(chars[i]).toMatch(/^[A-Z]$/);
        const letters = chars.filter((c) => /\p{L}/u.test(c)).length;
        expect(letters - hidden.length).toBeGreaterThanOrEqual(2);
        if (tier !== "impossible") expect(hidden).not.toContain(0);
      }
    }
  });

  it("hides more of the name as the tier climbs", () => {
    const share = (tier: keyof typeof TIER_RULES) => TIER_RULES[tier].share;
    expect(share("easy")).toBeLessThan(share("medium"));
    expect(share("medium")).toBeLessThan(share("hard"));
    expect(share("hard")).toBeLessThan(share("impossible"));
    expect(TIER_RULES.impossible.initials).toBe(false);
  });

  it("never sends a blank's letter to the client", () => {
    const board = { name: "Sergio Agüero", hidden: [3, 9] };
    expect(publicTiles(board)).toEqual(["S", "E", "R", null, "I", "O", " ", "A", "G", null, "E", "R", "O"]);
  });

  it("judges a guess on every blank, ignoring case and stray characters", () => {
    const board = { name: "Sergio Agüero", hidden: [3, 9] };
    expect(isCorrectGuess(board, "GÜ".replace("Ü", "U"))).toBe(false); // Ü is never a blank
    expect(boardText(board.name)[9]).toBe("Ü");
    const plain = { name: "Neymar", hidden: [3, 5] };
    expect(isCorrectGuess(plain, "mr")).toBe(true);
    expect(isCorrectGuess(plain, "M R")).toBe(true);
    expect(isCorrectGuess(plain, "MA")).toBe(false);
    expect(isCorrectGuess(plain, "M")).toBe(false);
    expect(normalizeGuess("a-b c1")).toBe("ABC");
  });
});

describe("Missing Letters daily", () => {
  it("is identical for everyone on the same date and differs across dates", () => {
    expect(buildDailyBoards(players, "2026-10-14")).toEqual(buildDailyBoards(players, "2026-10-14"));
    expect(buildDailyBoards(players, "2026-10-14")).not.toEqual(buildDailyBoards(players, "2026-10-15"));
  });

  it("deals ten boards on the reel's ramp, no name twice in a day", () => {
    for (const day of days(120)) {
      const boards = buildDailyBoards(players, day);
      expect(boards).toHaveLength(MISSING_LETTERS_DAILY_ROUNDS);
      expect(boards.map((b) => b.tier)).toEqual(DAILY_TIERS);
      expect(new Set(boards.map((b) => b.id)).size).toBe(boards.length);
      for (const b of boards) {
        const p = players.find((x) => x.id === b.id)!;
        expect(bandOf(p.fame)).toBe(TIER_RULES[b.tier].band);
      }
    }
  });

  it("does not repeat a name within two weeks", () => {
    const window = days(14).map((d) => buildDailyBoards(players, d).map((b) => b.id));
    const ids = window.flat();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("numbers editions from the launch epoch", () => {
    expect(lettersEditionForDate("2026-10-12")).toBe(1);
    expect(lettersEditionForDate("2026-11-11")).toBe(31);
  });
});

describe("Missing Letters endless", () => {
  it("ramps through the daily tiers, then stays in the hard mix", () => {
    const rand = seededRandom("t");
    DAILY_TIERS.forEach((tier, s) => expect(endlessTierFor(s, rand)).toBe(tier));
    for (let s = 10; s < 200; s++) expect(endlessTierFor(s, rand)).not.toBe("easy");
  });

  it("never deals a used player and stops only when players run out", () => {
    const tiny = [
      { id: "Q1", name: "Neymar", nation: "Brazil", fame: 1 },
      { id: "Q2", name: "Kaká", nation: "Brazil", fame: 200 },
    ];
    const board = pickEndlessBoard(tiny, "hard", new Set(["Q2"]), seededRandom("x"));
    expect(board?.id).toBe("Q1");
    expect(pickEndlessBoard(tiny, "easy", new Set(["Q1", "Q2"]), seededRandom("x"))).toBeNull();
  });
});

describe("Missing Letters wiring", () => {
  const server = read("convex/missingLetters.ts");
  const screen = read("src/pages/shell/play/MissingLettersPlayScreen.tsx");

  it("never sends the name of the board still being answered", () => {
    const view = server.slice(server.indexOf("function publicView"), server.indexOf("async function loadOwned"));
    expect(view).toContain("{ tier: pending.tier, nation: pending.nation, tiles: publicTiles(pending) }");
    expect(view).toContain("session.rounds.slice(0, session.current)");
  });

  it("is reachable from Play's TODAY (decision 10) and the caption short links", () => {
    expect(read("src/App.tsx")).toContain('path="/v2/missing-letters"');
    expect(read("src/App.tsx")).toContain('path="/letters"');
    // Decision 10 merged Home and Compete into Play: one TODAY list, in the
    // catalogue module, rendered by the Play screen.
    const tiles = read("src/pages/shell/competeModeTiles.ts");
    expect(tiles).toMatch(/PLAY_TODAY_KEYS\s*=\s*\[[^\]]*"missingLetters"/);
    expect(tiles).toMatch(/key: "missingLetters",[^\n]*SHELL_ROUTES\.missingLettersPlay/);
    expect(read("src/pages/shell/ShellHomeScreen.tsx")).toContain("tilesByKeys(PLAY_TODAY_KEYS)");
    expect(read("../deploy/nginx.conf")).toMatch(/\|letters\|missing-letters\|/);
    expect(missingLettersShortLinkTarget("")).toBe("/v2/missing-letters?ref=letters");
    expect(missingLettersShortLinkTarget("?ref=ig_bio")).toBe("/v2/missing-letters?ref=ig_bio");
  });

  it("ends like Who's Older: streak, reminder, challenge share, head-to-head", () => {
    for (const piece of ["<StreakBlock game=\"letters\"", "<ReminderCard game=\"letters\"", "<ChallengeResults game=\"letters\"", "<HeadToHead game=\"letters\"", "<ChallengeBanner game=\"letters\""]) {
      expect(screen).toContain(piece);
    }
    expect(screen).toContain("createChallengeMut({ sessionId: daily.sessionId })");
    expect(screen).toMatch(/\/letters\?c=\$\{challengeId\}&ref=missing_letters_challenge/);
    expect(screen).toContain('url.searchParams.delete("rt")');
  });

  it("reads the challenged score from the session, never from the client", () => {
    const record = server.slice(server.indexOf("export const recordChallengeResult"));
    expect(record).toContain('args: { challengeId: v.id("missingLettersChallenges"), sessionId: v.id("missingLettersSessions") }');
    expect(record).toContain("score: session.score");
  });

  it("mails each game's reminder with its own link and copy", () => {
    const reminders = read("convex/whosOlderReminders.ts");
    expect(reminders).toContain('path: "/letters"');
    expect(reminders).toContain('path: "/older"');
    expect(reminders).toContain("finishedDailyDates(ctx, game, userIds)");
  });
});
