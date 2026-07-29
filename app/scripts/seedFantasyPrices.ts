/**
 * Weekend Fantasy — editorial price seeding (FW-PR2 Step 3).
 *
 * Writes `research/fantasy/pricing/price-final.json` onto `fantasyPlayers.price`
 * via the internal mutation `fantasyIngest:applyPrices`, in chunks.
 *
 *   npx tsx scripts/seedFantasyPrices.ts             # plan: target + summary, no writes
 *   npx tsx scripts/seedFantasyPrices.ts --execute   # run the mutation
 *   npx tsx scripts/seedFantasyPrices.ts --verify    # re-read prices and diff vs the file
 *
 * ── Why a driver and not `convex import` ──
 *
 * An import replaces documents. Every `fantasySquadSlots.playerId` is a
 * `v.id("fantasyPlayers")`, so replacing the table would break every squad that
 * references it. Prices are a PATCH of one field on rows FW-2 already created,
 * which is what `applyPrices` does — same shape as the FW-2 bootstrap, where a
 * local driver feeds a chunked internal mutation.
 *
 * ── Target ──
 *
 * `guardTarget()` with no `allowLive` opt-in, so a resolved live deployment
 * (different-lynx-153) throws before anything is spawned; this pass is
 * DEV-only by ticket. The resolved deployment name is then passed to every
 * `convex run` explicitly, so the deployment that was guarded is provably the
 * deployment that is written to rather than whatever the CLI would default to.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { guardTarget } from "./lib/deployTarget";
import { isOnPriceScale, PRICE_MAX, PRICE_MIN } from "../convex/lib/fantasyConstants";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICE_FINAL_PATH = path.resolve(
  APP_DIR,
  "..",
  "research",
  "fantasy",
  "pricing",
  "price-final.json",
);
/** The pre-seed `convex export` the pricing universe was derived from — the
 *  baseline `--verify` proves nothing but `price` moved against. */
const BASELINE_PATH = path.resolve(
  APP_DIR,
  "..",
  "research",
  "fantasy",
  "pricing",
  "data",
  "players-seed-snapshot.json",
);

/** Chunk size. 2,895 rows is one index read + one patch each — far more than
 *  a single transaction should carry, and small chunks keep a failure local. */
const CHUNK_SIZE = 250;
const EXPECTED_ROWS = 2_895;

interface PricedPlayer {
  apiFootballId: number;
  name: string;
  club: string;
  position: string;
  price: number;
}

interface ApplyResult {
  requested: number;
  updated: number;
  unchanged: number;
  missing: string[];
}

function loadPrices(): PricedPlayer[] {
  const file = JSON.parse(fs.readFileSync(PRICE_FINAL_PATH, "utf8")) as {
    manifest: { overrideCount: number; draftCommit: string };
    players: PricedPlayer[];
  };
  const players = file.players;

  if (players.length !== EXPECTED_ROWS) {
    throw new Error(`price-final.json holds ${players.length} rows, expected ${EXPECTED_ROWS}`);
  }
  const ids = new Set(players.map((p) => p.apiFootballId));
  if (ids.size !== players.length) throw new Error("duplicate apiFootballId in price-final.json");
  for (const p of players) {
    if (!isOnPriceScale(p.price)) {
      throw new Error(
        `${p.name} is priced ${p.price}, off the ${PRICE_MIN}-${PRICE_MAX} half-step scale`,
      );
    }
  }
  console.log(
    `source=price-final.json rows=${players.length} overrides=${file.manifest.overrideCount} draftCommit=${file.manifest.draftCommit.slice(0, 7)}`,
  );
  return players;
}

/** Run a Convex function on the guarded deployment and return its parsed result. */
function convexRun(deployment: string, fn: string, args: unknown): unknown {
  const result = spawnSync(
    "npx",
    [
      "convex",
      "run",
      fn,
      JSON.stringify(args),
      "--deployment",
      deployment,
      "--typecheck",
      "disable",
    ],
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
    // A result we cannot read is a result we cannot check `missing` against,
    // so it is a stop rather than a warning.
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

/**
 * Re-export `fantasyPlayers` and check the write did exactly what it claimed:
 * every price equals price-final.json, and NOTHING else moved.
 *
 * The baseline for "nothing else" is the pre-seed export the pricing universe
 * was built from (pricing/data/players-seed-snapshot.json). Comparing against
 * it rather than against the price file is the point — a run that quietly
 * renamed a player or flipped `active` would satisfy every price assertion and
 * still be a bad write.
 */
function verifyByReExport(deployment: string, players: PricedPlayer[]): void {
  const zipPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "fantasy-price-verify-")),
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
  console.log(`re-export: ${rows.length} fantasyPlayers rows`);

  const problems: string[] = [];
  const byProviderId = new Map(rows.map((r) => [r.providerPlayerId, r]));
  if (byProviderId.size !== rows.length) problems.push("duplicate providerPlayerId in the export");

  const priced = rows.filter((r) => r.price !== null);
  const unpriced = rows.length - priced.length;

  for (const p of players) {
    const row = byProviderId.get(String(p.apiFootballId));
    if (row === undefined) problems.push(`${p.name} (${p.apiFootballId}): no row in the export`);
    else if (row.price !== p.price) problems.push(`${p.name}: stored ${row.price} != file ${p.price}`);
  }
  const inFile = new Set(players.map((p) => String(p.apiFootballId)));
  for (const row of rows) {
    if (!inFile.has(row.providerPlayerId)) {
      problems.push(`row ${row.providerPlayerId} (${row.name}) is in the table but not in price-final.json`);
    }
  }

  // ── nothing but `price` moved ──
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")) as {
    exportedAt: string;
    count: number;
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
  console.log(`baseline: players-seed-snapshot.json exportedAt=${baseline.exportedAt} count=${baseline.count}`);

  const baseById = new Map(baseline.players.map((b) => [String(b.apiFootballId), b]));
  let fieldDiffs = 0;
  for (const row of rows) {
    const base = baseById.get(row.providerPlayerId);
    if (base === undefined) {
      problems.push(`row ${row.providerPlayerId} is absent from the pre-seed baseline`);
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

  console.log(`priced ${priced.length}, unpriced ${unpriced}, non-price field diffs vs baseline ${fieldDiffs}`);
  if (problems.length > 0) {
    console.error(`STOP: ${problems.length} problem(s)`);
    for (const p of problems.slice(0, 25)) console.error(`  ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `verified: ${priced.length} non-null prices, all equal to price-final.json; 0 unpriced; 0 diffs in any other field`,
  );
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
    console.error(`STOP: ${missing.length} provider id(s) in price-final.json have no row: ${missing.slice(0, 20).join(", ")}`);
    process.exitCode = 1;
  }
}

main();
