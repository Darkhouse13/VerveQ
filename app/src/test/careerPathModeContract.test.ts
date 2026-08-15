import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { COMPETE_MODE_TILES } from "@/pages/shell/competeModeTiles";
import { SHELL_ROUTES, SHELL_ROUTE_PATTERNS } from "@/lib/shellRoutes";
import { playShortLinkTarget } from "@/lib/playShortLink";

const read = (path: string) => readFileSync(path, "utf8");

/**
 * Career Path replaced Who Am I. These contracts pin the two product decisions
 * that define the mode — no autocomplete help while typing, content served
 * from the in-bundle dataset — and keep the removed mode from creeping back.
 */

describe("career path registration", () => {
  it("is routed on the shell and registered in App.tsx", () => {
    expect(SHELL_ROUTES.careerPathPlay).toBe("/v2/career-path");
    expect(SHELL_ROUTE_PATTERNS.careerPathPlay).toBe("/v2/career-path");
    expect(read("src/App.tsx")).toContain('path="/v2/career-path"');
  });

  it("has a compete tile that launches directly (no difficulty picker)", () => {
    const tile = COMPETE_MODE_TILES.find((t) => t.key === "careerPath");
    expect(tile).toBeDefined();
    expect(tile!.to("football")).toBe("/v2/career-path?sport=football");
    expect(tile!.ranked).toBeUndefined(); // casual — no ELO writes
  });

  it("offers both modes from every career path entry point before starting play", () => {
    const entry = read("src/pages/shell/play/CareerPathPlayScreen.tsx");
    expect(entry).toContain('type CareerPathMode = "classic" | "ladder"');
    expect(entry).toContain('setMode("classic")');
    expect(entry).toContain('setMode("ladder")');
    expect(entry).toContain("<CareerPathClassicGame />");
    expect(entry).toContain("<CareerPathLadderGame");
    // The picker itself must not mint a session behind the language modal.
    expect(entry).not.toContain("api.careerPath.startChallenge");
  });

  it("declares tile copy in every locale", () => {
    for (const locale of ["en", "fr", "es"]) {
      const shell = JSON.parse(read(`src/i18n/locales/${locale}/shell.json`));
      expect(shell.modes.careerPath.name.length).toBeGreaterThan(0);
      expect(shell.modes.careerPath.desc.length).toBeGreaterThan(0);
      const play = JSON.parse(read(`src/i18n/locales/${locale}/play.json`));
      expect(Object.keys(play.careerPath).length).toBeGreaterThan(10);
    }
  });
});

describe("career path offers no autocomplete help", () => {
  const screen = read("src/pages/shell/play/CareerPathClassicGame.tsx");
  const backend = read("convex/careerPath.ts");

  it("the play screen never queries for player suggestions", () => {
    expect(screen).not.toContain("useQuery");
    expect(screen).not.toContain("searchPlayers");
    // Identifier-level check: the Who Am I screen's dropdown machinery was
    // playerSuggestions / PlayerSuggestion / selectedSuggestion.
    expect(screen).not.toContain("Suggestion");
  });

  it("the raw typed string is what reaches the server", () => {
    expect(screen).toContain("const submittedGuess = guess.trim();");
    expect(screen).toContain("guess: submittedGuess");
  });

  it("the backend exposes no player-search query", () => {
    expect(backend).not.toContain("searchPlayers");
    // Grading happens server-side through the shared fuzzy matcher.
    expect(backend).toContain('import { findBestMatch } from "./lib/fuzzy"');
    expect(backend).toContain("buildCareerPathAnswerAliases(session.answerName");
  });

  it("getSession never returns the answer", () => {
    const getSessionBlock = backend.slice(backend.indexOf("export const getSession"));
    expect(getSessionBlock).not.toMatch(/answerName: session\.answerName/);
  });
});

describe("career path is guest-playable (zero login)", () => {
  const app = read("src/App.tsx");
  const backend = read("convex/careerPath.ts");

  it("routes career path publicly — no username/account guard", () => {
    // The marketed mode: a logged-out visitor plays instantly.
    expect(app).toContain("<ShellGate><CareerPathPlayScreen /></ShellGate>");
    expect(app).not.toMatch(/<UsernameOnlyRoute>\s*<CareerPathPlayScreen/);
  });

  it("the backend no longer requires a username and accepts a guest token", () => {
    expect(backend).not.toContain("assertUsernameRequiredUser");
    expect(backend).toContain("guestToken");
    expect(backend).toContain("guestTokenHash");
    // Guests have no user record, so play-count writes must be user-gated.
    expect(backend).toContain("if (!session.userId) return");
  });
});

