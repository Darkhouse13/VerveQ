import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("multiplayer challenge arena contract", () => {
  it("defines party formats for 1v1, 2v2, and 3-5 player free-for-all", () => {
    const arena = read("convex/multiplayerMatches.ts");
    expect(arena).toContain("PARTY_FORMATS");
    expect(arena).toContain('"1v1"');
    expect(arena).toContain('"2v2"');
    expect(arena).toContain('"1v1v1"');
    expect(arena).toContain('"1v1v1v1"');
    expect(arena).toContain('"1v1v1v1v1"');
    expect(arena).toContain("maxPlayers: 5");
    expect(arena).toContain("teamSize: 2");
  });

  it("models the five 10-question arena rounds and new categories", () => {
    const arena = read("convex/multiplayerMatches.ts");
    expect(arena).toContain("ARENA_ROUNDS");
    expect(arena).toContain('kind: "football_quiz"');
    expect(arena).toContain('kind: "knowledge_quiz"');
    expect(arena).toContain('kind: "which_came_first"');
    expect(arena).toContain('kind: "logo_name"');
    expect(arena).toContain('kind: "capital_city"');
    expect(arena).toContain("QUESTIONS_PER_ROUND = 10");
    expect(arena).toContain("TOTAL_ARENA_QUESTIONS = ARENA_ROUNDS.length * QUESTIONS_PER_ROUND");
  });

  it("scores each correct answer by answer rank and remaining time", () => {
    const arena = read("convex/multiplayerMatches.ts");
    expect(arena).toContain("scoreArenaQuestion");
    expect(arena).toContain("correctRank");
    expect(arena).toContain("remainingMs");
    expect(arena).toContain("rankMultiplier");
  });

  it("forces a ranking break after every 10 questions until all players ready", () => {
    const arena = read("convex/multiplayerMatches.ts");
    expect(arena).toContain('v.literal("roundBreak")');
    expect(arena).toContain("allRoundBreakReady");
    expect(arena).toContain("roundBreakReadyUserIds");
    expect(arena).toContain("currentRoundIndex");
  });

  it("returns final podium plus lower table for 4-5 player matches", () => {
    const arena = read("convex/multiplayerMatches.ts");
    expect(arena).toContain("podium");
    expect(arena).toContain("bottomRankings");
    expect(arena).toContain("rankings.slice(0, 3)");
    expect(arena).toContain("rankings.slice(3)");
  });

  it("exposes dedicated frontend screens and routes for the beta arena", () => {
    const app = read("src/App.tsx");
    const hub = read("src/pages/ChallengeScreen.tsx");
    const lobby = read("src/pages/MultiplayerLobbyScreen.tsx");
    const play = read("src/pages/MultiplayerArenaScreen.tsx");

    expect(app).toContain("MultiplayerLobbyScreen");
    expect(app).toContain("MultiplayerArenaScreen");
    expect(app).toContain('path="/challenge/arena"');
    expect(app).toContain('path="/challenge/arena/play"');
    expect(hub).toContain("Arena Beta");
    expect(hub).toContain('navigate("/challenge/arena")');
    expect(lobby).toContain("Join code");
    expect(play).toContain("Round ranking");
    expect(play).toContain("Top 3");
    expect(play).toContain("Bottom table");
  });


  it("checks lobby and round-break readiness for the current player only", () => {
    const backend = read("convex/multiplayerMatches.ts");
    const lobby = read("src/pages/MultiplayerLobbyScreen.tsx");
    const play = read("src/pages/MultiplayerArenaScreen.tsx");

    expect(backend).toContain("currentUserId: userId");
    expect(lobby).toContain("p.id === match.currentUserId");
    expect(lobby).not.toContain("match.players.find((p) => match.readyUserIds.includes(p.id))");
    expect(play).toContain("id === match.currentUserId");
    expect(play).not.toContain("match.roundBreakReadyUserIds.some((id) => match.players.some((p) => p.id === id))");
  });

  it("lets players escape stale arena lobbies without being auto-resumed forever", () => {
    const backend = read("convex/multiplayerMatches.ts");
    const lobby = read("src/pages/MultiplayerLobbyScreen.tsx");

    expect(backend).toContain("export const leaveLobby");
    expect(backend).toContain("status: \"cancelled\"");
    expect(backend).toContain("filter((id) => id !== userId)");
    expect(lobby).toContain("leaveLobby");
    expect(lobby).toContain("Leave arena");
    expect(lobby).toContain("handleLeave");
  });

});
