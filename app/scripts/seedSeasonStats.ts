/**
 * MISSION FW-SCOUT L1 — seed 2025-26 season components for the player
 * detail sheet.
 *
 * Writes research/fantasy/pricing/season-components-2025-26.json into
 * `fantasyPlayerSeasonStats` via `fantasyIngest:applySeasonStats`, in
 * chunks. Strictly additive: a NEW table, one row per (player, "2025-26"),
 * source "pricing-seed"; nothing on fantasyPlayers or any other table moves.
 *
 *   npx tsx scripts/seedSeasonStats.ts             # plan, no writes
 *   npx tsx scripts/seedSeasonStats.ts --execute   # run the mutation
 *   npx tsx scripts/seedSeasonStats.ts --verify    # re-export and diff
 *
 * Target discipline = seedExpansionPrices.ts verbatim: `guardTarget()`
 * refuses a live deployment unless BOTH `--live` is passed AND
 * CONFIRM_LIVE_DEPLOY names the deployment. The FW-SCOUT L1 prod import is
 * the authorized live path.
 *
 * `--verify` re-exports fantasyPlayerSeasonStats and proves the
 * pricing-seed slice equals the artifact row-for-row (line, league scope,
 * partial), that no artifact row is missing, and that no unexpected
 * pricing-seed row exists. Rows with source "api-refresh" (FW-SCOUT L3)
 * belong to a different writer and are counted, not checked, here.
 *
 * PRODUCT LAW: the artifact carries raw totals only (its own emitter
 * gate-verifies against the pricing pass); this script adds nothing.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { guardTarget } from "./lib/deployTarget";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT_PATH = path.resolve(
  APP_DIR, "..", "research", "fantasy", "pricing", "season-components-2025-26.json",
);

const CHUNK_SIZE = 250;
const EXPECTED_ROWS = 4_667;
const SEASON = "2025-26";
const KNOWN_POOLS = new Set(["topfive", "promoted", "eredivisie", "ligaportugal", "championship", "flagged"]);

interface ArtifactComponents {
  minutes: number;
  apps: number;
  goals: number;
  assists: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  shotsOn: number;
  saves: number;
  csRate: number | null;
  gaPerMatch: number | null;
}

interface ArtifactRow {
  apiFootballId: number;
  name: string;
  clubName: string;
  position: string;
  pool: string;
  leagueIds: number[];
  leagueLabel: string;
  components: ArtifactComponents | null;
  partialMinutes?: number;
  partialApps?: number;
}

interface SeasonStatUpsert {
  providerPlayerId: string;
  season: string;
  source: "pricing-seed";
  pulledAt: number;
  leagueIds: number[];
  leagueLabel: string;
  line: ArtifactComponents | null;
  partial?: { minutes: number; apps: number };
}

interface ApplyResult {
  requested: number;
  created: number;
  updated: number;
  unchanged: number;
  missing: string[];
}

function loadArtifact(): { rows: ArtifactRow[]; pulledAt: number } {
  const file = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8")) as {
    manifest: { generatedAt: string; season: string; counts: Record<string, number> };
    rows: ArtifactRow[];
  };
  const rows = file.rows;
  if (file.manifest.season !== SEASON) {
    throw new Error(`artifact season ${file.manifest.season}, expected ${SEASON}`);
  }
  if (rows.length !== EXPECTED_ROWS) {
    throw new Error(`artifact holds ${rows.length} rows, expected ${EXPECTED_ROWS}`);
  }
  const ids = new Set(rows.map((r) => r.apiFootballId));
  if (ids.size !== rows.length) throw new Error("duplicate apiFootballId in the artifact");
  for (const r of rows) {
    if (!KNOWN_POOLS.has(r.pool)) throw new Error(`${r.name}: unknown pool ${r.pool}`);
    if (r.components === null) {
      if (r.leagueIds.length > 0 || r.leagueLabel !== "") {
        throw new Error(`${r.name}: league scope on a null line`);
      }
    } else {
      if (r.leagueIds.length === 0 || r.leagueLabel === "") {
        throw new Error(`${r.name}: season line with no league scope`);
      }
      if (r.components.minutes <= 0) throw new Error(`${r.name}: season line with ${r.components.minutes} minutes`);
    }
  }
  const pulledAt = Date.parse(file.manifest.generatedAt);
  if (!Number.isFinite(pulledAt)) throw new Error("artifact generatedAt is unparseable");
  const withLine = rows.filter((r) => r.components !== null).length;
  console.log(
    `source=season-components-2025-26.json rows=${rows.length} withLine=${withLine} flaggedContextOnly=${rows.length - withLine} counts=${JSON.stringify(file.manifest.counts)}`,
  );
  return { rows, pulledAt };
}

function toUpsert(r: ArtifactRow, pulledAt: number): SeasonStatUpsert {
  const partial =
    r.components === null && ((r.partialMinutes ?? 0) > 0 || (r.partialApps ?? 0) > 0)
      ? { minutes: r.partialMinutes ?? 0, apps: r.partialApps ?? 0 }
      : undefined;
  return {
    providerPlayerId: String(r.apiFootballId),
    season: SEASON,
    source: "pricing-seed",
    pulledAt,
    leagueIds: r.leagueIds,
    leagueLabel: r.leagueLabel,
    line: r.components,
    ...(partial !== undefined ? { partial } : {}),
  };
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

interface ExportedRow {
  _id: string;
  providerPlayerId: string;
  season: string;
  source: string;
  pulledAt: number;
  leagueIds: number[];
  leagueLabel: string;
  line: ArtifactComponents | null;
  partial?: { minutes: number; apps: number };
}

function verifyByReExport(deployment: string, rows: ArtifactRow[], pulledAt: number): void {
  const zipPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "fantasy-seasonstats-verify-")),
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
  const jsonl = spawnSync("unzip", ["-p", zipPath, "fantasyPlayerSeasonStats/documents.jsonl"], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (jsonl.status !== 0) throw new Error("could not read fantasyPlayerSeasonStats from the export");

  const stored = jsonl.stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ExportedRow);
  const seeded = stored.filter((r) => r.source === "pricing-seed" && r.season === SEASON);
  const others = stored.length - seeded.length;
  console.log(`re-export: ${stored.length} fantasyPlayerSeasonStats rows, ${seeded.length} pricing-seed/${SEASON}, ${others} other-writer rows (not checked here)`);

  const problems: string[] = [];
  const byId = new Map(seeded.map((r) => [r.providerPlayerId, r]));
  if (byId.size !== seeded.length) problems.push("duplicate (providerPlayerId, season) in the pricing-seed slice");

  const lineKeys: (keyof ArtifactComponents)[] = [
    "minutes", "apps", "goals", "assists", "keyPasses",
    "tackles", "interceptions", "shotsOn", "saves", "csRate", "gaPerMatch",
  ];
  for (const r of rows) {
    const row = byId.get(String(r.apiFootballId));
    if (row === undefined) {
      problems.push(`${r.name} (${r.apiFootballId}): no stored row`);
      continue;
    }
    const diffs: string[] = [];
    if (row.leagueLabel !== r.leagueLabel) diffs.push(`leagueLabel "${r.leagueLabel}" -> "${row.leagueLabel}"`);
    if (JSON.stringify(row.leagueIds) !== JSON.stringify(r.leagueIds)) diffs.push("leagueIds");
    if ((row.line === null) !== (r.components === null)) diffs.push("line presence");
    else if (row.line !== null && r.components !== null) {
      for (const k of lineKeys) if (row.line[k] !== r.components[k]) diffs.push(`line.${k} ${r.components[k]} -> ${row.line[k]}`);
    }
    const wantPartial =
      r.components === null && ((r.partialMinutes ?? 0) > 0 || (r.partialApps ?? 0) > 0)
        ? { minutes: r.partialMinutes ?? 0, apps: r.partialApps ?? 0 }
        : undefined;
    if ((row.partial === undefined) !== (wantPartial === undefined)) diffs.push("partial presence");
    else if (row.partial !== undefined && wantPartial !== undefined) {
      if (row.partial.minutes !== wantPartial.minutes || row.partial.apps !== wantPartial.apps) diffs.push("partial values");
    }
    if (row.pulledAt !== pulledAt) diffs.push(`pulledAt ${pulledAt} -> ${row.pulledAt}`);
    if (diffs.length > 0) problems.push(`${r.name} (${r.apiFootballId}): ${diffs.join("; ")}`);
  }
  const inFile = new Set(rows.map((r) => String(r.apiFootballId)));
  for (const row of seeded) {
    if (!inFile.has(row.providerPlayerId)) {
      problems.push(`stored pricing-seed row ${row.providerPlayerId} is not in the artifact`);
    }
  }

  if (problems.length > 0) {
    console.error(`STOP: ${problems.length} problem(s)`);
    for (const p of problems.slice(0, 25)) console.error(`  ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(`verified: all ${rows.length} artifact rows stored exactly; no stray pricing-seed row`);
}

function main(): void {
  const flags = new Set(process.argv.slice(2));
  const execute = flags.has("--execute");
  const verify = flags.has("--verify");
  const live = flags.has("--live");

  const target = guardTarget(live ? { allowLive: true } : {});
  const deployment = target.deploymentName;
  if (deployment === null) {
    throw new Error("Could not resolve a deployment NAME to pin the writes to; refusing to guess.");
  }
  console.log(`mode=${verify ? "verify" : execute ? "execute" : "plan"}`);
  console.log(`target=${deployment} (source=${target.source})`);

  const { rows, pulledAt } = loadArtifact();

  if (verify) {
    verifyByReExport(deployment, rows, pulledAt);
    return;
  }

  const upserts = rows.map((r) => toUpsert(r, pulledAt));
  const chunks = chunk(upserts, CHUNK_SIZE);
  if (!execute) {
    console.log(`chunks=${chunks.length} of <=${CHUNK_SIZE} (pass --execute to run fantasyIngest:applySeasonStats)`);
    return;
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const missing: string[] = [];
  chunks.forEach((batch, i) => {
    const result = convexRun(deployment, "fantasyIngest:applySeasonStats", { rows: batch }) as ApplyResult;
    created += result.created;
    updated += result.updated;
    unchanged += result.unchanged;
    missing.push(...result.missing);
    console.log(
      `  chunk ${i + 1}/${chunks.length}: requested ${result.requested}, created ${result.created}, updated ${result.updated}, unchanged ${result.unchanged}, missing ${result.missing.length}`,
    );
  });

  console.log(`applied: created ${created}, updated ${updated}, unchanged ${unchanged}, missing ${missing.length}`);
  if (missing.length > 0) {
    console.error(
      `STOP: ${missing.length} provider id(s) in the artifact have no fantasyPlayers row: ${missing.slice(0, 20).join(", ")}`,
    );
    process.exitCode = 1;
  }
}

main();
