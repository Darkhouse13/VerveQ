/**
 * FW-4 REGRESSION GATE — the pipeline's proof of correctness.
 *
 *   npx tsx scripts/fantasyScoringRegression.ts            # plan only, no writes
 *   npx tsx scripts/fantasyScoringRegression.ts --execute  # seed, score, compare
 *   npx tsx scripts/fantasyScoringRegression.ts --purge    # remove the synthetic season
 *
 * ── What it proves ──
 *
 * The ticket: "score a synthetic gameweek through the live Convex path and assert
 * the per-player totals equal the sim harness's outputs for the same inputs. Same
 * engine, two callers, identical numbers."
 *
 * So it takes a REAL round out of the FS-1 sample (`research/fantasy/data`, 192
 * fixtures pulled on the Pro key 2026-07-29), replays it through the shipped
 * `fantasyScores.applyFixtureStats` on DEV, and compares every player's stored
 * score against `scorePlayer` called directly the way `sim/run.ts` calls it. Two
 * callers, one engine, exact equality — not "within a tolerance", because the same
 * function on the same input has no business producing a different float.
 *
 * Both scoring CONTEXTS the harness itself exercises are compared:
 *   • starter in his nominal position — `sim/run.ts` baseScoreOf
 *   • finisher in his nominal position, entry-filtered — `sim/run.ts` scorePick,
 *     which is the only path that reaches the post-75' decisive-moment multiplier
 *
 * ── Zero provider requests ──
 *
 * Nothing here touches API-Football: the sample is already on disk. The call plan
 * is therefore printed as 0 requests, and no budget is spent.
 *
 * ── Why it is safe on a shared deployment ──
 *
 * Every row goes in under the `SYNTH-`/`synth-` prefixes `fantasyScoringDev`
 * enforces, so it cannot collide with (or delete) the bootstrapped 2026-2027
 * season, and `--purge` removes exactly what it made. DEV-only by `guardTarget()`:
 * a live target throws before anything is spawned.
 */

import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { guardTarget } from "./lib/deployTarget";
import {
  eventsFromEntry,
  loadDataset,
  type Gameweek,
  type PlayerFixtureRow,
} from "../../research/fantasy/sim/dataset.ts";
import { scorePlayer, type Slot } from "../convex/lib/fantasyScoring";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SEASON = "SYNTH-FW4";
const GW_NUMBER = 1;
/** Far future, so the gate's writes are never near a finality cut. */
const FINALITY_AT = Date.UTC(2030, 0, 1);

