import { describe, expect, it } from "vitest";

import { friendlyError, humanizeServerError } from "@/lib/errors";

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

describe("friendlyError", () => {
  const wrap = (msg: string) =>
    `[CONVEX M(x:y)] [Request ID: abc] Server Error Uncaught Error: ${msg} at handler (../convex/x.ts:1:1) Called by client`;

  it("maps known server errors to curated, user-facing copy", () => {
    expect(friendlyError(new Error(wrap("Not authenticated")))).toBe(
      "Please sign in to continue.",
    );
    expect(friendlyError(new Error(wrap("Arena not found")))).toBe(
      "This isn’t available anymore — it may have expired.",
    );
    expect(friendlyError(new Error(wrap("Arena is full")))).toBe(
      "This room is already full.",
    );
    expect(friendlyError(new Error(wrap("Cannot duel yourself")))).toBe(
      "You can’t duel yourself.",
    );
  });

  it("never leaks raw internals — leaky/unknown errors use the fallback", () => {
    // Internal detail (question counts) must never reach the player.
    expect(
      friendlyError(
        new Error(wrap("Not enough duel questions for football/easy: 7/10")),
        "Couldn’t start the duel.",
      ),
    ).toBe("Couldn’t start the duel.");
    // Config / secret names never shown.
    expect(
      friendlyError(new Error(wrap("RESEND_API_KEY is not configured")), "fb"),
    ).toBe("fb");
    // Completely unrecognised message → contextual fallback, not the raw text.
    const raw = wrap("Unexpected widget malfunction zzz");
    expect(friendlyError(new Error(raw), "fb")).toBe("fb");
    expect(friendlyError(new Error(raw), "fb")).not.toContain("widget");
  });

  it("falls back when there is no error or nothing legible", () => {
    expect(friendlyError(undefined, "fb")).toBe("fb");
    expect(friendlyError(new Error(""), "fb")).toBe("fb");
    expect(
      friendlyError(
        new Error("[CONVEX M(x:y)] [Request ID: abc] Server Error"),
        "fb",
      ),
    ).toBe("fb");
  });
});
