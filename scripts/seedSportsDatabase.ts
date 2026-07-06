#!/usr/bin/env npx tsx
/**
 * seedSportsDatabase.ts — Seeds Convex with sports data from JSON files.
 *
 * Reads JSON files from scripts/data/, chunks into batches of 256,
 * and calls the corresponding internal seedSportsData functions with Convex
 * admin credentials loaded by the local Convex CLI.
 *
 * Usage:
 *   npx tsx scripts/seedSportsDatabase.ts
 *   npx tsx scripts/seedSportsDatabase.ts --table statFacts   # seed one table only
 *   npx tsx scripts/seedSportsDatabase.ts --include-legacy-grid-index
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import {
  CURATED_PARITY_APPLY_OPERATION_ENV,
  type ConvexTarget,
  printResolvedConvexTarget,
  resolveConvexTarget,
  validateCuratedParityApplySession,
} from "./curatedParityDeploymentSafety";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(REPO_ROOT, "app");
const CONVEX_ESM_DIR = path.join(APP_DIR, "node_modules", "convex", "dist", "esm");

// ── Config ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 256;
const DATA_DIR = path.resolve(__dirname, "data");
const REPLACE_FLAG = "--replace";
const SPORT_FLAG = "--sport";
const SEED_VERSION_FLAG = "--seed-version";
const SCOPE_FLAG = "--scope";
const MODE_FLAG = "--mode";
const ARTIFACT_HASH_FLAG = "--artifact-hash";
const ARTIFACT_PATH_FLAG = "--artifact-path";
const GENERATED_AT_FLAG = "--generated-at";
const GUARD_REPORT_FLAG = "--guard-report";

const AUTHORITATIVE_CURATED_TABLES = new Set([
  "sportsPlayers",
  "sportsTeams",
  "higherLowerPools",
  "higherLowerFacts",
  "verveGridApprovedIndex",
  "verveGridBoards",
]);

interface TableConfig {
  jsonFile: string;
  mutation: string;
  /** Map JSON `id` → Convex `externalId`, stripping `id` from the record */
  mapRecord: (raw: Record<string, unknown>) => Record<string, unknown>;
}

/** Strip null values (Convex treats optional fields as absent, not null) */
function stripNulls(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null) out[k] = v;
  }
  return out;
}

const identity = (raw: Record<string, unknown>) => {
  const { id, ...rest } = stripNulls(raw);
  return { externalId: id as string, ...rest };
};

