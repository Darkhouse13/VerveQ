/**
 * MISSION FW-REPRICE — availability-aware repricing of the whole universe.
 *
 * Regenerates BOTH price artifacts from one signal, in one run, because the R2
 * within-club gate spans clubs in both universes and cannot be asserted from
 * either half alone:
 *   pricing/price-final.json            2,895 core rows (top-five + promoted)
 *   pricing/expansion-price-final.json  1,780 expansion rows (88 / 94 / 40)
 *
 * ── The problem ──
 *
 * Old price = per-90 proxy with shrinkage. Two compounding faults:
 *   1. It never asked whether a player PLAYS. Points per minute is a rate; a
 *      backup's rate is measured on the minutes he did get and says nothing
 *      about how few they were.
 *   2. Shrinkage made it worse rather than better. `w = min(minutes/900, 1)`
 *      pulled low-minute players TOWARD the position median — so the less a
 *      player played, the more he was priced like a median player of his
 *      position, which is precisely backwards.
 * The canonical result: FC Porto's four keepers all priced 6.0, Diogo Costa
 * (2,907') indistinguishable from Andorinha (18'), because the rank-quantile
 * cohort mapping put the top half of a 30-keeper cohort above the 6.0 GK
 * ceiling and the clamp flattened 15 of them onto it.
 *
 * ── The signal ──
 *
 *     signal = per90 × availability
 *
 * `availability` is minutes over a full season of his league (lib/availability.ts).
 * Shrinkage is RETIRED: it existed so a 90-minute wonder would not be ranked on
 * one match, and availability does that job correctly — 90 minutes is an
 * availability of 0.026, so his signal is 2.6% of his rate rather than 97% of
 * the median. Nobody is excluded; the same formula prices everyone.
 *
 * ── Season selection (mission rule) ──
 *
 * Last completed season is 2025-26, in the player's own pricing league set.
 *   - >= 900' there            -> price off 2025-26.
 *   - < 900' there, and 2024-25 in the SAME league set shows >= 1,800'
 *     (a real body of work: 20 full matches)
 *                              -> per90 from 2024-25 × 0.85, and availability
 *                                 = the mean of the two seasons'.
 *   - neither                  -> 4.0 floor, flagged, as before.
 *
 * The 0.85 is the mission's "stated discount": a year-old per-90 describes a
 * player a year older who has not played since, so it is not worth quite what
 * a current one is. The availability MEAN is what keeps the rule honest in the
 * direction the ruling demands — a returning starter (0.05 then 0.90) carries
 * 0.475, well below his healthy 0.90 and well above a career backup's 0.15.
 * He prices below his healthy self and above the backup, which is the test.
 *
 * The prior season is read in the SAME league set as the pool, never across
 * one: the cross-league ban is locked, so a Championship 2024-25 cannot rescue
 * a Premier League squad player. He stays flagged, exactly as a relegated-in
 * player already does.
 *
 * ── Mapping: spread by signal (owner ruling R3) ──
 *
 *     top    = min(pool band top, position ceiling)
 *     sMax   = the highest signal in that pool+position
 *     price  = round to 0.5 of  4.0 + (top - 4.0) × clamp(signal / sMax, 0, 1)
 *
 * R3 says in terms: "if more than ~3 players per position share a cohort
 * ceiling, the rank mapping is too compressed; spread by signal, ceiling
 * reserved for the top." So rank-quantile slotting is gone from the cohorts,
 * and the top-five pool's direct-value clamp goes with it — MEASURED, a direct
 * clamp of the new signal puts 587 of 644 top-five defenders on the 4.0 floor,
 * because multiplying every rate by a median availability of 0.43 drops the
 * whole distribution below the floor. That is the same flattening R3 forbids,
 * pointed at the floor instead of the ceiling, and it would make the mission's
 * own goal impossible: a club's starter cannot outprice his backups when both
 * are at 4.0.
 *
 * Normalising each pool+position by its own maximum keeps every locked
 * constraint — band ceilings 13.0/12.5/9.0/6.0 top-five, 4.0-7.5 for the new
 * leagues, 4.0-6.5 promoted, half-point steps, the 4.0 floor, and cohort
 * separation — while making price a monotone function of the signal and
 * reserving each ceiling for the players at the top of it.
 *
 * overrides.json applies LAST and wins, unchanged contract.
 *
 * Run: npx tsx pricing/reprice.ts
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { availabilityOf, seasonLengths, type SeasonLengths } from './lib/availability.ts';
import {
  allProbes,
  n,
  rawProxyPer90,
  sumLine,
  teamRatesFrom,
  type PositionProbes,
  type Raw,
  type Slot,
  type TeamRates,
} from './lib/proxyEngine.ts';
import { checkR2, checkR3, reportGates, type GateRow } from './lib/gates.ts';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(PRICING_DIR, 'data');
const CORE_OUT = path.join(PRICING_DIR, 'price-final.json');
const EXPANSION_OUT = path.join(PRICING_DIR, 'expansion-price-final.json');
const OVERRIDES_PATH = path.join(PRICING_DIR, 'overrides.json');

const CORE_UNIVERSE_SIZE = 2_895;
const EXPANSION_UNIVERSE_SIZE = 1_780;

const TOP5 = new Set([39, 140, 135, 78, 61]);
const SECOND_TIER = new Set([40, 141, 136, 79, 62]);
const EXPANSION_POOL_OF_LEAGUE: Record<number, string> = {
  88: 'eredivisie',
  94: 'ligaportugal',
  40: 'championship',
};

// ── season selection ──
const THIN_SEASON_MINUTES = 900; // "under ~900'" — the mission's thinness bar
const PRIOR_BODY_OF_WORK_MINUTES = 1_800; // "a real body of work" — 20 full matches
const PRIOR_DISCOUNT = 0.85; // the mission's "stated discount"

// ── bands (LOCKED) ──
const FLOOR = 4.0;
const CEILING: Record<string, number> = { MID: 13.0, ATT: 12.5, DEF: 9.0, GK: 6.0 };
const POOL_BAND_TOP: Record<string, number> = {
  promoted: 6.5,
  eredivisie: 7.5,
  ligaportugal: 7.5,
  championship: 7.5,
};
const SCALE_MIN = 4.0;
const SCALE_MAX = 13.0;

function bandTop(pool: string, position: string): number {
  return Math.min(POOL_BAND_TOP[pool] ?? CEILING[position], CEILING[position]);
}

const round05 = (v: number): number => Math.round(v * 2) / 2;
const onScale = (p: number): boolean =>
  p >= SCALE_MIN && p <= SCALE_MAX && Math.round(p * 2) === p * 2;

function read(name: string): Raw {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8'));
}

/**
 * The last commit BEFORE FW-REPRICE, pinned rather than `HEAD`.
 *
 * `HEAD` was wrong the moment the mission's own commit landed: a re-run then
 * compared the new prices against themselves and reported all 4,667 players
 * unchanged. The "old" column means the prices this mission replaced, which is
 * a fixed point in history, so it is named as one.
 */
