import {
  skillNodeById,
  skillNodes,
  type SkillNode,
  type SkillNodeId,
} from "./learnSkillGraph";
import {
  questionSkillTags,
  verifiedGeographyCieScoreQuestions,
} from "./learnQuestionSkillTags";
import {
  learnGeographyNonobviousLadderV1ByChecksum,
  learnGeographyNonobviousLadderV1Questions,
  type LearnModeDistractor,
} from "./learnGeographyNonobviousLadderV1";

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
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: Difficulty;
  ladderIndex: number;
  distractors: LearnModeDistractor[];
  correctReveal: string;
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
};

function conceptLineFor(node: SkillNode): string {
  return CONCEPT_LINE_BY_NODE[node.id] ?? node.description;
}

type LadderCandidate = {
  checksum: string;
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: Difficulty;
  tags: SkillNodeId[];
  ladderIndex?: number;
};

// Reveal metadata keyed by checksum. Currently only the non-obvious capitals
// ladder is enriched; other sources resolve to `undefined` here and stay
// reveal-less until they're authored.
const revealByChecksum = learnGeographyNonobviousLadderV1ByChecksum;

// Candidate pool = every learn-eligible question we can tag, from both the
// enriched ladder module and the verified CIE batches. Reveals are looked up
// separately by checksum so the pool stays source-agnostic.
const ladderCandidates: LadderCandidate[] = learnGeographyNonobviousLadderV1Questions.map(
  (question) => ({
    checksum: question.checksum,
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    difficulty: question.difficulty,
    tags: question.skillNodes,
    ladderIndex: question.ladderIndex,
  }),
);

const cieCandidates: LadderCandidate[] = verifiedGeographyCieScoreQuestions.map(
  (question) => ({
    checksum: question.checksum,
    question: question.question,
    options: question.options,
    correctAnswer: question.correctAnswer,
    difficulty: question.difficulty,
    tags: questionSkillTags[question.checksum] ?? [],
  }),
);

const candidatePool: LadderCandidate[] = [...ladderCandidates, ...cieCandidates];

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
        entry.reveal != null,
    );

  const ordered = enriched.sort((left, right) => {
    const byDifficulty =
      DIFFICULTY_RANK[left.candidate.difficulty] -
      DIFFICULTY_RANK[right.candidate.difficulty];
    if (byDifficulty !== 0) return byDifficulty;
    return (left.candidate.ladderIndex ?? 0) - (right.candidate.ladderIndex ?? 0);
  });

  const questions: BuiltLadderQuestion[] = ordered
    .slice(0, MAX_LADDER_RUNGS)
    .map((entry, index) => ({
      checksum: entry.candidate.checksum,
      question: entry.candidate.question,
      options: entry.candidate.options,
      correctAnswer: entry.candidate.correctAnswer,
      difficulty: entry.candidate.difficulty,
      // Re-index sequentially so the loop's progress bar matches the built order.
      ladderIndex: index + 1,
      distractors: entry.reveal.distractors,
      correctReveal: entry.reveal.correctReveal,
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

// Geography is the only subject in the graph today; the picker reads this list.
export function listGeographyNodeSummaries(): LearnNodeSummary[] {
  return skillNodes
    .filter((node) => node.subject === "geography")
    .map((node) => getLearnNodeSummary(node.id));
}
