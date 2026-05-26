import { describe, expect, it } from "vitest";
import {
  knowledgeGeographyCieScoreBatchV1Questions,
} from "../../convex/knowledgeGeographyCieScoreBatchV1";
import {
  knowledgeGeographyCieScoreBatchV2Questions,
} from "../../convex/knowledgeGeographyCieScoreBatchV2";
import {
  learnGeographyNonobviousLadderV1ByChecksum,
  learnGeographyNonobviousLadderV1Metadata,
  learnGeographyNonobviousLadderV1Questions,
  validateLearnGeographyNonobviousLadderV1,
} from "../../convex/learnGeographyNonobviousLadderV1";
import { knowledgeQuestions } from "../../convex/knowledgeQuestions";
import { validateContentBatch } from "../../convex/lib/contentQa";

describe("learn geography non-obvious capitals ladder v1", () => {
  it("is a seven-rung additive Learn-mode ladder with complete teaching metadata", () => {
    const report = validateLearnGeographyNonobviousLadderV1();

    expect(report).toMatchObject({
      ok: true,
      errors: [],
      questionCount: 7,
    });
    expect(learnGeographyNonobviousLadderV1Metadata).toMatchObject({
      mode: "learn",
      verdict: "pending",
      verifierModel: "pending_anthropic_verification",
      skillNodes: ["geo.capitals.nonobvious"],
    });

    learnGeographyNonobviousLadderV1Questions.forEach((question, index) => {
      expect(question.ladderIndex).toBe(index + 1);
      expect(question.skillNodes).toEqual(["geo.capitals.nonobvious"]);
      expect(question.correctReveal).toBeTruthy();
      expect(question.distractors).toHaveLength(3);
      question.distractors.forEach((distractor) => {
        expect(distractor.text).toBeTruthy();
        expect(distractor.misconception).toBeTruthy();
        expect(distractor.whyChosen).toBeTruthy();
        expect(distractor.reveal).toBeTruthy();
      });
      expect(learnGeographyNonobviousLadderV1ByChecksum[question.checksum]).toBeTruthy();
    });
  });

  it("keeps the ladder checksums distinct from existing committed content", () => {
    const existingChecksums = new Set(
      [
        ...knowledgeQuestions,
        ...knowledgeGeographyCieScoreBatchV1Questions,
        ...knowledgeGeographyCieScoreBatchV2Questions,
      ].map((question) => question.checksum),
    );

    for (const question of learnGeographyNonobviousLadderV1Questions) {
      expect(existingChecksums.has(question.checksum), question.checksum).toBe(false);
    }
  });

  it("passes standard content QA against existing committed content", () => {
    const existingChecksums = [
      ...knowledgeQuestions,
      ...knowledgeGeographyCieScoreBatchV1Questions,
      ...knowledgeGeographyCieScoreBatchV2Questions,
    ].map((question) => question.checksum);

    const report = validateContentBatch(learnGeographyNonobviousLadderV1Questions, {
      existingChecksums,
    });

    expect(report.rollup.bySeverity.ERROR).toBe(0);
    expect(report.ok).toBe(true);
  });
});
