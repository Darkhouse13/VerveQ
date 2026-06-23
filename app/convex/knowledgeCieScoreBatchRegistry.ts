import type { KnowledgeQuestionSeed } from "./knowledgeQuestions";
import {
  knowledgeGeographyCieScoreBatchV1Metadata,
  knowledgeGeographyCieScoreBatchV1Questions,
} from "./knowledgeGeographyCieScoreBatchV1";
import {
  knowledgeGeographyCieScoreBatchV2Metadata,
  knowledgeGeographyCieScoreBatchV2Questions,
} from "./knowledgeGeographyCieScoreBatchV2";
import {
  knowledgeGeographyCieScoreBatchV3Metadata,
  knowledgeGeographyCieScoreBatchV3Questions,
} from "./knowledgeGeographyCieScoreBatchV3";
import {
  knowledgeGeographyCieScoreBatchV4Metadata,
  knowledgeGeographyCieScoreBatchV4Questions,
} from "./knowledgeGeographyCieScoreBatchV4";
import {
  knowledgeGeographyCieScoreBatchV5Metadata,
  knowledgeGeographyCieScoreBatchV5Questions,
} from "./knowledgeGeographyCieScoreBatchV5";
import {
  knowledgeGeographyCieScoreBatchV6Metadata,
  knowledgeGeographyCieScoreBatchV6Questions,
} from "./knowledgeGeographyCieScoreBatchV6";
import {
  knowledgeGeographyCieScoreBatchV7Metadata,
  knowledgeGeographyCieScoreBatchV7Questions,
} from "./knowledgeGeographyCieScoreBatchV7";
import {
  knowledgeGeographyCieScoreBatchV8Metadata,
  knowledgeGeographyCieScoreBatchV8Questions,
} from "./knowledgeGeographyCieScoreBatchV8";
import {
  knowledgeGeographyCieScoreBatchV9Metadata,
  knowledgeGeographyCieScoreBatchV9Questions,
} from "./knowledgeGeographyCieScoreBatchV9";
import {
  knowledgeGeographyCieScoreBatchV10Metadata,
  knowledgeGeographyCieScoreBatchV10Questions,
} from "./knowledgeGeographyCieScoreBatchV10";
import {
  knowledgeHistoryCieScoreBatchV1Metadata,
  knowledgeHistoryCieScoreBatchV1Questions,
} from "./knowledgeHistoryCieScoreBatchV1";
import {
  knowledgeHistoryCieScoreBatchV2Metadata,
  knowledgeHistoryCieScoreBatchV2Questions,
} from "./knowledgeHistoryCieScoreBatchV2";
import {
  knowledgeHistoryCieScoreBatchV3Metadata,
  knowledgeHistoryCieScoreBatchV3Questions,
} from "./knowledgeHistoryCieScoreBatchV3";
import {
  knowledgeHistoryCieScoreBatchV4Metadata,
  knowledgeHistoryCieScoreBatchV4Questions,
} from "./knowledgeHistoryCieScoreBatchV4";
import {
  knowledgeHistoryCieScoreBatchV5Metadata,
  knowledgeHistoryCieScoreBatchV5Questions,
} from "./knowledgeHistoryCieScoreBatchV5";
import {
  knowledgeHistoryCieScoreBatchV6Metadata,
  knowledgeHistoryCieScoreBatchV6Questions,
} from "./knowledgeHistoryCieScoreBatchV6";
import {
  knowledgeHistoryCieScoreBatchV7Metadata,
  knowledgeHistoryCieScoreBatchV7Questions,
} from "./knowledgeHistoryCieScoreBatchV7";
import {
  knowledgeScienceCieScoreBatchV1Metadata,
  knowledgeScienceCieScoreBatchV1Questions,
} from "./knowledgeScienceCieScoreBatchV1";
import {
  knowledgeScienceCieScoreBatchV2Metadata,
  knowledgeScienceCieScoreBatchV2Questions,
} from "./knowledgeScienceCieScoreBatchV2";
import {
  knowledgeScienceCieScoreBatchV3Metadata,
  knowledgeScienceCieScoreBatchV3Questions,
} from "./knowledgeScienceCieScoreBatchV3";
import {
  knowledgeScienceCieScoreBatchV4Metadata,
  knowledgeScienceCieScoreBatchV4Questions,
} from "./knowledgeScienceCieScoreBatchV4";
import {
  knowledgeScienceCieScoreBatchV5Metadata,
  knowledgeScienceCieScoreBatchV5Questions,
} from "./knowledgeScienceCieScoreBatchV5";
import {
  knowledgeScienceCieScoreBatchV6Metadata,
  knowledgeScienceCieScoreBatchV6Questions,
} from "./knowledgeScienceCieScoreBatchV6";
import {
  knowledgeScienceCieScoreBatchV7Metadata,
  knowledgeScienceCieScoreBatchV7Questions,
} from "./knowledgeScienceCieScoreBatchV7";

