/**
 * TICKET FW-PR1 Step 3 — proxy expected points per 90, from season aggregates.
 *
 * A RANKING signal, not a score. Method (full write-up in PROXY_METHOD.md):
 *
 *  - Every scoring constant is sourced from app/convex/lib/fantasyScoring.ts BY CONSTRUCTION,
 *    not by copy: the exported v0.5.1 `scorePlayer` engine is driven with a
 *    synthetic 90-minute stat line built from the player's per-90 season rates
 *    (so caps apply to per-90 rates, ramps evaluate at season-average rates),
 *    and the context-dependent values (clean sheet, win, draw, concession
 *    unit) are recovered per position by probing the engine with controlled
 *    context diffs. The engine module stays read-only; the constants cannot drift.
 *
 *  - Clean sheets / concessions / team result cannot come from the player's
 *    aggregate row (keeper-only `conceded`, no result split), so they enter as
 *    expectations from CLUB season figures, weighted by where the player's
 *    minutes were actually played in 2025-26 (per-entry minutes weighting; in
 *    per-90 space minutes-share attribution reduces exactly to the club's
 *    per-match rates).
 *
 *  - Pools are disjoint BY DATA (owner ruling, modified option C):
 *      topfive   — 2025-26 minutes in leagues 39/140/135/78/61
 *      promoted  — no top-five minutes, at one of the 13 promoted clubs, with
 *                  2025-26 second-division minutes (40/141/136/79/62).
 *                  COHORT-INTERNAL signal: ranked only against each other.
 *      flagged   — everyone else: no usable 2025-26 league minutes. No proxy,
 *                  default floor 4.0 (ruling item 3).
 *    Amended gate: the three pools partition the 2,895 exactly; asserted here.
 *
 *  - Shrinkage: weight = min(minutes/900, 1); proxy = w*raw + (1-w) * position
 *    median OF THE PLAYER'S OWN POOL. No exclusion for low minutes.
 *
 * Run: npx tsx pricing/proxy.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The season-line assembly and engine driving live in lib/proxyEngine.ts so
// that this script, proxy-expansion.ts and FW-REPRICE's reprice.ts cannot
// drift apart about what "points per 90" means. Extracted verbatim; this
// script's artifact is unchanged by the move (proved by regeneration).
import {
  allProbes,
  median,
  n,
  rawProxyPer90,
  sumLine,
  teamRatesFrom,
  type PositionProbes,
  type Raw,
  type Slot,
  type TeamRates,
} from './lib/proxyEngine.ts';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(PRICING_DIR, 'data');
const OUT_PATH = path.join(PRICING_DIR, 'proxy-scores.json');

const TOP5 = new Set([39, 140, 135, 78, 61]);
const SECOND_TIER = new Set([40, 141, 136, 79, 62]);
const SHRINKAGE_FULL_MINUTES = 900;
const GRID_MIN_DISTINCT = 7; // ticket STOP: any position with < 7 distinct proxies

// ---------------------------------------------------------------- data loading

interface UniversePlayer {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubId: number;
  leagueId: number;
  position: Slot;
}

function read(name: string): Raw {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8'));
}

// ----------------------------------------------------------------------- main

function main(): void {
  const universe = (read('players-seed-snapshot.json') as { players: UniversePlayer[] }).players;
  const aggregates = read('player-aggregates-2025-26.json') as { rows: Raw[] };
  const backfill = read('promoted-backfill-2025-26.json') as { manifest: Raw; rows: Raw[] };
  const teamStatsMain = read('team-stats-2025-26.json') as { teams: Raw[] };
  const teamStatsExtra = read('team-stats-extra-2025-26.json') as { topFive: Raw[]; secondTier: Raw[] };

  const promotedClubs = new Set<number>(backfill.manifest.promotedClubIds as number[]);

  // club rates, keyed team|league
  const teamRates = new Map<string, TeamRates>();
  const clubNames = new Map<number, string>();
  for (const t of [...teamStatsMain.teams, ...teamStatsExtra.topFive, ...teamStatsExtra.secondTier]) {
    const rates = teamRatesFrom(t);
    if (t?.team?.id !== undefined) clubNames.set(t.team.id, t.team.name);
    if (rates !== null) teamRates.set(`${t.team?.id}|${t.league?.id}`, rates);
  }

  // per-player entry collection
  const topFiveEntries = new Map<number, Raw[]>();
  for (const row of aggregates.rows) {
    const list = topFiveEntries.get(row.player.id) ?? [];
    for (const s of row.statistics ?? []) if (TOP5.has(n(s.league?.id))) list.push(s);
    topFiveEntries.set(row.player.id, list);
  }
  const secondTierEntries = new Map<number, Raw[]>();
  for (const row of backfill.rows) {
    const list = secondTierEntries.get(row.player.id) ?? [];
    for (const s of row.statistics ?? []) if (SECOND_TIER.has(n(s.league?.id))) list.push(s);
    secondTierEntries.set(row.player.id, list);
  }

  const probes: Record<Slot, PositionProbes> = allProbes();

  interface Scored {
    convexId: string;
    apiFootballId: number;
    name: string;
    clubId: number;
    clubName: string;
    seededLeagueId: number;
    position: Slot;
    pool: 'topfive' | 'promoted';
    minutes: number;
    apps: number;
    rawPer90: number;
    shrinkWeight: number;
    proxy: number;
    teamStatGapMinutes: number;
  }
  interface Flagged {
    convexId: string;
    apiFootballId: number;
    name: string;
    clubId: number;
    clubName: string;
    seededLeagueId: number;
    position: Slot;
    reason: string;
    partialMinutes: number; // any 2025-26 minutes seen outside the pool scopes
    partialApps: number;
  }

  const scored: Scored[] = [];
  const flagged: Flagged[] = [];

  for (const p of universe) {
    const clubName = clubNames.get(p.clubId) ?? String(p.clubId);
    const t5 = (topFiveEntries.get(p.apiFootballId) ?? []).filter((s) => n(s.games?.minutes) > 0);
    const st = (secondTierEntries.get(p.apiFootballId) ?? []).filter((s) => n(s.games?.minutes) > 0);

    let pool: 'topfive' | 'promoted' | null = null;
    let entries: Raw[] = [];
    if (t5.length > 0) {
      pool = 'topfive';
      entries = t5;
    } else if (promotedClubs.has(p.clubId) && st.length > 0) {
      pool = 'promoted';
      entries = st;
    }

    if (pool === null) {
      // Partial data, if any, for FLAGS.md prominence ordering: whatever
      // 2025-26 rows exist in ANY competition we pulled for this player.
      const anyRows = [
        ...(topFiveEntries.get(p.apiFootballId) ?? []),
        ...(backfill.rows.filter((r) => r.player.id === p.apiFootballId).flatMap((r) => r.statistics ?? [])),
      ];
      const partialMinutes = anyRows.reduce((sum, s) => sum + n(s.games?.minutes), 0);
      const partialApps = anyRows.reduce((sum, s) => sum + n(s.games?.appearences), 0);
      const reason =
        anyRows.length === 0
          ? 'no 2025-26 rows in any pulled competition'
          : partialMinutes === 0
            ? '2025-26 rows exist but zero league minutes'
            : 'minutes only outside pool scope (cups / other leagues)';
      flagged.push({
        convexId: p.convexId, apiFootballId: p.apiFootballId, name: p.name,
        clubId: p.clubId, clubName, seededLeagueId: p.leagueId, position: p.position,
        reason, partialMinutes, partialApps,
      });
      continue;
    }

    const line = sumLine(entries, teamRates);
    const raw = rawProxyPer90(line, p.position, probes[p.position]);
    scored.push({
      convexId: p.convexId, apiFootballId: p.apiFootballId, name: p.name,
      clubId: p.clubId, clubName, seededLeagueId: p.leagueId, position: p.position,
      pool, minutes: line.minutes, apps: line.apps, rawPer90: raw,
      shrinkWeight: Math.min(line.minutes / SHRINKAGE_FULL_MINUTES, 1),
      proxy: 0, // filled after pool medians are known
      teamStatGapMinutes: line.teamStatGapMinutes,
    });
  }

  // shrinkage toward the position median OF THE PLAYER'S OWN POOL
  const medians: Record<string, number> = {};
  for (const pool of ['topfive', 'promoted'] as const) {
    for (const position of ['GK', 'DEF', 'MID', 'ATT'] as const) {
      const raws = scored.filter((s) => s.pool === pool && s.position === position).map((s) => s.rawPer90);
      if (raws.length > 0) medians[`${pool}|${position}`] = median(raws);
    }
  }
  for (const s of scored) {
    const m = medians[`${s.pool}|${s.position}`];
    s.proxy = s.shrinkWeight * s.rawPer90 + (1 - s.shrinkWeight) * m;
  }

  // ---- amended gate: exact three-way partition ------------------------------
  const topfive = scored.filter((s) => s.pool === 'topfive');
  const promoted = scored.filter((s) => s.pool === 'promoted');
  const total = topfive.length + promoted.length + flagged.length;
  const distinctIds = new Set([...scored, ...flagged].map((x) => x.apiFootballId)).size;
  console.log(`partition: topfive ${topfive.length} + promoted ${promoted.length} + flagged ${flagged.length} = ${total} (universe ${universe.length}, distinct ${distinctIds})`);
  if (total !== universe.length || distinctIds !== universe.length) {
    throw new Error('PARTITION ASSERTION FAILED — a universe player is missing or double-counted');
  }

  // ---- original ticket gate: grid buildability ------------------------------
  for (const position of ['GK', 'DEF', 'MID', 'ATT'] as const) {
    const distinct = new Set(topfive.filter((s) => s.position === position).map((s) => s.proxy.toFixed(6))).size;
    console.log(`  ${position}: ${topfive.filter((s) => s.position === position).length} proxied (topfive), ${distinct} distinct proxy values`);
    if (distinct < GRID_MIN_DISTINCT) {
      throw new Error(`STOP: position ${position} has ${distinct} < ${GRID_MIN_DISTINCT} distinct proxy scores — grid unbuildable`);
    }
  }

  const gapMinutes = scored.reduce((sum, s) => sum + s.teamStatGapMinutes, 0);
  console.log(`team-figure coverage gap across all scored players: ${gapMinutes} minutes (should be 0)`);

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        manifest: {
          generatedAt: new Date().toISOString(),
          method: 'PROXY_METHOD.md',
          engine: 'app/convex/lib/fantasyScoring.ts (SCORING_SPEC v0.5.1), driven, not copied',
          probes,
          medians,
          counts: { topfive: topfive.length, promoted: promoted.length, flagged: flagged.length },
        },
        players: scored,
        flagged,
      },
      null,
      1,
    ),
  );
  console.log(`wrote ${path.basename(OUT_PATH)}`);
}

main();