const argv = process.argv.slice(2);
const EXECUTE = argv.includes("--execute");
const PURGE_ONLY = argv.includes("--purge");
const KEEP = argv.includes("--keep");
function flag(name: string, fallback: number): number {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const parsed = Number.parseInt(argv[index + 1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
const FIXTURE_LIMIT = flag("fixtures", 10);

// ────────────────────────────────────────────────────────────── convex calls

function convexRun(deployment: string, fn: string, args: unknown): unknown {
  const result = spawnSync(
    "npx",
    ["convex", "run", fn, JSON.stringify(args), "--deployment", deployment, "--typecheck", "disable"],
    {
      cwd: APP_DIR,
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 128 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr ?? "");
    throw new Error(`convex run ${fn} failed with exit code ${result.status}`);
  }
  // `convex run` prints log lines before the JSON result; take the last JSON
  // value in the stream rather than assuming it is alone.
  const out = (result.stdout ?? "").trim();
  const start = Math.max(out.lastIndexOf("\n{"), out.lastIndexOf("\n["));
  const json = start === -1 ? out : out.slice(start + 1);
  try {
    return JSON.parse(json);
  } catch {
    const brace = out.indexOf("{");
    const bracket = out.indexOf("[");
    const first = brace === -1 ? bracket : bracket === -1 ? brace : Math.min(brace, bracket);
    if (first === -1) throw new Error(`convex run ${fn}: no JSON in output:\n${out}`);
    return JSON.parse(out.slice(first));
  }
}

// ───────────────────────────────────────────────────────────── the expected

/** Exactly `sim/run.ts` baseScoreOf: starter in his nominal position, crowd 0. */
function harnessStarterScore(row: PlayerFixtureRow): number {
  const slot: Slot = row.feedPosition ?? "MID";
  return scorePlayer(
    { stats: row.stats, context: row.context, events: row.events },
    { position: slot, role: "starter" },
    slot,
    null,
    0,
  ).points;
}

/** Exactly `sim/run.ts` scorePick for a finisher in his nominal position. */
function harnessFinisherScore(row: PlayerFixtureRow): number {
  const slot: Slot = row.feedPosition ?? "MID";
  return scorePlayer(
    { stats: row.stats, context: row.context, events: eventsFromEntry(row) },
    { position: slot, role: "finisher" },
    slot,
    row.entryMinute,
    0,
  ).points;
}

// ──────────────────────────────────────────────────────────────────── main

const target = guardTarget();
const deployment = target.deploymentName;
if (deployment === null) {
  throw new Error("Could not resolve a Convex deployment name to target.");
}

if (PURGE_ONLY) {
  const purged = convexRun(deployment, "fantasyScoringDev:purgeSynthetic", { season: SEASON });
  console.log(`purged ${SEASON} on ${deployment}:`, JSON.stringify(purged));
  process.exit(0);
}

const dataset = loadDataset();
if (dataset.gameweeks.length === 0) {
  throw new Error(
    "The FS-1 sample is not on disk (research/fantasy/data). It is gitignored; re-pull it before running this gate.",
  );
}

// The sample's first round, deterministically (gameweeks are key-sorted).
const round: Gameweek = dataset.gameweeks[0];
const fixtures = round.fixtures.slice(0, FIXTURE_LIMIT);
const fixtureIds = new Set(fixtures.map((f) => f.fixtureId));
const rows = round.rows.filter((r) => fixtureIds.has(r.fixtureId));

console.log("── FW-4 regression gate ──");
console.log(`deployment      ${deployment} (${target.source})`);
console.log(`sample          league ${round.leagueId}, ${round.round}, season ${dataset.season}`);
console.log(`fixtures        ${fixtures.length} of ${round.fixtures.length} in the round`);
console.log(`player rows     ${rows.length}`);
console.log(`call plan       0 provider requests — the sample is on disk, nothing is pulled`);
console.log(`synthetic ids   season ${SEASON}, fixtures synth-*, clubs SYNTH-*, players synth-*`);

if (!EXECUTE) {
  console.log("\nplan only. Re-run with --execute to seed, score and compare.");
  process.exit(0);
}

// ── seed + score, fixture by fixture, through the SHIPPED mutation ──

let scoreVersionsWritten = 0;
for (const fixture of fixtures) {
  const fixtureRows = rows.filter((r) => r.fixtureId === fixture.fixtureId);

  convexRun(deployment, "fantasyScoringDev:seedSyntheticFixture", {
    season: SEASON,
    gwNumber: GW_NUMBER,
    finalityAt: FINALITY_AT,
    providerFixtureId: `synth-${fixture.fixtureId}`,
    kickoffAt: Date.parse(fixture.date),
    homeClubId: `SYNTH-${fixture.homeClubId}`,
    awayClubId: `SYNTH-${fixture.awayClubId}`,
    homeGoals: fixture.homeGoals,
    awayGoals: fixture.awayGoals,
    players: fixtureRows.map((r) => ({
      providerPlayerId: `synth-${r.playerId}`,
      name: r.playerName,
      clubId: `SYNTH-${r.clubId}`,
      // A player with no feed position would leave the fixture unscoreable, and
      // the sample has none (8,110/8,110 carry one) — MID is a seed-row default
      // for the players TABLE only and is never the scoring verdict, which comes
      // from the ingested row below.
      feedPosition: r.feedPosition ?? "MID",
    })),
  });

  const applied = convexRun(deployment, "fantasyScores:applyFixtureStats", {
    providerFixtureId: `synth-${fixture.fixtureId}`,
    hasPlayerStats: fixtureRows.length > 0,
    hasEvents: (dataset.eventsByFixture.get(fixture.fixtureId) ?? []).length > 0,
    rows: fixtureRows.map((r) => ({
      providerPlayerId: `synth-${r.playerId}`,
      clubId: `SYNTH-${r.clubId}`,
      feedPosition: r.feedPosition,
      stats: r.stats,
      events: r.events,
      entryMinute: r.entryMinute,
    })),
  }) as { scoreable: boolean; scoreVersionsWritten: number; notScoredReason: string | null };

  if (!applied.scoreable) {
    throw new Error(
      `fixture ${fixture.fixtureId} came back unscoreable: ${applied.notScoredReason ?? "(no reason)"}`,
    );
  }
  scoreVersionsWritten += applied.scoreVersionsWritten;
  process.stdout.write(
    `  scored synth-${fixture.fixtureId}: ${fixtureRows.length} rows, ${applied.scoreVersionsWritten} versions\n`,
  );
}

// ── compare ──

interface StoredRow {
  providerPlayerId: string;
  version: number;
  state: string;
  crowdFactor: number;
  verdictPosition: string | null;
  baseScores: { starter: Record<string, number>; finisher: Record<string, number> };
}

const stored = convexRun(deployment, "fantasyScoringDev:syntheticScoreRows", {
  season: SEASON,
  gwNumber: GW_NUMBER,
}) as StoredRow[];

const storedByPlayer = new Map(stored.filter((r) => r.version === 1).map((r) => [r.providerPlayerId, r]));

interface Mismatch {
  playerId: number;
  playerName: string;
  context: string;
  harness: number;
  live: number;
}

const mismatches: Mismatch[] = [];
let comparedStarter = 0;
let comparedFinisher = 0;
let finisherRowsWithEntry = 0;
let maxAbsDelta = 0;

for (const row of rows) {
  const live = storedByPlayer.get(`synth-${row.playerId}`);
  if (live === undefined) {
    mismatches.push({
      playerId: row.playerId,
      playerName: row.playerName,
      context: "missing score row",
      harness: harnessStarterScore(row),
      live: Number.NaN,
    });
    continue;
  }

  const slot: Slot = row.feedPosition ?? "MID";

  const expectedStarter = harnessStarterScore(row);
  const liveStarter = live.baseScores.starter[slot];
  comparedStarter += 1;
  if (liveStarter !== expectedStarter) {
    mismatches.push({
      playerId: row.playerId,
      playerName: row.playerName,
      context: `starter/${slot}`,
      harness: expectedStarter,
      live: liveStarter,
    });
    maxAbsDelta = Math.max(maxAbsDelta, Math.abs(liveStarter - expectedStarter));
  }

  const expectedFinisher = harnessFinisherScore(row);
  const liveFinisher = live.baseScores.finisher[slot];
  comparedFinisher += 1;
  if (row.entryMinute !== null) finisherRowsWithEntry += 1;
  if (liveFinisher !== expectedFinisher) {
    mismatches.push({
      playerId: row.playerId,
      playerName: row.playerName,
      context: `finisher/${slot}`,
      harness: expectedFinisher,
      live: liveFinisher,
    });
    maxAbsDelta = Math.max(maxAbsDelta, Math.abs(liveFinisher - expectedFinisher));
  }
}

const starterTotal = rows.reduce((sum, r) => sum + harnessStarterScore(r), 0);
const liveStarterTotal = rows.reduce((sum, r) => {
  const live = storedByPlayer.get(`synth-${r.playerId}`);
  return sum + (live?.baseScores.starter[r.feedPosition ?? "MID"] ?? 0);
}, 0);

console.log("\n── comparison ──");
console.log(`score rows written        ${scoreVersionsWritten}`);
console.log(`rows compared             ${comparedStarter} starter + ${comparedFinisher} finisher`);
console.log(`  of which substitutes    ${finisherRowsWithEntry} (the multiplier's only reachable path)`);
console.log(`harness Σ starter points  ${starterTotal.toFixed(6)}`);
console.log(`live    Σ starter points  ${liveStarterTotal.toFixed(6)}`);
console.log(`mismatches                ${mismatches.length}`);
if (mismatches.length > 0) {
  console.log(`max |delta|               ${maxAbsDelta}`);
  for (const m of mismatches.slice(0, 20)) {
    console.log(
      `  ${m.playerId} ${m.playerName} [${m.context}]: harness ${m.harness} vs live ${m.live}`,
    );
  }
}

// Every version must be 1 and provisional: this is a first ingest of a gameweek
// whose cut is in 2030, so a revision or a finalized row would mean the pipeline
// did something nobody asked it to.
const badState = stored.filter((r) => r.version !== 1 || r.state !== "provisional");
const badCrowd = stored.filter((r) => r.crowdFactor !== 0);
console.log(`rows at version 1, provisional  ${stored.length - badState.length}/${stored.length}`);
console.log(`rows at crowd factor 0          ${stored.length - badCrowd.length}/${stored.length}`);

if (!KEEP) {
  const purged = convexRun(deployment, "fantasyScoringDev:purgeSynthetic", { season: SEASON });
  console.log(`\npurged ${SEASON}: ${JSON.stringify(purged)}`);
} else {
  console.log(`\n--keep: ${SEASON} left on ${deployment}. Remove it with --purge.`);
}

const pass =
  mismatches.length === 0 &&
  badState.length === 0 &&
  badCrowd.length === 0 &&
  comparedStarter === rows.length;
console.log(`\nGATE ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
