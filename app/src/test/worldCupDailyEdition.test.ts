import { describe, expect, it } from "vitest";

import {
  WORLD_CUP_EDITION_LAST_DATE,
  isWorldCupEditionActive,
  isWorldCupThemedQuestion,
} from "../../convex/lib/daily";
import enScreens from "../i18n/locales/en/screens.json";
import esScreens from "../i18n/locales/es/screens.json";
import frScreens from "../i18n/locales/fr/screens.json";

// The World Cup edition swaps the football daily's question pool while the
// 2026 tournament runs. These lock the two contracts the feature rests on:
// (1) the window opens for football only and closes after the final, and
// (2) the themed filter admits national-team World Cup questions while keeping
// out Club World Cup content and facts that can go stale mid-tournament.
describe("world cup daily edition", () => {
  describe("isWorldCupEditionActive", () => {
    it("is active for football through the final (inclusive)", () => {
      expect(isWorldCupEditionActive("football", "2026-07-02")).toBe(true);
      expect(
        isWorldCupEditionActive("football", WORLD_CUP_EDITION_LAST_DATE),
      ).toBe(true);
    });

    it("switches off the day after the final", () => {
      expect(isWorldCupEditionActive("football", "2026-07-20")).toBe(false);
    });

    it("never themes non-football dailies", () => {
      expect(isWorldCupEditionActive("knowledge", "2026-07-02")).toBe(false);
      expect(isWorldCupEditionActive("basketball", "2026-07-02")).toBe(false);
      expect(isWorldCupEditionActive("tennis", "2026-07-02")).toBe(false);
    });
  });

  describe("isWorldCupThemedQuestion", () => {
    it("admits questions mentioning the World Cup in text or category", () => {
      expect(
        isWorldCupThemedQuestion({
          question:
            "Against which side did Miroslav Klose score a hat-trick on his World Cup debut?",
          category: "legends_classic",
        }),
      ).toBe(true);
      expect(
        isWorldCupThemedQuestion({
          question: "Which nation won the 1966 final at Wembley?",
          category: "world_cup_history",
        }),
      ).toBe(true);
    });

    it("rejects questions with no World Cup connection", () => {
      expect(
        isWorldCupThemedQuestion({
          question: "Which English club is nicknamed 'The Red Devils'?",
          category: "clubs",
        }),
      ).toBe(false);
      expect(isWorldCupThemedQuestion({ question: "Who won the 2016 Euros?" })).toBe(
        false,
      );
    });

    it("rejects Club World Cup questions (national-team edition only)", () => {
      expect(
        isWorldCupThemedQuestion({
          question: "Which club won the 2023 FIFA Club World Cup?",
          category: "fifa_club_world_cup",
        }),
      ).toBe(false);
      expect(
        isWorldCupThemedQuestion({
          question: "Who scored in the Club World Cup final of 2018?",
          category: "world_cup",
        }),
      ).toBe(false);
    });

    it("rejects facts that can go stale while the 2026 tournament runs", () => {
      expect(
        isWorldCupThemedQuestion({
          question:
            "Which nations are co-hosting the 2026 FIFA World Cup?",
          category: "world_cup",
        }),
      ).toBe(false);
      expect(
        isWorldCupThemedQuestion({
          question:
            "As of 22 June 2026, how many career World Cup goals has Lionel Messi scored?",
          category: "world_cup",
        }),
      ).toBe(false);
      expect(
        isWorldCupThemedQuestion({
          question:
            "The 2026 World Cup is the first edition to feature how many teams?",
          category: "world_cup",
        }),
      ).toBe(false);
      expect(
        isWorldCupThemedQuestion({
          question: "Which nation is the reigning World Cup champion?",
          category: "world_cup",
        }),
      ).toBe(false);
    });
  });

  // The daily share text is the acquisition loop's carrier: every locale's
  // quiz share strings must exist (a missing key would leak the raw key name
  // into WhatsApp) and must carry the {{url}} placeholder — a share without a
  // link back to the app is a dead end for the recipient.
  describe("daily result share strings", () => {
    const locales = { en: enScreens, fr: frScreens, es: esScreens } as const;

    it.each(Object.entries(locales))(
      "%s share strings include the return link",
      (_locale, screens) => {
        const dailyResult = screens.dailyResult as Record<string, string>;
        for (const key of ["shareQuiz", "shareQuizWorldCup", "shareSurvival"]) {
          expect(dailyResult[key], key).toBeTruthy();
          expect(dailyResult[key], key).toContain("{{url}}");
        }
        expect(dailyResult.shareQuiz).toContain("{{emoji}}");
        expect(dailyResult.shareQuizWorldCup).toContain("{{emoji}}");
        expect(dailyResult.worldCupEdition, "worldCupEdition").toBeTruthy();
        expect(dailyResult.challengeAMate, "challengeAMate").toBeTruthy();
      },
    );
  });
});
