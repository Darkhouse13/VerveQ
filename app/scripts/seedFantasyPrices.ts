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
 * `guardTarget()` refuses a live deployment by default, so a resolved
 * different-lynx-153 throws before anything is spawned. The resolved
 * deployment name is then passed to every `convex run` explicitly, so the
 * deployment that was guarded is provably the deployment that is written to
 * rather than whatever the CLI would default to.
 *
 * FW-REPRICE opens the ONE authorized live path, on the same two-signal
 * discipline seedExpansionPrices.ts has carried since FW-EXPAND O7: pass
 * `--live` AND set CONFIRM_LIVE_DEPLOY=<deployment name>, with
 * CONVEX_DEPLOYMENT pointed at prod. Generic booleans are refused by the guard
 * itself; without both, a live target still throws before any spawn.
 *
 * Why this script was DEV-pinned before, and why that is no longer right: the
 * FW-SHIP ruling pinned it because prod's fantasyPlayers was bootstrapped by
 * cloning DEV, so nothing ever needed to write core prices to prod directly.
 * FW-REPRICE reprices a LIVE table that now carries user squads, and cloning
 * is not available to a deployment holding data of its own. The mission
 * authorizes the prod deploy in terms.
 *
 *   npx tsx scripts/seedFantasyPrices.ts --snapshot   # pre-seed baseline, first
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

/** Chunk size. 2,953 rows is one index read + one patch each — far more than
 *  a single transaction should carry, and small chunks keep a failure local. */
const CHUNK_SIZE = 250;
/** FW-REPRICE-2 re-cut (2026-08-14): 2,895 before. */
const EXPECTED_ROWS = 2_953;

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
    manifest: { overrideCount: number; sourceCommit: string; sourceDirty: boolean; mission?: string };
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
    `source=price-final.json rows=${players.length} overrides=${file.manifest.overrideCount} ` +
      `sourceCommit=${file.manifest.sourceCommit.slice(0, 7)}${file.manifest.sourceDirty ? " (DIRTY)" : ""}` +
      `${file.manifest.mission === undefined ? "" : ` mission=${file.manifest.mission.split(" ")[0]}`}`,
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
/**
 * A pre-seed export of THIS deployment, written by `--snapshot`.
 *
 * `--verify`'s "nothing but price moved" claim needs a baseline from just
 * before the write. players-seed-snapshot.json was cut 2026-07-29 and is the
 * pricing UNIVERSE's baseline, not a per-seed one: measured on DEV, 69 rows
 * differ from it on clubId / leagueId / active, every one of them FW-T1
 * transfer ingestion doing its job over the fortnight since. Diffing against
 * it cannot separate "the seed damaged a row" from "a player was transferred",
 * which is the only question this check exists to answer.
 *
 *   npx tsx scripts/seedFantasyPrices.ts --snapshot   # before --execute
 *
 * When the file exists it is preferred; when it does not, the July baseline is
 * used and the drift is reported rather than counted as failure.
 */
function preSeedPath(deployment: string): string {
  return path.resolve(PRICE_FINAL_PATH, "..", "data", `pre-reprice-${deployment}.json`);
}

interface PreSeedRow {
  providerPlayerId: string;
  convexId: string;
  name: string;
  clubId: string;
  leagueId: number;
  position: string;
  active: boolean;
  price: number | null;
}

function writePreSeedSnapshot(deployment: string): void {
  const rows = exportPlayers(deployment);
  const out: PreSeedRow[] = rows.map((r) => ({
    providerPlayerId: r.providerPlayerId,
    convexId: r._id,
    name: r.name,
    clubId: r.clubId,
    leagueId: r.leagueId,
    position: r.feedPosition,
    active: r.active,
    price: r.price,
  }));
  const file = preSeedPath(deployment);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    JSON.stringify(
      { exportedAt: new Date().toISOString(), deployment, count: out.length, players: out },
      null,
      1,
    ),
  );
  console.log(`wrote ${path.basename(file)} — ${out.length} rows, the pre-seed state of ${deployment}`);
}

/** Export fantasyPlayers from a deployment. */
function exportPlayers(deployment: string): ExportedPlayer[] {
  const zipPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "fantasy-price-export-")),
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
  return jsonl.stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ExportedPlayer);
}

