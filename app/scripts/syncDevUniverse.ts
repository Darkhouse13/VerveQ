/**
 * MISSION FW-REPRICE-2 — align DEV's fantasyPlayers with the re-cut universe.
 *
 * The universe snapshots are cut from PROD (the deployment users play on);
 * this script makes DEV agree with them so one artifact pair seeds both
 * deployments. Measured 2026-08-14 the drift was: 2 rows prod has and DEV
 * never got (Y. Hirakawa, D. Ballard — FW-EXPAND bootstrap feed drift), 1 row
 * DEV has and prod never did (I. Bowat — left Portsmouth before the prod
 * bootstrap read the feed), G. Kamara at the wrong club/league/active state,
 * and 6 feedPosition classifications where prod carries the newer feed read.
 *
 * The write path is `fantasyIngest:applyClubPlayers`, the standing ingestion
 * mutation — for every drifted club it is handed prod's ACTIVE roster of that
 * club, whole. Creation, reactivation-with-move, position refresh and
 * deactivation are all that mutation's existing semantics; this script only
 * decides WHICH clubs need a call. Prices are never touched (applyClubPlayers
 * writes price null on create only; the seeds own the field).
 *
 * DEV-PINNED: guardTarget() with no live path — prod is the SOURCE here and
 * must never be the target.
 *
 *   npx tsx scripts/syncDevUniverse.ts             # plan: the diff, no writes
 *   npx tsx scripts/syncDevUniverse.ts --execute   # write, then re-diff
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { guardTarget } from "./lib/deployTarget";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.resolve(APP_DIR, "..", "research", "fantasy", "pricing", "data");

interface SnapshotRow {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubId: number;
  leagueId: number;
  position: string;
  active: boolean;
}

interface TableRow {
  _id: string;
  providerPlayerId: string;
  name: string;
  clubId: string;
  leagueId: number;
  feedPosition: string;
  price: number | null;
  active: boolean;
}

function loadSnapshots(): SnapshotRow[] {
  const core = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "players-seed-snapshot.json"), "utf8"),
  ) as { exportedAt: string; source: string; players: SnapshotRow[] };
  const exp = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "expansion-players-snapshot.json"), "utf8"),
  ) as { manifest: { exportedAt: string; source: string }; players: SnapshotRow[] };
  if (!core.source.includes("FW-REPRICE-2") || !exp.manifest.source.includes("FW-REPRICE-2")) {
    throw new Error("STOP: the snapshots on disk are not the FW-REPRICE-2 re-cut; refusing to sync DEV to stale files.");
  }
  console.log(`prod truth: core exported ${core.exportedAt}, expansion ${exp.manifest.exportedAt}`);
  return [...core.players, ...exp.players];
}

function exportDevPlayers(deployment: string): TableRow[] {
  const zipPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "dev-sync-")), "s.zip");
  const exported = spawnSync(
    "npx",
    ["convex", "export", "--path", zipPath, "--deployment", deployment],
    { cwd: APP_DIR, encoding: "utf8", shell: process.platform === "win32" },
  );
  if (exported.status !== 0) {
    process.stderr.write(exported.stderr ?? "");
    throw new Error(`convex export failed with exit code ${exported.status}`);
  }
  const out = spawnSync("unzip", ["-p", zipPath, "fantasyPlayers/documents.jsonl"], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  });
  if (out.status !== 0) throw new Error("could not read fantasyPlayers from the export");
  return out.stdout
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as TableRow);
}

interface Diff {
  kind: "create" | "move-or-field" | "deactivate";
  detail: string;
  /** the club whose applyClubPlayers call repairs this diff (prod club for
   *  create/field diffs; the player's DEV club for deactivations) */
  repairClubId: number;
  repairLeagueId: number;
}