// Single source of truth for every CIE score-mode batch bundled in convex/.
// Consumers:
//   - learnQuestionSkillTags.ts derives its verified Learn tagging set from the
//     entries flagged learnTagged (Learn behavior is frozen by that flag, not
//     by this file's growth).
//   - app/scripts/seedLearnContent.ts derives its geography score-batch seed
//     sources from the geography entries.
//   - challengeArenaCieContent.ts derives the Arena-only compete seed plan from
//     the entries flagged eligible.
// Adding a future CIE batch to Arena = add its import + one entry here.

export type CieVerdict = "pending" | "agree" | "disagree" | "flag";
export type CieSubject = "geography" | "history" | "science";
export type CieShape = "mcq" | "which_came_first" | "logo_text";
export type ArenaRotatingCategory =
  | "general_knowledge"
  | "capital_cities"
  | "which_came_first";

export type CieProvenanceClaim = {
  claim: string;
  sourceType: string;
  sourceRef: string;
  retrievedAt: string;
  volatility: string;
};

export type CieScoreProvenance = {
  claims: CieProvenanceClaim[];
  authorModel: string;
  verifierModel: string;
  verdict: CieVerdict;
  batchId: string;
  workUnitId: string;
};

export type CieScoreQuestion = KnowledgeQuestionSeed & {
  provenance: CieScoreProvenance;
};

export type CieScoreBatchMetadata = {
  batchId: string;
  workUnitId: string;
  authorModel: string;
  verifierModel: string;
  verdict: CieVerdict;
  questionCount: number;
};

export type CieScoreBatchRegistryEntry = {
  /** convex/ module basename, e.g. "knowledgeGeographyCieScoreBatchV1" */
  batchModule: string;
  subject: CieSubject;
  /** Dominant question shape authored in the batch. */
  shape: CieShape;
  /**
   * Default Arena rotating category for the batch's rows. Per-question routing
   * overrides (see arenaCategoryForCieQuestion) take precedence:
   * which_came_first-shaped rows always join the which_came_first round and
   * geography capital_cities rows always join the capital_cities round.
   */
  arenaCategory: ArenaRotatingCategory;
  /** Master switch: only eligible batches may reach the Arena seed plan. */
  eligible: boolean;
  /**
   * Frozen Learn tagging set: exactly the batches learnQuestionSkillTags.ts
   * consumed before this registry existed. Do not flip without a Learn change.
   */
  learnTagged: boolean;
  metadata: CieScoreBatchMetadata;
  questions: readonly CieScoreQuestion[];
};