const PRE_REPRICE_COMMIT = 'a990a87';

/** The committed artifact this run replaces — the "old" column of the review. */
function oldPricesFromGit(relPath: string): Map<number, number> {
  const raw = execFileSync('git', ['show', `${PRE_REPRICE_COMMIT}:${relPath}`], {
    cwd: PRICING_DIR,
    encoding: 'utf-8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const file = JSON.parse(raw) as { players: { apiFootballId: number; price: number }[] };
  return new Map(file.players.map((p) => [p.apiFootballId, p.price]));
}

interface UniversePlayer {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubId: number;
  leagueId: number;
  position: Slot;
}

/** Everything the mapping, the gates and the review need about one player. */
interface Priced {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubId: number;
  clubName: string;
  leagueId: number;
  position: Slot;
  pool: string;
  /** 2025-26 minutes in his own pricing league set */
  minutes: number;
  priorMinutes: number;
  seasonUsed: '2025-26' | '2024-25' | 'none';
  per90: number | null;
  availability: number;
  signal: number | null;
  price: number;
  overridden?: boolean;
  draftPrice?: number;
  oldPrice: number | null;
  reason?: string;
}

function collectEntries(rows: Raw[], keep: (leagueId: number) => boolean): Map<number, Raw[]> {
  const m = new Map<number, Raw[]>();
  for (const row of rows) {
    const list = m.get(row.player.id) ?? [];
    for (const s of row.statistics ?? []) if (keep(n(s.league?.id))) list.push(s);
    m.set(row.player.id, list);
  }
  return m;
}

function main(): void {
  // ── 2025-26 data (unchanged inputs, reused from disk) ──────────────────────
  const coreUniverse = (read('players-seed-snapshot.json') as { players: UniversePlayer[] }).players;
  const expUniverse = (read('expansion-players-snapshot.json') as { players: UniversePlayer[] }).players;
  const coreAggregates = read('player-aggregates-2025-26.json') as { rows: Raw[] };
  const backfill = read('promoted-backfill-2025-26.json') as { manifest: Raw; rows: Raw[] };
  const expAggregates = read('expansion-aggregates-2025-26.json') as { rows: Raw[] };
  const teamStatsMain = read('team-stats-2025-26.json') as { teams: Raw[] };
  const teamStatsExtra = read('team-stats-extra-2025-26.json') as { topFive: Raw[]; secondTier: Raw[] };
  const expTeamStats = read('expansion-team-stats-2025-26.json') as { teams: Raw[] };
  const expTeamAddendum = read('expansion-team-stats-addendum-2025-26.json') as { teams: Raw[] };
  const currentClubs = read('expansion-current-clubs-2026.json') as {
    clubs: Array<{ leagueId: number; teamId: number; name: string }>;
  };

  // ── 2024-25 data (FW-REPRICE pull) ─────────────────────────────────────────
  const priorAggregates = read('prior-aggregates-2024-25.json') as { manifest: Raw; rows: Raw[] };
  const priorTeamStats = read('prior-team-stats-2024-25.json') as { teams: Raw[] };
  console.log(
    `prior season: ${priorAggregates.rows.length} rows, ${priorTeamStats.teams.length} club figures ` +
      `(${priorAggregates.manifest.calls} calls${priorAggregates.manifest.wastedCalls ? ` + ${priorAggregates.manifest.wastedCalls} wasted` : ''})`,
  );

  const promotedClubs = new Set<number>(backfill.manifest.promotedClubIds as number[]);

  // ── club rates + club names ────────────────────────────────────────────────
  const rates25 = new Map<string, TeamRates>();
  const clubNames = new Map<number, string>();
  const all25TeamRows = [
    ...teamStatsMain.teams,
    ...teamStatsExtra.topFive,
    ...teamStatsExtra.secondTier,
    ...expTeamStats.teams,
    ...expTeamAddendum.teams,
  ];
  for (const t of all25TeamRows) {
    if (t?.team?.id !== undefined) clubNames.set(t.team.id, t.team.name);
    const r = teamRatesFrom(t);
    if (r !== null) rates25.set(`${t.team?.id}|${t.league?.id}`, r);
  }
  // Provider id-duplication carried over from proxy-expansion.ts (verified
  // 2026-08-12): Estrela's Primeira season is tagged 28053 in the player rows
  // and 15130 in the membership list and team figures. Same club, two ids.
  const TEAM_STAT_ALIASES: Record<string, string> = { '28053|94': '15130|94' };
  for (const [from, to] of Object.entries(TEAM_STAT_ALIASES)) {
    const r = rates25.get(to);
    if (r === undefined) throw new Error(`STOP: team-stat alias target ${to} has no figures`);
    rates25.set(from, r);
  }
  for (const c of currentClubs.clubs) clubNames.set(c.teamId, c.name);

  const rates24 = new Map<string, TeamRates>();
  for (const t of priorTeamStats.teams) {
    if (t?.team?.id !== undefined && !clubNames.has(t.team.id)) clubNames.set(t.team.id, t.team.name);
    const r = teamRatesFrom(t);
    if (r !== null) rates24.set(`${t.team?.id}|${t.league?.id}`, r);
  }

  // ── season lengths, per season, per league ────────────────────────────────
  const lengths25: SeasonLengths = seasonLengths(all25TeamRows);
  const lengths24: SeasonLengths = seasonLengths(priorTeamStats.teams);
  const fmtLengths = (l: SeasonLengths): string =>
    [...l.byLeague.entries()].sort((a, b) => a[0] - b[0]).map(([id, m]) => `${id}:${m}`).join(' ');
  console.log(`season length 2025-26  ${fmtLengths(lengths25)}`);
  console.log(`season length 2024-25  ${fmtLengths(lengths24)}`);

  // ── entry indexes ──────────────────────────────────────────────────────────
  const core25Top5 = collectEntries(coreAggregates.rows, (id) => TOP5.has(id));
  const core25Second = collectEntries(backfill.rows, (id) => SECOND_TIER.has(id));
  const exp25 = collectEntries(expAggregates.rows, (id) => EXPANSION_POOL_OF_LEAGUE[id] !== undefined);
  const prior24 = collectEntries(priorAggregates.rows, () => true);

  const probes: Record<Slot, PositionProbes> = allProbes();
  const played = (e: Raw): boolean => n(e.games?.minutes) > 0;
  /** Entries at clubs we hold season figures for. See proxy-expansion.ts on
   *  playoff rows: the feed tags promotion playoffs with the destination
   *  league's id at clubs that were never season members. Out of scope. */
  const inScope = (e: Raw, rates: Map<string, TeamRates>): boolean =>
    rates.has(`${e.team?.id}|${e.league?.id}`);

  const priced: Priced[] = [];
  let scopeExcluded = 0;

  /** One player, whichever universe he is in. */
  function priceOne(
    p: UniversePlayer,
    poolIfScored: string,
    leagueSet: (id: number) => boolean,
    entries25: Raw[],
  ): void {
    const clubName = clubNames.get(p.clubId) ?? String(p.clubId);
    const own25 = entries25.filter((e) => played(e) && inScope(e, rates25));
    scopeExcluded += entries25.filter((e) => played(e) && !inScope(e, rates25)).length;

    const line25 = sumLine(own25, rates25);
    const avail25 = availabilityOf(own25, lengths25);
    const raw25 = line25.minutes > 0 ? rawProxyPer90(line25, p.position, probes[p.position]) : null;

    let seasonUsed: Priced['seasonUsed'] = line25.minutes > 0 ? '2025-26' : 'none';
    let per90 = raw25;
    let availability = avail25.value;
    let priorMinutes = 0;

    if (line25.minutes < THIN_SEASON_MINUTES) {
      const own24 = (prior24.get(p.apiFootballId) ?? []).filter(
        (e) => leagueSet(n(e.league?.id)) && played(e) && inScope(e, rates24),
      );
      const line24 = sumLine(own24, rates24);
      priorMinutes = line24.minutes;
      if (line24.minutes >= PRIOR_BODY_OF_WORK_MINUTES) {
        const avail24 = availabilityOf(own24, lengths24);
        seasonUsed = '2024-25';
        per90 = rawProxyPer90(line24, p.position, probes[p.position]) * PRIOR_DISCOUNT;
        // "availability still reflecting the recent absence honestly"
        availability = (avail25.value + avail24.value) / 2;
      }
    }

    const scored = seasonUsed !== 'none' && per90 !== null;
    priced.push({
      convexId: p.convexId,
      apiFootballId: p.apiFootballId,
      name: p.name,
      clubId: p.clubId,
      clubName,
      leagueId: p.leagueId,
      position: p.position,
      pool: scored ? poolIfScored : 'flagged',
      minutes: line25.minutes,
      priorMinutes,
      seasonUsed,
      per90: scored ? per90 : null,
      availability: scored ? availability : 0,
      // A per-90 can be negative (a red-carded cameo); a negative signal is
      // floor-priced anyway, and clamping here keeps sMax normalisation sane.
      signal: scored ? Math.max(per90! * availability, 0) : null,
      price: FLOOR,
      oldPrice: null,
      ...(scored ? {} : { reason: line25.minutes > 0 ? 'thin in both seasons' : 'no usable league minutes' }),
    });
  }

  // ── the two snapshots OVERLAP; price each player exactly once ──────────────
  //
  // MEASURED 2026-08-13: 8 apiFootballIds appear in both universe snapshots,
  // with the SAME convexId and different clubs — one database row, snapshotted
  // twice. players-seed-snapshot.json was exported 2026-07-29 and
  // expansion-players-snapshot.json on 2026-08-12, and in between FW-T1
  // transfer ingestion moved these eight from top-five clubs to Championship
  // and Eredivisie ones (J. Gauci to Oxford, U. Raghouber to Burnley, and so
  // on). Both price artifacts therefore already list them, at DIFFERENT prices
  // — Raghouber is 5.5 in the core file and 4.0 in the expansion file — and
  // both seed scripts write the same row, so whichever ran last silently won
  // and the two `--verify` passes contradict each other today.
  //
  // Resolution: the expansion snapshot is the NEWER read of the same row, so
  // it holds the player's current club and league, and the current club is
  // what decides his pool. Price him once, there. He is then emitted into BOTH
  // artifacts as an identical row, so the row counts every downstream consumer
  // asserts (2,895 and 1,780) are untouched and the two seeds agree instead of
  // racing. An assertion below proves the emitted rows really are identical.
  const pricedIds = new Set<number>();

  // ── expansion universe first: his own league only (R1 cohort separation) ───
  for (const p of expUniverse) {
    const pool = EXPANSION_POOL_OF_LEAGUE[p.leagueId];
    if (pool === undefined) {
      throw new Error(`STOP: expansion player ${p.apiFootballId} carries league ${p.leagueId}`);
    }
    const own = (exp25.get(p.apiFootballId) ?? []).filter((e) => n(e.league?.id) === p.leagueId);
    priceOne(p, pool, (id) => id === p.leagueId, own);
    pricedIds.add(p.apiFootballId);
  }

  // ── core universe: top-five, else promoted, else flagged ───────────────────
  for (const p of coreUniverse) {
    if (pricedIds.has(p.apiFootballId)) continue; // already priced at his current club
    const t5 = (core25Top5.get(p.apiFootballId) ?? []).filter(played);
    const st = (core25Second.get(p.apiFootballId) ?? []).filter(played);
    if (t5.length > 0) {
      priceOne(p, 'topfive', (id) => TOP5.has(id), core25Top5.get(p.apiFootballId) ?? []);
    } else if (promotedClubs.has(p.clubId) && st.length > 0) {
      priceOne(p, 'promoted', (id) => SECOND_TIER.has(id), core25Second.get(p.apiFootballId) ?? []);
    } else {
      // No 2025-26 minutes in any pool scope. He may still be rescued by the
      // prior-season rule, but only within the league set his CLUB prices in —
      // the cross-league ban is locked, so a second-division 2024-25 cannot
      // price a top-five squad player.
      const promoted = promotedClubs.has(p.clubId);
      priceOne(p, promoted ? 'promoted' : 'topfive', (id) => (promoted ? SECOND_TIER : TOP5).has(id), []);
    }
    pricedIds.add(p.apiFootballId);
  }

  const coreIdSet = new Set(coreUniverse.map((p) => p.apiFootballId));
  const expIdSet = new Set(expUniverse.map((p) => p.apiFootballId));
  const overlapIds = [...expIdSet].filter((id) => coreIdSet.has(id));
  console.log(
    `priced ${priced.length} distinct players from ${coreUniverse.length} core + ${expUniverse.length} expansion snapshot rows ` +
      `(${overlapIds.length} in both, priced once at their current club)`,
  );
  console.log(`entries excluded as out-of-season-scope (playoff rows at non-member clubs): ${scopeExcluded}`);

  // ── mapping: spread by signal onto each pool+position band ─────────────────
  const sMaxByGroup = new Map<string, number>();
  for (const r of priced) {
    if (r.signal === null || r.pool === 'flagged') continue;
    const key = `${r.pool}|${r.position}`;
    sMaxByGroup.set(key, Math.max(sMaxByGroup.get(key) ?? 0, r.signal));
  }
  for (const r of priced) {
    if (r.signal === null || r.pool === 'flagged') {
      r.price = FLOOR;
      continue;
    }
    const top = bandTop(r.pool, r.position);
    const sMax = sMaxByGroup.get(`${r.pool}|${r.position}`) ?? 0;
    const fraction = sMax > 0 ? Math.min(Math.max(r.signal / sMax, 0), 1) : 0;
    r.price = round05(FLOOR + (top - FLOOR) * fraction);
  }

  // ── pre-override gates: scale, band, monotonicity ──────────────────────────
  for (const r of priced) {
    if (!onScale(r.price)) throw new Error(`STOP: off-scale price ${r.price} for ${r.name}`);
    if (r.pool !== 'flagged' && r.price > bandTop(r.pool, r.position)) {
      throw new Error(`STOP: ${r.name} priced ${r.price} above the ${r.pool}|${r.position} band top`);
    }
  }
  for (const key of sMaxByGroup.keys()) {
    const [pool, position] = key.split('|');
    const rows = priced
      .filter((r) => r.pool === pool && r.position === position)
      .sort((a, b) => (b.signal ?? 0) - (a.signal ?? 0));
    for (let i = 1; i < rows.length; i += 1) {
      if (rows[i].price > rows[i - 1].price) {
        throw new Error(`STOP: monotonicity in signal violated in ${key} at ${rows[i].name}`);
      }
    }
  }

  // ── overrides apply LAST and win (locked contract) ─────────────────────────
  const overridesFile = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8')) as {
    version: number;
    overrides: Record<string, { price: number; reason: string; date: string; name?: string; club?: string }>;
  };
  if (overridesFile.version !== 1) {
    throw new Error(`STOP: overrides.json version ${overridesFile.version}, expected 1`);
  }
  const byId = new Map(priced.map((r) => [String(r.apiFootballId), r]));
  const applied: { id: number; name: string; club: string; position: string; from: number; to: number }[] = [];
  for (const [id, entry] of Object.entries(overridesFile.overrides)) {
    const row = byId.get(id);
    if (row === undefined) throw new Error(`STOP: override id ${id} is in no universe`);
    if (entry.name !== undefined && entry.name !== row.name) {
      throw new Error(`STOP: override ${id} names "${entry.name}"; row is "${row.name}"`);
    }
    if (entry.club !== undefined && entry.club !== row.clubName) {
      throw new Error(`STOP: override ${id} (${row.name}) cites club "${entry.club}"; row is "${row.clubName}"`);
    }
    if (!onScale(entry.price)) {
      throw new Error(`STOP: override price ${entry.price} for ${row.name} is off the half-step scale`);
    }
    row.draftPrice = row.price;
    row.price = entry.price;
    row.overridden = true;
    applied.push({
      id: Number(id), name: row.name, club: row.clubName, position: row.position,
      from: row.draftPrice, to: row.price,
    });
  }
  const expectedOverrides = Object.keys(overridesFile.overrides).length;
  if (applied.length !== expectedOverrides) {
    throw new Error(`STOP: applied ${applied.length} overrides, file declares ${expectedOverrides}`);
  }
  console.log(`overrides applied LAST: ${applied.length} (all ids resolved, name+club re-checked)`);

  // ── old prices, for the review ─────────────────────────────────────────────
  const oldCore = oldPricesFromGit('research/fantasy/pricing/price-final.json');
  const oldExp = oldPricesFromGit('research/fantasy/pricing/expansion-price-final.json');
  for (const r of priced) {
    // For the eight overlap players the two old artifacts disagree; the
    // expansion pass seeded last (2026-08-12), so its price is what was live.
    r.oldPrice = oldExp.get(r.apiFootballId) ?? oldCore.get(r.apiFootballId) ?? null;
  }

  // ── R2 / R3 ────────────────────────────────────────────────────────────────
  const gateRows: GateRow[] = priced.map((r) => ({
    apiFootballId: r.apiFootballId,
    name: r.name,
    clubId: r.clubId,
    clubName: r.clubName,
    position: r.position,
    pool: r.pool,
    price: r.price,
    lastSeasonMinutes: r.minutes,
    per90: r.per90,
    overridden: r.overridden,
  }));
  const r2 = checkR2(gateRows);
  const r3 = checkR3(gateRows, (pool, position) => (pool === 'flagged' ? null : bandTop(pool, position)));
  const gatesOk = reportGates('reprice.ts, post-override', r2, r3);
  if (!gatesOk) {
    throw new Error('STOP: R2/R3 gates failed — see the violations above. No artifact written.');
  }

  // ── partition + write ──────────────────────────────────────────────────────
  if (new Set(priced.map((r) => r.apiFootballId)).size !== priced.length) {
    throw new Error('STOP: a player was priced twice');
  }
  // Each artifact carries exactly the ids its own snapshot carries. The eight
  // overlap players appear in both, as the same row object, so the files
  // cannot disagree about them by construction — asserted anyway below.
  const coreRows = priced.filter((r) => coreIdSet.has(r.apiFootballId));
  const expRows = priced.filter((r) => expIdSet.has(r.apiFootballId));
  if (coreRows.length !== CORE_UNIVERSE_SIZE || expRows.length !== EXPANSION_UNIVERSE_SIZE) {
    throw new Error(
      `STOP: partition — core ${coreRows.length} (expected ${CORE_UNIVERSE_SIZE}), expansion ${expRows.length} (expected ${EXPANSION_UNIVERSE_SIZE})`,
    );
  }
  if (coreRows.length + expRows.length - overlapIds.length !== priced.length) {
    throw new Error('STOP: the two artifacts do not cover the priced universe exactly once');
  }
  for (const id of overlapIds) {
    const inCore = coreRows.find((r) => r.apiFootballId === id);
    const inExp = expRows.find((r) => r.apiFootballId === id);
    if (inCore !== inExp) throw new Error(`STOP: overlap player ${id} is not the same row in both artifacts`);
  }

  const countsOf = (rows: Priced[]): Record<string, number> => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.pool] = (c[r.pool] ?? 0) + 1;
    return c;
  };
  const coreCounts = countsOf(coreRows);
  const expCounts = countsOf(expRows);
  console.log(`core pools    ${JSON.stringify(coreCounts)}`);
  console.log(`expansion     ${JSON.stringify(expCounts)}`);

  // Provenance, so a seeded price can always be traced back to the tree that
  // produced it. `dirty` says the generator or its libs differ from that
  // commit, which would make the sha a lie if it went unrecorded.
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: PRICING_DIR, encoding: 'utf-8' }).trim();
  const sourceCommit = git('log', '-1', '--format=%H');
  const sourceDirty =
    git('status', '--porcelain', '--', 'reprice.ts', 'lib', 'overrides.json').length > 0;

  const manifest = {
    generatedAt: new Date().toISOString(),
    mission: 'FW-REPRICE (2026-08-13) — availability-aware repricing',
    sourceCommit,
    sourceDirty,
    method: 'PROXY_METHOD.md §FW-REPRICE',
    formula:
      `signal = per90 x availability; price = round0.5(${FLOOR} + (bandTop - ${FLOOR}) x signal/sMax(pool,position)); flagged: ${FLOOR}`,
    seasonSelection: {
      thinSeasonMinutes: THIN_SEASON_MINUTES,
      priorBodyOfWorkMinutes: PRIOR_BODY_OF_WORK_MINUTES,
      priorDiscount: PRIOR_DISCOUNT,
      priorAvailability: 'mean of the two seasons',
    },
    bands: { floor: FLOOR, ceilings: CEILING, poolBandTops: POOL_BAND_TOP },
    overridesApplied: applied.length,
    overrideCount: applied.length,
    scale: `${SCALE_MIN}-${SCALE_MAX} in 0.5 steps`,
    gates: {
      r2Comparisons: r2.comparisons,
      r2Violations: r2.violations.length,
      r2ExemptedByMargin: r2.exemptedByMargin,
      r2OverrideViolations: r2.overrideViolations.length,
      r3MaxAtCeiling: Math.max(...r3.counts.map((c) => c.atCeiling)),
    },
  };

  // core artifact — `club` and `proxy` keep the field names its consumers read
  // (seedFantasyPrices.ts, push-draft-pool.ts); `proxy` now carries the SIGNAL,
  // which is the number the price is a function of, so draft-room auto-pick
  // ranks on availability too instead of on a retired shrunken rate.
  const coreOut = coreRows
    .map((r) => ({
      convexId: r.convexId,
      apiFootballId: r.apiFootballId,
      name: r.name,
      club: r.clubName,
      clubId: r.clubId,
      position: r.position,
      pool: r.pool,
      proxy: r.signal,
      per90: r.per90,
      availability: r.availability,
      minutes: r.minutes,
      priorMinutes: r.priorMinutes,
      seasonUsed: r.seasonUsed,
      price: r.price,
      oldPrice: r.oldPrice,
      ...(r.overridden ? { overridden: true, draftPrice: r.draftPrice } : { overridden: false }),
      ...(r.reason ? { reason: r.reason } : {}),
    }))
    .sort((a, b) => b.price - a.price || (b.proxy ?? -1) - (a.proxy ?? -1) || a.name.localeCompare(b.name));

  const expOut = expRows
    .map((r) => ({
      convexId: r.convexId,
      apiFootballId: r.apiFootballId,
      name: r.name,
      clubId: r.clubId,
      clubName: r.clubName,
      leagueId: r.leagueId,
      position: r.position,
      pool: r.pool,
      minutes: r.minutes,
      priorMinutes: r.priorMinutes,
      seasonUsed: r.seasonUsed,
      proxy: r.signal,
      per90: r.per90,
      availability: r.availability,
      price: r.price,
      oldPrice: r.oldPrice,
      ...(r.overridden ? { overridden: true, draftPrice: r.draftPrice } : {}),
      ...(r.reason ? { reason: r.reason } : {}),
    }))
    .sort((a, b) => b.price - a.price || (b.proxy ?? -1) - (a.proxy ?? -1) || a.name.localeCompare(b.name));

  fs.writeFileSync(
    CORE_OUT,
    JSON.stringify({ manifest: { ...manifest, counts: coreCounts }, overridesApplied: applied, players: coreOut }, null, 1),
  );
  fs.writeFileSync(
    EXPANSION_OUT,
    JSON.stringify({ manifest: { ...manifest, counts: expCounts }, players: expOut }, null, 1),
  );
  console.log(`wrote ${path.basename(CORE_OUT)} (${coreOut.length}) and ${path.basename(EXPANSION_OUT)} (${expOut.length})`);

  // ── the review doc ─────────────────────────────────────────────────────────
  writeReview(priced, r2, r3, applied);
}