function diffAgainstProd(prod: SnapshotRow[], dev: TableRow[]): Diff[] {
  const devById = new Map(dev.map((r) => [r.providerPlayerId, r]));
  const prodActiveIds = new Set(prod.filter((p) => p.active).map((p) => String(p.apiFootballId)));
  const diffs: Diff[] = [];

  for (const p of prod) {
    if (!p.active) continue; // departed rows: prod state is the seed's job, not ingestion's
    const d = devById.get(String(p.apiFootballId));
    if (d === undefined) {
      diffs.push({
        kind: "create",
        detail: `${p.name} (${p.apiFootballId}) missing on DEV — prod: club ${p.clubId}, lg ${p.leagueId}, ${p.position}`,
        repairClubId: p.clubId,
        repairLeagueId: p.leagueId,
      });
      continue;
    }
    const fieldDiffs: string[] = [];
    if (Number(d.clubId) !== p.clubId) fieldDiffs.push(`club ${d.clubId}->${p.clubId}`);
    if (Number(d.leagueId) !== p.leagueId) fieldDiffs.push(`lg ${d.leagueId}->${p.leagueId}`);
    if (d.feedPosition !== p.position) fieldDiffs.push(`pos ${d.feedPosition}->${p.position}`);
    if (d.name !== p.name) fieldDiffs.push(`name "${d.name}"->"${p.name}"`);
    if (!d.active) fieldDiffs.push(`active false->true`);
    if (fieldDiffs.length > 0) {
      diffs.push({
        kind: "move-or-field",
        detail: `${p.name} (${p.apiFootballId}): ${fieldDiffs.join("; ")}`,
        repairClubId: p.clubId,
        repairLeagueId: p.leagueId,
      });
    }
  }

  for (const d of dev) {
    if (!d.active) continue;
    if (!prodActiveIds.has(d.providerPlayerId)) {
      diffs.push({
        kind: "deactivate",
        detail: `${d.name} (${d.providerPlayerId}) active on DEV, not active on prod — DEV club ${d.clubId}, lg ${d.leagueId}`,
        repairClubId: Number(d.clubId),
        repairLeagueId: Number(d.leagueId),
      });
    }
  }
  return diffs;
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
  return stdout.length === 0 ? null : JSON.parse(stdout);
}

function main(): void {
  const execute = process.argv.includes("--execute");
  const target = guardTarget({}); // no allowLive: a live target throws here
  const deployment = target.deploymentName;
  if (deployment === null) throw new Error("Could not resolve a deployment name; refusing to guess.");
  console.log(`mode=${execute ? "execute" : "plan"} target=${deployment} (source=${target.source})`);

  const prod = loadSnapshots();
  const dev = exportDevPlayers(deployment);
  console.log(`DEV: ${dev.length} rows; prod snapshots: ${prod.length} rows`);

  const diffs = diffAgainstProd(prod, dev);
  if (diffs.length === 0) {
    console.log("DEV already matches the prod universe — nothing to do.");
    return;
  }
  console.log(`${diffs.length} diff(s):`);
  for (const d of diffs) console.log(`  [${d.kind}] ${d.detail}`);

  const clubs = new Map<number, number>(); // clubId -> leagueId
  for (const d of diffs) clubs.set(d.repairClubId, d.repairLeagueId);
  console.log(`repair calls: ${clubs.size} club roster(s): ${[...clubs.keys()].join(", ")}`);

  if (!execute) {
    console.log("plan only — pass --execute to write.");
    return;
  }

  for (const [clubId, leagueId] of clubs) {
    const roster = prod
      .filter((p) => p.active && p.clubId === clubId)
      .map((p) => ({
        providerPlayerId: String(p.apiFootballId),
        name: p.name,
        clubId: String(clubId),
        leagueId,
        feedPosition: p.position,
      }));
    const result = convexRun(deployment, "fantasyIngest:applyClubPlayers", {
      clubId: String(clubId),
      leagueId,
      players: roster,
    }) as { created: number; updated: number; deactivated: number };
    console.log(
      `  club ${clubId} (lg ${leagueId}): roster ${roster.length} -> created ${result.created}, updated ${result.updated}, deactivated ${result.deactivated}`,
    );
  }

  const after = diffAgainstProd(prod, exportDevPlayers(deployment));
  if (after.length > 0) {
    console.error(`STOP: ${after.length} diff(s) remain after the sync:`);
    for (const d of after) console.error(`  [${d.kind}] ${d.detail}`);
    process.exitCode = 1;
    return;
  }
  console.log("re-diffed: DEV now matches the prod universe (active membership + club/league/position/name).");
}

main();
