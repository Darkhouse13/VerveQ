#!/usr/bin/env npx tsx
/**
 * runCuratedGameplaySmoke.ts
 *
 * Lightweight backend/runtime smoke checks for curated gameplay modes.
 *
 * Usage:
 *   npx tsx scripts/runCuratedGameplaySmoke.ts
 *   npx tsx scripts/runCuratedGameplaySmoke.ts who-am-i
 *   npx tsx scripts/runCuratedGameplaySmoke.ts --mode verve-grid
 */

import {
  buildCuratedSeedManifest,
  CURATED_PARITY_SCOPE,
  type CuratedParityTable,
} from "./curatedSeedManifest";
import {
  printResolvedConvexTarget,
  resolveConvexTarget,
} from "./curatedParityDeploymentSafety";

type ModeName = "all" | "higher-lower" | "verve-grid" | "who-am-i";
type CuratedMode = Exclude<ModeName, "all">;
type CallKind = "query" | "mutation";

type ModeConfig = {
  label: string;
  parityTables: CuratedParityTable[];
  startPath: string;
  supportedArgs: Record<string, unknown>;
  unsupportedArgs: Record<string, unknown>;
  validateSuccess: (value: unknown) => string;
  validateFailure: (message: string) => void;
};

const MODE_CONFIGS: Record<CuratedMode, ModeConfig> = {
  "higher-lower": {
    label: "Higher or Lower",
    parityTables: [
      "sportsPlayers",
      "sportsTeams",
      "higherLowerPools",
      "higherLowerFacts",
    ],
    startPath: "higherLower:startSession",
    supportedArgs: { sport: "football" },
    unsupportedArgs: { sport: "basketball" },
    validateSuccess: (value) => {
      const result = value as Record<string, unknown>;
      if (
        typeof result.sessionId !== "string" ||
        typeof result.statKey !== "string" ||
        typeof result.context !== "string"
      ) {
        throw new Error("Higher or Lower start result is missing required fields");
      }
      return `session=${result.sessionId}, stat=${result.statKey}, context=${result.context}`;
    },
    validateFailure: (message) => {
      if (!/football only/i.test(message)) {
        throw new Error(
          `Higher or Lower unsupported-sport failure was not explicit enough: ${message}`,
        );
      }
    },
  },
  "verve-grid": {
    label: "VerveGrid",
    parityTables: [
      "sportsPlayers",
      "verveGridApprovedIndex",
      "verveGridBoards",
    ],
    startPath: "verveGrid:startSession",
    supportedArgs: { sport: "football" },
    unsupportedArgs: { sport: "basketball" },
    validateSuccess: (value) => {
      const result = value as Record<string, unknown>;
      const rows = Array.isArray(result.rows) ? result.rows : [];
      const cols = Array.isArray(result.cols) ? result.cols : [];
      if (
        typeof result.sessionId !== "string" ||
        typeof result.boardTemplateId !== "string" ||
        rows.length !== 3 ||
        cols.length !== 3
      ) {
        throw new Error("VerveGrid start result is missing required board fields");
      }
      return `session=${result.sessionId}, template=${result.boardTemplateId}, rows=${rows.length}, cols=${cols.length}`;
    },
    validateFailure: (message) => {
      if (!/football only/i.test(message)) {
        throw new Error(
          `VerveGrid unsupported-sport failure was not explicit enough: ${message}`,
        );
      }
    },
  },
  "who-am-i": {
    label: "Who Am I",
    parityTables: ["whoAmIApprovedClues"],
    startPath: "whoAmI:startChallenge",
    supportedArgs: { sport: "football" },
    unsupportedArgs: { sport: "basketball" },
    validateSuccess: (value) => {
      const result = value as Record<string, unknown>;
      if (
        typeof result.sessionId !== "string" ||
        typeof result.clue1 !== "string" ||
        typeof result.difficulty !== "string"
      ) {
        throw new Error("Who Am I start result is missing required fields");
      }
      return `session=${result.sessionId}, difficulty=${result.difficulty}`;
    },
    validateFailure: (message) => {
      if (!/not available/i.test(message)) {
        throw new Error(
          `Who Am I unsupported-sport failure was not explicit enough: ${message}`,
        );
      }
    },
  },
};

function parseArgs(): { mode: ModeName } {
  const args = process.argv.slice(2);
  const modeIndex = args.indexOf("--mode");
  const recognizedModes = new Set<ModeName>([
    "all",
    "higher-lower",
    "verve-grid",
    "who-am-i",
  ]);
  const positionalArgs = args.filter((arg, index) => {
    if (arg === "--mode") return false;
    if (modeIndex >= 0 && index === modeIndex + 1) return false;
    return !arg.startsWith("--");
  });
  const positionalMode = positionalArgs[0];
  const modeValue =
    modeIndex >= 0 ? args[modeIndex + 1] : positionalMode ?? "all";

  if (!modeValue || !recognizedModes.has(modeValue as ModeName)) {
    throw new Error(
      `Unknown mode "${modeValue}". Expected one of: all, higher-lower, verve-grid, who-am-i`,
    );
  }

  if (positionalArgs.length > 1) {
    throw new Error(
      `Too many positional arguments: ${positionalArgs.join(" ")}. Expected at most one mode.`,
    );
  }

  return { mode: modeValue as ModeName };
}