const TABLE_CONFIGS: Record<string, TableConfig> = {
  sportsPlayers: {
    jsonFile: "players.json",
    mutation: "seedSportsData:seedPlayersBatch",
    mapRecord: identity,
  },
  sportsTeams: {
    jsonFile: "teams.json",
    mutation: "seedSportsData:seedTeamsBatch",
    mapRecord: identity,
  },
  higherLowerPools: {
    jsonFile: "higherLowerPools.json",
    mutation: "seedSportsData:seedHigherLowerPoolsBatch",
    mapRecord: identity,
  },
  higherLowerFacts: {
    jsonFile: "higherLowerFacts.json",
    mutation: "seedSportsData:seedHigherLowerFactsBatch",
    mapRecord: identity,
  },
  // The raw pipeline tables (statFacts, gridIndex, whoAmIClues) are no longer
  // Convex tables — gameplay reads only the approved layers, and the raw
  // artifacts stay local in scripts/data/*.json.
  verveGridApprovedIndex: {
    jsonFile: "verveGridApprovedIndex.json",
    mutation: "seedSportsData:seedVerveGridApprovedIndexBatch",
    mapRecord: identity,
  },
  verveGridBoards: {
    jsonFile: "verveGridBoards.json",
    mutation: "seedSportsData:seedVerveGridBoardsBatch",
    mapRecord: identity,
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

type ConvexAdminClient = {
  setAdminAuth: (token: string) => void;
  function: (
    functionReference: unknown,
    componentPath: string | undefined,
    args: unknown,
  ) => Promise<unknown>;
};

type ConvexAdminRuntime = {
  client: ConvexAdminClient;
  makeFunctionReference: (functionPath: string) => unknown;
};

type ConvexBrowserModule = {
  ConvexHttpClient: new (
    deploymentUrl: string,
    options?: Record<string, unknown>,
  ) => ConvexAdminClient;
};

type ConvexServerModule = {
  makeFunctionReference: (functionPath: string) => unknown;
};

type ConvexContextModule = {
  oneoffContext: (options: Record<string, unknown>) => Promise<unknown>;
};

type ConvexDeploymentSelectionModule = {
  getDeploymentSelection: (
    ctx: unknown,
    options: Record<string, unknown>,
  ) => Promise<unknown>;
};

type ConvexApiModule = {
  loadSelectedDeploymentCredentials: (
    ctx: unknown,
    deploymentSelection: unknown,
    options: { ensureLocalRunning: boolean },
  ) => Promise<{
    adminKey: string;
    url: string;
    deploymentFields?: { deploymentName?: string | null } | null;
  }>;
};

let adminRuntime: Promise<ConvexAdminRuntime> | null = null;

async function importConvexEsm<T>(relativePath: string): Promise<T> {
  const modulePath = path.join(CONVEX_ESM_DIR, relativePath);
  return (await import(pathToFileURL(modulePath).href)) as T;
}

const DEPLOY_KEY_ENV = "CONVEX_DEPLOY_KEY";

// Read a deploy key from the environment, falling back to app/.env.local. A
// deploy key lets the seeder authenticate WITHOUT convex's CLI/bundler ESM
// internals (bundler/context.js + cli/lib/*), whose undeclared, version-pinned
// transitive deps (@sentry/node v7, @sentry/tracing, fetch-retry, openapi-fetch,
// detect-port, chalk>=5.3, find-up>=6, …) are not installed in app/node_modules
// and crash the default credential path under tsx with convex 1.40.x. Generate
// one in the Convex dashboard (deployment → Settings → Deploy keys) for the
// target deployment.
function resolveAdminDeployKey(target: ConvexTarget): string | null {
  const fromEnv = process.env[DEPLOY_KEY_ENV]?.trim();
  if (fromEnv) return fromEnv;
  try {
    const raw = fs.readFileSync(target.envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*CONVEX_DEPLOY_KEY\s*=\s*(.+?)\s*$/);
      if (match) {
        const value = match[1].replace(/^["']|["']$/g, "").trim();
        if (value) return value;
      }
    }
  } catch {
    /* no .env.local or unreadable — fall through to the CLI credential path */
  }
  return null;
}

// Defense in depth: if the deploy key names a specific deployment
// ("<env>:<name>|<secret>"), it MUST match the pinned (allowlisted) target so a
// stray key can't authenticate against the wrong URL. Project-scoped keys
// ("project:…") carry no deployment name and are left as-is.
function assertDeployKeyMatchesTarget(
  deployKey: string,
  target: ConvexTarget,
): void {
  const head = deployKey.split("|")[0] ?? "";
  // Only the explicit "<env>:<name>|<secret>" deploy-key form self-describes a
  // deployment we can check. Project-scoped ("project:…") and opaque/bare keys
  // are left for convex to validate — it rejects a key that doesn't match the
  // deployment serving target.convexUrl, so a mismatch can't write to the wrong
  // place; this guard just turns the common typo into a clear error.
  if (!head.includes(":") || head.startsWith("project:")) return;
  const name = head.split(":").pop();
  if (name && name !== target.deploymentSlug) {
    throw new Error(
      `${DEPLOY_KEY_ENV} is scoped to "${name}" but the resolved target is "${target.deploymentSlug}". Refusing to use a mismatched key.`,
    );
  }
}

async function loadConvexAdminRuntime(
  target: ConvexTarget,
): Promise<ConvexAdminRuntime> {
  if (adminRuntime) return adminRuntime;

  adminRuntime = (async () => {
    const deployKey = resolveAdminDeployKey(target);
    if (deployKey) {
      // Durable path: authenticate with an explicit deploy key against the
      // pinned target URL, importing ONLY the lightweight browser/server
      // modules (no convex CLI/bundler internals → no missing-dep crash).
      assertDeployKeyMatchesTarget(deployKey, target);
      const [browserMod, serverMod] = await Promise.all([
        importConvexEsm<ConvexBrowserModule>("browser/index-node.js"),
        importConvexEsm<ConvexServerModule>("server/index.js"),
      ]);
      const client = new browserMod.ConvexHttpClient(target.convexUrl);
      client.setAdminAuth(deployKey);
      return { client, makeFunctionReference: serverMod.makeFunctionReference };
    }

    // Fallback path: resolve credentials via convex's CLI internals. Works
    // where convex's full CLI dependency tree is installed; if this throws
    // ERR_MODULE_NOT_FOUND (@sentry/node, fetch-retry, chalk, find-up, …), set
    // CONVEX_DEPLOY_KEY (see resolveAdminDeployKey) to use the path above.
    const [browserMod, serverMod, contextMod, selectionMod, apiMod] =
      await Promise.all([
        importConvexEsm<ConvexBrowserModule>("browser/index-node.js"),
        importConvexEsm<ConvexServerModule>("server/index.js"),
        importConvexEsm<ConvexContextModule>("bundler/context.js"),
        importConvexEsm<ConvexDeploymentSelectionModule>(
          "cli/lib/deploymentSelection.js",
        ),
        importConvexEsm<ConvexApiModule>("cli/lib/api.js"),
      ]);

    const ctx = await contextMod.oneoffContext({
      deployment: target.deploymentSlug,
    });
    const deploymentSelection = await selectionMod.getDeploymentSelection(ctx, {
      deployment: target.deploymentSlug,
    });
    const credentials = await apiMod.loadSelectedDeploymentCredentials(
      ctx,
      deploymentSelection,
      { ensureLocalRunning: false },
    );

    if (credentials.url !== target.convexUrl) {
      throw new Error(
        `Resolved Convex credentials URL ${credentials.url} does not match target ${target.convexUrl}`,
      );
    }

    const client = new browserMod.ConvexHttpClient(credentials.url);
    client.setAdminAuth(credentials.adminKey);
    return { client, makeFunctionReference: serverMod.makeFunctionReference };
  })();

  return adminRuntime;
}

async function callInternalFunction(
  target: ConvexTarget,
  functionPath: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const runtime = await loadConvexAdminRuntime(target);
  return await runtime.client.function(
    runtime.makeFunctionReference(functionPath),
    undefined,
    args,
  );
}

function formatProgress(done: number, total: number): string {
  const pct = ((done / total) * 100).toFixed(1);
  return `${done.toLocaleString()}/${total.toLocaleString()} (${pct}%)`;
}

function getArgValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function loadRecords(
  tableName: string,
  config: TableConfig,
  sport: string | null,
): Record<string, unknown>[] {
  const filePath = path.join(DATA_DIR, config.jsonFile);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ Skipping ${tableName}: ${config.jsonFile} not found`);
    return [];
  }

  const raw: Record<string, unknown>[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const filtered = sport
    ? raw.filter((record) => record.sport === sport)
    : raw;
  return filtered.map(config.mapRecord);
}

type SeedTableOptions = {
  replaceExisting: boolean;
  sport: string | null;
  seedVersion: string | null;
  scopeKey: string | null;
  mode: string | null;
  artifactHash: string | null;
  artifactPath: string | null;
  generatedAt: string | null;
};

type GuardReportMode = "full" | "compact";

function getGuardReportMode(): GuardReportMode {
  return getArgValue(GUARD_REPORT_FLAG) === "compact" ? "compact" : "full";
}

function printDirectDestructiveEntryPointGuidance(): void {
  console.log(
    "[next] Direct destructive seed entry points stay blocked by default. Start with: cd app && npm run gameplay:curated-parity:status",
  );
  console.log(
    "[next] If the target is ready, run the wrapper flow instead: cd app && npm run gameplay:curated-parity",
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

async function seedTable(
  target: ConvexTarget,
  tableName: string,
  config: TableConfig,
  options: SeedTableOptions,
) {
  console.log(`\n[${tableName}] Loading ${config.jsonFile}...`);
  const records = loadRecords(tableName, config, options.sport);
  if (records.length === 0) {
    console.warn(`  ⚠ Skipping ${tableName}: no matching records found`);
    return;
  }

  let totalDeleted = 0;
  if (options.replaceExisting) {
    console.log(`[${tableName}] Clearing existing ${options.sport} rows before authoritative reseed...`);
    while (true) {
      const clearResult = (await callInternalFunction(
        target,
        "seedSportsData:clearCuratedSeedTablePage",
        {
          tableName,
          sport: options.sport,
        },
      )) as { deletedCount: number; hasMore: boolean };

      totalDeleted += clearResult.deletedCount;
      if (clearResult.deletedCount === 0 || !clearResult.hasMore) {
        if (clearResult.deletedCount === 0) {
          break;
        }
      }
      if (clearResult.deletedCount === 0) break;
    }
    console.log(
      `[${tableName}] Cleared ${totalDeleted.toLocaleString()} existing ${options.sport} rows`,
    );
  }

  const batches = chunk(records, BATCH_SIZE);
  console.log(`[${tableName}] ${records.length.toLocaleString()} records → ${batches.length} batches`);

  let totalInserted = 0;
  let totalReplaced = 0;
  for (let i = 0; i < batches.length; i++) {
    const result = (await callInternalFunction(target, config.mutation, {
      records: batches[i],
      seedVersion: options.seedVersion ?? undefined,
      replaceExisting: undefined,
    })) as { inserted: number; replaced?: number } | null;
    totalInserted += result?.inserted ?? 0;
    totalReplaced += result?.replaced ?? 0;

    // Log every 10 batches or on last batch
    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      const processed = Math.min((i + 1) * BATCH_SIZE, records.length);
      process.stdout.write(
        `\r  [${tableName}] ${formatProgress(processed, records.length)} — ${totalInserted.toLocaleString()} inserted, ${totalReplaced.toLocaleString()} replaced`,
      );
    }
  }
  console.log(); // newline after progress

  if (!options.replaceExisting) {
    return;
  }

  if (
    !options.sport ||
    !options.seedVersion ||
    !options.scopeKey ||
    !options.mode ||
    !options.artifactHash ||
    !options.artifactPath ||
    !options.generatedAt
  ) {
    throw new Error(
      `Authoritative replace for ${tableName} requires ${SPORT_FLAG}, ${SEED_VERSION_FLAG}, ${SCOPE_FLAG}, ${MODE_FLAG}, ${ARTIFACT_HASH_FLAG}, ${ARTIFACT_PATH_FLAG}, and ${GENERATED_AT_FLAG}`,
    );
  }

  const finalizeResult = (await callInternalFunction(
    target,
    "seedSportsData:storeCuratedSeedMetadata",
    {
      scopeKey: options.scopeKey,
      tableName,
      sport: options.sport,
      mode: options.mode,
      artifactPath: options.artifactPath,
      seedVersion: options.seedVersion,
      artifactHash: options.artifactHash,
      recordCount: records.length,
      insertedCount: totalInserted,
      replacedCount: totalReplaced,
      deletedCount: totalDeleted,
      generatedAt: options.generatedAt,
    },
  )) as {
    deletedCount: number;
    insertedCount: number;
    replacedCount: number;
    seedVersion: string;
  };

  console.log(
    `  [${tableName}] authoritative parity applied — inserted=${finalizeResult.insertedCount.toLocaleString()}, replaced=${finalizeResult.replacedCount.toLocaleString()}, deleted=${finalizeResult.deletedCount.toLocaleString()}, seedVersion=${finalizeResult.seedVersion}`,
  );
}

async function main() {
  // Parse --table flag for single-table mode.
  const tableArg = process.argv.indexOf("--table");
  const targetTable = tableArg !== -1 ? process.argv[tableArg + 1] : null;
  const replaceExisting = process.argv.includes(REPLACE_FLAG);
  const guardReportMode = getGuardReportMode();
  const sport = getArgValue(SPORT_FLAG);
  const seedVersion = getArgValue(SEED_VERSION_FLAG);
  const scopeKey = getArgValue(SCOPE_FLAG);
  const mode = getArgValue(MODE_FLAG);
  const artifactHash = getArgValue(ARTIFACT_HASH_FLAG);
  const artifactPath = getArgValue(ARTIFACT_PATH_FLAG);
  const generatedAt = getArgValue(GENERATED_AT_FLAG);
  const target = resolveConvexTarget();

  const tables = targetTable
    ? { [targetTable]: TABLE_CONFIGS[targetTable] }
    : TABLE_CONFIGS;

  if (targetTable && !TABLE_CONFIGS[targetTable]) {
    console.error(`Unknown table: ${targetTable}`);
    console.error(`Available: ${Object.keys(TABLE_CONFIGS).join(", ")}`);
    process.exit(1);
  }

  if (replaceExisting) {
    if (!targetTable) {
      throw new Error("Authoritative replace requires a single --table target");
    }
    if (!AUTHORITATIVE_CURATED_TABLES.has(targetTable)) {
      throw new Error(
        `Authoritative replace is only supported for curated runtime tables: ${Array.from(AUTHORITATIVE_CURATED_TABLES).join(", ")}`,
      );
    }
    if (!sport) {
      throw new Error(`Authoritative replace requires ${SPORT_FLAG} to scope deletions safely`);
    }
    if (!seedVersion) {
      throw new Error(`Authoritative replace requires ${SEED_VERSION_FLAG}`);
    }
    if (!scopeKey) {
      throw new Error(`Authoritative replace requires ${SCOPE_FLAG}`);
    }
    if (!mode) {
      throw new Error(`Authoritative replace requires ${MODE_FLAG}`);
    }
    if (!artifactHash) {
      throw new Error(`Authoritative replace requires ${ARTIFACT_HASH_FLAG}`);
    }
    if (!artifactPath) {
      throw new Error(`Authoritative replace requires ${ARTIFACT_PATH_FLAG}`);
    }
    if (!generatedAt) {
      throw new Error(`Authoritative replace requires ${GENERATED_AT_FLAG}`);
    }

    const sessionValidation = validateCuratedParityApplySession(target, {
      scopeKey,
      seedVersion,
      operationId: process.env[CURATED_PARITY_APPLY_OPERATION_ENV]?.trim() || null,
    });

    if (guardReportMode === "compact" && sessionValidation.allowed) {
      console.log(
        `[safety] destructive curated parity apply session validated for ${target.deploymentName} -> ${target.convexUrl} (session=${sessionValidation.session?.sessionId}, approval=${sessionValidation.session?.approvalId})`,
      );
    } else if (!sessionValidation.allowed) {
      console.log(
        "[blocked] Direct destructive curated parity entry point refused before any clear-and-reseed step.",
      );
      for (const reason of sessionValidation.reasons) {
        console.log(`[blocked] ${reason}`);
      }
      printDirectDestructiveEntryPointGuidance();
    }

    if (!sessionValidation.allowed) {
      process.exit(1);
      return;
    }
  } else {
    printResolvedConvexTarget(target, {
      label: "seedSportsDatabase target",
      safetyNote: "non-destructive seed run; curated parity clear-and-reseed guard not engaged",
    });
  }

  const order = [
    "sportsPlayers",
    "sportsTeams",
    "higherLowerPools",
    "higherLowerFacts",
    "verveGridApprovedIndex",
    "verveGridBoards",
  ];

  for (const tableName of order) {
    if (tables[tableName]) {
      await seedTable(target, tableName, tables[tableName], {
        replaceExisting,
        sport,
        seedVersion,
        scopeKey,
        mode,
        artifactHash,
        artifactPath,
        generatedAt,
      });
    }
  }

  console.log("\nSeeding complete!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
