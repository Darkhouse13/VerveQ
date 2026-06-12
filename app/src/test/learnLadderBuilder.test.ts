import { describe, expect, it } from "vitest";
import {
  MAX_LADDER_RUNGS,
  MIN_PLAYABLE_RUNGS,
  buildLadder,
  listSubjectNodeSummaries,
} from "../../convex/learnLadderBuilder";
import { learnGeographyNonobviousLadderV1Questions } from "../../convex/learnGeographyNonobviousLadderV1";
import { learnGeographyBorderReasoningLadderV1Questions } from "../../convex/learnGeographyBorderReasoningLadderV1";
import { learnGeographyCapitalsRecallSelectedChecksumsByNode } from "../../convex/learnGeographyCapitalsRecallRevealsV1";

const DIFFICULTY_RANK = { easy: 0, intermediate: 1, hard: 2 } as const;

describe("learn ladder builder", () => {
  it("builds the non-obvious capitals ladder from the graph node, with reveals", () => {
    const ladder = buildLadder("geo.capitals.nonobvious");

    // Reaches the loop through node -> builder, not a hardcoded import.
    expect(ladder.questions.length).toBe(
      learnGeographyNonobviousLadderV1Questions.length,
    );
    expect(ladder.questions.length).toBeLessThanOrEqual(MAX_LADDER_RUNGS);

    // Every rung carries teaching metadata.
    for (const rung of ladder.questions) {
      expect(rung.correctReveal.trim().length).toBeGreaterThan(0);
      expect(rung.distractors.length).toBe(3);
      for (const distractor of rung.distractors) {
        expect(rung.options).toContain(distractor.text);
        expect(distractor.reveal.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("builds the border-reasoning ladder from its graph node, with reveals", () => {
    const ladder = buildLadder("geo.borders.reasoning");
    expect(ladder.questions.length).toBe(
      learnGeographyBorderReasoningLadderV1Questions.length,
    );
    expect(ladder.questions.length).toBeLessThanOrEqual(MAX_LADDER_RUNGS);
    for (const rung of ladder.questions) {
      expect(rung.correctReveal.trim().length).toBeGreaterThan(0);
      expect(rung.distractors.length).toBe(3);
    }
  });

  it("builds the capital recall ladders from checksum-scoped CIE reveals", () => {
    for (const [nodeId, expectedChecksums] of Object.entries(
      learnGeographyCapitalsRecallSelectedChecksumsByNode,
    )) {
      const ladder = buildLadder(nodeId as keyof typeof learnGeographyCapitalsRecallSelectedChecksumsByNode);

      expect(ladder.questions.map((question) => question.checksum)).toEqual(
        expectedChecksums,
      );
      expect(ladder.questions).toHaveLength(8);
      for (const rung of ladder.questions) {
        expect(rung.correctReveal.trim().length).toBeGreaterThan(0);
        expect(rung.distractors).toHaveLength(3);
        for (const distractor of rung.distractors) {
          expect(rung.options).toContain(distractor.text);
          expect(distractor.reveal.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("builds the clearly marked pipeline-proof ladder with all four rung types", () => {
    const ladder = buildLadder("geo.pipeline.proof");

    expect(ladder.conceptLine).toContain("Pipeline-proof fixture");
    expect(ladder.questions.map((question) => question.type)).toEqual([
      "mcq",
      "text",
      "text",
      "text",
      "numeric",
      "numeric",
      "numeric",
      "order",
      "order",
      "order",
    ]);
    expect(ladder.questions.filter((question) => question.type === "text")).toHaveLength(3);
    expect(ladder.questions.filter((question) => question.type === "numeric")).toHaveLength(3);
    expect(ladder.questions.filter((question) => question.type === "order")).toHaveLength(3);
    expect(ladder.questions.find((question) => question.type === "order")).toEqual(
      expect.objectContaining({
        items: expect.any(Array),
        correctOrder: expect.any(Array),
      }),
    );
  });

  it("keeps the pipeline-proof fixture out of normal geography node lists", () => {
    expect(
      listSubjectNodeSummaries("geography").map((summary) => summary.nodeId),
    ).not.toContain("geo.pipeline.proof");
  });

  it("orders rungs easy -> intermediate -> hard and re-indexes sequentially", () => {
    const ladder = buildLadder("geo.capitals.nonobvious");
    for (let i = 1; i < ladder.questions.length; i += 1) {
      expect(ladder.questions[i].ladderIndex).toBe(i + 1);
      expect(
        DIFFICULTY_RANK[ladder.questions[i].difficulty],
      ).toBeGreaterThanOrEqual(DIFFICULTY_RANK[ladder.questions[i - 1].difficulty]);
    }
  });

  it("marks only nodes with reveal-carrying questions as playable", () => {
    const summaries = listSubjectNodeSummaries("geography");
    const playable = summaries.filter((summary) => summary.playable);

    // Recall-capital nodes, non-obvious capitals, and border reasoning qualify.
    expect(playable.map((summary) => summary.nodeId)).toEqual([
      "geo.capitals.core",
      "geo.capitals.europe",
      "geo.capitals.asia",
      "geo.capitals.other",
      "geo.capitals.nonobvious",
      "geo.borders.reasoning",
    ]);

    for (const summary of summaries) {
      if (summary.playable) {
        expect(summary.rungCount).toBeGreaterThanOrEqual(MIN_PLAYABLE_RUNGS);
      } else {
        // Coming-soon nodes can still be tagged; they just lack teaching reveals.
        expect(summary.rungCount).toBeLessThan(MIN_PLAYABLE_RUNGS);
      }
    }

    // The picker lists exactly the 7 geography nodes from the graph.
    expect(summaries).toHaveLength(7);
  });
});
