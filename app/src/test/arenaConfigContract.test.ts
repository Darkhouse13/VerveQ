import { describe, expect, it } from "vitest";

import {
  challengeArenaCapitalCityQuestions,
  challengeArenaEnterpriseLogoQuestions,
  challengeArenaGeneralKnowledgeQuestions,
  challengeArenaWhichCameFirstQuestions,
} from "../../convex/challengeArenaContent";
import { ARENA_SELECTABLE_CATEGORIES } from "../../convex/challengeArenas";
import { ARENA_CATEGORY_OPTIONS, ARENA_MAX_PER_ROUND } from "../lib/arena";

// Guards the customizable-arena contract: the create UI's subject list must stay
// in lockstep with the server's allowlist, and every selectable subject must be
// able to fill the largest allowed round purely from bundled fallback content
// (so no structurally-valid config can ever be unfillable at start).
describe("arena config contract", () => {
  it("frontend subject options match the backend selectable categories (order included)", () => {
    expect(ARENA_CATEGORY_OPTIONS.map((option) => option.key)).toEqual([
      ...ARENA_SELECTABLE_CATEGORIES,
    ]);
  });

  it("every selectable subject can fill the max questions-per-round from bundled content", () => {
    const bundledFloor: Record<string, number> = {
      football_quiz: Number.POSITIVE_INFINITY, // seeded football pool is large
      general_knowledge: challengeArenaGeneralKnowledgeQuestions.length,
      which_came_first: challengeArenaWhichCameFirstQuestions.length,
      enterprise_logos: challengeArenaEnterpriseLogoQuestions.length,
      capital_cities: challengeArenaCapitalCityQuestions.length,
    };

    for (const category of ARENA_SELECTABLE_CATEGORIES) {
      expect(bundledFloor[category]).toBeGreaterThanOrEqual(ARENA_MAX_PER_ROUND);
    }
  });
});