// ---------------------------------------------------------------------------

function writeReview(
  priced: Priced[],
  r2: ReturnType<typeof checkR2>,
  r3: ReturnType<typeof checkR3>,
  applied: { name: string; club: string; from: number; to: number }[],
): void {
  const REVIEW_PATH = path.join(PRICING_DIR, 'REPRICE_REVIEW.md');
  const POOL_LABEL: Record<string, string> = {
    topfive: 'Top five (pooled)',
    promoted: 'Promoted cohort',
    eredivisie: 'Eredivisie (88)',
    ligaportugal: 'Liga Portugal (94)',
    championship: 'EFL Championship (40)',
    flagged: 'Flagged (4.0 floor)',
  };
  const POOL_ORDER = ['topfive', 'promoted', 'eredivisie', 'ligaportugal', 'championship'];
  const TOP_N = 25;
  const f2 = (v: number | null): string => (v === null ? '—' : v.toFixed(2));
  const L: string[] = [];

  L.push('# FW-REPRICE — availability-aware price review');
  L.push('');
  L.push(
    'Generated by `pricing/reprice.ts` (2026-08-13). Every one of the ' +
      `${priced.length} players is repriced on \`signal = per90 x availability\`, ` +
      'spread across his pool+position band. Shrinkage is retired. ' +
      'See PROXY_METHOD.md §FW-REPRICE for the method and the season-selection rule.',
  );
  L.push('');

  // ── headline: move sizes ──
  const moved = priced.filter((r) => r.oldPrice !== null);
  const delta = (r: Priced): number => r.price - (r.oldPrice ?? r.price);
  const buckets: Array<[string, (d: number) => boolean]> = [
    ['unchanged', (d) => d === 0],
    ['0.5', (d) => Math.abs(d) === 0.5],
    ['1.0', (d) => Math.abs(d) === 1.0],
    ['1.5 – 2.5', (d) => Math.abs(d) >= 1.5 && Math.abs(d) <= 2.5],
    ['3.0 +', (d) => Math.abs(d) >= 3.0],
  ];
  L.push('## Move sizes');
  L.push('');
  L.push('| Move | Players | Down | Up |');
  L.push('|------|---------|------|----|');
  for (const [label, pred] of buckets) {
    const rows = moved.filter((r) => pred(delta(r)));
    L.push(
      `| ${label} | ${rows.length} | ${rows.filter((r) => delta(r) < 0).length} | ${rows.filter((r) => delta(r) > 0).length} |`,
    );
  }
  L.push('');

  // ── the Porto case ──
  L.push('## The canonical case: FC Porto keepers');
  L.push('');
  L.push('Before this mission all four priced 6.0 — the GK ceiling — and only Diogo Costa starts.');
  L.push('');
  L.push('| Player | 2025-26 min | Availability | per-90 | Signal | Old | New |');
  L.push('|--------|-------------|--------------|--------|--------|-----|-----|');
  const porto = priced
    .filter((r) => /Porto/i.test(r.clubName) && r.position === 'GK')
    .sort((a, b) => b.minutes - a.minutes);
  for (const p of porto) {
    L.push(
      `| ${p.name} | ${p.minutes} | ${p.availability.toFixed(3)} | ${f2(p.per90)} | ${f2(p.signal)} | ${p.oldPrice?.toFixed(1) ?? '—'} | **${p.price.toFixed(1)}** |`,
    );
  }
  L.push('');

  // ── R2 / R3 ──
  L.push('## R2 — within-club sanity (gate)');
  L.push('');
  L.push(
    `${r2.clubPositionGroups} club+position groups of two or more, across ${r2.clubs} clubs, ` +
      `${r2.comparisons} leader-vs-teammate comparisons. ` +
      `**${r2.violations.length} violations.** ${r2.strictlyLeading} groups are strictly led by the ` +
      `most-played player; ${r2.tied} tie at the top; ${r2.exemptedByMargin} are exempt because the ` +
      'leader\'s per-90 trails his teammate\'s by more than 10% (the ruling\'s documented margin).',
  );
  if (r2.overrideViolations.length > 0) {
    L.push('');
    L.push('Owner overrides win over the formula, so these inversions are reported, not blocked:');
    L.push('');
    for (const v of r2.overrideViolations) {
      L.push(`- ${v.clubName} ${v.position}: ${v.leader} ${v.leaderPrice.toFixed(1)} < ${v.other} ${v.otherPrice.toFixed(1)}`);
    }
  }
  L.push('');
  L.push('## R3 — ceiling scarcity (gate)');
  L.push('');
  L.push('| Pool | Pos | Band top | At top | Of |');
  L.push('|------|-----|----------|--------|----|');
  for (const c of r3.counts) {
    L.push(`| ${c.pool} | ${c.position} | ${c.ceiling.toFixed(1)} | ${c.atCeiling} | ${c.total} |`);
  }
  L.push('');

  // ── per league+position top 25 ──
  L.push('## Per pool and position — top 25 by new price');
  L.push('');
  for (const pool of POOL_ORDER) {
    const inPool = priced.filter((r) => r.pool === pool);
    if (inPool.length === 0) continue;
    L.push(`### ${POOL_LABEL[pool]}`);
    L.push('');
    for (const position of ['GK', 'DEF', 'MID', 'ATT'] as const) {
      const rows = inPool
        .filter((r) => r.position === position)
        .sort((a, b) => b.price - a.price || (b.signal ?? 0) - (a.signal ?? 0))
        .slice(0, TOP_N);
      if (rows.length === 0) continue;
      L.push(`#### ${position}`);
      L.push('');
      L.push('| # | Player | Club | Min | Avail | per-90 | Signal | Old | New | Δ |');
      L.push('|---|--------|------|-----|-------|--------|--------|-----|-----|---|');
      rows.forEach((r, i) => {
        const d = r.oldPrice === null ? '—' : (r.price - r.oldPrice).toFixed(1);
        L.push(
          `| ${i + 1} | ${r.name}${r.overridden ? ' *(override)*' : ''}${r.seasonUsed === '2024-25' ? ' †' : ''} | ${r.clubName} | ${r.minutes} | ${r.availability.toFixed(2)} | ${f2(r.per90)} | ${f2(r.signal)} | ${r.oldPrice?.toFixed(1) ?? '—'} | ${r.price.toFixed(1)} | ${d} |`,
        );
      });
      L.push('');
    }
  }
  L.push('† priced off 2024-25 under the under-900\' season-selection rule.');
  L.push('');

  // ── every move >= 1.5 ──
  const big = moved
    .filter((r) => Math.abs(delta(r)) >= 1.5)
    .sort((a, b) => Math.abs(delta(b)) - Math.abs(delta(a)) || a.name.localeCompare(b.name));
  L.push(`## Every move of 1.5 or more (${big.length})`);
  L.push('');
  L.push('| Player | Club | Pos | Pool | Min | Avail | Old | New | Δ | Season |');
  L.push('|--------|------|-----|------|-----|-------|-----|-----|---|--------|');
  for (const r of big) {
    L.push(
      `| ${r.name}${r.overridden ? ' *(override)*' : ''} | ${r.clubName} | ${r.position} | ${r.pool} | ${r.minutes} | ${r.availability.toFixed(2)} | ${r.oldPrice!.toFixed(1)} | ${r.price.toFixed(1)} | ${delta(r) > 0 ? '+' : ''}${delta(r).toFixed(1)} | ${r.seasonUsed} |`,
    );
  }
  L.push('');

  // ── season selection + overrides ──
  const prior = priced.filter((r) => r.seasonUsed === '2024-25');
  L.push('## Season selection');
  L.push('');
  L.push(`- priced off 2025-26: ${priced.filter((r) => r.seasonUsed === '2025-26').length}`);
  L.push(`- priced off 2024-25 (under 900' last season, >= 1,800' the season before): ${prior.length}`);
  L.push(`- flagged at the 4.0 floor (thin in both): ${priced.filter((r) => r.seasonUsed === 'none').length}`);
  L.push('');
  if (prior.length > 0) {
    L.push('| Player | Club | Pos | 2025-26 min | 2024-25 min | Avail | Old | New |');
    L.push('|--------|------|-----|-------------|-------------|-------|-----|-----|');
    for (const r of prior.sort((a, b) => b.price - a.price || b.priorMinutes - a.priorMinutes)) {
      L.push(
        `| ${r.name} | ${r.clubName} | ${r.position} | ${r.minutes} | ${r.priorMinutes} | ${r.availability.toFixed(2)} | ${r.oldPrice?.toFixed(1) ?? '—'} | ${r.price.toFixed(1)} |`,
      );
    }
    L.push('');
  }
  // ── R1, measured on each deployment ──
  L.push('## R1 — squads grandfathered by the reprice');
  L.push('');
  L.push(
    'A squad the reprice pushes over 91.0 stays legal at its pre-edit cost ' +
      '(`validateBudget`, mirroring the club-cap grandfather); an edit that makes it cost MORE is ' +
      'still blocked. Counted per deployment by `app/scripts/repriceSquadImpact.ts`, which re-costs ' +
      'every standing budget squad at the new prices and writes the result next to this file.',
  );
  L.push('');
  const impacts = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith('r1-impact-') && f.endsWith('.json'))
    .sort();
  if (impacts.length === 0) {
    L.push('_No measurement on disk — run `npx tsx scripts/repriceSquadImpact.ts` per deployment._');
  } else {
    L.push('| Deployment | Budget squads | Grandfathered | Measured |');
    L.push('|------------|---------------|---------------|----------|');
    for (const f of impacts) {
      const m = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8')) as {
        deployment: string; budgetSquads: number; grandfathered: number; measuredAt: string;
      };
      L.push(
        `| ${m.deployment} | ${m.budgetSquads} | **${m.grandfathered}** | ${m.measuredAt.slice(0, 10)} |`,
      );
    }
  }
  L.push('');

  L.push(`## Owner overrides (${applied.length}, applied last and unchanged)`);
  L.push('');
  L.push('| Player | Club | Formula price | Override |');
  L.push('|--------|------|---------------|----------|');
  for (const a of [...applied].sort((x, y) => y.to - x.to || x.name.localeCompare(y.name))) {
    L.push(`| ${a.name} | ${a.club} | ${a.from.toFixed(1)} | ${a.to.toFixed(1)} |`);
  }
  L.push('');

  fs.writeFileSync(REVIEW_PATH, `${L.join('\n')}\n`);
  console.log(`wrote ${path.basename(REVIEW_PATH)}`);
}

main();
