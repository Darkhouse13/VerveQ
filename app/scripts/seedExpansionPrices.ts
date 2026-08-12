/**
 * MISSION FW-EXPAND O2 — seed the expansion cohorts' prices onto DEV.
 *
 * The expansion sibling of seedFantasyPrices.ts, and the same discipline:
 * writes research/fantasy/pricing/expansion-price-final.json onto
 * `fantasyPlayers.price` via `fantasyIngest:applyPrices`, in chunks, patching
 * one field on rows FW-EXPAND O1 already created and touching nothing else.
 *
 *   npx tsx scripts/seedExpansionPrices.ts             # plan, no writes
 *   npx tsx scripts/seedExpansionPrices.ts --execute   # run the mutation
 *   npx tsx scripts/seedExpansionPrices.ts --verify    # re-read and diff
 *
 * DEV-PINNED exactly like its sibling: `guardTarget()` with no allowLive
 * opt-in throws on a resolved live deployment before anything is spawned.
 * Prod receives the expansion data through the O7 import discipline, never
 * through this script.
 *
 * `--verify` proves the write did what it claimed for THE EXPANSION SLICE:
 * every leagueId-88/94/40 row's price equals the artifact, and no other field
 * moved against the pre-pricing snapshot
 * (pricing/data/expansion-players-snapshot.json). Rows outside the expansion
 * leagues are asserted untouched by count only — their own seed pass
 * (seedFantasyPrices --verify) owns their field-level checks.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { guardTarget } from "./lib/deployTarget";
import { isOnPriceScale, PRICE_MAX, PRICE_MIN } from "../convex/lib/fantasyConstants";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICING_DIR = path.resolve(APP_DIR, "..", "research", "fantasy", "pricing");
const PRICE_FINAL_PATH = path.join(PRICING_DIR, "expansion-price-final.json");
const BASELINE_PATH = path.join(PRICING_DIR, "data", "expansion-players-snapshot.json");

const CHUNK_SIZE = 250;
const EXPECTED_ROWS = 1_780;
const EXPANSION_LEAGUE_IDS = new Set([88, 94, 40]);
const BAND_TOP = 7.5;

interface PricedPlayer {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubName: string;
  leagueId: number;
  position: string;
  pool: string;
  price: number;
  overridden?: boolean;
}

interface ApplyResult {
  requested: number;
  updated: number;
  unchanged: number;
  missing: string[];
}

function loadPrices(): PricedPlayer[] {
  const file = JSON.parse(fs.readFileSync(PRICE_FINAL_PATH, "utf8")) as {
    manifest: { overridesApplied: number };
    players: PricedPlayer[];
  };
  const players = file.players;

  if (players.length !== EXPECTED_ROWS) {
    throw new Error(`expansion-price-final.json holds ${players.length} rows, expected ${EXPECTED_ROWS}`);
  }
  const ids = new Set(players.map((p) => p.apiFootballId));
  if (ids.size !== players.length) throw new Error("duplicate apiFootballId in expansion-price-final.json");
  for (const p of players) {
    if (!isOnPriceScale(p.price)) {
      throw new Error(`${p.name} is priced ${p.price}, off the ${PRICE_MIN}-${PRICE_MAX} half-step scale`);
    }
    if (!p.overridden && p.price > BAND_TOP) {
      throw new Error(`${p.name} is priced ${p.price}, above the R1 band top ${BAND_TOP}`);
    }
    if (!EXPANSION_LEAGUE_IDS.has(p.leagueId)) {
      throw new Error(`${p.name} carries league ${p.leagueId}, outside the expansion set`);
    }
  }
  console.log(
    `source=expansion-price-final.json rows=${players.length} overrides=${file.manifest.overridesApplied}`,
  );
  return players;
}

function convexRun(deployment: string, fn: string, args: unknown): unknown {
  const result = spawnSync(
    "npx",
    ["convex", "run", fn, JSON.stringify(args), "--deployment", deployment, "--typecheck", "disable"],
    { cwd: APP_DIR, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`convex run ${fn} failed with exit code ${result.status}`);
  }
  const stdout = (result.stdout ?? "").trim();
  if (stdout.length === 0) return null;
  try {
    return JSON.parse(stdout);
  } catch {
    process.stderr.write(`${stdout}\n`);
    throw new Error(`could not parse the result of ${fn} as JSON`);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function priceHistogram(players: PricedPlayer[]): string {
  const counts = new Map<number, number>();
  for (const p of players) counts.set(p.price, (counts.get(p.price) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([price, n]) => `${price.toFixed(1)}:${n}`)
    .join(" ");
}

interface ExportedPlayer {
  _id: string;
  providerPlayerId: string;
  name: string;
  clubId: string;
  leagueId: number;
  feedPosition: string;
  price: number | null;
  active: boolean;
}

function verifyByReExport(deployment: string, players: PricedPlayer[]): void {
  const zipPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "fantasy-expansion-verify-")),
    "snapshot.zip",
  );
  const exported = spawnSync(
    "npx",
    ["convex", "export", "--path", zipPath, "--deployment", deployment],
    { cwd: APP_DIR, encoding: "utf8", shell: process.platform === "win32" },
  );
  if (exported.status !== 0) {
    process.stderr.write(exported.stderr ?? "");
    throw new Error(`convex export failed with exit code ${exported.status}`);
  }

  const jsonl = spawnSync("unzip", ["-p", zipPath, "fantasyPlayers/documents.jsonl"], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (jsonl.status !== 0) throw new Error("could not read fantasyPlayers from the export");

  const rows = jsonl.stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ExportedPlayer);
  const expansionRows = rows.filter((r) => EXPANSION_LEAGUE_IDS.has(r.leagueId));
  console.log(`re-export: ${rows.length} fantasyPlayers rows, ${expansionRows.length} in expansion leagues`);

  const problems: string[] = [];
  const byProviderId = new Map(expansionRows.map((r) => [r.providerPlayerId, r]));
  if (byProviderId.size !== expansionRows.length) problems.push("duplicate providerPlayerId in the expansion slice");

  for (const p of players) {
    const row = byProviderId.get(String(p.apiFootballId));
    if (row === undefined) problems.push(`${p.name} (${p.apiFootballId}): no expansion row in the export`);
    else if (row.price !== p.price) problems.push(`${p.name}: stored ${row.price} != file ${p.price}`);
  }
  const inFile = new Set(players.map((p) => String(p.apiFootballId)));
  for (const row of expansionRows) {
    if (!inFile.has(row.providerPlayerId)) {
      problems.push(`row ${row.providerPlayerId} (${row.name}) is in the expansion slice but not in the artifact`);
    }
  }

  // nothing but price moved, against the pre-pricing snapshot
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) as {
    manifest: { count: number };
    players: {
      convexId: string;
      apiFootballId: number;
      name: string;
      clubId: number;
      leagueId: number;
      position: string;
      active: boolean;
    }[];
  };
  const baseById = new Map(baseline.players.map((b) => [String(b.apiFootballId), b]));
  let fieldDiffs = 0;
  for (const row of expansionRows) {
    const base = baseById.get(row.providerPlayerId);
    if (base === undefined) {
      problems.push(`row ${row.providerPlayerId} is absent from the pre-pricing baseline`);
      continue;
    }
    const diffs: string[] = [];
    if (row._id !== base.convexId) diffs.push(`_id ${base.convexId} -> ${row._id}`);
    if (row.name !== base.name) diffs.push(`name "${base.name}" -> "${row.name}"`);
    if (row.clubId !== String(base.clubId)) diffs.push(`clubId ${base.clubId} -> ${row.clubId}`);
    if (row.leagueId !== base.leagueId) diffs.push(`leagueId ${base.leagueId} -> ${row.leagueId}`);
    if (row.feedPosition !== base.position) diffs.push(`position ${base.position} -> ${row.feedPosition}`);
    if (row.active !== base.active) diffs.push(`active ${base.active} -> ${row.active}`);
    if (diffs.length > 0) {
      fieldDiffs += 1;
      problems.push(`${row.name} (${row.providerPlayerId}): ${diffs.join("; ")}`);
    }
  }

  console.log(`expansion prices checked ${players.length}, non-price field diffs vs baseline ${fieldDiffs}`);
  if (problems.length > 0) {
    console.error(`STOP: ${problems.length} problem(s)`);
    for (const p of problems.slice(0, 25)) console.error(`  ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log("verified: every expansion price equals the artifact; 0 diffs in any other field");
}

function main(): void {
  const flags = new Set(process.argv.slice(2));
  const execute = flags.has("--execute");
  const verify = flags.has("--verify");

  // No allowLive: a live target throws here, before any spawn.
  const target = guardTarget();
  const deployment = target.deploymentName;
  if (deployment === null) {
    throw new Error("Could not resolve a deployment NAME to pin the writes to; refusing to guess.");
  }
  console.log(`mode=${verify ? "verify" : execute ? "execute" : "plan"}`);
  console.log(`target=${deployment} (source=${target.source})`);

  const players = loadPrices();
  console.log(`histogram ${priceHistogram(players)}`);

  if (verify) {
    verifyByReExport(deployment, players);
    return;
  }

  const chunks = chunk(players, CHUNK_SIZE);
  if (!execute) {
    console.log(`chunks=${chunks.length} of <=${CHUNK_SIZE} (pass --execute to run fantasyIngest:applyPrices)`);
    return;
  }

  let updated = 0;
  let unchanged = 0;
  const missing: string[] = [];
  chunks.forEach((rows, i) => {
    const result = convexRun(deployment, "fantasyIngest:applyPrices", {
      prices: rows.map((p) => ({ providerPlayerId: String(p.apiFootballId), price: p.price })),
    }) as ApplyResult;
    updated += result.updated;
    unchanged += result.unchanged;
    missing.push(...result.missing);
    console.log(
      `  chunk ${i + 1}/${chunks.length}: requested ${result.requested}, updated ${result.updated}, unchanged ${result.unchanged}, missing ${result.missing.length}`,
    );
  });

  console.log(`applied: updated ${updated}, unchanged ${unchanged}, missing ${missing.length}`);
  if (missing.length > 0) {
    console.error(
      `STOP: ${missing.length} provider id(s) in the artifact have no row: ${missing.slice(0, 20).join(", ")}`,
    );
    process.exitCode = 1;
  }
}

main();
