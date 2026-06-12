import {
  arenaCategoryForCieQuestion,
  cieQuestionShape,
  cieScoreBatchRegistry,
  type ArenaRotatingCategory,
  type CieScoreBatchRegistryEntry,
  type CieScoreProvenance,
  type CieScoreQuestion,
  type CieShape,
  type CieSubject,
} from "./knowledgeCieScoreBatchRegistry";
import {
  challengeArenaCapitalCityQuestions,
  challengeArenaEnterpriseLogoQuestions,
  type ChallengeArenaQuestionSeed,
} from "./challengeArenaContent";
import { knowledgeQuestions } from "./knowledgeQuestions";
import { contentDuplicateKey } from "./lib/contentQa";

// Arena-only compete seeding for CIE score batches.
//
// Rows produced here carry sport ARENA_CIE_SPORT — a value no quiz, blitz,
// daily, duel, or live-match selection ever queries (those paths all filter
// quizQuestions by an exact product sport: football/basketball/tennis/
// knowledge). Challenge Arena round selection explicitly adds an
// ARENA_CIE_SPORT scope, which is the ONLY read path for these rows.
export const ARENA_CIE_SPORT = "arena_knowledge";

export type ArenaCieQuestionSeed = ChallengeArenaQuestionSeed & {
  provenance: CieScoreProvenance;
};

export type ArenaCieExclusionReason =
  | "registry_ineligible"
  | "batch_verdict_not_agree"
  | "question_verdict_not_agree"
  | "verifier_not_cross_family"
  | "non_static_volatility"
  | "unsupported_shape"
  | "duplicate_checksum_in_plan"
  | "duplicate_prompt_answer_in_plan"
  | "exact_duplicate_of_bundled_row";

export type ArenaCieExclusion = {
  batchId: string;
  checksum: string;
  reason: ArenaCieExclusionReason;
};

export type ArenaCiePlannedRow = {
  subject: CieSubject;
  shape: CieShape;
  arenaCategory: ArenaRotatingCategory;
  seed: ArenaCieQuestionSeed;
};

export type ArenaCieSeedPlan = {
  rows: ArenaCiePlannedRow[];
  exclusions: ArenaCieExclusion[];
  totals: {
    registeredQuestions: number;
    planned: number;
    excluded: number;
    plannedBySubject: Record<string, number>;
    plannedByShape: Record<string, number>;
    plannedByArenaCategory: Record<string, number>;
    excludedByReason: Record<string, number>;
  };
};

const ARENA_LIVE_SHAPES: ReadonlySet<CieShape> = new Set([
  "mcq",
  "which_came_first",
  "logo_text",
]);

function isAnswerableMcqSeed(question: CieScoreQuestion) {
  return (
    question.options.length >= 2 &&
    question.options.includes(question.correctAnswer)
  );
}

function hasCrossFamilyVerifier(verifierModel: string | undefined) {
  return !!verifierModel && verifierModel !== "pending_anthropic_verification";
}

function hasOnlyStaticClaims(provenance: CieScoreProvenance) {
  return (
    provenance.claims.length > 0 &&
    provenance.claims.every((claim) => claim.volatility === "static")
  );
}

function supportedShape(question: CieScoreQuestion): CieShape | null {
  const shape = cieQuestionShape(question);
  if (!ARENA_LIVE_SHAPES.has(shape)) return null;
  if (shape === "logo_text") {
    // CIE batches do not author logo rows; without a bundled imageUrl a
    // logo_text row cannot render, so it is not a supported seed shape.
    return null;
  }
  if (!isAnswerableMcqSeed(question)) return null;
  return shape;
}

// Repo-known knowledge-sport content: the seeded aggregate plus the two
// bundled Arena sets that are generated outside the aggregate. Any new row
// whose normalized prompt+answer collides with one of these would be an
// EXACT_DUPLICATE ERROR in the content QA harness, so it never ships.
function bundledKnowledgeDuplicateKeys() {
  const keys = new Set<string>();
  for (const question of knowledgeQuestions) {
    keys.add(contentDuplicateKey(question));
  }
  for (const question of challengeArenaCapitalCityQuestions) {
    keys.add(contentDuplicateKey(question));
  }
  for (const question of challengeArenaEnterpriseLogoQuestions) {
    keys.add(contentDuplicateKey(question));
  }
  return keys;
}

