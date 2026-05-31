import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guardTarget, LIVE_CONFIRM_ENV } from "./lib/deployTarget";
import {
  knowledgeGeographyCieScoreBatchV1Metadata,
  knowledgeGeographyCieScoreBatchV1Questions,
} from "../convex/knowledgeGeographyCieScoreBatchV1";
import {
  knowledgeGeographyCieScoreBatchV2Metadata,
  knowledgeGeographyCieScoreBatchV2Questions,
} from "../convex/knowledgeGeographyCieScoreBatchV2";
import {
  knowledgeGeographyCieScoreBatchV3Metadata,
  knowledgeGeographyCieScoreBatchV3Questions,
} from "../convex/knowledgeGeographyCieScoreBatchV3";
import {
  knowledgeGeographyCieScoreBatchV4Metadata,
  knowledgeGeographyCieScoreBatchV4Questions,
} from "../convex/knowledgeGeographyCieScoreBatchV4";
import {
  knowledgeGeographyCieScoreBatchV5Metadata,
  knowledgeGeographyCieScoreBatchV5Questions,
} from "../convex/knowledgeGeographyCieScoreBatchV5";
import {
  knowledgeGeographyCieScoreBatchV6Metadata,
  knowledgeGeographyCieScoreBatchV6Questions,
} from "../convex/knowledgeGeographyCieScoreBatchV6";
import {
  knowledgeGeographyCieScoreBatchV7Metadata,
  knowledgeGeographyCieScoreBatchV7Questions,
} from "../convex/knowledgeGeographyCieScoreBatchV7";
import {
  knowledgeGeographyCieScoreBatchV8Metadata,
  knowledgeGeographyCieScoreBatchV8Questions,
} from "../convex/knowledgeGeographyCieScoreBatchV8";
import {
  knowledgeGeographyCieScoreBatchV9Metadata,
  knowledgeGeographyCieScoreBatchV9Questions,
} from "../convex/knowledgeGeographyCieScoreBatchV9";
import {
  learnGeographyBorderReasoningLadderV1Metadata,
  learnGeographyBorderReasoningLadderV1Questions,
} from "../convex/learnGeographyBorderReasoningLadderV1";
import {
  learnGeographyCapitalsRecallRevealsV1ByChecksum,
  learnGeographyCapitalsRecallRevealsV1Metadata,
} from "../convex/learnGeographyCapitalsRecallRevealsV1";
import {
  learnGeographyNonobviousLadderV1Metadata,
  learnGeographyNonobviousLadderV1Questions,
} from "../convex/learnGeographyNonobviousLadderV1";
import { skillNodes } from "../convex/learnSkillGraph";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, "..");
const SCHEMA_PATH = path.join(APP_DIR, "convex", "schema.ts");
const SCOPE_KEY = "learn:content:geography:v1";
const SEED_VERSION = "learn-content-geography-v1";

type Verdict = "pending" | "agree" | "disagree" | "flag";

type VerifiedMetadata = {
  batchId: string;
  workUnitId: string;
  verifierModel: string;
  verdict: Verdict;
};

type ProvenanceBearing = {
  checksum?: string;
  provenance?: {
    verifierModel?: string;
    verdict?: Verdict;
    batchId?: string;
  };
};

type ContentBatch<T extends ProvenanceBearing> = {
  kind: "score-batch" | "learn-ladder";
  file: string;
  metadata: VerifiedMetadata & { questionCount?: number };
  records: readonly T[];
};

type RevealRecord = {
  checksum: string;
  provenance?: {
    verifierModel?: string;
    verdict?: Verdict;
    batchId?: string;
  };
};

type RevealBatch = {
  kind: "learn-reveals";
  file: string;
  metadata: VerifiedMetadata & { revealCount?: number };
  records: readonly RevealRecord[];
};

type SeedSource = ContentBatch<ProvenanceBearing> | RevealBatch;

type GuardDecision =
  | {
      allowed: true;
      deploymentName: string | null;
      deploymentSpecifier: string | null;
      deploymentKind: string | null;
      convexUrl: string | null;
      host: string | null;
      source: string;
      sources: string[];
    }
  | {
      allowed: false;
      error: string;
    };

