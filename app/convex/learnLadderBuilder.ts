import {
  isPipelineProofNode,
  skillNodeById,
  skillNodes,
  type SkillNode,
  type SkillNodeId,
} from "./learnSkillGraph";
import {
  questionSkillTags,
  verifiedLearnCieScoreQuestions,
} from "./learnQuestionSkillTags";
import {
  learnGeographyNonobviousLadderV1ByChecksum,
  learnGeographyNonobviousLadderV1Questions,
  type LearnModeDistractor,
} from "./learnGeographyNonobviousLadderV1";
import {
  learnGeographyBorderReasoningLadderV1ByChecksum,
  learnGeographyBorderReasoningLadderV1Questions,
} from "./learnGeographyBorderReasoningLadderV1";
import { learnGeographyCapitalsRecallRevealsV1ByChecksum } from "./learnGeographyCapitalsRecallRevealsV1";
import {
  LEARN_GEOGRAPHY_PIPELINE_PROOF_CONCEPT,
  learnGeographyPipelineProofLadderV1ByChecksum,
  learnGeographyPipelineProofLadderV1Questions,
  type LearnOrderRenderItem,
} from "./learnGeographyPipelineProofLadderV1";
import type { LearnQuestionType } from "./learnGraders";

// Graph-driven Learn ladder builder.
//
// Given a skill node, this assembles a playable ladder by:
//   1. pulling every candidate question tagged to that node (graph tags live in
//      learnQuestionSkillTags.ts / learnSkillGraph.ts),
//   2. attaching learn-mode teaching metadata (per-distractor reveals +
//      correctReveal) BY CHECKSUM where it exists, and
//   3. ordering easy -> intermediate -> hard and capping the rung count.
//
// Teaching reveals are OPTIONAL enrichment, not a ship gate. A node ships in one
// of two shapes, never a mix:
//   - CURATED ladder: if any tagged question carries a hand-authored reveal, the
//     ladder is built from those reveal-carrying questions only (the teach
//     content is the point — we don't dilute it with bare drills).
//   - RECALL DRILL: if NO tagged question carries a reveal, the node still ships
//     as an honest spaced-repetition drill (questions only, no teach card). The
//     grader surfaces the correct answer on a miss so the drill is learnable.
// Playability is simply "enough questions to build a loop" (MIN_PLAYABLE_RUNGS),
// which is why reveal-less nodes (e.g. geo.borders.identify, the science/history
// recall nodes) are now playable drills instead of dead "coming soon" entries.
// The old tautological CIE recall-reveal layers were removed precisely because a
// reveal that restates the answer is the quiz-not-learning failure — an honest
// drill beats a fake teach card.

type Difficulty = "easy" | "intermediate" | "hard";

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  easy: 0,
  intermediate: 1,
  hard: 2,
};

// A node needs at least this many reveal-carrying rungs to be playable, and a
// built ladder is capped at the max so it stays a short, focused loop.
export const MIN_PLAYABLE_RUNGS = 4;
export const MAX_LADDER_RUNGS = 8;

export type BuiltLadderQuestion = {
  checksum: string;
  type: LearnQuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: Difficulty;
  ladderIndex: number;
  /** Teaching metadata — present on curated reveal rungs, absent on drill rungs. */
  distractors?: LearnModeDistractor[];
  correctReveal?: string;
  acceptedAnswers?: string[];
  textEditDistance?: number;
  numericAnswer?: number;
  numericTolerance?: number;
  numericUnit?: string;
  acceptedUnits?: string[];
  items?: LearnOrderRenderItem[];
  correctOrder?: string[];
};

export type BuiltLadder = {
  nodeId: SkillNodeId;
  node: SkillNode;
  conceptLine: string;
  questions: BuiltLadderQuestion[];
};

export type LearnNodeSummary = {
  nodeId: SkillNodeId;
  node: SkillNode;
  playable: boolean;
  rungCount: number;
  taggedCount: number;
};

// One-line "what you learned" framing per node, shown on the end card. Falls
// back to the node description for nodes that don't have bespoke copy yet.
const CONCEPT_LINE_BY_NODE: Partial<Record<SkillNodeId, string>> = {
  "geo.capitals.nonobvious":
    "A country's capital is often not its biggest or most famous city — it's frequently planned or relocated.",
  "geo.pipeline.proof": LEARN_GEOGRAPHY_PIPELINE_PROOF_CONCEPT,
  "hist.events.dates":
    "A year sticks when it's anchored to the exact day the event turned — not memorized as a bare number.",
  "hist.founding.years":
    "Institutions have birthdays: tie each founding year to its founding date and the era around it.",
  "hist.chronology":
    "Ordering beats memorizing — placing events relative to each other is how timelines actually stick.",
  "sci.elements.symbols":
    "Element symbols aren't always the English initials — pairing each symbol with its atomic number locks both in.",
  "sci.elements.numbers":
    "The atomic number is the element's address on the periodic table — neighbors are the classic traps.",
  "sci.units.si":
    "SI symbols are exact: knowing whether a unit is a base unit or a special name makes the symbol memorable.",
};

