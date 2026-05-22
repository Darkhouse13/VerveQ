import { describe, expect, it } from "vitest";

import * as whoAmI from "../../convex/whoAmI";

function argsOf(mutation: unknown): Record<string, unknown> {
  const fn = mutation as { exportArgs?: () => string };
  if (typeof fn.exportArgs !== "function") throw new Error("not a Convex mutation");
  const raw = JSON.parse(fn.exportArgs());
  return (raw.value ?? raw) as Record<string, unknown>;
}

describe("Who Am I visual hook contract", () => {
  it("startChallenge supports an explicit hardMode flag without requiring client answer data", () => {
    const args = argsOf(whoAmI.startChallenge);

    expect(args).toHaveProperty("hardMode");
    expect(args).toHaveProperty("sport");
    expect(args).not.toHaveProperty("answerName");
    expect(args).not.toHaveProperty("photoUrl");
  });
});
