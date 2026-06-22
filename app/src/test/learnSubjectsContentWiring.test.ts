import { describe, expect, it } from "vitest";
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

describe("history and science recall drills", () => {
  // The tautological CIE recall-reveal layers were removed. These nodes now ship
  // as honest spaced-repetition drills — questions only, no fake teach card. The
  // candidate population is unchanged; only the reveal overlay went away.
  it("marks every wired node playable and builds full drill ladders without reveals", () => {
    for (const nodeId of [...HISTORY_NODES, ...SCIENCE_NODES]) {
      const ladder = buildLadder(nodeId);
      expect(ladder.questions.length, nodeId).toBeGreaterThanOrEqual(
        MIN_PLAYABLE_RUNGS,
      );
      expect(ladder.questions).toHaveLength(8);
      for (const rung of ladder.questions) {
        expect(rung.type, `${nodeId} ${rung.checksum}`).toBe("mcq");
        expect(rung.options.length).toBeGreaterThan(0);
        // Drill rungs carry no teaching metadata.
        expect(rung.correctReveal, `${nodeId} ${rung.checksum}`).toBeUndefined();
        expect(rung.distractors, `${nodeId} ${rung.checksum}`).toBeUndefined();
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

  it("draws every drill rung from a question already tagged to its node", () => {
    for (const nodeId of [...HISTORY_NODES, ...SCIENCE_NODES]) {
      const ladder = buildLadder(nodeId);
      for (const rung of ladder.questions) {
        expect(
          questionSkillTags[rung.checksum],
          `${nodeId} ${rung.checksum}`,
        ).toContain(nodeId);
      }
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
