import { describe, expect, it } from "vitest";
import {
  learnGeographyCapitalsRecallRevealsV1ByChecksum,
  learnGeographyCapitalsRecallRevealsV1Metadata,
  learnGeographyCapitalsRecallSelectedChecksumsByNode,
  validateLearnGeographyCapitalsRecallRevealsV1,
} from "../../convex/learnGeographyCapitalsRecallRevealsV1";
import { questionSkillTags } from "../../convex/learnQuestionSkillTags";

describe("learn geography capital recall reveals v1", () => {
  it("is a pending verification reveal layer over existing CIE checksums", () => {
    const report = validateLearnGeographyCapitalsRecallRevealsV1();

    expect(report).toMatchObject({
      ok: true,
      errors: [],
      revealCount: 24,
    });
    expect(learnGeographyCapitalsRecallRevealsV1Metadata).toMatchObject({
      mode: "learn",
      layer: "checksum_reveals",
      verdict: "pending",
      verifierModel: "pending_anthropic_verification",
    });
  });

  it("selects only questions already tagged to each recall node", () => {
    for (const [nodeId, checksums] of Object.entries(
      learnGeographyCapitalsRecallSelectedChecksumsByNode,
    )) {
      expect(checksums).toHaveLength(8);

      for (const checksum of checksums) {
        expect(questionSkillTags[checksum]).toContain(nodeId);
        expect(
          learnGeographyCapitalsRecallRevealsV1ByChecksum[checksum].skillNodes,
        ).toContain(nodeId);
      }
    }
  });

  it("keeps each recall reveal sourced and lightweight", () => {
    for (const [checksum, reveal] of Object.entries(
      learnGeographyCapitalsRecallRevealsV1ByChecksum,
    )) {
      expect(reveal.correctReveal).toMatch(/\.$/);
      expect(reveal.distractors).toHaveLength(3);
      expect(reveal.provenance.verdict).toBe("pending");
      expect(reveal.provenance.verifierModel).toBe(
        "pending_anthropic_verification",
      );
      expect(
        reveal.provenance.claims.some((claim) => !claim.claim.startsWith("capital_of(")),
        checksum,
      ).toBe(true);
      for (const claim of reveal.provenance.claims) {
        expect(claim.sourceType).toBe("structured_open");
        expect(claim.sourceRef).toMatch(/^wikidata:/);
        expect(claim.volatility).toBe("static");
      }
    }
  });
});
