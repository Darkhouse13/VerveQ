import { describe, expect, it } from "vitest";

import { humanizeServerError } from "@/lib/errors";

describe("humanizeServerError", () => {
  it("strips Convex transport noise down to the thrown message", () => {
    const raw =
      "[CONVEX M(challengeArenas:join)] [Request ID: 37687cc7ba1193d9] Server Error Uncaught Error: Arena not found at handler (../convex/challengeArenas.ts:1910:21) Called by client";
    expect(humanizeServerError(new Error(raw))).toBe("Arena not found");
  });

  it("strips query-shaped noise too", () => {
    const raw =
      "[CONVEX Q(learn:getLearnReviewPlan)] [Request ID: 11d3e11fb12079c3] Server Error Uncaught Error: Not authenticated at requireUserId (../convex/learn.ts:61:9) at async handler (../convex/learn.ts:696:17) Called by client";
    expect(humanizeServerError(new Error(raw))).toBe("Not authenticated");
  });

  it("falls back to friendly copy when nothing legible is left", () => {
    expect(humanizeServerError(new Error(""), "fallback")).toBe("fallback");
    expect(humanizeServerError(undefined, "fallback")).toBe("fallback");
    expect(
      humanizeServerError(new Error("[CONVEX M(x:y)] [Request ID: abc] Server Error"), "fallback"),
    ).toBe("fallback");
  });

  it("passes plain messages through untouched", () => {
    expect(humanizeServerError(new Error("Username is already taken."))).toBe(
      "Username is already taken.",
    );
  });
});
