import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ARENA_AWAY_AFTER_MS, isArenaPlayerAway } from "@/lib/arena";

// docs/OPEN_BUGS.md #4 (2026-11-04): presence in live rooms.
describe("arena presence", () => {
  it("marks a player away only after three missed heartbeats", () => {
    const now = 1_000_000;
    expect(isArenaPlayerAway({ left: false, lastSeenAt: now - 10_000 }, now)).toBe(false);
    expect(isArenaPlayerAway({ left: false, lastSeenAt: now - ARENA_AWAY_AFTER_MS - 1 }, now)).toBe(true);
    expect(isArenaPlayerAway({ left: false, lastSeenAt: null }, now)).toBe(false);
    expect(isArenaPlayerAway({ left: true, lastSeenAt: 0 }, now)).toBe(false);
  });

  it("the web room heartbeats while visible and the lobby shows Away", () => {
    const screen = readFileSync("src/pages/shell/play/ArenaPlayScreen.tsx", "utf8");
    expect(screen).toContain("api.challengeArenas.heartbeat");
    expect(screen).toContain('document.visibilityState === "visible"');
    const views = readFileSync("src/pages/arena/ArenaRoomViews.tsx", "utf8");
    expect(views).toContain('t("arenaRoom.away")');
  });
});