describe("career path social funnel", () => {
  it("/play short link routes into career path, attribution preserved", () => {
    // The off-platform CTA (promo endcards, social bios) must land on the
    // marketed mode, and a bare hit must not be bucketed as "direct".
    expect(read("src/App.tsx")).toContain('path="/play"');
    expect(playShortLinkTarget("")).toBe("/v2/career-path?ref=play");
    expect(playShortLinkTarget("?ref=tiktok")).toBe(
      "/v2/career-path?ref=tiktok",
    );
    expect(playShortLinkTarget("?utm_source=ig")).toBe(
      "/v2/career-path?utm_source=ig",
    );
  });

  it("the play screen records started/completed top-of-funnel events", () => {
    const classic = read("src/pages/shell/play/CareerPathClassicGame.tsx");
    const ladder = read("src/pages/shell/play/CareerPathLadderGame.tsx");
    for (const screen of [classic, ladder]) {
      expect(screen).toContain("api.funnel.recordCareerPathEvent");
      expect(screen).toContain('stage: "started"');
      expect(screen).toContain('stage: "completed"');
      expect(screen).toContain("readColdSource");
    }
  });

  it("the funnel events and readout exist server-side", () => {
    const funnel = read("convex/funnel.ts");
    expect(funnel).toContain("export const recordCareerPathEvent");
    expect(funnel).toContain("export const careerPathMetrics");
    const schema = read("convex/schema.ts");
    expect(schema).toContain('v.literal("career_path_started")');
    expect(schema).toContain('v.literal("career_path_completed")');
  });
});

describe("who am i stays removed", () => {
  it("has no whoAmI source files left", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (entry.name === "node_modules" || entry.name === "_generated" || entry.name === "dist") return [];
        const full = join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      });
    const offenders = [...walk("src"), ...walk("convex")].filter((f) =>
      /whoami/i.test(f),
    );
    expect(offenders).toEqual([]);
  });

  it("has no whoAmI routes, tiles, or api references", () => {
    for (const file of [
      "src/App.tsx",
      "src/lib/shellRoutes.ts",
      "src/pages/shell/competeModeTiles.ts",
      "src/pages/shell/CompeteModeGridScreen.tsx",
      "src/pages/SportSelectScreen.tsx",
      "src/pages/HomeScreen.tsx",
    ]) {
      const source = read(file);
      expect(source).not.toContain("who-am-i");
      expect(source).not.toContain("whoAmI");
      expect(source).not.toContain("WhoAmI");
    }
  });

  it("has no whoAmI tables in the schema", () => {
    const schema = read("convex/schema.ts");
    expect(schema).not.toMatch(/whoAmI\w*:\s*defineTable/);
    expect(schema).toMatch(/careerPathSessions:\s*defineTable/);
  });
});

describe("career path still starts a REAL new game on an explicit action", () => {
  it("wires Next player / Try again straight to startGame", () => {
    // The arrival guard (see analyticsContract) is idempotency on arrival, NOT
    // global start suppression: an explicit replay must still mint a session.
    expect(read("src/pages/shell/play/CareerPathClassicGame.tsx")).toContain(
      "onClick={startGame}",
    );
  });
});

describe("10 Path Challenge contract", () => {
  const screen = read("src/pages/shell/play/CareerPathLadderGame.tsx");
  const backend = read("convex/careerPath.ts");

  it("matches the advertised 2/3/3/2 escalating ten-path shape", () => {
    expect(screen).toContain("const ROUND_COUNT = 10");
    expect(backend).toMatch(/"easy", "easy",\s*"medium", "medium", "medium",\s*"hard", "hard", "hard",\s*"impossible", "impossible"/);
    expect(backend).toContain("export const CAREER_PATH_LADDER_ROUNDS = 10");
  });

  it("gives every path an authoritative 30-second deadline and a skip", () => {
    expect(backend).toContain("export const CAREER_PATH_LADDER_ROUND_MS = 30_000");
    expect(backend).toContain("export const resolveLadderChallenge");
    expect(backend).toContain('v.literal("skipped")');
    expect(backend).toContain('v.literal("timed_out")');
    expect(screen).toContain('resolveWithoutGuess("skipped")');
    expect(screen).toContain('resolveWithoutGuess("timed_out")');
  });

  it("does not repeat a path inside one challenge and caps paths like the reels", () => {
    expect(backend).toContain("buildLadderEntryQueue");
    expect(backend).toContain("ladderEntryIds: session.ladderEntryIds");
    expect(screen).not.toContain("excludedEntryIds");
    expect(backend).toContain("entry.clubs.length <= 7");
  });

  it("prepares the next rung in the terminal mutation without exposing player IDs", () => {
    expect(backend).toContain("prepareNextLadderRound");
    expect(backend).toContain("...(nextRound ? { nextRound } : {})");
    expect(screen).toContain("response.nextRound as PreparedRound");
    expect(screen).toContain("nextRound.startsAt - Date.now()");
    expect(screen).not.toContain("startRound(roundIndex + 1)");
  });

  it("makes the revealed player the result card's strongest readable line", () => {
    expect(screen).toContain('font-heading text-2xl font-bold leading-tight');
    expect(screen).toContain('t("careerPath.itWas", { name: result.answerName })');
  });

  it("offers result sharing from both Career Path finish states", () => {
    const classic = read("src/pages/shell/play/CareerPathClassicGame.tsx");
    expect(classic).toContain("shareCareerPathResult");
    expect(classic).toContain('careerPath.classicShareText');
    expect(screen).toContain("shareCareerPathResult");
    expect(screen).toContain('careerPath.ladderShareText');
    expect(read("src/lib/careerPathShare.ts")).toContain("`${getShareBaseUrl()}/play`");
  });

  it("tracks the full ladder as one distinct run, not ten inflated starts", () => {
    expect(screen).toContain('startRun(response.sessionId, "career-path-ladder"');
    expect(screen).toContain("if (!runIdRef.current)");
    expect(screen).toContain("questionsAnswered: ROUND_COUNT");
  });
});
