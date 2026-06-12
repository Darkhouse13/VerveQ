import { describe, expect, it } from "vitest";
import {
  learnHistoryDatesRevealsV1ByChecksum,
  learnHistoryDatesRevealsV1Metadata,
  learnHistoryDatesRevealChecksumsByNode,
  validateLearnHistoryDatesRevealsV1,
} from "../../convex/learnHistoryDatesRevealsV1";
import {
  learnScienceRecallRevealsV1ByChecksum,
  learnScienceRecallRevealsV1Metadata,
  learnScienceRecallRevealChecksumsByNode,
  validateLearnScienceRecallRevealsV1,
} from "../../convex/learnScienceRecallRevealsV1";
import {
  questionSkillTags,
  validateLearnSkillGraph,
} from "../../convex/learnQuestionSkillTags";
import {
  MIN_PLAYABLE_RUNGS,
  buildLadder,
  listSubjectNodeSummaries,
} from "../../convex/learnLadderBuilder";
import type { SkillNodeId } from "../../convex/learnSkillGraph";
import { pickTodaysSessionNode } from "@/lib/learn/todaysSession";

const HISTORY_NODES: SkillNodeId[] = [
  "hist.events.dates",
  "hist.founding.years",
  "hist.chronology",
];
const SCIENCE_NODES: SkillNodeId[] = [
  "sci.elements.symbols",
  "sci.elements.numbers",
  "sci.units.si",
];

describe("history and science reveal layers", () => {
  it("pass their fail-closed derived-only validators with full batch coverage", () => {
    expect(validateLearnHistoryDatesRevealsV1()).toEqual({
      ok: true,
      errors: [],
      revealCount: 50,
    });
    expect(validateLearnScienceRecallRevealsV1()).toEqual({
      ok: true,
      errors: [],
      revealCount: 50,
    });
    expect(learnHistoryDatesRevealsV1Metadata).toMatchObject({
      mode: "learn",
      layer: "checksum_reveals",
      sourceBatchId: "knowledge_history_cie_score_v1",
    });
    expect(learnScienceRecallRevealsV1Metadata).toMatchObject({
      mode: "learn",
      layer: "checksum_reveals",
      sourceBatchId: "knowledge_science_cie_score_v1",
    });
  });

  it("covers every batch question per node with consistent tags", () => {
    const expectedCounts: Record<string, number> = {
      "hist.events.dates": 20,
      "hist.founding.years": 15,
      "hist.chronology": 15,
      "sci.elements.symbols": 18,
      "sci.elements.numbers": 17,
      "sci.units.si": 15,
    };
    const selections: Array<[Record<string, string[]>, Record<string, { skillNodes: SkillNodeId[] }>]> = [
      [learnHistoryDatesRevealChecksumsByNode, learnHistoryDatesRevealsV1ByChecksum],
      [learnScienceRecallRevealChecksumsByNode, learnScienceRecallRevealsV1ByChecksum],
    ];
    for (const [byNode, byChecksum] of selections) {
      for (const [nodeId, checksums] of Object.entries(byNode)) {
        expect(checksums, nodeId).toHaveLength(expectedCounts[nodeId]);
        for (const checksum of checksums) {
          expect(questionSkillTags[checksum]).toContain(nodeId);
          expect(byChecksum[checksum].skillNodes).toContain(nodeId as SkillNodeId);
        }
      }
    }
  });

  it("keeps every reveal sourced, teaching, and derived from batch claims", () => {
    const reveals = {
      ...learnHistoryDatesRevealsV1ByChecksum,
      ...learnScienceRecallRevealsV1ByChecksum,
    };
    for (const [checksum, reveal] of Object.entries(reveals)) {
      expect(reveal.correctReveal, checksum).toMatch(/\.$/);
      expect(reveal.distractors).toHaveLength(3);
      expect(reveal.provenance.verdict).toBe("agree");
      expect(reveal.provenance.authorModel).toBe("anthropic/claude-fable-5");
      expect(reveal.provenance.verifierModel).toBe("openai/gpt-5-codex");
      for (const claim of reveal.provenance.claims) {
        expect(claim.sourceRef, checksum).toMatch(/^wikidata:/);
        expect(claim.volatility).toBe("static");
      }
      for (const distractor of reveal.distractors) {
        expect(distractor.reveal.trim().length, checksum).toBeGreaterThan(0);
      }
    }
  });
});

describe("history and science ladders", () => {
  it("marks every wired node playable and builds full reveal-carrying ladders", () => {
    for (const nodeId of [...HISTORY_NODES, ...SCIENCE_NODES]) {
      const ladder = buildLadder(nodeId);
      expect(ladder.questions.length, nodeId).toBeGreaterThanOrEqual(
        MIN_PLAYABLE_RUNGS,
      );
      expect(ladder.questions).toHaveLength(8);
      for (const rung of ladder.questions) {
        expect(rung.correctReveal.trim().length).toBeGreaterThan(0);
        expect(rung.distractors).toHaveLength(3);
        for (const distractor of rung.distractors) {
          expect(rung.options, `${nodeId} ${rung.checksum}`).toContain(
            distractor.text,
          );
        }
      }
    }
  });

  it("builds a balanced difficulty ramp instead of an all-easy slice", () => {
    for (const nodeId of [...HISTORY_NODES, ...SCIENCE_NODES]) {
      const ladder = buildLadder(nodeId);
      const byDifficulty = ladder.questions.reduce<Record<string, number>>(
        (counts, rung) => ({
          ...counts,
          [rung.difficulty]: (counts[rung.difficulty] ?? 0) + 1,
        }),
        {},
      );
      expect(byDifficulty, nodeId).toEqual({ easy: 3, intermediate: 3, hard: 2 });
      // Presentation order stays easy → hard.
      const ranks = ladder.questions.map((rung) =>
        rung.difficulty === "easy" ? 0 : rung.difficulty === "intermediate" ? 1 : 2,
      );
      expect([...ranks].sort((a, b) => a - b), nodeId).toEqual(ranks);
    }
  });

  it("lists history and science as fully playable subjects", () => {
    for (const subject of ["history", "science"]) {
      const summaries = listSubjectNodeSummaries(subject);
      expect(summaries).toHaveLength(3);
      expect(summaries.every((summary) => summary.playable)).toBe(true);
    }
  });

  it("keeps the cross-subject graph validation gates green", () => {
    const report = validateLearnSkillGraph();
    expect(report.errors).toEqual([]);
    expect(report.acyclic).toBe(true);
    expect(report.zeroFitQuestions).toHaveLength(0);
    expect(report.questionCount).toBe(200);
    expect(report.populationByNode["hist.events.dates"]).toBe(20);
    expect(report.populationByNode["hist.founding.years"]).toBe(15);
    expect(report.populationByNode["hist.chronology"]).toBe(15);
    expect(report.populationByNode["sci.elements.symbols"]).toBe(18);
    expect(report.populationByNode["sci.elements.numbers"]).toBe(17);
    expect(report.populationByNode["sci.units.si"]).toBe(15);
  });
});

describe("today's session playability guard", () => {
  it("never picks a coming-soon node and returns null when nothing is startable", () => {
    expect(
      pickTodaysSessionNode([
        { id: "a", due: 5, state: "learning", playable: false },
        { id: "b", due: 0, state: "untouched", playable: true },
      ]),
    ).toBe("b");
    expect(
      pickTodaysSessionNode([{ id: "a", due: 5, playable: false }]),
    ).toBeNull();
    // Plans that don't carry the flag keep the old behavior.
    expect(pickTodaysSessionNode([{ id: "a" }])).toBe("a");
  });
});