// Subject → Arena rotating category mapping (documented contract):
//   geography  → capital_cities for rows with category "capital_cities",
//                general_knowledge for everything else (country_facts, ...).
//   history    → general_knowledge for mcq-shaped rows; rows authored with the
//                which_came_first shape route to the which_came_first round.
//   science    → general_knowledge (all current shapes are mcq).
// Rows routed to which_came_first are seeded with category "which_came_first"
// (the Arena round key); their authored category stays visible in the bucket
// string and in provenance.
export const cieScoreBatchRegistry: CieScoreBatchRegistryEntry[] = [
  {
    batchModule: "knowledgeGeographyCieScoreBatchV1",
    subject: "geography",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: true,
    metadata: knowledgeGeographyCieScoreBatchV1Metadata,
    questions: knowledgeGeographyCieScoreBatchV1Questions,
  },
  {
    batchModule: "knowledgeGeographyCieScoreBatchV2",
    subject: "geography",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: true,
    metadata: knowledgeGeographyCieScoreBatchV2Metadata,
    questions: knowledgeGeographyCieScoreBatchV2Questions,
  },
  {
    batchModule: "knowledgeGeographyCieScoreBatchV3",
    subject: "geography",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeGeographyCieScoreBatchV3Metadata,
    questions: knowledgeGeographyCieScoreBatchV3Questions,
  },
  {
    batchModule: "knowledgeGeographyCieScoreBatchV4",
    subject: "geography",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeGeographyCieScoreBatchV4Metadata,
    questions: knowledgeGeographyCieScoreBatchV4Questions,
  },
  {
    batchModule: "knowledgeGeographyCieScoreBatchV5",
    subject: "geography",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeGeographyCieScoreBatchV5Metadata,
    questions: knowledgeGeographyCieScoreBatchV5Questions,
  },
  {
    batchModule: "knowledgeGeographyCieScoreBatchV6",
    subject: "geography",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeGeographyCieScoreBatchV6Metadata,
    questions: knowledgeGeographyCieScoreBatchV6Questions,
  },
  {
    batchModule: "knowledgeGeographyCieScoreBatchV7",
    subject: "geography",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeGeographyCieScoreBatchV7Metadata,
    questions: knowledgeGeographyCieScoreBatchV7Questions,
  },
  {
    batchModule: "knowledgeGeographyCieScoreBatchV8",
    subject: "geography",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeGeographyCieScoreBatchV8Metadata,
    questions: knowledgeGeographyCieScoreBatchV8Questions,
  },
  {
    batchModule: "knowledgeGeographyCieScoreBatchV9",
    subject: "geography",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeGeographyCieScoreBatchV9Metadata,
    questions: knowledgeGeographyCieScoreBatchV9Questions,
  },
  {
    batchModule: "knowledgeGeographyCieScoreBatchV10",
    subject: "geography",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeGeographyCieScoreBatchV10Metadata,
    questions: knowledgeGeographyCieScoreBatchV10Questions,
  },
  {
    batchModule: "knowledgeHistoryCieScoreBatchV1",
    subject: "history",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: true,
    metadata: knowledgeHistoryCieScoreBatchV1Metadata,
    questions: knowledgeHistoryCieScoreBatchV1Questions,
  },
  {
    batchModule: "knowledgeHistoryCieScoreBatchV2",
    subject: "history",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeHistoryCieScoreBatchV2Metadata,
    questions: knowledgeHistoryCieScoreBatchV2Questions,
  },
  {
    batchModule: "knowledgeHistoryCieScoreBatchV3",
    subject: "history",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeHistoryCieScoreBatchV3Metadata,
    questions: knowledgeHistoryCieScoreBatchV3Questions,
  },
  {
    batchModule: "knowledgeHistoryCieScoreBatchV4",
    subject: "history",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeHistoryCieScoreBatchV4Metadata,
    questions: knowledgeHistoryCieScoreBatchV4Questions,
  },
  {
    batchModule: "knowledgeHistoryCieScoreBatchV5",
    subject: "history",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeHistoryCieScoreBatchV5Metadata,
    questions: knowledgeHistoryCieScoreBatchV5Questions,
  },
  {
    batchModule: "knowledgeHistoryCieScoreBatchV6",
    subject: "history",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeHistoryCieScoreBatchV6Metadata,
    questions: knowledgeHistoryCieScoreBatchV6Questions,
  },
  {
    batchModule: "knowledgeHistoryCieScoreBatchV7",
    subject: "history",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeHistoryCieScoreBatchV7Metadata,
    questions: knowledgeHistoryCieScoreBatchV7Questions,
  },
  {
    batchModule: "knowledgeScienceCieScoreBatchV1",
    subject: "science",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: true,
    metadata: knowledgeScienceCieScoreBatchV1Metadata,
    questions: knowledgeScienceCieScoreBatchV1Questions,
  },
  {
    batchModule: "knowledgeScienceCieScoreBatchV2",
    subject: "science",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeScienceCieScoreBatchV2Metadata,
    questions: knowledgeScienceCieScoreBatchV2Questions,
  },
  {
    batchModule: "knowledgeScienceCieScoreBatchV3",
    subject: "science",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeScienceCieScoreBatchV3Metadata,
    questions: knowledgeScienceCieScoreBatchV3Questions,
  },
  {
    batchModule: "knowledgeScienceCieScoreBatchV4",
    subject: "science",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeScienceCieScoreBatchV4Metadata,
    questions: knowledgeScienceCieScoreBatchV4Questions,
  },
  {
    batchModule: "knowledgeScienceCieScoreBatchV5",
    subject: "science",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeScienceCieScoreBatchV5Metadata,
    questions: knowledgeScienceCieScoreBatchV5Questions,
  },
  {
    batchModule: "knowledgeScienceCieScoreBatchV6",
    subject: "science",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeScienceCieScoreBatchV6Metadata,
    questions: knowledgeScienceCieScoreBatchV6Questions,
  },
  {
    batchModule: "knowledgeScienceCieScoreBatchV7",
    subject: "science",
    shape: "mcq",
    arenaCategory: "general_knowledge",
    eligible: true,
    learnTagged: false,
    metadata: knowledgeScienceCieScoreBatchV7Metadata,
    questions: knowledgeScienceCieScoreBatchV7Questions,
  },
];

export function cieQuestionShape(question: CieScoreQuestion): CieShape {
  if (question.questionKind === "logo_text") return "logo_text";
  if (
    question.questionKind === "which_came_first" ||
    question.category === "which_came_first"
  ) {
    return "which_came_first";
  }
  return "mcq";
}

export function arenaCategoryForCieQuestion(
  entry: Pick<CieScoreBatchRegistryEntry, "arenaCategory">,
  question: CieScoreQuestion,
): ArenaRotatingCategory {
  if (cieQuestionShape(question) === "which_came_first") {
    return "which_came_first";
  }
  if (question.category === "capital_cities") {
    return "capital_cities";
  }
  return entry.arenaCategory === "which_came_first"
    ? "general_knowledge"
    : entry.arenaCategory;
}

export const learnTaggedCieScoreBatches = cieScoreBatchRegistry.filter(
  (entry) => entry.learnTagged,
);
