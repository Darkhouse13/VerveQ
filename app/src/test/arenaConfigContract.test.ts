import { describe, expect, it } from "vitest";

import {
  ARENA_SELECTABLE_CATEGORIES,
  categoryRoundCapacityFloor,
} from "../../convex/challengeArenas";
import { ARENA_CATEGORY_OPTIONS, ARENA_MAX_PER_ROUND } from "../lib/arena";

// Guards the customizable-arena contract: the create UI's subject list must stay
// in lockstep with the server's allowlist, and every selectable subject must be
// able to fill the largest allowed round (so no structurally-valid config can
// ever be accepted that the content can't fill).
describe("arena config contract", () => {
  it("frontend subject options match the backend selectable categories (order included)", () => {
    expect(ARENA_CATEGORY_OPTIONS.map((option) => option.key)).toEqual([
      ...ARENA_SELECTABLE_CATEGORIES,
    ]);
  });

  it("every selectable subject's content floor covers the max questions-per-round", () => {
    for (const category of ARENA_SELECTABLE_CATEGORIES) {
      expect(categoryRoundCapacityFloor(category)).toBeGreaterThanOrEqual(
        ARENA_MAX_PER_ROUND,
      );
    }
  });
});
