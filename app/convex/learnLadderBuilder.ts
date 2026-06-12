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
import { learnHistoryDatesRevealsV1ByChecksum } from "./learnHistoryDatesRevealsV1";
import { learnScienceRecallRevealsV1ByChecksum } from "./learnScienceRecallRevealsV1";
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
// A node is PLAYABLE only when enough of its tagged questions actually carry
// teaching metadata. Tagged-but-reveal-less questions (currently every CIE
// batch question) are NOT shipped into the loop — empty/tautological reveals are
// exactly the quiz-not-learning failure we already fixed, so they keep the node
// in "coming soon" instead.

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
  distractors: LearnModeDistractor[];
  correctReveal: string;
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
  ...learnHistoryDatesRevealsV1ByChecksum,
  ...learnScienceRecallRevealsV1ByChecksum,
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

export function buildLadder(nodeId: SkillNodeId): BuiltLadder {
  const node = skillNodeById[nodeId];
  if (!node) {
    throw new Error(`Unknown skill node ${nodeId}`);
  }

  const tagged = candidatePool.filter((candidate) => candidate.tags.includes(nodeId));

  // Only reveal-carrying questions reach the loop — the readiness rule depends
  // on this so we never ship a "reveal" that just restates the answer.
  const enriched = tagged
    .map((candidate) => ({ candidate, reveal: revealByChecksum[candidate.checksum] }))
    .filter(
      (entry): entry is { candidate: LadderCandidate; reveal: NonNullable<typeof entry.reveal> } =>
        entry.reveal != null && entry.reveal.skillNodes.includes(nodeId),
    );

  const ordered = enriched.sort((left, right) => {
    const byDifficulty =
      DIFFICULTY_RANK[left.candidate.difficulty] -
      DIFFICULTY_RANK[right.candidate.difficulty];
    if (byDifficulty !== 0) return byDifficulty;
    return (left.candidate.ladderIndex ?? 0) - (right.candidate.ladderIndex ?? 0);
  });

  const selected = isPipelineProofNode(node) ? ordered : selectBalancedRungs(ordered);

  const questions: BuiltLadderQuestion[] = selected
    .slice(0, isPipelineProofNode(node) ? selected.length : MAX_LADDER_RUNGS)
    .map((entry, index) => ({
      checksum: entry.candidate.checksum,
      type: entry.candidate.type ?? "mcq",
      question: entry.candidate.question,
      options: entry.candidate.options,
      correctAnswer: entry.candidate.correctAnswer,
      difficulty: entry.candidate.difficulty,
      // Re-index sequentially so the loop's progress bar matches the built order.
      ladderIndex: index + 1,
      distractors: entry.reveal.distractors,
      correctReveal: entry.reveal.correctReveal,
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
      ...(entry.candidate.items
        ? { items: entry.candidate.items }
        : {}),
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
