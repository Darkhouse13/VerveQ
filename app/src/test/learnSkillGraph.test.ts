import { describe, expect, it } from "vitest";
import {
  coreCapitalCountryCount,
  questionSkillTags,
  tagGeographyQuestion,
  validateLearnSkillGraph,
  verifiedGeographyCieScoreQuestions,
} from "../../convex/learnQuestionSkillTags";

const capitalRegionNodes = [
  "geo.capitals.europe",
  "geo.capitals.asia",
  "geo.capitals.other",
];

describe("learn skill graph geography tags", () => {
  it("covers the verified CIE geography batches with deterministic checksum tags", () => {
    expect(verifiedGeographyCieScoreQuestions).toHaveLength(100);

    for (const question of verifiedGeographyCieScoreQuestions) {
      expect(questionSkillTags[question.checksum]).toEqual(
        tagGeographyQuestion(question),
      );
    }
  });

  it("keeps capital region tags mandatory and core/non-obvious mutually exclusive", () => {
    expect(coreCapitalCountryCount).toBe(40);

    for (const question of verifiedGeographyCieScoreQuestions) {
      const tags = questionSkillTags[question.checksum];
      if (question.category !== "capital_cities") continue;

      expect(tags.filter((tag) => capitalRegionNodes.includes(tag))).toHaveLength(1);
      expect(
        tags.includes("geo.capitals.core") &&
          tags.includes("geo.capitals.nonobvious"),
      ).toBe(false);
    }

    expect(questionSkillTags.knowledge_geography_cie_score_v2_001).toEqual([
      "geo.capitals.core",
      "geo.capitals.europe",
    ]);
    expect(questionSkillTags.knowledge_geography_cie_score_v2_002).toEqual([
      "geo.capitals.other",
      "geo.capitals.nonobvious",
    ]);
  });

  it("reserves border reasoning for explicit non-adjacency stems", () => {
    expect(questionSkillTags.knowledge_geography_cie_score_v1_026).toEqual([
      "geo.borders.identify",
    ]);

    const report = validateLearnSkillGraph();
    expect(report.populationByNode["geo.borders.identify"]).toBe(50);
    expect(report.populationByNode["geo.borders.reasoning"]).toBe(0);
  });

  it("passes the additive graph validation gates", () => {
    const report = validateLearnSkillGraph();

    expect(report.acyclic).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.zeroFitQuestions).toHaveLength(0);
    expect(report.orphanNodes).toEqual(["geo.borders.reasoning"]);
  });
});
