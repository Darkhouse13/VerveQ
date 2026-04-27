#!/usr/bin/env npx tsx

import * as path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import {
  buildCuratedSeedManifest,
  CURATED_PARITY_SCOPE,
  type CuratedSeedManifestEntry,
} from "./curatedSeedManifest";
import {
  CURATED_PARITY_APPLY_OPERATION_ENV,
  createCuratedParityApprovalArtifact,
  CURATED_PARITY_APPROVAL_ARTIFACT_PATH,
  type CuratedParityCommandMode,
  evaluateCuratedParityDestructiveGuard,
  finishCuratedParityApplySession,
  printCuratedParityNextSteps,
  printCuratedParitySafetyReport,
  resolveConvexTarget,
  startCuratedParityApplySession,
} from "./curatedParityDeploymentSafety";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function divider(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function parseArgs(): { commandMode: CuratedParityCommandMode } {
  const statusOnly =
    process.argv.includes("--status") ||
    process.argv.includes("--check") ||
    process.argv.includes("--self-check");
  const inspectOnly =
    process.argv.includes("--inspect") || process.argv.includes("--inspect-only");
  const approveOnly =
    process.argv.includes("--approve") || process.argv.includes("--write-approval");

  const enabledModes = [statusOnly, inspectOnly, approveOnly].filter(Boolean).length;
  if (enabledModes > 1) {
    throw new Error("Use only one of --status, --inspect, or --approve");
  }

  return {
    commandMode: statusOnly ? "status" : inspectOnly ? "inspect" : approveOnly ? "approve" : "apply",
  };
}

async function runCommand(
  label: string,
  args: string[],
  extraEnv?: Record<string, string>,
): Promise<void> {
  console.log(`\n[run] ${label}`);
  console.log(`      npx ${args.join(" ")}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", args, {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

async function callConvexQuery(
  convexUrl: string,
  pathName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`${convexUrl}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: pathName,
      args,
      format: "json",
    }),
  });

  if (!response.ok) {
    throw new Error(`query ${pathName} failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    status: "success" | "error";
    value?: unknown;
    errorMessage?: string;
  };

  if (payload.status === "error") {
    throw new Error(payload.errorMessage || `query ${pathName} failed`);
  }

  return payload.value;
}

function printManifestTable(entry: CuratedSeedManifestEntry): void {
  console.log(
    `  - ${entry.tableName}: ${entry.recordCount.toLocaleString()} rows, hash ${entry.artifactHash.slice(0, 12)}, mode=${entry.mode}`,
  );
}

async function verifyTable(
  convexUrl: string,
  entry: CuratedSeedManifestEntry,
  seedVersion: string,
): Promise<void> {
  let cursor: string | null = null;
  let currentCount = 0;
  let matchingSeedVersionCount = 0;
  let staleCount = 0;
  let metadata: null | {
    seedVersion: string;
    artifactHash: string;
    recordCount: number;
    insertedCount: number;
    replacedCount: number;
    deletedCount: number;
  } = null;

  while (true) {
    const pageStatus = (await callConvexQuery(
      convexUrl,
      "seedSportsData:getCuratedSeedTableStatusPage",
      {
        scopeKey: CURATED_PARITY_SCOPE,
        tableName: entry.tableName,
        sport: entry.sport,
        cursor,
      },
    )) as {
      metadata: null | {
        seedVersion: string;
        artifactHash: string;
        recordCount: number;
        insertedCount: number;
        replacedCount: number;
        deletedCount: number;
      };
      currentCountInPage: number;
      matchingSeedVersionCountInPage: number;
      staleCountInPage: number;
      continueCursor: string;
      isDone: boolean;
    };

    metadata = metadata ?? pageStatus.metadata;
    currentCount += pageStatus.currentCountInPage;
    matchingSeedVersionCount += pageStatus.matchingSeedVersionCountInPage;
    staleCount += pageStatus.staleCountInPage;

    if (pageStatus.isDone) {
      break;
    }

    cursor = pageStatus.continueCursor;
  }

  if (!metadata) {
    throw new Error(`Missing curated seed metadata for ${entry.tableName}`);
  }

  if (
    metadata.seedVersion !== seedVersion ||
    metadata.artifactHash !== entry.artifactHash ||
    metadata.recordCount !== entry.recordCount ||
    currentCount !== entry.recordCount ||
    matchingSeedVersionCount !== entry.recordCount ||
    staleCount !== 0
  ) {
    throw new Error(
      `Parity verification failed for ${entry.tableName}: expected ${entry.recordCount} rows @ ${seedVersion}, got current=${currentCount}, matching=${matchingSeedVersionCount}, stale=${staleCount}`,
    );
  }

  console.log(
    `[verified] ${entry.tableName}: ${currentCount.toLocaleString()} rows, inserted=${metadata.insertedCount}, replaced=${metadata.replacedCount}, deleted=${metadata.deletedCount}`,
  );
}

async function seedTable(
  entry: CuratedSeedManifestEntry,
  generatedAt: string,
  seedVersion: string,
  applyOperationId: string,
): Promise<void> {
  await runCommand(`authoritative seed ${entry.tableName}`, [
    "tsx",
    "scripts/seedSportsDatabase.ts",
    "--table",
    entry.tableName,
    "--replace",
    "--sport",
    entry.sport,
    "--seed-version",
    seedVersion,
    "--scope",
    CURATED_PARITY_SCOPE,
    "--mode",
    entry.mode,
    "--artifact-path",
    entry.artifactPath,
    "--artifact-hash",
    entry.artifactHash,
    "--generated-at",
    generatedAt,
    "--guard-report",
    "compact",
  ], {
    [CURATED_PARITY_APPLY_OPERATION_ENV]: applyOperationId,
  });
}

async function main(): Promise<void> {
  const { commandMode } = parseArgs();
  const target = resolveConvexTarget();
  const convexUrl = target.convexUrl;
  const manifest = buildCuratedSeedManifest();
  const safetyReport = evaluateCuratedParityDestructiveGuard(target, {
    commandMode,
    scopeKey: manifest.scopeKey,
    seedVersion: manifest.seedVersion,
  });

  divider("Curated Runtime Parity");
  console.log(`[mode] ${commandMode}`);
  console.log(`[scope] ${manifest.scopeKey}`);
  console.log(`[seedVersion] ${manifest.seedVersion}`);
  console.log(`[convex] ${target.deploymentName} -> ${convexUrl}`);
  console.log("[source] repo artifacts only; no provider refetch");

  divider("Curated Parity Safety Guard");
  printCuratedParitySafetyReport(safetyReport);

  if (commandMode === "status") {
    divider("Recommended Next Step");
    printCuratedParityNextSteps(safetyReport, { includeLocalConfigTemplate: true });
    return;
  }

  if (commandMode === "inspect") {
    divider("Artifact Manifest");
    for (const entry of manifest.tables) {
      printManifestTable(entry);
    }

    divider("Recommended Next Step");
    printCuratedParityNextSteps(safetyReport, { includeLocalConfigTemplate: true });
    return;
  }

  if (!safetyReport.allowed) {
    divider("Recommended Next Step");
    printCuratedParityNextSteps(safetyReport, { includeLocalConfigTemplate: true });
    process.exitCode = 1;
    return;
  }

  if (commandMode === "approve") {
    const replacedExistingApproval = safetyReport.approvalArtifactState === "valid";
    const artifact = createCuratedParityApprovalArtifact({
      target,
      scopeKey: manifest.scopeKey,
      seedVersion: manifest.seedVersion,
    });

    divider("Approval Artifact");
    console.log(
      `[written] ${path.relative(REPO_ROOT, CURATED_PARITY_APPROVAL_ARTIFACT_PATH)}`,
    );
    console.log(`[approvalId] ${artifact.approvalId}`);
    console.log(`[approvedAt] ${artifact.approvedAt}`);
    console.log(`[expiresAt] ${artifact.expiresAt}`);
    console.log(`[seedVersion] ${artifact.seedVersion}`);
    if (replacedExistingApproval) {
      console.log("[cleanup] replaced the previous unconsumed approval with a fresh single-use approval");
    }
    console.log(
      `[next] Run: cd app && npm run gameplay:curated-parity`,
    );
    return;
  }

  divider("Artifact Manifest");
  for (const entry of manifest.tables) {
    printManifestTable(entry);
  }

  const { session, operationId } = startCuratedParityApplySession({
    target,
    scopeKey: manifest.scopeKey,
    seedVersion: manifest.seedVersion,
    approvalArtifact: safetyReport.approvalArtifact!,
  });
  let applyOutcome: "succeeded" | "failed" = "failed";

  divider("Apply Session");
  console.log(`[sessionId] ${session.sessionId}`);
  console.log(`[approvalId] ${session.approvalId}`);
  console.log(`[startedAt] ${session.startedAt}`);
  console.log(`[expiresAt] ${session.expiresAt}`);
  console.log("[approval] single-use approval consumed before the first destructive step");

  try {
    divider("Authoritative Reseed");
    for (const entry of manifest.tables) {
      await seedTable(entry, manifest.generatedAt, manifest.seedVersion, operationId);
    }

    divider("Parity Verification");
    for (const entry of manifest.tables) {
      await verifyTable(convexUrl, entry, manifest.seedVersion);
    }

    applyOutcome = "succeeded";
  } finally {
    finishCuratedParityApplySession({
      approvalId: session.approvalId,
      sessionId: session.sessionId,
      outcome: applyOutcome,
    });
  }

  divider("Parity Summary");
  console.log(
    `[pass] ${manifest.tables.length} curated runtime tables now match repo artifacts at ${manifest.seedVersion}`,
  );
  console.log("[cleanup] apply session closed; a fresh approve step is required before any replay");
}

main().catch((error) => {
  console.error("\n[curated-runtime-parity] failed");
  if (error instanceof Error) {
    console.error(error.message);
    return process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