function getSelectedModes(mode: ModeName): CuratedMode[] {
  return mode === "all"
    ? ["higher-lower", "verve-grid", "who-am-i"]
    : [mode];
}

function divider(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function callConvex(
  convexUrl: string,
  kind: CallKind,
  pathName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const endpoint = `${convexUrl}/api/${kind}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: pathName,
      args,
      format: "json",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${kind} ${pathName} failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as {
    status: "success" | "error";
    value?: unknown;
    errorMessage?: string;
  };

  if (payload.status === "error") {
    throw new Error(payload.errorMessage || `${kind} ${pathName} failed`);
  }

  return payload.value;
}

async function expectMutationFailure(
  convexUrl: string,
  pathName: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    await callConvex(convexUrl, "mutation", pathName, args);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown mutation failure";
    return message;
  }

  throw new Error(`Expected ${pathName} to fail, but it succeeded`);
}

async function checkCuratedSeedParity(
  convexUrl: string,
  selectedModes: CuratedMode[],
): Promise<void> {
  divider("Curated Seed Parity");

  const manifest = buildCuratedSeedManifest();
  const requiredTables = Array.from(
    new Set(selectedModes.flatMap((mode) => MODE_CONFIGS[mode].parityTables)),
  );
  const manifestEntries = manifest.tables.filter((entry) =>
    requiredTables.includes(entry.tableName),
  );

  for (const entry of manifestEntries) {
    let cursor: string | null = null;
    let currentCount = 0;
    let matchingSeedVersionCount = 0;
    let staleCount = 0;
    let metadata: null | {
      seedVersion: string;
      artifactHash: string;
      recordCount: number;
    } = null;

    while (true) {
      const status = (await callConvex(
        convexUrl,
        "query",
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
        };
        currentCountInPage: number;
        matchingSeedVersionCountInPage: number;
        staleCountInPage: number;
        continueCursor: string;
        isDone: boolean;
      };

      metadata = metadata ?? status.metadata;
      currentCount += status.currentCountInPage;
      matchingSeedVersionCount += status.matchingSeedVersionCountInPage;
      staleCount += status.staleCountInPage;

      if (status.isDone) {
        break;
      }

      cursor = status.continueCursor;
    }

    if (
      !metadata ||
      metadata.seedVersion !== manifest.seedVersion ||
      metadata.artifactHash !== entry.artifactHash ||
      metadata.recordCount !== entry.recordCount ||
      currentCount !== entry.recordCount ||
      matchingSeedVersionCount !== entry.recordCount ||
      staleCount !== 0
    ) {
      throw new Error(
        `Curated parity mismatch for ${entry.tableName}: expected ${entry.recordCount} rows @ ${manifest.seedVersion}, got current=${currentCount}, matching=${matchingSeedVersionCount}, stale=${staleCount}`,
      );
    }

    console.log(
      `[pass] ${entry.tableName}: parity verified (${entry.recordCount.toLocaleString()} rows, ${entry.artifactHash.slice(0, 12)})`,
    );
  }
}

async function checkModeStarts(
  convexUrl: string,
  selectedModes: CuratedMode[],
): Promise<void> {
  divider("Backend Runtime Starts");

  for (const mode of selectedModes) {
    const config = MODE_CONFIGS[mode];

    const successValue = await callConvex(
      convexUrl,
      "mutation",
      config.startPath,
      config.supportedArgs,
    );
    const successSummary = config.validateSuccess(successValue);
    console.log(`[pass] ${config.label} football start: ${successSummary}`);

    const failureMessage = await expectMutationFailure(
      convexUrl,
      config.startPath,
      config.unsupportedArgs,
    );
    config.validateFailure(failureMessage);
    console.log(
      `[pass] ${config.label} unsupported sport failure: ${failureMessage}`,
    );
  }
}

async function printManualChecklist(mode: ModeName): Promise<void> {
  divider("Reachable Target Manual Checks");
  const modes =
    mode === "all" ? ["higher-lower", "verve-grid", "who-am-i"] : [mode];
  const checklistPath = "docs/CURATED_GAMEPLAY_REACHABLE_TARGET_CHECKLIST.md";
  console.log("[serve] cd app && npm run build && npx serve -s dist -l 3000");
  console.log(
    `[checklist] ${checklistPath} (${modes.join(", ")})`,
  );
  console.log(
    "[manual] Verify football-only sport picker, unsupported direct routes, and startup failure recovery UI on the reachable static target.",
  );
}

async function main(): Promise<void> {
  const { mode } = parseArgs();
  const target = resolveConvexTarget();
  const convexUrl = target.convexUrl;
  const selectedModes = getSelectedModes(mode);

  divider("Curated Gameplay Smoke");
  console.log(`[mode] ${mode}`);
  printResolvedConvexTarget(target, {
    label: "curated gameplay smoke target",
    safetyNote: "read-only parity verification plus startup mutations; destructive curated parity guard not engaged",
  });

  await checkCuratedSeedParity(convexUrl, selectedModes);
  await checkModeStarts(convexUrl, selectedModes);
  await printManualChecklist(mode);

  divider("Smoke Summary");
  console.log(`[pass] curated gameplay smoke checks completed for ${selectedModes.join(", ")}`);
}

main().catch((error) => {
  console.error("\n[curated-gameplay-smoke] failed");
  console.error(error);
  process.exit(1);
});
