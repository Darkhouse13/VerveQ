// Shared authoring kit for hand-authored Learn teaching ladders.
//
// A "teaching ladder" is a short easy→hard loop where every rung carries a
// hand-written `correctReveal` (the "why") plus three distractors, each with its
// own `misconception` / `whyChosen` / `reveal`. This is the *opposite* of the
// deleted templated reveal layers: the kit NEVER synthesizes reveal prose — every
// reveal string is authored by hand per rung. The kit only assembles the runtime
// shape the ladder builder consumes and runs a fail-closed validator.
//
// Consumed by learnLadderBuilder.ts:
//   - `<module>Questions`  -> spread into `enrichedLadderQuestions`
//   - `<module>ByChecksum` -> spread into `revealByChecksum`
//
// The three original geography ladder modules predate this kit and are left
// untouched; new ladders (history, science, and the new subjects) use the kit so
// the 18 modules stay uniform and small.

import type { ContentDifficulty, ContentQuestionSeed } from "./lib/contentQa";
import { skillNodeById, type SkillNodeId } from "./learnSkillGraph";
import type { LearnModeDistractor } from "./learnGeographyNonobviousLadderV1";

export type LadderVolatility = "static" | "volatile";
export type LadderVerdict = "pending" | "agree" | "disagree" | "flag";

export type LadderProvenanceClaim = {
  claim: string;
  sourceType: string;
  sourceRef: string;
  retrievedAt: string;
  volatility: LadderVolatility;
};

export type LadderProvenance = {
  claims: LadderProvenanceClaim[];
  authorModel: string;
  verifierModel: string;
  verdict: LadderVerdict;
  batchId: string;
  workUnitId: string;
};

// Authored distractor: text + why it traps + the teaching detour shown when a
// learner picks it. All fields are required for authored ladders (recall drills
// that only need the correctReveal do not use this kit).
export type LadderRawDistractor = {
  text: string;
  misconception: string;
  whyChosen: string;
  reveal: string;
};

export type LadderRawRung = {
  difficulty: ContentDifficulty;
  question: string;
  correctAnswer: string;
  correctReveal: string;
  distractors: [LadderRawDistractor, LadderRawDistractor, LadderRawDistractor];
  // Sourced provenance claims for this rung (the answer fact, each distractor
  // fact, and the teaching-anchor fact). Facts only — never lifted prose.
  claims: LadderProvenanceClaim[];
};

export type LadderModuleConfig = {
  batchId: string;
  workUnitId: string;
  skillNode: SkillNodeId;
  /** Content category / bucket key, e.g. "chemical_element_symbols". */
  category: string;
  retrievedAt: string;
  authorModel: string;
  verifierModel: string;
  verdict?: LadderVerdict;
  sourceType?: string;
  sourceName: string;
  sourceLicense: string;
  rungs: LadderRawRung[];
};

export type LearnLadderModuleQuestion = ContentQuestionSeed & {
  ladderIndex: number;
  skillNodes: SkillNodeId[];
  distractors: LearnModeDistractor[];
  correctReveal: string;
  provenance: LadderProvenance;
};

export type LearnLadderRevealByChecksum = Record<
  string,
  Pick<
    LearnLadderModuleQuestion,
    "skillNodes" | "ladderIndex" | "distractors" | "correctReveal" | "provenance"
  >
>;

export type LearnLadderModule = {
  questions: LearnLadderModuleQuestion[];
  byChecksum: LearnLadderRevealByChecksum;
  metadata: {
    batchId: string;
    mode: "learn";
    workUnitId: string;
    skillNodes: SkillNodeId[];
    category: string;
    sourceType: string;
    sourceName: string;
    sourceLicense: string;
    retrievedAt: string;
    authorModel: string;
    verifierModel: string;
    verdict: LadderVerdict;
    questionCount: number;
    checksumPrefix: string;
  };
  validate: () => { ok: boolean; errors: string[]; questionCount: number };
};

function checksumFor(batchId: string, index: number) {
  return `${batchId}_${String(index + 1).padStart(3, "0")}`;
}

// Deterministically place the correct answer so it is not always in the same
// slot (a position tell) without needing per-rung hand-ordered option arrays.
function optionOrder(correct: string, distractors: string[], index: number) {
  const options = [...distractors];
  const slot = index % (distractors.length + 1);
  options.splice(slot, 0, correct);
  return options;
}

// Tokens (>=4 chars, alphabetic-ish) used by the non-tautology check.
function teachingTokens(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  );
}

// A reveal is a tautology if it introduces no token beyond the question stem and
// the answer — i.e. it can only be restating them. Authored teaching reveals must
// add a real anchor (a date, a root, an origin, a neighbour, a mechanism).
function introducesNewToken(reveal: string, stemPlusAnswer: string): boolean {
  const known = teachingTokens(stemPlusAnswer);
  for (const token of teachingTokens(reveal)) {
    if (!known.has(token)) return true;
  }
  return false;
}

