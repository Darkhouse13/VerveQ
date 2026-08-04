/**
 * FR-1B — anonymous-first identity contract.
 *
 * The ladder is: anonymous (any session) → username (claimed name, appears on
 * public boards) → full account (ranked + Forge). Each rung upgrades IN PLACE
 * on the same users doc.
 *
 * What is worth locking here is the pair of invariants that are easy to break
 * by accident and expensive when broken:
 *
 *  1. The FRONT DOOR and the BACK DOOR must agree. A route guarded at a
 *     stricter tier than its handlers enforces is a gate the product does not
 *     need (that was FR-1A's learn finding); a route guarded looser than its
 *     handlers is a dead end where the screen mounts and the first mutation
 *     throws. So: every SessionRoute surface's handlers must sit on
 *     `assertSessionUser`, and must not read `username`.
 *  2. PERSISTENCE and PUBLICATION are separate. An anonymous run is recorded
 *     in full and merely unlisted, because the claim prompt's whole promise is
 *     that the score you already set becomes visible. Gating the WRITE on
 *     board eligibility silently makes that promise a lie.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(relative: string): string {
  return readFileSync(join(__dirname, relative), "utf8");
}

const APP = read("../App.tsx");
const GUARDS = read("../components/shell/ShellRouteGuards.tsx");

/** Routes that must sit on the identity tier — the ticket's Part 2 list. */
const SESSION_ROUTES = [
  "/v2/daily",
  "/v2/daily-survival",
  "/v2/blitz",
  "/v2/higher-lower",
  "/v2/verve-grid",
  "/v2/learn",
  "/v2/learn/run",
  "/v2/learn/review",
  "/v2/learn/mastery",
  // The exit screens of those modes. A run that is playable anonymously but
  // whose RESULT screen demands a username is a wall at the finish line — and
  // the post-run claim prompt lives on exactly these two screens, so gating
  // them above the identity tier makes the prompt unreachable by construction.
  "/daily-results",
  "/blitz-results",
];

/** Routes whose tier FR-1B deliberately did NOT move. */
const UNCHANGED_TIERS: Array<[string, string]> = [
  ["/v2/quiz", "FullAccountRoute"],
  ["/v2/survival", "FullAccountRoute"],
  ["/v2/forge", "FullAccountRoute"],
  ["/v2/arena", "UsernameOnlyRoute"],
  ["/v2/duels", "UsernameOnlyRoute"],
  ["/v2/profile", "UsernameOnlyRoute"],
];

/**
 * The JSX for one route. Routes are written both inline (one line) and
 * expanded over several lines, so match from the `path=` line up to the start
 * of the NEXT route — a fixed line window would bleed a neighbour's guard in
 * and make this assert the wrong thing.
 */
function routeBlock(path: string): string {
  const lines = APP.split("\n");
  const start = lines.findIndex((l) => l.includes(`path="${path}"`));
  if (start === -1) throw new Error(`no route registered for ${path}`);
  let end = start + 1;
  while (end < lines.length && !/<Route\b/.test(lines[end])) end++;
  return lines.slice(start, end).join("\n");
}

describe("FR-1B route tiers (source contract)", () => {
  it("puts every solo/casual surface on SessionRoute", () => {
    for (const path of SESSION_ROUTES) {
      const line = routeBlock(path);
      expect(line, `${path} should be SessionRoute`).toContain("SessionRoute");
      expect(line, `${path} should no longer demand a username`).not.toContain(
        "UsernameOnlyRoute",
      );
      expect(line, `${path} should not use the v1 username gate`).not.toContain(
        "UsernameRequiredRoute",
      );
    }
  });

  it("leaves ranked, Forge and the social surfaces at their existing tiers", () => {
    for (const [path, guard] of UNCHANGED_TIERS) {
      expect(routeBlock(path), `${path} should stay ${guard}`).toContain(guard);
    }
  });

  it("keeps Career Path tokenized-guest — no session guard at all", () => {
    const line = routeBlock("/v2/career-path");
    expect(line).not.toContain("SessionRoute");
    expect(line).not.toContain("UsernameOnlyRoute");
    expect(line).not.toContain("FullAccountRoute");
  });
});

