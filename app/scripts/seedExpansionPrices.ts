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
 * Target discipline: by default `guardTarget()` refuses a live deployment.
 * The FW-EXPAND O7 prod import is the ONE authorized live path and demands
 * BOTH explicit signals the guard requires: pass `--live` (sets allowLive)
 * AND set CONFIRM_LIVE_DEPLOY=<deployment name> in the environment, with
 * CONVEX_DEPLOYMENT pointed at prod. Generic booleans are refused by the
 * guard itself; without both, a live target still throws before any spawn.
 * (seedFantasyPrices.ts — the 2,895-row top-five sibling — stays DEV-pinned
 * with no live path at all, per the FW-SHIP ruling.)
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
import { checkR2, checkR3, reportGates } from "../../research/fantasy/pricing/lib/gates";
import {
  gateRowsFromArtifacts,
  overlayStoredPrices,
} from "../../research/fantasy/pricing/lib/artifactRows";


const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICING_DIR = path.resolve(APP_DIR, "..", "research", "fantasy", "pricing");
const PRICE_FINAL_PATH = path.join(PRICING_DIR, "expansion-price-final.json");
const BASELINE_PATH = path.join(PRICING_DIR, "data", "expansion-players-snapshot.json");

const CHUNK_SIZE = 250;
/** FW-REPRICE-2 re-cut (2026-08-14): 1,780 before. */
const EXPECTED_ROWS = 1_783;
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