function buildQuestion(
  config: LadderModuleConfig,
  rung: LadderRawRung,
  index: number,
): LearnLadderModuleQuestion {
  const distractorTexts = rung.distractors.map((distractor) => distractor.text);
  const options = optionOrder(rung.correctAnswer, distractorTexts, index);
  return {
    sport: "knowledge",
    category: config.category,
    question: rung.question,
    options,
    correctAnswer: rung.correctAnswer,
    explanation: rung.correctReveal,
    difficulty: rung.difficulty,
    bucket: `knowledge_${rung.difficulty}_${config.category}`,
    checksum: checksumFor(config.batchId, index),
    ladderIndex: index + 1,
    skillNodes: [config.skillNode],
    distractors: rung.distractors.map((distractor) => ({
      text: distractor.text,
      misconception: distractor.misconception,
      whyChosen: distractor.whyChosen,
      reveal: distractor.reveal,
    })),
    correctReveal: rung.correctReveal,
    provenance: {
      claims: rung.claims,
      authorModel: config.authorModel,
      verifierModel: config.verifierModel,
      verdict: config.verdict ?? "agree",
      batchId: config.batchId,
      workUnitId: config.workUnitId,
    },
  };
}

export function buildLearnLadderModule(
  config: LadderModuleConfig,
): LearnLadderModule {
  const questions = config.rungs.map((rung, index) =>
    buildQuestion(config, rung, index),
  );

  const byChecksum = Object.fromEntries(
    questions.map((question) => [
      question.checksum,
      {
        skillNodes: question.skillNodes,
        ladderIndex: question.ladderIndex,
        distractors: question.distractors,
        correctReveal: question.correctReveal,
        provenance: question.provenance,
      },
    ]),
  ) as LearnLadderRevealByChecksum;

  const metadata = {
    batchId: config.batchId,
    mode: "learn" as const,
    workUnitId: config.workUnitId,
    skillNodes: [config.skillNode],
    category: config.category,
    sourceType: config.sourceType ?? "structured_open",
    sourceName: config.sourceName,
    sourceLicense: config.sourceLicense,
    retrievedAt: config.retrievedAt,
    authorModel: config.authorModel,
    verifierModel: config.verifierModel,
    verdict: config.verdict ?? ("agree" as LadderVerdict),
    questionCount: questions.length,
    checksumPrefix: config.batchId,
  };

  function validate() {
    const errors: string[] = [];
    const checksums = new Set<string>();
    const ladderIndexes = new Set<number>();

    if (!skillNodeById[config.skillNode]) {
      errors.push(`unknown skill node ${config.skillNode}`);
    }
    if (config.rungs.length < 4) {
      errors.push(`${config.batchId} needs at least 4 rungs to be playable`);
    }

    questions.forEach((question, index) => {
      const ref = question.checksum;

      if (question.ladderIndex !== index + 1) {
        errors.push(`${ref} has ladderIndex ${question.ladderIndex}`);
      }
      if (ladderIndexes.has(question.ladderIndex)) {
        errors.push(`${ref} duplicates ladderIndex ${question.ladderIndex}`);
      }
      ladderIndexes.add(question.ladderIndex);

      if (checksums.has(ref)) errors.push(`${ref} is duplicated in the batch`);
      checksums.add(ref);

      if (question.options.length !== 4) {
        errors.push(`${ref} must have exactly 4 options`);
      }
      if (!question.options.includes(question.correctAnswer)) {
        errors.push(`${ref} correct answer is not among the options`);
      }
      const normalized = question.options.map((option) =>
        option.trim().toLocaleLowerCase(),
      );
      if (new Set(normalized).size !== normalized.length) {
        errors.push(`${ref} has duplicate options`);
      }

      if (!question.correctReveal.trim()) {
        errors.push(`${ref} is missing correctReveal`);
      }
      const stemPlusAnswer = `${question.question} ${question.correctAnswer}`;
      if (!introducesNewToken(question.correctReveal, stemPlusAnswer)) {
        errors.push(
          `${ref} correctReveal is tautological (adds no token beyond the question and answer)`,
        );
      }

      if (question.distractors.length !== 3) {
        errors.push(`${ref} must have exactly 3 distractors`);
      }
      for (const distractor of question.distractors) {
        if (!question.options.includes(distractor.text)) {
          errors.push(`${ref} distractor ${distractor.text} is not an option`);
        }
        if (distractor.text === question.correctAnswer) {
          errors.push(`${ref} marks the correct answer as a distractor`);
        }
        if (!distractor.misconception.trim()) {
          errors.push(`${ref} distractor ${distractor.text} is missing misconception`);
        }
        if (!distractor.whyChosen.trim()) {
          errors.push(`${ref} distractor ${distractor.text} is missing whyChosen`);
        }
        if (!distractor.reveal.trim()) {
          errors.push(`${ref} distractor ${distractor.text} is missing reveal`);
        }
      }

      if (question.provenance.verdict === "pending") {
        errors.push(`${ref} is still pending verification`);
      }
      if (question.provenance.claims.length === 0) {
        errors.push(`${ref} has no provenance claims`);
      }
    });

    return { ok: errors.length === 0, errors, questionCount: questions.length };
  }

  return { questions, byChecksum, metadata, validate };
}

// Convenience for a rung's provenance claims: names the authoritative source and
// carries the fact as a resolvable claim string (facts only, never source prose).
export function makeClaimFactory(
  retrievedAt: string,
  defaultSourceType = "structured_open",
) {
  return function claim(
    text: string,
    sourceRef: string,
    options?: { sourceType?: string; volatility?: LadderVolatility },
  ): LadderProvenanceClaim {
    return {
      claim: text,
      sourceType: options?.sourceType ?? defaultSourceType,
      sourceRef,
      retrievedAt,
      volatility: options?.volatility ?? "static",
    };
  };
}
