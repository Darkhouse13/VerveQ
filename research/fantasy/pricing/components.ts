/**
 * MISSION FW-SCOUT Layer 1 — per-90 SEASON COMPONENTS for the player detail
 * sheet, from the same on-disk 2025-26 aggregates the pricing pass used.
 *
 * proxy.ts / proxy-expansion.ts collapse the season line to one scalar and
 * only emit that. The detail sheet needs the components themselves (goals,
 * assists, key passes, tackles+interceptions, shots on target, saves, club
 * clean-sheet/concession exposure) — so this script re-runs EXACTLY the same
 * entry selection and season-line summation as the two proxy scripts and
 * emits raw totals + minutes/apps. Per-90 is derived at display time
 * (value * 90 / minutes); nothing new is computed here.
 *
 * PRODUCT LAW GUARDS:
 *  - no scalar, no rank, no composite of any kind is emitted;
 *  - flagged players emit apps/minutes context only, never components — the
 *    partial minutes proxy.ts sees for them are out-of-scope (cups / other
 *    leagues / playoff-only) and would misrepresent "last season per 90";
 *  - VERIFICATION GATE: every scored player's (pool, minutes, apps) must
 *    equal the committed proxy artifact row, and pool counts must equal the
 *    artifact manifests. Any mismatch is a hard STOP — it would mean this
 *    script's selection drifted from the pricing pass it claims to mirror.
 *
 * Zero network. Reads pricing/data/ (gitignored, on disk from FW-PR1 /
 * FW-EXPAND pulls) + the committed proxy artifacts for the gate.
 *
 * Run: npx tsx pricing/components.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(PRICING_DIR, 'data');
const OUT_PATH = path.join(PRICING_DIR, 'season-components-2025-26.json');

const TOP5 = new Set([39, 140, 135, 78, 61]);
const SECOND_TIER = new Set([40, 141, 136, 79, 62]);
const EXPANSION: Record<number, string> = { 88: 'eredivisie', 94: 'ligaportugal', 40: 'championship' };

/** Display names for every league id a component row can cite. */
const LEAGUE_NAMES: Record<number, string> = {
  39: 'Premier League',
  140: 'La Liga',
  135: 'Serie A',
  78: 'Bundesliga',
  61: 'Ligue 1',
  40: 'Championship',
  141: 'La Liga 2',
  136: 'Serie B',
  79: '2. Bundesliga',
  62: 'Ligue 2',
  88: 'Eredivisie',
  94: 'Primeira Liga',
};

type Raw = Record<string, any>;

