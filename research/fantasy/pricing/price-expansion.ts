/**
 * MISSION FW-EXPAND O2 — band prices for the three expansion cohorts, plus
 * EXPANSION_REVIEW.md (the owner's post-ship override surface).
 *
 * R1 (owner ruling 2026-08-02): band 4.0–7.5 for all three leagues,
 * half-point steps, rank→step mapping per the promoted method — cohort-
 * internal rank quantile, band top for rank #1, floor for the last rank:
 *
 *     price = min(7.5 − 0.5 × round(7 × (rank−1)/(N−1)), position ceiling)
 *
 * ranked per position WITHIN each league pool (the promoted precedent,
 * PROMOTED_COHORT.md). The position ceilings are the same global draft-
 * formula gates as ever (MID 13.0 / ATT 12.5 / DEF 9.0 / GK 6.0) — for GK the
 * 6.0 ceiling bites, exactly as it did for the promoted cohort. Flagged
 * players take the 4.0 floor.
 *
 * overrides.json applies LAST, same contract as price-final.ts — entries are
 * matched by API-Football id against this file's rows; none exist for the
 * expansion at generation time (the owner reviews EXPANSION_REVIEW.md after
 * ship and adds names there; a re-run then picks them up).
 *
 * Output: pricing/expansion-price-final.json, pricing/EXPANSION_REVIEW.md.
 *
 * Run: npx tsx pricing/price-expansion.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROXY_PATH = path.join(PRICING_DIR, 'expansion-proxy-scores.json');
const OVERRIDES_PATH = path.join(PRICING_DIR, 'overrides.json');
const OUT_PATH = path.join(PRICING_DIR, 'expansion-price-final.json');
const REVIEW_PATH = path.join(PRICING_DIR, 'EXPANSION_REVIEW.md');

const UNIVERSE_SIZE = 1_780;
const FLOOR = 4.0;
const BAND_TOP = 7.5;
const BAND_STEPS = 7; // 7.5 → 4.0 in 0.5 steps (8 levels)
const CEILING: Record<string, number> = { MID: 13.0, ATT: 12.5, DEF: 9.0, GK: 6.0 };
const SCALE_MIN = 4.0;
const SCALE_MAX = 13.0;
const REVIEW_TOP_N = 20;

const POOLS = ['eredivisie', 'ligaportugal', 'championship'] as const;
type Pool = (typeof POOLS)[number];
const POOL_LABEL: Record<Pool, string> = {
  eredivisie: 'Eredivisie',
  ligaportugal: 'Liga Portugal',
  championship: 'EFL Championship',
};
const POOL_LEAGUE: Record<Pool, number> = { eredivisie: 88, ligaportugal: 94, championship: 40 };

interface ScoredRow {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubId: number;
  clubName: string;
  leagueId: number;
  position: 'GK' | 'DEF' | 'MID' | 'ATT';
  pool: Pool;
  minutes: number;
  apps: number;
  proxy: number;
}

interface FlaggedRow {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubId: number;
  clubName: string;
  leagueId: number;
  position: 'GK' | 'DEF' | 'MID' | 'ATT';
  reason: string;
  partialMinutes: number;
}

interface PricedRow {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubId: number;
  clubName: string;
  leagueId: number;
  position: string;
  pool: Pool | 'flagged';
  minutes: number;
  proxy: number | null;
  price: number;
  overridden?: boolean;
  draftPrice?: number;
}

function onScale(price: number): boolean {
  return price >= SCALE_MIN && price <= SCALE_MAX && Math.round(price * 2) === price * 2;
}

function main(): void {
  const data = JSON.parse(fs.readFileSync(PROXY_PATH, 'utf-8')) as {
    manifest: Record<string, unknown>;
    players: ScoredRow[];
    flagged: FlaggedRow[];
  };

  const priced: PricedRow[] = [];

  for (const pool of POOLS) {
    for (const position of ['GK', 'DEF', 'MID', 'ATT'] as const) {
      const cohort = data.players
        .filter((s) => s.pool === pool && s.position === position)
        .sort((a, b) => b.proxy - a.proxy);
      cohort.forEach((p, i) => {
        const q = cohort.length === 1 ? 0 : i / (cohort.length - 1);
        const price = Math.min(BAND_TOP - 0.5 * Math.round(q * BAND_STEPS), CEILING[position]);
        priced.push({
          convexId: p.convexId, apiFootballId: p.apiFootballId, name: p.name,
          clubId: p.clubId, clubName: p.clubName, leagueId: p.leagueId,
          position, pool, minutes: p.minutes, proxy: p.proxy, price,
        });
      });
    }
  }
  for (const f of data.flagged) {
    priced.push({
      convexId: f.convexId, apiFootballId: f.apiFootballId, name: f.name,
      clubId: f.clubId, clubName: f.clubName, leagueId: f.leagueId,
      position: f.position, pool: 'flagged', minutes: f.partialMinutes,
      proxy: null, price: FLOOR,
    });
  }

  // ---- gates -----------------------------------------------------------------
  const distinct = new Set(priced.map((p) => p.apiFootballId)).size;
  if (priced.length !== UNIVERSE_SIZE || distinct !== UNIVERSE_SIZE) {
    throw new Error(
      `STOP: partition assertion failed — priced ${priced.length}, distinct ${distinct}, expected ${UNIVERSE_SIZE}`,
    );
  }
  for (const p of priced) {
    if (!onScale(p.price)) throw new Error(`STOP: off-scale price ${p.price} for ${p.name}`);
    if (p.pool !== 'flagged' && p.price > BAND_TOP) {
      throw new Error(`STOP: expansion price ${p.price} above the 4.0-${BAND_TOP} band for ${p.name}`);
    }
  }
  // monotonicity in proxy within pool|position
  for (const pool of POOLS) {
    for (const position of ['GK', 'DEF', 'MID', 'ATT'] as const) {
      const rows = priced
        .filter((p) => p.pool === pool && p.position === position)
        .sort((a, b) => (b.proxy ?? 0) - (a.proxy ?? 0));
      for (let i = 1; i < rows.length; i += 1) {
        if (rows[i].price > rows[i - 1].price) {
          throw new Error(`STOP: monotonicity violated in ${pool}|${position} at ${rows[i].name}`);
        }
      }
    }
  }

  // ---- overrides apply LAST (price-final.ts contract) ------------------------
  const overridesFile = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8')) as {
    overrides: Record<string, { price: number; name: string; club: string }>;
  };
  const byApiId = new Map(priced.map((p) => [String(p.apiFootballId), p]));
  let overridesApplied = 0;
  for (const [id, entry] of Object.entries(overridesFile.overrides)) {
    const row = byApiId.get(id);
    if (row === undefined) continue; // an old-universe override; not ours
    if (row.name !== entry.name || row.clubName !== entry.club) {
      throw new Error(
        `STOP: override ${id} annotations (${entry.name}, ${entry.club}) do not match the row (${row.name}, ${row.clubName})`,
      );
    }
    if (!onScale(entry.price)) throw new Error(`STOP: override ${id} price ${entry.price} off scale`);
    row.draftPrice = row.price;
    row.price = entry.price;
    row.overridden = true;
    overridesApplied += 1;
  }

  // ---- artifact ----------------------------------------------------------------
  const counts: Record<string, number> = {};
  for (const pool of [...POOLS, 'flagged'] as const) {
    counts[pool] = priced.filter((p) => p.pool === pool).length;
  }
  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        manifest: {
          generatedAt: new Date().toISOString(),
          ruling: 'FW-EXPAND R1 (2026-08-02): per-league cohorts, band 4.0-7.5, promoted method',
          formula: `min(${BAND_TOP} - 0.5*round(${BAND_STEPS}*rankQuantile), ceiling[pos]); flagged: ${FLOOR}`,
          counts,
          overridesApplied,
        },
        players: priced,
      },
      null,
      1,
    ),
  );

  // ---- EXPANSION_REVIEW.md -----------------------------------------------------
  const lines: string[] = [];
  lines.push('# FW-EXPAND — expansion cohort price review');
  lines.push('');
  lines.push(
    `Generated by pricing/price-expansion.ts. Owner ruling R1 (2026-08-02): each league is its own cohort, band ${FLOOR.toFixed(1)}–${BAND_TOP.toFixed(1)} in half-point steps, rank→step per the promoted method (PROMOTED_COHORT.md); GKs meet the global 6.0 position ceiling exactly as the promoted cohort did. Players without usable 2025-26 minutes in their own league are flagged at the ${FLOOR.toFixed(1)} floor — including players relegated in from the top five (their minutes are cross-league, and the cross-league ban is standing). **overrides.json is the exception path**: add an entry keyed by the API-Football id (name + club annotations must match this file), re-run price-expansion.ts, and re-seed.`,
  );
  lines.push('');
  const fmt = (v: number | null, digits = 2): string => (v === null ? '—' : v.toFixed(digits));
  for (const pool of POOLS) {
    const cohortAll = priced
      .filter((p) => p.pool === pool)
      .sort((a, b) => (b.proxy ?? 0) - (a.proxy ?? 0));
    const flaggedHere = priced.filter(
      (p) => p.pool === 'flagged' && p.leagueId === POOL_LEAGUE[pool],
    );
    lines.push(`## ${POOL_LABEL[pool]} (league ${POOL_LEAGUE[pool]})`);
    lines.push('');
    lines.push(
      `${cohortAll.length} cohort-priced + ${flaggedHere.length} flagged at ${FLOOR.toFixed(1)} = ${cohortAll.length + flaggedHere.length} players.`,
    );
    lines.push('');
    lines.push(`### Top ${REVIEW_TOP_N} by cohort proxy`);
    lines.push('');
    lines.push('| # | Player | Club | Pos | 2025-26 min | Proxy | Price |');
    lines.push('|---|--------|------|-----|-------------|-------|-------|');
    cohortAll.slice(0, REVIEW_TOP_N).forEach((p, i) => {
      lines.push(
        `| ${i + 1} | ${p.name} | ${p.clubName} | ${p.position} | ${p.minutes} | ${fmt(p.proxy)} | ${p.price.toFixed(1)}${p.overridden ? ' (override)' : ''} |`,
      );
    });
    lines.push('');
    lines.push('### Price distribution');
    lines.push('');
    const dist = new Map<number, number>();
    for (const p of [...cohortAll, ...flaggedHere]) dist.set(p.price, (dist.get(p.price) ?? 0) + 1);
    lines.push('| Price | Players |');
    lines.push('|-------|---------|');
    for (const [price, count] of [...dist.entries()].sort((a, b) => b[0] - a[0])) {
      lines.push(`| ${price.toFixed(1)} | ${count} |`);
    }
    lines.push('');
    // the most prominent flagged names: players the owner is most likely to re-price
    const prominentFlagged = flaggedHere
      .filter((p) => p.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10);
    if (prominentFlagged.length > 0) {
      lines.push('### Most prominent flagged (partial 2025-26 minutes outside the cohort scope)');
      lines.push('');
      lines.push('| Player | Club | Pos | Partial min | Price |');
      lines.push('|--------|------|-----|-------------|-------|');
      for (const p of prominentFlagged) {
        lines.push(`| ${p.name} | ${p.clubName} | ${p.position} | ${p.minutes} | ${p.price.toFixed(1)} |`);
      }
      lines.push('');
    }
  }
  fs.writeFileSync(REVIEW_PATH, `${lines.join('\n')}\n`);

  console.log(
    `priced ${priced.length}: ${POOLS.map((p) => `${p} ${counts[p]}`).join(', ')}, flagged ${counts.flagged}; overrides applied: ${overridesApplied}`,
  );
  console.log(`wrote ${path.basename(OUT_PATH)}, ${path.basename(REVIEW_PATH)}`);
}

main();