function verifyByReExport(deployment: string, players: PricedPlayer[]): void {
  const rows = exportPlayers(deployment);
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
  // Rows this artifact is NOT responsible for are not defects of this seed.
  //
  // Until FW-EXPAND the table and price-final.json were the same 2,895 rows, so
  // "in the table but not in the file" was a sound check. It has been wrong
  // since: the table also holds the 1,780 expansion rows (their own artifact's
  // job) and rows FW-T1 transfer ingestion has created since the universe
  // snapshots were cut. Measured on DEV before this change, the check reported
  // 3,749 problems on a seed that was in fact correct, which is a verification
  // that cannot fail usefully. It now scopes to the union of BOTH artifacts and
  // counts what neither covers, so the number is visible rather than fatal.
  const inCoreFile = new Set(players.map((p) => String(p.apiFootballId)));
  const inAnyArtifact = new Set(
    gateRowsFromArtifacts().map((r) => String(r.apiFootballId)),
  );
  const unpricedByAnyArtifact = rows.filter((r) => !inAnyArtifact.has(r.providerPlayerId));
  console.log(
    `scope: ${inCoreFile.size} rows in price-final.json, ${inAnyArtifact.size} across both artifacts, ` +
      `${unpricedByAnyArtifact.length} table rows covered by neither (FW-REPRICE known gap — see REPRICE_REVIEW.md)`,
  );

  // ── nothing but `price` moved ──
  //
  // Prefer a pre-seed snapshot of THIS deployment when one exists: it isolates
  // what the seed did from what a fortnight of transfer ingestion did. Fall
  // back to the July universe baseline, whose drift is then reported instead
  // of failed on.
  const preSeedFile = preSeedPath(deployment);
  const usingPreSeed = fs.existsSync(preSeedFile);
  interface BaselineRow {
    convexId: string;
    providerPlayerId: string;
    name: string;
    clubId: string;
    leagueId: number;
    position: string;
    active: boolean;
  }
  let baselineRows: BaselineRow[];
  if (usingPreSeed) {
    const pre = JSON.parse(fs.readFileSync(preSeedFile, "utf8")) as {
      exportedAt: string;
      count: number;
      players: PreSeedRow[];
    };
    console.log(
      `baseline: ${path.basename(preSeedFile)} exportedAt=${pre.exportedAt} count=${pre.count} (pre-seed, this deployment)`,
    );
    baselineRows = pre.players.map((b) => ({
      convexId: b.convexId,
      providerPlayerId: b.providerPlayerId,
      name: b.name,
      clubId: b.clubId,
      leagueId: b.leagueId,
      position: b.position,
      active: b.active,
    }));
  } else {
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
    console.log(
      `baseline: players-seed-snapshot.json exportedAt=${baseline.exportedAt} count=${baseline.count} ` +
        `(universe baseline — run --snapshot before --execute for a per-seed one)`,
    );
    baselineRows = baseline.players.map((b) => ({
      convexId: b.convexId,
      providerPlayerId: String(b.apiFootballId),
      name: b.name,
      clubId: String(b.clubId),
      leagueId: b.leagueId,
      position: b.position,
      active: b.active,
    }));
  }

  // Same scoping point: the baseline is a 2026-07-29 export of the 2,895-row
  // core universe, so a row it does not name is a row created after it, not a
  // row this seed damaged. Counted, not flagged.
  const baseById = new Map(baselineRows.map((b) => [b.providerPlayerId, b]));
  let fieldDiffs = 0;
  let outsideBaseline = 0;
  const drift: string[] = [];
  for (const row of rows) {
    const base = baseById.get(row.providerPlayerId);
    if (base === undefined) {
      outsideBaseline += 1;
      continue;
    }
    const diffs: string[] = [];
    // Document ids are deployment-local: the identity check only means
    // something when the baseline was exported from THIS deployment.
    if (usingPreSeed && row._id !== base.convexId) diffs.push(`_id ${base.convexId} -> ${row._id}`);
    if (row.name !== base.name) diffs.push(`name "${base.name}" -> "${row.name}"`);
    if (row.clubId !== base.clubId) diffs.push(`clubId ${base.clubId} -> ${row.clubId}`);
    if (row.leagueId !== base.leagueId) diffs.push(`leagueId ${base.leagueId} -> ${row.leagueId}`);
    if (row.feedPosition !== base.position) diffs.push(`position ${base.position} -> ${row.feedPosition}`);
    if (row.active !== base.active) diffs.push(`active ${base.active} -> ${row.active}`);
    if (diffs.length > 0) {
      fieldDiffs += 1;
      const line = `${row.name} (${row.providerPlayerId}): ${diffs.join("; ")}`;
      // Against a pre-seed baseline any diff is this seed's doing and fatal.
      // Against the stale universe baseline it is a fortnight of transfer
      // ingestion, so it is reported and not counted as a failure.
      if (usingPreSeed) problems.push(line);
      else drift.push(line);
    }
  }
  if (drift.length > 0) {
    console.log(
      `NOTE: ${drift.length} row(s) differ from the July universe baseline on clubId/leagueId/active — ` +
        `transfer ingestion since 2026-07-29, not this seed. First few:`,
    );
    for (const d of drift.slice(0, 5)) console.log(`  ${d}`);
  }

  console.log(
    `priced ${priced.length}, unpriced ${unpriced}, non-price field diffs vs baseline ${fieldDiffs} ` +
      `(over the ${rows.length - outsideBaseline} rows the baseline covers; ${outsideBaseline} newer rows out of its scope)`,
  );
  if (problems.length > 0) {
    console.error(`STOP: ${problems.length} problem(s)`);
    for (const p of problems.slice(0, 25)) console.error(`  ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `verified: ${players.length} price-final.json rows all match the deployment; ` +
      `${priced.length} of ${rows.length} table rows carry a price, ${unpriced} unpriced; 0 diffs in any other field`,
  );

  // The gates against what this deployment actually stores, not against the file.
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
  const snapshot = flags.has("--snapshot");
  const live = flags.has("--live");

  // Without --live a live target throws here, before any spawn. With it, the
  // guard still demands CONFIRM_LIVE_DEPLOY === the deployment name.
  const target = guardTarget(live ? { allowLive: true } : {});
  const deployment = target.deploymentName;
  if (deployment === null) {
    throw new Error("Could not resolve a deployment NAME to pin the writes to; refusing to guess.");
  }
  console.log(`mode=${snapshot ? "snapshot" : verify ? "verify" : execute ? "execute" : "plan"}`);
  console.log(`target=${deployment} (source=${target.source})`);

  if (snapshot) {
    writePreSeedSnapshot(deployment);
    return;
  }

  const players = loadPrices();
  console.log(`histogram ${priceHistogram(players)}`);
  runPriceGates("price artifacts (pre-seed)");

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
