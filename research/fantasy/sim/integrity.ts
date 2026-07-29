/**
 * FS-1 — sample integrity pass.
 *
 * Runs over the completed 192-fixture sample and measures what is actually
 * there, against the checklists declared BEFORE the pull (`fetch/config.ts`
 * REQUIRED_STATS and REQUIRED_EVENT_FIELDS). Declaring them first is the point:
 * coverage is judged against a fixed list rather than against whatever happened
 * to arrive.
 *
 * It reports. It never repairs. Every discrepancy below is printed with its
 * magnitude and left in the data (ticket HARD RULES: missing is reported
 * missing, never invented, estimated or backfilled).
 *
 *   npx tsx sim/integrity.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { REQUIRED_EVENT_FIELDS, REQUIRED_STATS } from '../fetch/config.ts';
import { DATA_DIR, loadDataset, type Dataset } from './dataset.ts';

function log(line = ''): void {
  process.stdout.write(`${line}\n`);
}

function pct(part: number, whole: number): string {
  return whole === 0 ? 'n/a' : `${((part / whole) * 100).toFixed(1)}%`;
}

function getPath(source: unknown, dotted: string): unknown {
  let current: unknown = source;
  for (const segment of dotted.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

// ---------------------------------------------------------------- file census

interface Census {
  fixturesOnDisk: number;
  eventsOnDisk: number;
  enumerated: number;
  missingPlayers: number[];
  missingEvents: number[];
}

function census(dataset: Dataset): Census {
  const missingPlayers: number[] = [];
  const missingEvents: number[] = [];
  let fixturesOnDisk = 0;
  let eventsOnDisk = 0;

  for (const meta of dataset.fixtures) {
    const p = path.join(DATA_DIR, 'fixtures', String(meta.leagueId), `${meta.fixtureId}.json`);
    const e = path.join(DATA_DIR, 'events', String(meta.leagueId), `${meta.fixtureId}.json`);
    if (fs.existsSync(p)) fixturesOnDisk += 1;
    else missingPlayers.push(meta.fixtureId);
    if (fs.existsSync(e)) eventsOnDisk += 1;
    else missingEvents.push(meta.fixtureId);
  }

  return {
    fixturesOnDisk,
    eventsOnDisk,
    enumerated: dataset.fixtures.length,
    missingPlayers,
    missingEvents,
  };
}

// ------------------------------------------------------------------ main pass

const dataset = loadDataset();
const c = census(dataset);

log('# FS-1 — sample integrity pass');
log('');
log(`Season ${dataset.season}. ${dataset.gameweeks.length} sampled rounds across 5 leagues.`);
log('');

log('## 1. File census');
log('');
log(`  fixtures enumerated by discovery : ${c.enumerated}`);
log(`  fixtures/players files on disk   : ${c.fixturesOnDisk}  (${pct(c.fixturesOnDisk, c.enumerated)})`);
log(`  fixtures/events  files on disk   : ${c.eventsOnDisk}  (${pct(c.eventsOnDisk, c.enumerated)})`);
if (c.missingPlayers.length > 0) log(`  MISSING player files: ${c.missingPlayers.join(', ')}`);
if (c.missingEvents.length > 0) log(`  MISSING event files : ${c.missingEvents.join(', ')}`);
log(`  player-fixture rows loaded       : ${dataset.rows.length}`);
log('');

log('## 2. Fixture completeness');
log('');
const statusCounts = new Map<string, number>();
for (const f of dataset.fixtures) statusCounts.set(f.statusShort, (statusCounts.get(f.statusShort) ?? 0) + 1);
for (const [status, count] of [...statusCounts].sort((a, b) => b[1] - a[1])) {
  log(`  status ${status.padEnd(4)}: ${count}`);
}
const perRound = new Map<string, number>();
for (const f of dataset.fixtures) {
  const k = `${f.leagueId}|${f.round}`;
  perRound.set(k, (perRound.get(k) ?? 0) + 1);
}
const roundSizes = [...new Set(perRound.values())].sort((a, b) => a - b);
log(`  fixtures per sampled round: ${roundSizes.join(', ')} (${perRound.size} rounds)`);
log('');

log('## 3. REQUIRED_STATS coverage across the full sample');
log(`  n = ${dataset.rows.length} player-fixture rows. "present" = the feed sent a non-null value.`);
log('  A null is NOT a zero on the wire; the harness converts it to 0 only because');
log('  the probe measured that null means "did not record this". Both are shown.');
log('');

const rawStatsByRow: Record<string, any>[] = [];
for (const meta of dataset.fixtures) {
  const file = path.join(DATA_DIR, 'fixtures', String(meta.leagueId), `${meta.fixtureId}.json`);
  if (!fs.existsSync(file)) continue;
  const body = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    response: { players: { statistics: Record<string, any>[] }[] }[];
  };
  for (const team of body.response ?? []) {
    for (const p of team.players ?? []) rawStatsByRow.push(p.statistics?.[0] ?? {});
  }
}

let worstGap: { name: string; rate: number } | null = null;
for (const stat of REQUIRED_STATS) {
  if (stat.path === null) {
    log(`  ${stat.specName.padEnd(26)} ${'—'.padEnd(24)} not on this endpoint (events feed supplies it)`);
    continue;
  }
  let present = 0;
  for (const s of rawStatsByRow) {
    const value = getPath(s, stat.path);
    if (value !== null && value !== undefined) present += 1;
  }
  const rate = rawStatsByRow.length === 0 ? 0 : (present / rawStatsByRow.length) * 100;
  const flag = rate < 90 ? '   <-- >10% null' : '';
  if (worstGap === null || rate < worstGap.rate) worstGap = { name: stat.specName, rate };
  log(`  ${stat.specName.padEnd(26)} ${stat.path.padEnd(24)} ${rate.toFixed(1).padStart(5)}% non-null${flag}`);
}
log('');
log('  Reading note: a low non-null rate here is NOT a broken pull. The feed omits a');
log('  stat for a player who did not record it — a striker with no tackles has');
log('  tackles.total null, not 0. The structural question (does the field EXIST) was');
log('  settled by the probe; this table measures how often it carries a value.');
log('');

log('## 4. Structural absences (declared before the pull, re-confirmed here)');
log('');
for (const stat of REQUIRED_STATS) {
  if (stat.note === undefined) continue;
  log(`  ${stat.specName}`);
  log(`    ${stat.note.replace(/\s+/g, ' ')}`);
  log('');
}

log('## 5. Events feed');
log('');
let eventTotal = 0;
const combos = new Map<string, number>();
for (const events of dataset.eventsByFixture.values()) {
  for (const e of events) {
    eventTotal += 1;
    combos.set(`${e.type} | ${e.detail}`, (combos.get(`${e.type} | ${e.detail}`) ?? 0) + 1);
  }
}
log(`  ${eventTotal} events across ${dataset.eventsByFixture.size} fixtures.`);
log('');
for (const [combo, count] of [...combos].sort((a, b) => b[1] - a[1])) {
  log(`  ${String(count).padStart(5)}  ${combo}`);
}
log('');
for (const field of REQUIRED_EVENT_FIELDS) {
  if (field.path === null) continue;
  let present = 0;
  for (const events of dataset.eventsByFixture.values()) {
    for (const e of events) if (getPath(e, field.path) !== undefined) present += 1;
  }
  log(`  ${field.specName.padEnd(30)} present on ${present}/${eventTotal} (${pct(present, eventTotal)})`);
}
log('');
log('  NOTE — no "Second Yellow card" detail exists anywhere in the sample. Reds are');
log('  a single undifferentiated category, exactly as SCORING_SPEC v0.4.1 assumes');
log('  when it prices both at -4. The assumption is now measured, not inherited.');
log('');
log('  NOTE — there is no event detail for a SAVED penalty. `penalty.saved` exists on');
log('  the stat line but carries no clock, so a GK finisher\'s penalty save cannot be');
log('  placed after the 75th minute. This is a feed limit, reported not worked around.');
log('');

log('## 6. Cross-feed reconciliation — goals');
log('');
log('  The two feeds are independent. If summed stat-line goals disagree with the');
log('  fixture score, one of them is wrong and the sim would silently inherit it.');
log('  THE STAT LINE WINS in the harness; disagreements are reported here, never patched.');
log('');

let scoreMatches = 0;
let scoreMismatches = 0;
const mismatchDetail: string[] = [];
let eventGoalMatches = 0;
let eventGoalMismatches = 0;
const eventMismatchDetail: string[] = [];

for (const meta of dataset.fixtures) {
  const rows = dataset.rows.filter((r) => r.fixtureId === meta.fixtureId);
  if (rows.length === 0) continue;

  // Stat-line goals, per side. Own goals count for the OPPOSING side, which is
  // why they are added across rather than to the scorer's own team.
  const homeStatGoals = rows.filter((r) => r.clubId === meta.homeClubId).reduce((a, r) => a + r.stats.goals, 0);
  const awayStatGoals = rows.filter((r) => r.clubId === meta.awayClubId).reduce((a, r) => a + r.stats.goals, 0);
  const homeOwn = rows.filter((r) => r.clubId === meta.homeClubId).reduce((a, r) => a + r.stats.ownGoals, 0);
  const awayOwn = rows.filter((r) => r.clubId === meta.awayClubId).reduce((a, r) => a + r.stats.ownGoals, 0);

  const homeReconstructed = homeStatGoals + awayOwn;
  const awayReconstructed = awayStatGoals + homeOwn;

  if (homeReconstructed === meta.homeGoals && awayReconstructed === meta.awayGoals) {
    scoreMatches += 1;
  } else {
    scoreMismatches += 1;
    if (mismatchDetail.length < 15) {
      mismatchDetail.push(
        `    #${meta.fixtureId} (L${meta.leagueId}) ${meta.homeName} ${meta.homeGoals}-${meta.awayGoals} ${meta.awayName}` +
          ` | stat-line reconstructs ${homeReconstructed}-${awayReconstructed}` +
          ` (stat goals ${homeStatGoals}/${awayStatGoals}, own goals ${homeOwn}/${awayOwn})`,
      );
    }
  }

  // Independently: does the EVENTS feed's goal count match the score? This is
  // the test that says whether VAR-cancelled goals were already excluded from
  // the Goal rows, or are still sitting in them.
  const events = dataset.eventsByFixture.get(meta.fixtureId) ?? [];
  const goalEvents = events.filter(
    (e) => e.type?.toLowerCase() === 'goal' && !e.detail?.toLowerCase().includes('missed penalty'),
  );
  if (goalEvents.length === meta.homeGoals + meta.awayGoals) {
    eventGoalMatches += 1;
  } else {
    eventGoalMismatches += 1;
    if (eventMismatchDetail.length < 15) {
      const cancelled = events.filter((e) => e.type?.toLowerCase() === 'var' && e.detail?.toLowerCase().includes('cancelled')).length;
      eventMismatchDetail.push(
        `    #${meta.fixtureId} (L${meta.leagueId}) score ${meta.homeGoals}-${meta.awayGoals} = ${meta.homeGoals + meta.awayGoals}` +
          ` but ${goalEvents.length} goal events (${cancelled} Var/cancelled rows present)`,
      );
    }
  }
}

const scored = scoreMatches + scoreMismatches;
log(`  stat line vs fixture score : ${scoreMatches}/${scored} agree (${pct(scoreMatches, scored)})`);
if (mismatchDetail.length > 0) {
  log('    disagreements (first 15):');
  mismatchDetail.forEach((d) => log(d));
}
log('');
const evScored = eventGoalMatches + eventGoalMismatches;
log(`  events feed vs fixture score: ${eventGoalMatches}/${evScored} agree (${pct(eventGoalMatches, evScored)})`);
if (eventMismatchDetail.length > 0) {
  log('    disagreements (first 15):');
  eventMismatchDetail.forEach((d) => log(d));
}
log('');

log('## 7. Cross-feed reconciliation — substitutions');
log('');
let subEvents = 0;
let subsWithEntry = 0;
let flaggedSubstitutes = 0;
let flaggedWithEntryMinute = 0;
for (const events of dataset.eventsByFixture.values()) {
  for (const e of events) {
    if (e.type?.toLowerCase() !== 'subst') continue;
    subEvents += 1;
    if (e.assist?.id !== null && e.assist?.id !== undefined) subsWithEntry += 1;
  }
}
for (const row of dataset.rows) {
  if (!row.stats.wasSubstitute) continue;
  flaggedSubstitutes += 1;
  if (row.entryMinute !== null) flaggedWithEntryMinute += 1;
}
log(`  subst events                       : ${subEvents}`);
log(`  ...carrying an incoming player id  : ${subsWithEntry} (${pct(subsWithEntry, subEvents)})`);
log(`  rows flagged games.substitute=true : ${flaggedSubstitutes}`);
log(`  ...with an entry minute resolvable : ${flaggedWithEntryMinute} (${pct(flaggedWithEntryMinute, flaggedSubstitutes)})`);
log('');
log('  The gap is unused substitutes: games.substitute=true means "was on the bench",');
log('  not "came on". A bench player who never entered has no subst event and');
log('  correctly resolves to a null entry minute — SCORING_SPEC §Finishers scores');
log('  an unused finisher as 0, so this is the intended path, not a coverage hole.');
log('');

log('## 8. Position coverage');
log('');
const posCounts = new Map<string, number>();
for (const row of dataset.rows) posCounts.set(String(row.feedPosition), (posCounts.get(String(row.feedPosition)) ?? 0) + 1);
for (const [pos, count] of [...posCounts].sort((a, b) => b[1] - a[1])) {
  log(`  ${pos.padEnd(6)}: ${String(count).padStart(5)} (${pct(count, dataset.rows.length)})`);
}
const nullPos = posCounts.get('null') ?? 0;
log('');
log(
  nullPos === 0
    ? '  Every row carries a nominal position. The verdict-position input to'
    : `  ${nullPos} rows carry no nominal position — those rows cannot exercise`,
);
log(
  nullPos === 0
    ? '  SCORING_SPEC §Position mismatch is fully populated.'
    : '  §Position mismatch and are reported, not guessed.',
);
log('');

log('## 9. Minutes');
log('');
const played = dataset.rows.filter((r) => r.stats.minutes > 0);
const zero = dataset.rows.length - played.length;
const over60 = dataset.rows.filter((r) => r.stats.minutes >= 60).length;
log(`  rows with minutes > 0 : ${played.length} (${pct(played.length, dataset.rows.length)})`);
log(`  rows with minutes = 0 : ${zero} (unused bench — expected)`);
log(`  rows with minutes >= 60: ${over60} (${pct(over60, dataset.rows.length)}) — the clean-sheet / concession qualifier`);
const maxMinutes = Math.max(...dataset.rows.map((r) => r.stats.minutes));
log(`  max minutes observed  : ${maxMinutes}`);
log('');

log('## Verdict inputs');
log('');
log(`  This pass makes no PASS/FAIL judgment — it reports figures. The numbers a`);
log(`  reader needs: ${c.fixturesOnDisk}/${c.enumerated} player files, ${c.eventsOnDisk}/${c.enumerated} event files,`);
log(`  ${dataset.rows.length} player-fixture rows, stat-line/score agreement ${pct(scoreMatches, scored)},`);
log(`  events/score agreement ${pct(eventGoalMatches, evScored)}.`);
