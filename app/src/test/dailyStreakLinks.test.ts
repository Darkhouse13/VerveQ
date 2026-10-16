import { describe, expect, it } from "vitest";
import {
  STREAK_GROUP_MAX,
  STREAK_TRANSFER_MAX_CLAIMS,
  planStreakMerge,
  streakTransferState,
} from "../../convex/lib/whosOlderRetention";
import { streakLinkUrl } from "@/lib/dailyShare";

const lone = (userId: string) => ({ userId, groupId: null, members: [userId] });

describe("planStreakMerge", () => {
  it("starts a group named after the sender when neither browser has one", () => {
    expect(planStreakMerge(lone("ig"), lone("safari"))).toEqual({
      ok: true,
      groupId: "ig",
      members: ["ig", "safari"],
      alreadyLinked: false,
    });
  });

  it("keeps the sender's group and pulls the claimer's whole group in", () => {
    const plan = planStreakMerge(
      { userId: "ig", groupId: "g1", members: ["ig", "laptop"] },
      { userId: "safari", groupId: "g2", members: ["safari", "chrome"] },
    );
    expect(plan).toEqual({ ok: true, groupId: "g1", members: ["ig", "laptop", "safari", "chrome"], alreadyLinked: false });
  });

  it("joins the claimer's group when only the claimer has one", () => {
    const plan = planStreakMerge(lone("ig"), { userId: "safari", groupId: "g2", members: ["safari", "laptop"] });
    expect(plan).toMatchObject({ ok: true, groupId: "g2" });
  });

  it("is a no-op when both browsers are already linked", () => {
    const g = { groupId: "g1", members: ["ig", "safari"] };
    expect(planStreakMerge({ userId: "ig", ...g }, { userId: "safari", ...g })).toMatchObject({
      ok: true,
      alreadyLinked: true,
    });
  });

  it("refuses to grow a group past the cap", () => {
    const big = Array.from({ length: STREAK_GROUP_MAX }, (_, i) => `u${i}`);
    expect(planStreakMerge({ userId: "u0", groupId: "g1", members: big }, lone("extra"))).toEqual({
      ok: false,
      reason: "group_full",
    });
  });
});

describe("streakTransferState", () => {
  const now = 1_000_000;
  const transfer = { fromUserId: "ig", expiresAt: now + 1, claimCount: 0 };

  it("accepts a fresh link from another browser", () => {
    expect(streakTransferState(transfer, "safari", now)).toBe("ok");
  });
  it("treats the sender reopening their own link as their own", () => {
    expect(streakTransferState(transfer, "ig", now)).toBe("own");
  });
  it("rejects an expired link", () => {
    expect(streakTransferState({ ...transfer, expiresAt: now - 1 }, "safari", now)).toBe("expired");
  });
  it("rejects a link claimed the maximum number of times", () => {
    expect(streakTransferState({ ...transfer, claimCount: STREAK_TRANSFER_MAX_CLAIMS }, "safari", now)).toBe("used_up");
  });
});

describe("streakLinkUrl", () => {
  it("points at the game's short link with the token and its own ref", () => {
    expect(streakLinkUrl("https://verveq.com", "letters", "abc")).toBe("https://verveq.com/letters?st=abc&ref=streak_link");
    expect(streakLinkUrl("https://verveq.com", "older", "abc")).toBe("https://verveq.com/older?st=abc&ref=streak_link");
  });
});
