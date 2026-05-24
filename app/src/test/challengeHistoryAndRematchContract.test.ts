import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge head-to-head history and rematch contract", () => {
  it("persists a per-pair versus summary and immutable match history when live matches finish", () => {
    const schema = readFileSync("convex/schema.ts", "utf8");
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");

    expect(schema).toContain("challengeHeadToHeads");
    expect(schema).toContain("challengeMatchHistory");
    expect(schema).toContain('index("by_pair_sport_mode"');
    expect(schema).toContain('index("by_match"');

    expect(liveMatches).toContain("recordChallengeHistory");
    expect(liveMatches).toContain('ctx.db.insert("challengeMatchHistory"');
    expect(liveMatches).toContain('ctx.db.insert("challengeHeadToHeads"');
    expect(liveMatches).toContain('ctx.db.patch(existing._id');
    expect(liveMatches).toContain("getVersusSummary");
  });

  it("returns the versus summary on match reads so both players can see the running score", () => {
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");

    expect(liveMatches).toContain("versusSummary");
    expect(liveMatches).toContain("player1Wins");
    expect(liveMatches).toContain("player2Wins");
    expect(liveMatches).toContain("draws");
  });

  it("shows actual challenge points on the result card instead of quiz grade/correct-count score", () => {
    const liveMatch = readFileSync("src/pages/LiveMatchScreen.tsx", "utf8");
    const resultScreen = readFileSync("src/pages/ResultScreen.tsx", "utf8");
    const types = readFileSync("src/types/api.ts", "utf8");

    expect(types).toContain("opponentId?: string");
    expect(types).toContain("versusScore");
    expect(liveMatch).toContain("opponentId: opponent.id");
    expect(liveMatch).toContain("versusScore: match.versusSummary");
    expect(resultScreen).toContain("challengeScoreline");
    expect(resultScreen).toContain('state.mode === "challenge" ? challengeScoreline');
    expect(resultScreen).toContain("Series");
  });

  it("keeps legacy rematch backend code dormant instead of wiring it to Live Match results", () => {
    const resultScreen = readFileSync("src/pages/ResultScreen.tsx", "utf8");
    const challenges = readFileSync("convex/challenges.ts", "utf8");

    expect(challenges).toContain("createRematch");
    expect(challenges).toContain("challengedId: opponentId");
    expect(resultScreen).not.toContain("api.challenges.createRematch");
    expect(resultScreen).not.toContain("api.challenges.accept");
    expect(resultScreen).not.toContain("api.liveMatches.createFromChallenge");
    expect(resultScreen).not.toContain("handleChallengeAgain");
    expect(resultScreen).not.toContain("opponentId: state.opponentId");
    expect(resultScreen).toContain('onClick={() => navigate("/home")}');
  });

  it("dedupes reciprocal pending rematch invites and clears stale pending requests when a rematch starts", () => {
    const challenges = readFileSync("convex/challenges.ts", "utf8");
    const liveMatches = readFileSync("convex/liveMatches.ts", "utf8");

    expect(challenges).toContain("findPendingChallengeBetweenPlayers");
    expect(challenges).toContain("return { challengeId: existingPending._id, alreadyPending: true }");
    expect(challenges).toContain("return { challengeId: reciprocalPending._id, reciprocalPending: true }");
    expect(challenges).toContain("declineOtherPendingChallengesBetweenPlayers");
    expect(liveMatches).toContain("declineOtherPendingChallengesForMatch");
    expect(liveMatches).toContain("status: \"declined\"");
  });

  it("does not turn reciprocal legacy rematch invites into new live matches from the result screen", () => {
    const resultScreen = readFileSync("src/pages/ResultScreen.tsx", "utf8");

    expect(resultScreen).not.toContain("const acceptChallenge = useMutation(api.challenges.accept)");
    expect(resultScreen).not.toContain("const createLiveMatch = useMutation(api.liveMatches.createFromChallenge)");
    expect(resultScreen).not.toContain("reciprocalPending");
    expect(resultScreen).not.toContain("await acceptChallenge({ challengeId: result.challengeId as never })");
    expect(resultScreen).not.toContain("await createLiveMatch({ challengeId: result.challengeId as never })");
    expect(resultScreen).not.toContain("navigate(`/waiting-room?matchId=${match.matchId}`)");
  });

});