describe("FR-1B guard behaviour (source contract)", () => {
  it("SessionRoute mints silently and falls back to the chooser, never a dead end", () => {
    expect(GUARDS).toMatch(/SessionRoute[\s\S]{0,1600}ensureSession\(\)/);
    // A refused mint lands on the account chooser WITH intent preserved.
    expect(GUARDS).toMatch(/mintFailed[\s\S]{0,200}accountChoiceUrl\(next\)/);
  });

  it("is a no-op until the backend is deployed (flag OFF ⇒ the old gate)", () => {
    // The OFF branch must be the pre-FR-1B behaviour verbatim: username or
    // chooser. Without this, a master push (frontend-only, per DEPLOYMENT.md)
    // would silently mint sessions against a backend that still rejects them.
    expect(GUARDS).toMatch(
      /if \(!ANONYMOUS_FIRST_ENABLED\) \{[\s\S]{0,400}hasUsername[\s\S]{0,200}accountChoiceUrl\(next\)/,
    );
  });
});

describe("FR-1B backend tiers (source contract)", () => {
  const SURFACES: Array<[string, string[]]> = [
    ["../../convex/dailyChallenge.ts", ["startAttempt", "submitAnswer", "completeAttempt"]],
    ["../../convex/blitz.ts", ["start"]],
    ["../../convex/higherLower.ts", ["startSession"]],
    ["../../convex/verveGrid.ts", ["startSession"]],
    ["../../convex/survivalSessions.ts", ["startDailyGame"]],
  ];

  it("gates the identity-tier surfaces with assertSessionUser", () => {
    for (const [file, fns] of SURFACES) {
      const source = read(file);
      expect(source, `${file} should use the identity gate`).toContain(
        "assertSessionUser",
      );
      for (const fn of fns) {
        expect(source, `${file} should still export ${fn}`).toContain(
          `export const ${fn} =`,
        );
      }
    }
  });

  it("keeps a username gate off the daily and casual handlers entirely", () => {
    for (const file of [
      "../../convex/dailyChallenge.ts",
      "../../convex/higherLower.ts",
      "../../convex/verveGrid.ts",
    ]) {
      expect(read(file), `${file} should not re-add a username gate`).not.toContain(
        "assertUsernameRequiredUser",
      );
    }
  });

  it("learn stays on requireUserId — it never had a username gate to drop", () => {
    const learn = read("../../convex/learn.ts");
    expect(learn).toContain("requireUserId");
    expect(learn).not.toContain("assertUsernameRequiredUser");
    expect(learn).not.toContain("assertFullAccountUser");
  });

  it("keeps ranked and Forge on the full-account gate", () => {
    expect(read("../../convex/quizSessions.ts")).toContain("assertFullAccountUser");
    expect(read("../../convex/forge.ts")).toContain("assertFullAccountUser");
    // Solo (non-daily) Survival is the ranked entry point and must not have
    // been relaxed along with startDailyGame.
    expect(read("../../convex/survivalSessions.ts")).toContain(
      "assertFullAccountUser",
    );
  });
});

describe("FR-1B board policy: record always, publish on a claimed name", () => {
  const blitz = read("../../convex/blitz.ts");

  it("writes the score row unconditionally", () => {
    // The insert must not sit behind an eligibility check — that is what made
    // an anonymous player's run unrecoverable before FR-1B.
    expect(blitz).toMatch(
      /await ctx\.db\.insert\("blitzScores"/,
    );
    expect(blitz).not.toMatch(
      /if \(await isRankedEligibleUserId[\s\S]{0,120}insert\("blitzScores"/,
    );
  });

  it("filters the board on a claimed name, not on account type", () => {
    expect(blitz).toContain("isBoardEligibleUserDoc");
  });

  it("keeps the ELO board on ranked eligibility", () => {
    expect(read("../../convex/leaderboards.ts")).toContain(
      "isRankedEligibleUserDoc",
    );
  });
});

describe("FR-1B claim prompt", () => {
  const prompt = read("../components/shell/onboarding/ClaimNamePrompt.tsx");

  it("claims in place — it never signs out, re-signs in, or copies progress", () => {
    expect(prompt).toContain("claimUsername");
    expect(prompt).not.toContain("signOut");
    expect(prompt).not.toContain("startAnonymousSession");
  });

  it("only asks a session that has no name yet", () => {
    expect(prompt).toMatch(/accountState !== "needsUsername" \|\| hasUsername/);
  });

  it("is dismissible and rides behind the flag", () => {
    expect(prompt).toContain("setDismissed(true)");
    expect(prompt).toMatch(/if \(!ANONYMOUS_FIRST_ENABLED\) return null;/);
  });

  it("promises a board only where one exists", () => {
    // Daily has no public board of its own, so it must not pass `board`.
    expect(read("../pages/DailyResultScreen.tsx")).toMatch(
      /<ClaimNamePrompt source=/,
    );
    expect(read("../pages/DailyResultScreen.tsx")).not.toMatch(
      /<ClaimNamePrompt[^>]*board=/,
    );
    // Blitz does, and its score row is already on file.
    expect(read("../pages/BlitzResultScreen.tsx")).toMatch(
      /<ClaimNamePrompt board="blitz"/,
    );
  });

  /**
   * The check above only proves the `board` PROP is withheld from the Daily —
   * which is exactly why the original no-board COPY still promised
   * "leaderboards, in duels and arenas" and shipped. Blind verification O-FR1B
   * refuted it. Withholding the prop is worthless if the string it selects
   * names a board anyway, so the strings themselves are now the contract.
   *
   * Asserted across every locale: a translator adding "clasificación" or
   * "classement" to the no-board body re-breaks the ruling just as surely as
   * the English did.
   */
  it("keeps every board word out of the no-board copy, in every locale", () => {
    const BOARD_WORDS =
      /board|leaderboard|duel|arena|tabla|clasific|classement|duelo|arène/i;

    for (const locale of ["en", "es", "fr"]) {
      const screens = JSON.parse(
        read(`../i18n/locales/${locale}/screens.json`),
      ) as { claimName: Record<string, string> };
      const { title, body, titleBoard, bodyBoard } = screens.claimName;

      expect(title, `${locale}.claimName.title names a board`).not.toMatch(
        BOARD_WORDS,
      );
      expect(body, `${locale}.claimName.body names a board`).not.toMatch(
        BOARD_WORDS,
      );
      // The Blitz variant is the one place a board may be named — if these
      // stopped naming one, the board-eligible prompt would have gone vague
      // instead of the Daily one going honest.
      expect(titleBoard, `${locale}.claimName.titleBoard`).toMatch(BOARD_WORDS);
      expect(bodyBoard, `${locale}.claimName.bodyBoard`).toMatch(BOARD_WORDS);
    }
  });

  it("carries no board word in the component's inline fallbacks either", () => {
    // `defaultValue` is what renders if a key goes missing, so the forbidden
    // copy must not survive in the source as a fallback.
    const source = read("../components/shell/onboarding/ClaimNamePrompt.tsx");
    const noBodyFallback = source.match(
      /claimName\.body",\s*\{\s*defaultValue:\s*\n?\s*"([^"]+)"/,
    );
    const noTitleFallback = source.match(
      /claimName\.title",\s*\{\s*\n?\s*defaultValue:\s*"([^"]+)"/,
    );
    expect(noBodyFallback?.[1], "no-board body fallback").toBeTruthy();
    expect(noTitleFallback?.[1], "no-board title fallback").toBeTruthy();
    expect(noBodyFallback![1]).not.toMatch(/board|leaderboard|duel|arena/i);
    expect(noTitleFallback![1]).not.toMatch(/board|leaderboard|duel|arena/i);
  });
});

describe("FR-1B in-screen tier control", () => {
  it("is pre-run only in both curated modes", () => {
    for (const screen of [
      "../pages/shell/play/HigherLowerPlayScreen.tsx",
      "../pages/shell/play/VerveGridPlayScreen.tsx",
    ]) {
      const source = read(screen);
      expect(source, `${screen} should mount TierControl`).toContain(
        "TierControl",
      );
      expect(source, `${screen} should compute a pre-run gate`).toMatch(
        /const preRun =/,
      );
    }
  });

  it("re-tiers through the URL, so the run keys off one source of truth", () => {
    for (const screen of [
      "../pages/shell/play/HigherLowerPlayScreen.tsx",
      "../pages/shell/play/VerveGridPlayScreen.tsx",
    ]) {
      expect(read(screen)).toMatch(/nextParams\.set\("difficulty", tier\)/);
    }
  });

  it("adds no new route for the picker", () => {
    expect(APP).not.toContain('path="/v2/difficulty"');
  });
});
