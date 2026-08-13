/**
 * MISSION FW-REPRICE-2 — re-cut the two universe snapshots from the live table.
 *
 * OWNER DECISION 5 ruled option (c): re-export both snapshots from the live
 * table and regenerate. The old files were two reads of the same drifting
 * table twelve days apart (2026-07-29 and 2026-08-12), which is what put 8
 * players in both universes at different clubs and left 70 active prod rows
 * in neither.
 *
 * The cut is from PROD (different-lynx-153) — the deployment users play on is
 * the pricing universe's authority; DEV is re-synced to match by
 * app/scripts/syncDevUniverse.ts. One export, split by CURRENT leagueId:
 *
 *   leagues 39/140/135/78/61  -> data/players-seed-snapshot.json      (core)
 *   leagues 40/88/94          -> data/expansion-players-snapshot.json (expansion)
 *
 * The two files are DISJOINT BY CONSTRUCTION: a player is snapshotted exactly
 * once, at his current club, which is what collapses the OWNER DECISION 5
 * double rows. Every row of the table lands in exactly one file — including
 * inactive (departed) rows, so the artifacts cover the whole table and
 * repriceCoverage.ts can demand ZERO uncovered rows instead of ledgering 70.
 *
 * Read-only against Convex: this script exports, it never writes. File shapes
 * are kept exactly as their consumers read them (seedFantasyPrices.ts wants
 * exportedAt/count top-level on the core file; seedExpansionPrices.ts wants
 * manifest.count on the expansion file; reprice.ts reads .players on both).
 *
 * Run: npx tsx pricing/recut-snapshots.ts [--from <players.jsonl>]
 *   --from reuses an existing `convex export` fantasyPlayers/documents.jsonl
 *   instead of pulling a fresh one (same-session re-runs; provenance printed).
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(PRICING_DIR, 'data');
const APP_DIR = path.resolve(PRICING_DIR, '..', '..', '..', 'app');
const CORE_PATH = path.join(DATA_DIR, 'players-seed-snapshot.json');
const EXPANSION_PATH = path.join(DATA_DIR, 'expansion-players-snapshot.json');

/** The deployment the universe is cut from. Prod, deliberately and visibly. */
const SOURCE_DEPLOYMENT = 'different-lynx-153';

const CORE_LEAGUES = new Set([39, 140, 135, 78, 61]);
const EXPANSION_LEAGUES = new Set([40, 88, 94]);
const POSITIONS = new Set(['GK', 'DEF', 'MID', 'ATT']);

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

interface SnapshotRow {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubId: number;
  leagueId: number;
  position: string;
  active: boolean;
}

function exportPlayers(): { rows: TableRow[]; provenance: string } {
  const fromFlag = process.argv.indexOf('--from');
  if (fromFlag !== -1) {
    const file = process.argv[fromFlag + 1];
    if (file === undefined) throw new Error('--from needs a path to a fantasyPlayers documents.jsonl');
    const rows = fs
      .readFileSync(file, 'utf-8')
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as TableRow);
    return { rows, provenance: `reused export ${file}` };
  }
  const zipPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'recut-')), 's.zip');
  const exported = spawnSync(
    'npx',
    ['convex', 'export', '--path', zipPath, '--deployment', SOURCE_DEPLOYMENT],
    { cwd: APP_DIR, encoding: 'utf8', shell: process.platform === 'win32' },
  );
  if (exported.status !== 0) {
    process.stderr.write(exported.stderr ?? '');
    throw new Error(`convex export failed with exit code ${exported.status}`);
  }
  const out = spawnSync('unzip', ['-p', zipPath, 'fantasyPlayers/documents.jsonl'], {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  if (out.status !== 0) throw new Error('could not read fantasyPlayers from the export');
  const rows = out.stdout
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as TableRow);
  return { rows, provenance: 'fresh convex export' };
}

function main(): void {
  // The 8 OWNER DECISION 5 double rows, measured off the files being replaced
  // so the collapse is verifiable in this script's own output.
  const oldOverlap = ((): number[] => {
    try {
      const oldCore = JSON.parse(fs.readFileSync(CORE_PATH, 'utf-8')) as { players: { apiFootballId: number }[] };
      const oldExp = JSON.parse(fs.readFileSync(EXPANSION_PATH, 'utf-8')) as { players: { apiFootballId: number }[] };
      const coreIds = new Set(oldCore.players.map((p) => p.apiFootballId));
      return oldExp.players.map((p) => p.apiFootballId).filter((id) => coreIds.has(id));
    } catch {
      return [];
    }
  })();

  const { rows, provenance } = exportPlayers();
  console.log(`source: ${SOURCE_DEPLOYMENT} (${provenance}) — ${rows.length} fantasyPlayers rows`);

  const ids = new Set(rows.map((r) => r.providerPlayerId));
  if (ids.size !== rows.length) throw new Error('STOP: duplicate providerPlayerId in the export');

  const core: SnapshotRow[] = [];
  const expansion: (SnapshotRow & { price: number | null })[] = [];
  for (const r of rows) {
    if (!POSITIONS.has(r.feedPosition)) {
      throw new Error(`STOP: ${r.name} (${r.providerPlayerId}) carries position "${r.feedPosition}"`);
    }
    const league = Number(r.leagueId);
    const row: SnapshotRow = {
      convexId: r._id,
      apiFootballId: Number(r.providerPlayerId),
      name: r.name,
      clubId: Number(r.clubId),
      leagueId: league,
      position: r.feedPosition,
      active: r.active,
    };
    if (Number.isNaN(row.apiFootballId) || Number.isNaN(row.clubId)) {
      throw new Error(`STOP: non-numeric provider/club id on ${r.name}`);
    }
    if (CORE_LEAGUES.has(league)) core.push(row);
    else if (EXPANSION_LEAGUES.has(league)) expansion.push({ ...row, price: r.price });
    else throw new Error(`STOP: ${r.name} carries league ${r.leagueId}, outside the 8 covered leagues`);
  }
  if (core.length + expansion.length !== rows.length) {
    throw new Error('STOP: the split does not partition the table');
  }

  const exportedAt = new Date().toISOString();
  const source =
    `npx convex export, deployment prod:${SOURCE_DEPLOYMENT}, table fantasyPlayers ` +
    '(FW-REPRICE-2 re-cut, OWNER DECISION 5 option c)';

  fs.writeFileSync(
    CORE_PATH,
    JSON.stringify({ exportedAt, source, count: core.length, players: core }, null, 1),
  );
  fs.writeFileSync(
    EXPANSION_PATH,
    JSON.stringify({ manifest: { source, exportedAt, count: expansion.length }, players: expansion }, null, 1),
  );

  const actives = (list: { active: boolean }[]): string =>
    `${list.filter((r) => r.active).length} active + ${list.filter((r) => !r.active).length} inactive`;
  console.log(`core      ${core.length} rows (${actives(core)}) -> ${path.basename(CORE_PATH)}`);
  console.log(`expansion ${expansion.length} rows (${actives(expansion)}) -> ${path.basename(EXPANSION_PATH)}`);
  const stillBoth = expansion.filter((e) => core.some((c) => c.apiFootballId === e.apiFootballId));
  if (stillBoth.length > 0) throw new Error(`STOP: ${stillBoth.length} players still in both files`);
  console.log(
    `OWNER DECISION 5 collapse: the old files shared ${oldOverlap.length} players ` +
      `(${oldOverlap.join(', ') || 'none'}); the new files share 0 — disjoint by construction.`,
  );
}

main();