function toArenaSeed(
  question: CieScoreQuestion,
  arenaCategory: ArenaRotatingCategory,
  shape: CieShape,
): ArenaCieQuestionSeed {
  return {
    sport: ARENA_CIE_SPORT,
    // which_came_first is the Arena round key, mirroring every existing row of
    // that shape; the authored category stays in bucket + provenance claims.
    category:
      arenaCategory === "which_came_first" ? "which_came_first" : question.category,
    question: question.question,
    options: [...question.options],
    correctAnswer: question.correctAnswer,
    ...(question.explanation ? { explanation: question.explanation } : {}),
    questionKind: shape,
    difficulty: question.difficulty,
    bucket: question.bucket,
    checksum: question.checksum,
    provenance: question.provenance,
  };
}

function tallyInto(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1;
}

export function buildArenaCieSeedPlan(
  registry: readonly CieScoreBatchRegistryEntry[] = cieScoreBatchRegistry,
): ArenaCieSeedPlan {
  const rows: ArenaCiePlannedRow[] = [];
  const exclusions: ArenaCieExclusion[] = [];
  const bundledKeys = bundledKnowledgeDuplicateKeys();
  const plannedChecksums = new Set<string>();
  const plannedDuplicateKeys = new Set<string>();
  let registeredQuestions = 0;

  const exclude = (
    batchId: string,
    checksum: string,
    reason: ArenaCieExclusionReason,
  ) => {
    exclusions.push({ batchId, checksum, reason });
  };

  for (const entry of registry) {
    const batchId = entry.metadata.batchId;
    registeredQuestions += entry.questions.length;

    for (const question of entry.questions) {
      if (!entry.eligible) {
        exclude(batchId, question.checksum, "registry_ineligible");
        continue;
      }
      if (entry.metadata.verdict !== "agree") {
        exclude(batchId, question.checksum, "batch_verdict_not_agree");
        continue;
      }
      if (question.provenance.verdict !== "agree") {
        exclude(batchId, question.checksum, "question_verdict_not_agree");
        continue;
      }
      if (
        !hasCrossFamilyVerifier(entry.metadata.verifierModel) ||
        !hasCrossFamilyVerifier(question.provenance.verifierModel)
      ) {
        exclude(batchId, question.checksum, "verifier_not_cross_family");
        continue;
      }
      if (!hasOnlyStaticClaims(question.provenance)) {
        exclude(batchId, question.checksum, "non_static_volatility");
        continue;
      }
      const shape = supportedShape(question);
      if (!shape) {
        exclude(batchId, question.checksum, "unsupported_shape");
        continue;
      }
      if (plannedChecksums.has(question.checksum)) {
        exclude(batchId, question.checksum, "duplicate_checksum_in_plan");
        continue;
      }
      const arenaCategory = arenaCategoryForCieQuestion(entry, question);
      const seed = toArenaSeed(question, arenaCategory, shape);
      const duplicateKey = contentDuplicateKey(seed);
      if (bundledKeys.has(duplicateKey)) {
        exclude(batchId, question.checksum, "exact_duplicate_of_bundled_row");
        continue;
      }
      if (plannedDuplicateKeys.has(duplicateKey)) {
        exclude(batchId, question.checksum, "duplicate_prompt_answer_in_plan");
        continue;
      }

      plannedChecksums.add(question.checksum);
      plannedDuplicateKeys.add(duplicateKey);
      rows.push({ subject: entry.subject, shape, arenaCategory, seed });
    }
  }

  const plannedBySubject: Record<string, number> = {};
  const plannedByShape: Record<string, number> = {};
  const plannedByArenaCategory: Record<string, number> = {};
  const excludedByReason: Record<string, number> = {};
  for (const row of rows) {
    tallyInto(plannedBySubject, row.subject);
    tallyInto(plannedByShape, row.shape);
    tallyInto(plannedByArenaCategory, row.arenaCategory);
  }
  for (const exclusion of exclusions) {
    tallyInto(excludedByReason, exclusion.reason);
  }

  return {
    rows,
    exclusions,
    totals: {
      registeredQuestions,
      planned: rows.length,
      excluded: exclusions.length,
      plannedBySubject,
      plannedByShape,
      plannedByArenaCategory,
      excludedByReason,
    },
  };
}

let cachedPlan: ArenaCieSeedPlan | null = null;

export function arenaCieSeedPlan(): ArenaCieSeedPlan {
  cachedPlan ??= buildArenaCieSeedPlan();
  return cachedPlan;
}