function conceptLineFor(node: SkillNode): string {
  return CONCEPT_LINE_BY_NODE[node.id] ?? node.description;
}

type LadderCandidate = {
  checksum: string;
  type?: LearnQuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: Difficulty;
  tags: SkillNodeId[];
  ladderIndex?: number;
  acceptedAnswers?: string[];
  textEditDistance?: number;
  numericAnswer?: number;
  numericTolerance?: number;
  numericUnit?: string;
  acceptedUnits?: string[];
  items?: LearnOrderRenderItem[];
  correctOrder?: string[];
};

type LearnQuestionGradingMetadata = Pick<
  LadderCandidate,
  | "type"
  | "acceptedAnswers"
  | "textEditDistance"
  | "numericAnswer"
  | "numericTolerance"
  | "numericUnit"
  | "acceptedUnits"
  | "items"
  | "correctOrder"
>;

function gradingMetadata(
  question: Partial<LearnQuestionGradingMetadata>,
): LearnQuestionGradingMetadata {
  return {
    ...(question.type ? { type: question.type } : {}),
    ...(question.acceptedAnswers ? { acceptedAnswers: question.acceptedAnswers } : {}),
    ...(question.textEditDistance !== undefined
      ? { textEditDistance: question.textEditDistance }
      : {}),
    ...(question.numericAnswer !== undefined
      ? { numericAnswer: question.numericAnswer }
      : {}),
    ...(question.numericTolerance !== undefined
      ? { numericTolerance: question.numericTolerance }
      : {}),
    ...(question.numericUnit ? { numericUnit: question.numericUnit } : {}),
    ...(question.acceptedUnits ? { acceptedUnits: question.acceptedUnits } : {}),
    ...(question.items ? { items: question.items } : {}),
    ...(question.correctOrder ? { correctOrder: question.correctOrder } : {}),
  };
}

// Reveal metadata keyed by checksum. A reveal also declares which node(s) it was
// authored for, so recall-only CIE reveals do not leak into concept ladders that
// share the same base question tags.
const revealByChecksum = {
  ...learnGeographyNonobviousLadderV1ByChecksum,
  ...learnGeographyBorderReasoningLadderV1ByChecksum,
  ...learnGeographyCapitalsRecallRevealsV1ByChecksum,
  ...learnGeographyPipelineProofLadderV1ByChecksum,
};

// Candidate pool = every learn-eligible question we can tag, from the enriched
// ladder modules and the verified CIE batches. Reveals are looked up separately
// by checksum so the pool stays source-agnostic.
const enrichedLadderQuestions = [
  ...learnGeographyNonobviousLadderV1Questions,
  ...learnGeographyBorderReasoningLadderV1Questions,
  ...learnGeographyPipelineProofLadderV1Questions,
];

const ladderCandidates: LadderCandidate[] = enrichedLadderQuestions.map(
  (question) => ({
    checksum: question.checksum,
    ...gradingMetadata(question as Partial<LearnQuestionGradingMetadata>),
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    difficulty: question.difficulty,
    tags: question.skillNodes,
    ladderIndex: question.ladderIndex,
  }),
);

const cieCandidates: LadderCandidate[] = verifiedLearnCieScoreQuestions.map(
  (question) => ({
    checksum: question.checksum,
    ...gradingMetadata(question as Partial<LearnQuestionGradingMetadata>),
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    difficulty: question.difficulty,
    tags: questionSkillTags[question.checksum] ?? [],
  }),
);

const candidatePool: LadderCandidate[] = [...ladderCandidates, ...cieCandidates];

// When more reveal-carrying questions exist than fit one ladder, a plain
// difficulty-sorted slice would build an all-easy session. Keep the ladder a
// real ramp instead: a fixed easy→intermediate→hard mix, backfilled in sorted
// order when a difficulty bucket runs short.
const LADDER_DIFFICULTY_MIX: Record<Difficulty, number> = {
  easy: 3,
  intermediate: 3,
  hard: 2,
};

function selectBalancedRungs<T extends { candidate: { difficulty: Difficulty } }>(
  ordered: T[],
): T[] {
  if (ordered.length <= MAX_LADDER_RUNGS) return ordered;
  const picked = new Set<T>();
  for (const difficulty of ["easy", "intermediate", "hard"] as const) {
    let remaining = LADDER_DIFFICULTY_MIX[difficulty];
    for (const entry of ordered) {
      if (remaining === 0) break;
      if (entry.candidate.difficulty !== difficulty) continue;
      picked.add(entry);
      remaining -= 1;
    }
  }
  for (const entry of ordered) {
    if (picked.size >= MAX_LADDER_RUNGS) break;
    picked.add(entry);
  }
  // Filtering `ordered` keeps the easy → hard presentation order.
  return ordered.filter((entry) => picked.has(entry));
}