function read(name: string): Raw {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8'));
}
function readArtifact(name: string): Raw {
  return JSON.parse(fs.readFileSync(path.join(PRICING_DIR, name), 'utf-8'));
}
function n(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

// ---- season-line summation: field-for-field the proxy scripts' sumLine ----

interface Components {
  minutes: number;
  apps: number;
  goals: number;
  assists: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  shotsOn: number;
  saves: number;
  /** minutes-weighted CLUB rates (expectation terms, PROXY_METHOD.md appr. 4) */
  csRate: number;
  gaPerMatch: number;
}

interface TeamRates {
  csRate: number;
  gaPerMatch: number;
}

function teamRatesFrom(stats: Raw): TeamRates | null {
  const played = n(stats?.fixtures?.played?.total);
  if (played === 0) return null;
  return {
    csRate: n(stats?.clean_sheet?.total) / played,
    gaPerMatch: n(stats?.goals?.against?.total?.total) / played,
  };
}

function sumComponents(entries: Raw[], teamRates: Map<string, TeamRates>): Components {
  const line: Components = {
    minutes: 0, apps: 0, goals: 0, assists: 0, keyPasses: 0,
    tackles: 0, interceptions: 0, shotsOn: 0, saves: 0,
    csRate: 0, gaPerMatch: 0,
  };
  let ratedMinutes = 0;
  for (const s of entries) {
    const minutes = n(s.games?.minutes);
    line.minutes += minutes;
    line.apps += n(s.games?.appearences);
    line.goals += n(s.goals?.total);
    line.assists += n(s.goals?.assists);
    line.saves += n(s.goals?.saves);
    line.shotsOn += n(s.shots?.on);
    line.keyPasses += n(s.passes?.key);
    line.tackles += n(s.tackles?.total);
    line.interceptions += n(s.tackles?.interceptions);
    const rates = teamRates.get(`${s.team?.id}|${s.league?.id}`);
    if (rates !== undefined) {
      ratedMinutes += minutes;
      line.csRate += minutes * rates.csRate;
      line.gaPerMatch += minutes * rates.gaPerMatch;
    }
  }
  if (ratedMinutes > 0) {
    line.csRate = Number((line.csRate / ratedMinutes).toFixed(4));
    line.gaPerMatch = Number((line.gaPerMatch / ratedMinutes).toFixed(4));
  }
  return line;
}

function leagueScope(entries: Raw[]): number[] {
  return [...new Set(entries.map((s) => n(s.league?.id)))].sort((a, b) => a - b);
}

// ----------------------------------------------------------------------- main

interface ComponentRow {
  apiFootballId: number;
  name: string;
  clubName: string;
  position: string;
  pool: string;
  /** leagues the counted 2025-26 entries came from, for the honesty label */
  leagueIds: number[];
  leagueLabel: string;
  components: Components | null; // null for flagged — never fabricated
  /** flagged only: out-of-scope context so the sheet can say what exists */
  partialMinutes?: number;
  partialApps?: number;
}

function main(): void {
  // ---------- top-five universe (proxy.ts selection, verbatim) ----------
  const universe = (read('players-seed-snapshot.json') as { players: Raw[] }).players;
  const aggregates = read('player-aggregates-2025-26.json') as { rows: Raw[] };
  const backfill = read('promoted-backfill-2025-26.json') as { manifest: Raw; rows: Raw[] };
  const teamStatsMain = read('team-stats-2025-26.json') as { teams: Raw[] };
  const teamStatsExtra = read('team-stats-extra-2025-26.json') as { topFive: Raw[]; secondTier: Raw[] };
  const promotedClubs = new Set<number>(backfill.manifest.promotedClubIds as number[]);

  const teamRates = new Map<string, TeamRates>();
  const clubNames = new Map<number, string>();
  for (const t of [...teamStatsMain.teams, ...teamStatsExtra.topFive, ...teamStatsExtra.secondTier]) {
    const rates = teamRatesFrom(t);
    if (t?.team?.id !== undefined) clubNames.set(t.team.id, t.team.name);
    if (rates !== null) teamRates.set(`${t.team?.id}|${t.league?.id}`, rates);
  }

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

  const rows: ComponentRow[] = [];

  for (const p of universe) {
    const clubName = clubNames.get(p.clubId) ?? String(p.clubId);
    const t5 = (topFiveEntries.get(p.apiFootballId) ?? []).filter((s) => n(s.games?.minutes) > 0);
    const st = (secondTierEntries.get(p.apiFootballId) ?? []).filter((s) => n(s.games?.minutes) > 0);

    let pool: string | null = null;
    let entries: Raw[] = [];
    if (t5.length > 0) {
      pool = 'topfive';
      entries = t5;
    } else if (promotedClubs.has(p.clubId) && st.length > 0) {
      pool = 'promoted';
      entries = st;
    }

    if (pool === null) {
      const anyRows = [
        ...(topFiveEntries.get(p.apiFootballId) ?? []),
        ...backfill.rows.filter((r) => r.player.id === p.apiFootballId).flatMap((r) => r.statistics ?? []),
      ];
      rows.push({
        apiFootballId: p.apiFootballId, name: p.name, clubName,
        position: p.position, pool: 'flagged', leagueIds: [], leagueLabel: '',
        components: null,
        partialMinutes: anyRows.reduce((sum, s) => sum + n(s.games?.minutes), 0),
        partialApps: anyRows.reduce((sum, s) => sum + n(s.games?.appearences), 0),
      });
      continue;
    }

    const leagueIds = leagueScope(entries);
    rows.push({
      apiFootballId: p.apiFootballId, name: p.name, clubName,
      position: p.position, pool, leagueIds,
      leagueLabel: leagueIds.map((id) => LEAGUE_NAMES[id] ?? `league ${id}`).join(' + '),
      components: sumComponents(entries, teamRates),
    });
  }

  // ---------- expansion universe (proxy-expansion.ts selection, verbatim) ----
  const expUniverse = (read('expansion-players-snapshot.json') as { players: Raw[] }).players;
  const expAggregates = read('expansion-aggregates-2025-26.json') as { rows: Raw[] };
  const expTeamStats = read('expansion-team-stats-2025-26.json') as { teams: Raw[] };
  const expAddendum = read('expansion-team-stats-addendum-2025-26.json') as { teams: Raw[] };
  const currentClubs = read('expansion-current-clubs-2026.json') as {
    clubs: Array<{ leagueId: number; teamId: number; name: string }>;
  };

  const expTeamRates = new Map<string, TeamRates>();
  for (const t of [...expTeamStats.teams, ...expAddendum.teams]) {
    const rates = teamRatesFrom(t);
    if (rates !== null) expTeamRates.set(`${t.team?.id}|${t.league?.id}`, rates);
  }
  // Estrela id-duplication alias, verified 2026-08-12 (see proxy-expansion.ts)
  const aliasTo = expTeamRates.get('15130|94');
  if (aliasTo === undefined) throw new Error('alias target 15130|94 has no team figures');
  expTeamRates.set('28053|94', aliasTo);

  const expClubNames = new Map<number, string>();
  for (const c of currentClubs.clubs) expClubNames.set(c.teamId, c.name);

  const expEntriesByPlayer = new Map<number, Raw[]>();
  for (const row of expAggregates.rows) {
    const list = expEntriesByPlayer.get(row.player.id) ?? [];
    for (const s of row.statistics ?? []) {
      if (EXPANSION[n(s.league?.id)] !== undefined) list.push(s);
    }
    expEntriesByPlayer.set(row.player.id, list);
  }

  for (const p of expUniverse) {
    const pool = EXPANSION[p.leagueId];
    if (pool === undefined) throw new Error(`non-expansion league ${p.leagueId} in expansion snapshot`);
    const clubName = expClubNames.get(p.clubId) ?? String(p.clubId);
    const tagged = (expEntriesByPlayer.get(p.apiFootballId) ?? []).filter(
      (s) => n(s.league?.id) === p.leagueId && n(s.games?.minutes) > 0,
    );
    const own = tagged.filter((s) => expTeamRates.has(`${s.team?.id}|${s.league?.id}`));

    if (own.length === 0) {
      const anyRows = expEntriesByPlayer.get(p.apiFootballId) ?? [];
      rows.push({
        apiFootballId: p.apiFootballId, name: p.name, clubName,
        position: p.position, pool: 'flagged', leagueIds: [], leagueLabel: '',
        components: null,
        partialMinutes: anyRows.reduce((sum, s) => sum + n(s.games?.minutes), 0),
        partialApps: anyRows.reduce((sum, s) => sum + n(s.games?.appearences), 0),
      });
      continue;
    }

    const leagueIds = leagueScope(own);
    rows.push({
      apiFootballId: p.apiFootballId, name: p.name, clubName,
      position: p.position, pool, leagueIds,
      leagueLabel: leagueIds.map((id) => LEAGUE_NAMES[id] ?? `league ${id}`).join(' + '),
      components: sumComponents(own, expTeamRates),
    });
  }

  // ---------- VERIFICATION GATE against the committed proxy artifacts ----------
  // Each universe is checked against ITS OWN artifact (the two snapshots were
  // pulled two weeks apart and 8 players legitimately appear in both).
  const proxyMain = readArtifact('proxy-scores.json') as { manifest: Raw; players: Raw[]; flagged: Raw[] };
  const proxyExp = readArtifact('expansion-proxy-scores.json') as { manifest: Raw; players: Raw[]; flagged: Raw[] };

  const mainRows = rows.slice(0, universe.length);
  const expRows = rows.slice(universe.length);

  let mismatches = 0;
  const gate = (
    got: ComponentRow[],
    artifact: { manifest: Raw; players: Raw[]; flagged: Raw[] },
    label: string,
  ): void => {
    const expected = new Map<number, { pool: string; minutes: number; apps: number }>();
    for (const s of artifact.players) expected.set(s.apiFootballId, { pool: s.pool, minutes: s.minutes, apps: s.apps });
    for (const f of artifact.flagged) expected.set(f.apiFootballId, { pool: 'flagged', minutes: -1, apps: -1 });
    for (const r of got) {
      const e = expected.get(r.apiFootballId);
      if (e === undefined) {
        console.error(`GATE(${label}): ${r.apiFootballId} ${r.name} not in artifact`);
        mismatches += 1;
        continue;
      }
      if (e.pool !== r.pool) {
        console.error(`GATE(${label}): ${r.apiFootballId} ${r.name} pool ${r.pool} != artifact ${e.pool}`);
        mismatches += 1;
        continue;
      }
      if (r.pool !== 'flagged' && (r.components!.minutes !== e.minutes || r.components!.apps !== e.apps)) {
        console.error(
          `GATE(${label}): ${r.apiFootballId} ${r.name} minutes/apps ${r.components!.minutes}/${r.components!.apps} != artifact ${e.minutes}/${e.apps}`,
        );
        mismatches += 1;
      }
    }
    if (got.length !== expected.size) {
      console.error(`GATE(${label}): row count ${got.length} != artifact ${expected.size}`);
      mismatches += 1;
    }
    const gotCounts: Record<string, number> = {};
    for (const r of got) gotCounts[r.pool] = (gotCounts[r.pool] ?? 0) + 1;
    for (const [pool, want] of Object.entries(artifact.manifest.counts as Record<string, number>)) {
      if ((gotCounts[pool] ?? 0) !== want) {
        console.error(`GATE(${label}): pool ${pool} count ${gotCounts[pool] ?? 0} != artifact ${want}`);
        mismatches += 1;
      }
    }
  };
  gate(mainRows, proxyMain, 'topfive');
  gate(expRows, proxyExp, 'expansion');
  if (mismatches > 0) {
    throw new Error(`STOP: ${mismatches} gate mismatches against the committed proxy artifacts — selection drifted`);
  }
  console.log(`gate: ${mainRows.length} + ${expRows.length} rows match their proxy artifacts (pool, minutes, apps)`);

  // ---------- dedupe across universes: expansion wins ----------
  // The expansion snapshot (2026-08-12) postdates the top-five one (2026-07-29)
  // and matches the CURRENT fantasyDraftPoolMeta for the overlap players (the
  // expansion push upserted their meta last). If the surviving row is flagged
  // with no components while the superseded top-five row has a real season
  // line, carry that line across — "flagged" states the PRICING basis (no
  // in-cohort 2025-26 minutes); the player's actual last-season football is
  // still a fact we hold and the sheet's mandate is "show what exists".
  const byId = new Map<number, ComponentRow>();
  for (const r of mainRows) byId.set(r.apiFootballId, r);
  let carried = 0;
  const dupes: string[] = [];
  for (const r of expRows) {
    const prior = byId.get(r.apiFootballId);
    if (prior !== undefined) {
      dupes.push(`${r.apiFootballId} ${r.name} (${prior.pool} -> ${r.pool})`);
      if (r.components === null && prior.components !== null) {
        r.components = prior.components;
        r.leagueIds = prior.leagueIds;
        r.leagueLabel = prior.leagueLabel;
        delete r.partialMinutes;
        delete r.partialApps;
        carried += 1;
      }
    }
    byId.set(r.apiFootballId, r);
  }
  const finalRows = [...byId.values()];
  console.log(`dedupe: ${dupes.length} players in both universes (expansion wins): ${dupes.join('; ')}`);
  console.log(`dedupe: carried a real top-five season line onto ${carried} flagged expansion rows`);

  const counts: Record<string, number> = {};
  for (const r of finalRows) counts[r.pool] = (counts[r.pool] ?? 0) + 1;
  console.log(`final counts: ${JSON.stringify(counts)} (total ${finalRows.length})`);

  fs.writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        manifest: {
          generatedAt: new Date().toISOString(),
          season: '2025-26',
          method:
            'FW-SCOUT L1: season-line components via the exact proxy.ts / proxy-expansion.ts entry selection; gate-verified against proxy-scores.json + expansion-proxy-scores.json (pool, minutes, apps) per universe, then deduped across universes (expansion wins, matching current fantasyDraftPoolMeta; a superseded top-five season line is carried onto flagged expansion rows — the sheet shows what exists). csRate/gaPerMatch are minutes-weighted CLUB expectation rates (PROXY_METHOD.md approximation 4), not player stats. No scalar, no rank, no composite.',
          counts,
          dupes,
          carriedLines: carried,
        },
        rows: finalRows,
      },
      null,
      1,
    ),
  );
  console.log(`wrote ${path.basename(OUT_PATH)} (${finalRows.length} rows)`);
}

main();
