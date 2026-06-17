import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("challenge sender waiting room contract", () => {
  it("subscribes to the current user active match so the challenge sender follows accepted invites into the waiting room", () => {
    const source = readFileSync("src/pages/ChallengeScreen.tsx", "utf8");

    expect(source).toContain("api.liveMatches.getActiveMatch");
    expect(source).toContain("activeMatchId");
    expect(source).toContain("/waiting-room?matchId=${activeMatchId}");
  });

  it("gives auto-resumed legacy waiting rooms a safe exit and leaves finalized matches", () => {
    const source = readFileSync("src/pages/WaitingRoomScreen.tsx", "utf8");
    const screens = JSON.parse(readFileSync("src/i18n/locales/en/screens.json", "utf8"));

    expect(source).toContain("ExitGameButton");
    expect(source).toContain("api.liveMatches.abandonWaitingMatch");
    expect(source).toContain("api.liveMatches.forfeit");
    expect(source).toContain('matchStatus === "completed" || matchStatus === "forfeited"');
    expect(source).toContain('navigate("/home", { replace: true })');
    // i18n: the leave-confirmation title and the "no longer active" copy moved
    // to locale keys; verify both the key wiring and the English copy.
    expect(source).toContain("waitingRoom.leaveTitle");
    expect(screens.waitingRoom.leaveTitle).toBe("Leave waiting room?");
    expect(source).toContain("waitingRoom.unavailableDesc");
    expect(screens.waitingRoom.unavailableDesc).toBe("This legacy Live Match is no longer active.");
  });
});