type LadderEntry = {
  candidate: LadderCandidate;
  reveal: (typeof revealByChecksum)[string] | undefined;
};

function orderByDifficulty(entries: LadderEntry[]): LadderEntry[] {
  return entries.sort((left, right) => {
    const byDifficulty =
      DIFFICULTY_RANK[left.candidate.difficulty] -
      DIFFICULTY_RANK[right.candidate.difficulty];
    if (byDifficulty !== 0) return byDifficulty;
    return (left.candidate.ladderIndex ?? 0) - (right.candidate.ladderIndex ?? 0);
  });
}

export function buildLadder(nodeId: SkillNodeId): BuiltLadder {
  const node = skillNodeById[nodeId];
  if (!node) {
    throw new Error(`Unknown skill node ${nodeId}`);
  }

  const tagged = candidatePool.filter((candidate) => candidate.tags.includes(nodeId));

  // Attach a reveal where one exists AND was authored for this node, so recall
  // reveals don't leak into concept ladders that share base-question tags.
  const entries: LadderEntry[] = tagged.map((candidate) => {
    const reveal = revealByChecksum[candidate.checksum];
    return {
      candidate,
      reveal: reveal != null && reveal.skillNodes.includes(nodeId) ? reveal : undefined,
    };
  });

  const revealCarrying = orderByDifficulty(entries.filter((entry) => entry.reveal != null));
  const drills = orderByDifficulty(entries.filter((entry) => entry.reveal == null));

  // Curated-or-drill, never mixed (see header). Pipeline-proof ships every rung;
  // a node with reveals ships its reveal rungs; otherwise it ships a recall drill.
  let selected: LadderEntry[];
  if (isPipelineProofNode(node)) {
    selected = revealCarrying;
  } else if (revealCarrying.length > 0) {
    selected = selectBalancedRungs(revealCarrying).slice(0, MAX_LADDER_RUNGS);
  } else {
    selected = selectBalancedRungs(drills).slice(0, MAX_LADDER_RUNGS);
  }

  const questions: BuiltLadderQuestion[] = selected.map((entry, index) => ({
    checksum: entry.candidate.checksum,
    type: entry.candidate.type ?? "mcq",
    question: entry.candidate.question,
    options: entry.candidate.options,
    correctAnswer: entry.candidate.correctAnswer,
    difficulty: entry.candidate.difficulty,
    // Re-index sequentially so the loop's progress bar matches the built order.
    ladderIndex: index + 1,
    // Teaching metadata only when the rung actually carries a reveal; drill rungs
    // ship without it and the grader reveals the answer on a miss instead.
    ...(entry.reveal
      ? {
          distractors: entry.reveal.distractors,
          correctReveal: entry.reveal.correctReveal,
        }
      : {}),
    ...(entry.candidate.acceptedAnswers
      ? { acceptedAnswers: entry.candidate.acceptedAnswers }
      : {}),
    ...(entry.candidate.textEditDistance !== undefined
      ? { textEditDistance: entry.candidate.textEditDistance }
      : {}),
    ...(entry.candidate.numericAnswer !== undefined
      ? { numericAnswer: entry.candidate.numericAnswer }
      : {}),
    ...(entry.candidate.numericTolerance !== undefined
      ? { numericTolerance: entry.candidate.numericTolerance }
      : {}),
    ...(entry.candidate.numericUnit
      ? { numericUnit: entry.candidate.numericUnit }
      : {}),
    ...(entry.candidate.acceptedUnits
      ? { acceptedUnits: entry.candidate.acceptedUnits }
      : {}),
    ...(entry.candidate.items ? { items: entry.candidate.items } : {}),
    ...(entry.candidate.correctOrder
      ? { correctOrder: entry.candidate.correctOrder }
      : {}),
  }));

  return {
    nodeId,
    node,
    conceptLine: conceptLineFor(node),
    questions,
  };
}

export function getLearnNodeSummary(nodeId: SkillNodeId): LearnNodeSummary {
  const node = skillNodeById[nodeId];
  const taggedCount = candidatePool.filter((candidate) =>
    candidate.tags.includes(nodeId),
  ).length;
  const ladder = buildLadder(nodeId);
  return {
    nodeId,
    node,
    rungCount: ladder.questions.length,
    taggedCount,
    playable: ladder.questions.length >= MIN_PLAYABLE_RUNGS,
  };
}

// Every serving surface (queries, pickers, the subject switcher) lists a
// subject's nodes through here; pipeline-proof fixtures never leave the graph.
export function listSubjectNodeSummaries(subject: string): LearnNodeSummary[] {
  return skillNodes
    .filter((node) => node.subject === subject && !isPipelineProofNode(node))
    .map((node) => getLearnNodeSummary(node.id));
}