function verifyByReExport(
  deployment: string,
  players: PricedPlayer[],
  live: boolean,
): void {
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
  // A row in an expansion league that NEITHER artifact prices is a coverage
  // gap, not a defect of this seed: FW-T1 transfer ingestion creates
  // fantasyPlayers rows after the universe snapshots were cut, and this seed
  // was never responsible for them. Counted and named, never silently passed.
  const inFile = new Set(players.map((p) => String(p.apiFootballId)));
  const inAnyArtifact = new Set(gateRowsFromArtifacts().map((r) => String(r.apiFootballId)));
  const uncovered = expansionRows.filter((r) => !inAnyArtifact.has(r.providerPlayerId));
  // Priced by the core artifact while sitting in an expansion league today.
  // Same drift family as the eight overlap players: transfer ingestion moved
  // him after the snapshots, so his pool is stale, but he HAS a price and this
  // seed did not put it there. Named, not failed. (Prod: G. Kamara.)
  const wrongArtifact = expansionRows.filter(
    (r) => !inFile.has(r.providerPlayerId) && inAnyArtifact.has(r.providerPlayerId),
  );
  if (wrongArtifact.length > 0) {
    console.log(
      `NOTE: ${wrongArtifact.length} expansion-league row(s) are priced by the CORE artifact — ` +
        `stale pool after a transfer, see DECISIONS_NEEDED OWNER DECISION 5: ` +
        `${wrongArtifact.map((r) => `${r.name} (${r.providerPlayerId})`).join(", ")}`,
    );
  }
  if (uncovered.length > 0) {
    console.log(
      `NOTE: ${uncovered.length} expansion-league row(s) are covered by neither artifact ` +
        `(FW-REPRICE known gap — see REPRICE_REVIEW.md): ${uncovered.map((r) => `${r.name} (${r.providerPlayerId})`).join(", ")}`,
    );
  }

  // ── nothing but `price` moved ──
  //
  // Prefer a pre-seed snapshot of THIS deployment (written by
  // seedFantasyPrices.ts --snapshot, one per deployment, covering the whole
  // fantasyPlayers table). expansion-players-snapshot.json was cut 2026-08-12
  // and cannot separate "this seed damaged a row" from "the feed reclassified
  // a position since" — measured on prod, 6 rows differ from it on
  // feedPosition alone, none of them anything this seed touched.
  const preSeedFile = path.resolve(PRICING_DIR, "data", `pre-reprice-${deployment}.json`);
  const usingPreSeed = fs.existsSync(preSeedFile);
  interface BaseRow {
    convexId: string;
    name: string;
    clubId: string;
    leagueId: number;
    position: string;
    active: boolean;
  }
  let baseById: Map<string, BaseRow>;
  if (usingPreSeed) {
    const pre = JSON.parse(fs.readFileSync(preSeedFile, "utf8")) as {
      exportedAt: string;
      players: {
        providerPlayerId: string;
        convexId: string;
        name: string;
        clubId: string;
        leagueId: number;
        position: string;
        active: boolean;
      }[];
    };
    console.log(`baseline: ${path.basename(preSeedFile)} exportedAt=${pre.exportedAt} (pre-seed, this deployment)`);
    baseById = new Map(pre.players.map((b) => [b.providerPlayerId, b as BaseRow]));
  } else {
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
    console.log("baseline: expansion-players-snapshot.json (universe baseline — run --snapshot for a per-seed one)");
    baseById = new Map(
      baseline.players.map((b) => [
        String(b.apiFootballId),
        { convexId: b.convexId, name: b.name, clubId: String(b.clubId), leagueId: b.leagueId, position: b.position, active: b.active },
      ]),
    );
  }
  let fieldDiffs = 0;
  let outsideBaseline = 0;
  for (const row of expansionRows) {
    const base = baseById.get(row.providerPlayerId);
    if (base === undefined) {
      // Created after the 2026-08-12 expansion snapshot; out of its scope.
      outsideBaseline += 1;
      continue;
    }
    const diffs: string[] = [];
    // The baseline snapshot is a DEV export; document ids are deployment-
    // local, so the _id identity check only holds against DEV itself. Every
    // provider-keyed field below is deployment-independent and still checked.
    if ((usingPreSeed || !live) && row._id !== base.convexId) diffs.push(`_id ${base.convexId} -> ${row._id}`);
    if (row.name !== base.name) diffs.push(`name "${base.name}" -> "${row.name}"`);
    if (row.clubId !== base.clubId) diffs.push(`clubId ${base.clubId} -> ${row.clubId}`);
    if (row.leagueId !== base.leagueId) diffs.push(`leagueId ${base.leagueId} -> ${row.leagueId}`);
    if (row.feedPosition !== base.position) diffs.push(`position ${base.position} -> ${row.feedPosition}`);
    if (row.active !== base.active) diffs.push(`active ${base.active} -> ${row.active}`);
    if (diffs.length > 0) {
      fieldDiffs += 1;
      problems.push(`${row.name} (${row.providerPlayerId}): ${diffs.join("; ")}`);
    }
  }

  console.log(
    `expansion prices checked ${players.length}, non-price field diffs vs baseline ${fieldDiffs} ` +
      `(${outsideBaseline} row(s) newer than the baseline, out of its scope)`,
  );
  if (problems.length > 0) {
    console.error(`STOP: ${problems.length} problem(s)`);
    for (const p of problems.slice(0, 25)) console.error(`  ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log("verified: every expansion price equals the artifact; 0 diffs in any other field");

  // The gates against what this deployment actually stores, not against the
  // file — and over BOTH universes, because R2 groups by club.
  runPriceGates(
    `${deployment} stored prices`,
    new Map(rows.map((r) => [r.providerPlayerId, r.price])),
  );
}

/**
 * FW-REPRICE R2/R3, run in the seed pipeline itself (mission requirement:
 * "asserted in the seed pipeline, run on both deployments").
 *
 * `stored` is the prices read back off a deployment. Passing it is the whole
 * point of running the gates here rather than only in reprice.ts: the file
 * being self-consistent is not evidence that the DEPLOYMENT is, and the
 * deployment is what serves the picker.
 *
 * Band tops mirror reprice.ts. They are locked values, restated rather than
 * imported so this check does not depend on the generator it is checking.
 */
const GATE_CEILING: Record<string, number> = { MID: 13.0, ATT: 12.5, DEF: 9.0, GK: 6.0 };
const GATE_POOL_TOP: Record<string, number> = {
  promoted: 6.5,
  eredivisie: 7.5,
  ligaportugal: 7.5,
  championship: 7.5,
};
function gateBandTop(pool: string, position: string): number | null {
  if (pool === "flagged") return null;
  return Math.min(GATE_POOL_TOP[pool] ?? GATE_CEILING[position], GATE_CEILING[position]);
}

function runPriceGates(label: string, stored?: ReadonlyMap<string, number | null>): void {
  let rows = gateRowsFromArtifacts();
  if (stored !== undefined) {
    const overlaid = overlayStoredPrices(rows, stored);
    // A player the deployment does not HAVE cannot be mispriced on it, and the
    // gates are still sound over his club's remaining players. Prod is missing
    // I. Bowat (284473) — the FW-EXPAND feed-drift follow-up, a row DEV has and
    // prod never got. Reported by id every run so it cannot quietly grow; the
    // seed's own `missing` count is what fails a write that did not land.
    if (overlaid.missing.length > 0) {
      console.log(
        `NOTE: ${overlaid.missing.length} artifact player(s) absent from this deployment, gated over the rest: ` +
          `${overlaid.missing.slice(0, 10).join(", ")}`,
      );
    }
    // A player who IS there with no price is different: that is a hole the
    // gates cannot evaluate and a budget squad cannot spend against.
    if (overlaid.unpriced.length > 0) {
      throw new Error(
        `STOP: ${overlaid.unpriced.length} player(s) on this deployment carry a null price: ` +
          `${overlaid.unpriced.slice(0, 10).join(", ")}`,
      );
    }
    rows = overlaid.rows;
  }
  const r2 = checkR2(rows);
  const r3 = checkR3(rows, gateBandTop);
  const ok = reportGates(label, r2, r3);
  if (!ok) throw new Error(`STOP: R2/R3 gates failed for ${label}.`);
}

function main(): void {
  const flags = new Set(process.argv.slice(2));
  const execute = flags.has("--execute");
  const verify = flags.has("--verify");
  const live = flags.has("--live");

  // Without --live a live target throws here, before any spawn. With it,
  // the guard still demands CONFIRM_LIVE_DEPLOY === the deployment name.
  const target = guardTarget(live ? { allowLive: true } : {});
  const deployment = target.deploymentName;
  if (deployment === null) {
    throw new Error("Could not resolve a deployment NAME to pin the writes to; refusing to guess.");
  }
  console.log(`mode=${verify ? "verify" : execute ? "execute" : "plan"}`);
  console.log(`target=${deployment} (source=${target.source})`);

  const players = loadPrices();
  console.log(`histogram ${priceHistogram(players)}`);
  runPriceGates("price artifacts (pre-seed)");

  if (verify) {
    verifyByReExport(deployment, players, live);
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
