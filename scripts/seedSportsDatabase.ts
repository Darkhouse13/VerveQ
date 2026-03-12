#!/usr/bin/env npx tsx
/**
 * seedSportsDatabase.ts — Seeds Convex with sports data from JSON files.
 *
 * Reads JSON files from scripts/data/, chunks into batches of 256,
 * and calls the corresponding seedSportsData mutations via the Convex HTTP API.
 *
 * Usage:
 *   npx tsx scripts/seedSportsDatabase.ts
 *   npx tsx scripts/seedSportsDatabase.ts --table statFacts   # seed one table only
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────────

const BATCH_SIZE = 256;
const DATA_DIR = path.resolve(__dirname, "data");

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
  statFacts: {
    jsonFile: "statFacts.json",
    mutation: "seedSportsData:seedStatFactsBatch",
    mapRecord: identity,
  },
  gridIndex: {
    jsonFile: "gridIndex.json",
    mutation: "seedSportsData:seedGridIndexBatch",
    mapRecord: identity,
  },
  whoAmIClues: {
    jsonFile: "whoAmIClues.json",
    mutation: "seedSportsData:seedWhoAmICluesBatch",
    mapRecord: identity,
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadConvexUrl(): string {
  const envPath = path.resolve(__dirname, "..", "frontend-web", ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing ${envPath} — run 'npx convex dev' in frontend-web first`);
  }
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^VITE_CONVEX_URL\s*=\s*(.+)/);
    if (match) return match[1].trim();
  }
  throw new Error("VITE_CONVEX_URL not found in .env.local");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function callMutation(
  convexUrl: string,
  mutationPath: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const url = `${convexUrl}/api/mutation`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: mutationPath, args, format: "json" }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mutation ${mutationPath} failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json.status === "error") {
    throw new Error(`Mutation ${mutationPath} error: ${json.errorMessage}`);
  }
  return json.value;
}

function formatProgress(done: number, total: number): string {
  const pct = ((done / total) * 100).toFixed(1);
  return `${done.toLocaleString()}/${total.toLocaleString()} (${pct}%)`;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function seedTable(convexUrl: string, tableName: string, config: TableConfig) {
  const filePath = path.join(DATA_DIR, config.jsonFile);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ Skipping ${tableName}: ${config.jsonFile} not found`);
    return;
  }

  console.log(`\n[${tableName}] Loading ${config.jsonFile}...`);
  const raw: Record<string, unknown>[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const records = raw.map(config.mapRecord);
  const batches = chunk(records, BATCH_SIZE);
  console.log(`[${tableName}] ${records.length.toLocaleString()} records → ${batches.length} batches`);

  let totalInserted = 0;
  for (let i = 0; i < batches.length; i++) {
    const result = (await callMutation(convexUrl, config.mutation, {
      records: batches[i],
    })) as { inserted: number } | null;
    totalInserted += result?.inserted ?? 0;

    // Log every 10 batches or on last batch
    if ((i + 1) % 10 === 0 || i === batches.length - 1) {
      const processed = Math.min((i + 1) * BATCH_SIZE, records.length);
      process.stdout.write(
        `\r  [${tableName}] ${formatProgress(processed, records.length)} — ${totalInserted.toLocaleString()} inserted`,
      );
    }
  }
  console.log(); // newline after progress
}

async function main() {
  const convexUrl = loadConvexUrl();
  console.log(`Convex URL: ${convexUrl}`);

  // Parse --table flag for single-table mode
  const tableArg = process.argv.indexOf("--table");
  const targetTable = tableArg !== -1 ? process.argv[tableArg + 1] : null;

  const tables = targetTable
    ? { [targetTable]: TABLE_CONFIGS[targetTable] }
    : TABLE_CONFIGS;

  if (targetTable && !TABLE_CONFIGS[targetTable]) {
    console.error(`Unknown table: ${targetTable}`);
    console.error(`Available: ${Object.keys(TABLE_CONFIGS).join(", ")}`);
    process.exit(1);
  }

  const order = ["sportsPlayers", "sportsTeams", "statFacts", "gridIndex", "whoAmIClues"];
  for (const tableName of order) {
    if (tables[tableName]) {
      await seedTable(convexUrl, tableName, tables[tableName]);
    }
  }

  console.log("\nSeeding complete!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