function parseArgs(argv: string[]) {
  const flags = new Set(argv);
  const execute = flags.has("--execute");
  return {
    plan: !execute || flags.has("--plan"),
    execute,
    allowLive: flags.has("--allow-live"),
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function guardDecision(allowLive: boolean): GuardDecision {
  try {
    return { allowed: true, ...guardTarget({ allowLive }) };
  } catch (error) {
    return {
      allowed: false,
      error: sanitizeGuardError(error instanceof Error ? error.message : String(error)),
    };
  }
}

function sanitizeGuardError(message: string): string {
  return message.replace(/url=https?:\/\/([^/;\s]+)[^;]*;/g, "urlHost=$1;");
}

function metadataTableName() {
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  return schema.includes("curatedSeedMetadata")
    ? "curatedSeedMetadata"
    : null;
}

function assertVerifiedSource(source: SeedSource) {
  const { metadata } = source;
  const errors: string[] = [];
  if (metadata.verdict !== "agree") {
    errors.push(
      `${source.file} metadata verdict is ${metadata.verdict}, expected agree`,
    );
  }
  if (
    !metadata.verifierModel ||
    metadata.verifierModel === "pending_anthropic_verification"
  ) {
    errors.push(
      `${source.file} metadata verifierModel is not cross-family verified`,
    );
  }

  for (const record of source.records) {
    if (record.provenance?.verdict !== "agree") {
      errors.push(
        `${source.file}:${record.checksum ?? "(unknown)"} provenance verdict is ${
          record.provenance?.verdict ?? "(missing)"
        }`,
      );
    }
    if (
      !record.provenance?.verifierModel ||
      record.provenance.verifierModel === "pending_anthropic_verification"
    ) {
      errors.push(
        `${source.file}:${record.checksum ?? "(unknown)"} provenance verifierModel is not cross-family verified`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`Unverified Learn seed source refused:\n${errors.join("\n")}`);
  }
}

function asRevealRecords(
  revealsByChecksum: Record<string, { provenance?: RevealRecord["provenance"] }>,
): RevealRecord[] {
  return Object.entries(revealsByChecksum).map(([checksum, reveal]) => ({
    checksum,
    provenance: reveal.provenance,
  }));
}

const seedSources: SeedSource[] = [
  {
    kind: "score-batch",
    file: "app/convex/knowledgeGeographyCieScoreBatchV1.ts",
    metadata: knowledgeGeographyCieScoreBatchV1Metadata,
    records: knowledgeGeographyCieScoreBatchV1Questions,
  },
  {
    kind: "score-batch",
    file: "app/convex/knowledgeGeographyCieScoreBatchV2.ts",
    metadata: knowledgeGeographyCieScoreBatchV2Metadata,
    records: knowledgeGeographyCieScoreBatchV2Questions,
  },
  {
    kind: "score-batch",
    file: "app/convex/knowledgeGeographyCieScoreBatchV3.ts",
    metadata: knowledgeGeographyCieScoreBatchV3Metadata,
    records: knowledgeGeographyCieScoreBatchV3Questions,
  },
  {
    kind: "score-batch",
    file: "app/convex/knowledgeGeographyCieScoreBatchV4.ts",
    metadata: knowledgeGeographyCieScoreBatchV4Metadata,
    records: knowledgeGeographyCieScoreBatchV4Questions,
  },
  {
    kind: "score-batch",
    file: "app/convex/knowledgeGeographyCieScoreBatchV5.ts",
    metadata: knowledgeGeographyCieScoreBatchV5Metadata,
    records: knowledgeGeographyCieScoreBatchV5Questions,
  },
  {
    kind: "score-batch",
    file: "app/convex/knowledgeGeographyCieScoreBatchV6.ts",
    metadata: knowledgeGeographyCieScoreBatchV6Metadata,
    records: knowledgeGeographyCieScoreBatchV6Questions,
  },
  {
    kind: "score-batch",
    file: "app/convex/knowledgeGeographyCieScoreBatchV7.ts",
    metadata: knowledgeGeographyCieScoreBatchV7Metadata,
    records: knowledgeGeographyCieScoreBatchV7Questions,
  },
  {
    kind: "score-batch",
    file: "app/convex/knowledgeGeographyCieScoreBatchV8.ts",
    metadata: knowledgeGeographyCieScoreBatchV8Metadata,
    records: knowledgeGeographyCieScoreBatchV8Questions,
  },
  {
    kind: "score-batch",
    file: "app/convex/knowledgeGeographyCieScoreBatchV9.ts",
    metadata: knowledgeGeographyCieScoreBatchV9Metadata,
    records: knowledgeGeographyCieScoreBatchV9Questions,
  },
  {
    kind: "learn-reveals",
    file: "app/convex/learnGeographyCapitalsRecallRevealsV1.ts",
    metadata: learnGeographyCapitalsRecallRevealsV1Metadata,
    records: asRevealRecords(learnGeographyCapitalsRecallRevealsV1ByChecksum),
  },
  {
    kind: "learn-ladder",
    file: "app/convex/learnGeographyBorderReasoningLadderV1.ts",
    metadata: learnGeographyBorderReasoningLadderV1Metadata,
    records: learnGeographyBorderReasoningLadderV1Questions,
  },
  {
    kind: "learn-ladder",
    file: "app/convex/learnGeographyNonobviousLadderV1.ts",
    metadata: learnGeographyNonobviousLadderV1Metadata,
    records: learnGeographyNonobviousLadderV1Questions,
  },
];

function buildPlan() {
  for (const source of seedSources) {
    assertVerifiedSource(source);
  }

  const metadataTable = metadataTableName();
  const questionCount = seedSources
    .filter((source) => source.kind === "score-batch")
    .reduce((sum, source) => sum + source.records.length, 0);
  const learnOverlayCount = seedSources
    .filter((source) => source.kind !== "score-batch")
    .reduce((sum, source) => sum + source.records.length, 0);
  const nodeCount = skillNodes.length;
  const manifest = {
    scopeKey: SCOPE_KEY,
    seedVersion: SEED_VERSION,
    sources: seedSources.map((source) => ({
      kind: source.kind,
      file: source.file,
      batchId: source.metadata.batchId,
      workUnitId: source.metadata.workUnitId,
      verifierModel: source.metadata.verifierModel,
      verdict: source.metadata.verdict,
      recordCount: source.records.length,
    })),
    skillNodes: skillNodes.map((node) => ({
      id: node.id,
      subject: node.subject,
      prerequisites: node.prerequisites,
    })),
  };

  return {
    scopeKey: SCOPE_KEY,
    seedVersion: SEED_VERSION,
    artifactHash: sha256(manifest),
    metadataTable,
    replaceStrategy:
      "deterministic replace by Learn source key/checksum; no append-only duplicates",
    counts: {
      verifiedScoreQuestions: questionCount,
      verifiedLearnOverlayRecords: learnOverlayCount,
      skillNodes: nodeCount,
      totalPlannedRecords: questionCount + learnOverlayCount + nodeCount,
    },
    sources: manifest.sources,
    skillNodeIds: skillNodes.map((node) => node.id),
  };
}

function printGuard(decision: GuardDecision) {
  if (decision.allowed) {
    console.log("targetGuard=allowed");
    console.log(`targetDeployment=${decision.deploymentSpecifier ?? decision.deploymentName ?? "(none)"}`);
    console.log(`targetHost=${decision.host ?? "(none)"}`);
    console.log(`targetSource=${decision.source}`);
    return;
  }

  console.log("targetGuard=blocked");
  console.log(`targetBlocker=${decision.error}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const decision = guardDecision(args.allowLive);
  const plan = buildPlan();

  console.log(`mode=${args.plan ? "plan" : "execute"}`);
  console.log(`scopeKey=${plan.scopeKey}`);
  console.log(`seedVersion=${plan.seedVersion}`);
  console.log(`artifactHash=${plan.artifactHash}`);
  console.log(`metadataTable=${plan.metadataTable ?? "none"}`);
  console.log(`replaceStrategy=${plan.replaceStrategy}`);
  console.log(`liveGuardEnv=${LIVE_CONFIRM_ENV}`);
  printGuard(decision);
  console.log(
    `counts=scoreQuestions:${plan.counts.verifiedScoreQuestions},learnOverlays:${plan.counts.verifiedLearnOverlayRecords},skillNodes:${plan.counts.skillNodes},total:${plan.counts.totalPlannedRecords}`,
  );
  for (const source of plan.sources) {
    console.log(
      `verifiedSource=${source.kind}:${source.batchId}:${source.recordCount}:${source.verdict}:${source.verifierModel}:${source.file}`,
    );
  }
  console.log(`skillNodes=${plan.skillNodeIds.join(",")}`);

  if (args.plan) {
    console.log("mutation=none");
    return;
  }

  if (!args.execute) {
    throw new Error("Non-plan execution requires --execute.");
  }
  if (!decision.allowed) {
    throw new Error("Refusing execution because target guard is blocked.");
  }

  throw new Error(
    "Non-plan Learn content execution is intentionally out of scope for this readiness task.",
  );
}

main();
