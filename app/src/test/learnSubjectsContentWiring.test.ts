import { describe, expect, it } from "vitest";
import { validateLearnSkillGraph } from "../../convex/learnQuestionSkillTags";
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

describe("history and science teaching ladders", () => {
  // The bare recall drills were replaced by hand-authored teaching ladders: every
  // rung now carries a unique correctReveal + three distractors with their own
  // reveal (the "actual content work" TODO from the reveal overhaul). The CIE
  // candidate population is unchanged; the authored reveal-carrying rungs win the
  // curated-or-drill selection, so these nodes now ship curated.
  it("marks every wired node playable and builds curated ladders with reveals", () => {
    for (const nodeId of [...HISTORY_NODES, ...SCIENCE_NODES]) {
      const ladder = buildLadder(nodeId);
      expect(ladder.questions.length, nodeId).toBeGreaterThanOrEqual(
        MIN_PLAYABLE_RUNGS,
      );
      expect(ladder.questions, nodeId).toHaveLength(7);
      for (const rung of ladder.questions) {
        expect(rung.type, `${nodeId} ${rung.checksum}`).toBe("mcq");
        expect(rung.options, `${nodeId} ${rung.checksum}`).toHaveLength(4);
        // Curated teaching rungs carry a hand-authored reveal + 3 distractor reveals.
        expect(
          (rung.correctReveal ?? "").trim().length,
          `${nodeId} ${rung.checksum}`,
        ).toBeGreaterThan(0);
        expect(rung.distractors ?? [], `${nodeId} ${rung.checksum}`).toHaveLength(3);
        for (const distractor of rung.distractors ?? []) {
          expect(rung.options, `${nodeId} ${rung.checksum}`).toContain(distractor.text);
          expect(
            (distractor.reveal ?? "").trim().length,
            `${nodeId} ${rung.checksum}`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("builds an easy -> hard ramp with every difficulty present", () => {
    for (const nodeId of [...HISTORY_NODES, ...SCIENCE_NODES]) {
      const ladder = buildLadder(nodeId);
      const byDifficulty = ladder.questions.reduce<Record<string, number>>(
        (counts, rung) => ({
          ...counts,
          [rung.difficulty]: (counts[rung.difficulty] ?? 0) + 1,
        }),
        {},
      );
      expect(byDifficulty.easy ?? 0, nodeId).toBeGreaterThan(0);
      expect(byDifficulty.intermediate ?? 0, nodeId).toBeGreaterThan(0);
      expect(byDifficulty.hard ?? 0, nodeId).toBeGreaterThan(0);
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
