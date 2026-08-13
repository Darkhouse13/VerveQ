/**
 * MISSION FW-EXPAND O2 — seed the expansion players' draft-pool metadata.
 *
 * The expansion sibling of push-draft-pool.ts: reads
 * pricing/expansion-price-final.json and pushes pool cohort, proxy and the
 * display club name into fantasyDraftPoolMeta via
 * fantasyDraftRooms:upsertDraftPoolMeta. fantasyPlayers is never touched.
 * The clubName is also what the U1 picker matchup line resolves opponents
 * against — every expansion player must carry one.
 *
 * Idempotent; STOPs if any artifact row has no matching player on the
 * deployment.
 *
 * Run: npx tsx pricing/push-expansion-pool.ts
 * Deployment: whatever app/.env.local names (DEV: admired-warthog-495).
 *
 * FW-EXPAND O7 live path: `--live` appends `--prod` to every convex run AND
 * refuses to start unless CONFIRM_LIVE_DEPLOY=different-lynx-153 — the same
 * two-signal discipline as seedExpansionPrices.ts.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const FINAL_PATH = path.join(PRICING_DIR, 'expansion-price-final.json');
const APP_DIR = path.join(PRICING_DIR, '..', '..', '..', 'app');

/** FW-REPRICE-2 re-cut (2026-08-14): 1,780 before. */
const UNIVERSE_SIZE = 1_783;
const CHUNK_SIZE = 250;

interface FinalPlayer {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubName: string;
  position: string;
  pool: 'eredivisie' | 'ligaportugal' | 'championship' | 'flagged';
  proxy: number | null;
  price: number;
}

const live = process.argv.includes('--live');
if (live && process.env.CONFIRM_LIVE_DEPLOY?.trim() !== 'different-lynx-153') {
  throw new Error(
    'STOP: --live requires CONFIRM_LIVE_DEPLOY=different-lynx-153 exactly; generic booleans are refused.',
  );
}

const artifact = JSON.parse(fs.readFileSync(FINAL_PATH, 'utf8')) as {
  players: FinalPlayer[];
};

if (artifact.players.length !== UNIVERSE_SIZE) {
  throw new Error(
    `STOP: expansion-price-final.json holds ${artifact.players.length} players, expected ${UNIVERSE_SIZE}.`,
  );
}
for (const p of artifact.players) {
  if (typeof p.clubName !== 'string' || p.clubName.length === 0 || /^\d+$/.test(p.clubName)) {
    throw new Error(`STOP: ${p.name} has no usable clubName ("${p.clubName}")`);
  }
}

const entries = artifact.players.map((p) => ({
  providerPlayerId: String(p.apiFootballId),
  pool: p.pool,
  proxy: p.proxy ?? null,
  clubName: p.clubName,
}));

let created = 0;
let updated = 0;
let missing = 0;

for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
  const chunk = entries.slice(i, i + CHUNK_SIZE);
  const raw = execFileSync(
    'npx',
    [
      'convex',
      'run',
      'fantasyDraftRooms:upsertDraftPoolMeta',
      JSON.stringify({ entries: chunk }),
      ...(live ? ['--prod'] : []),
    ],
    { cwd: APP_DIR, encoding: 'utf8' },
  );
  const result = JSON.parse(raw) as {
    requested: number;
    created: number;
    updated: number;
    missing: number;
  };
  created += result.created;
  updated += result.updated;
  missing += result.missing;
  console.log(
    `chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(entries.length / CHUNK_SIZE)}: ` +
      `+${result.created} ~${result.updated} ?${result.missing}`,
  );
}

console.log(`total: created ${created}, updated ${updated}, missing ${missing}`);
if (missing > 0) {
  throw new Error(
    `STOP: ${missing} artifact rows have no player on this deployment — players table and artifact have drifted.`,
  );
}
if (created + updated !== UNIVERSE_SIZE) {
  throw new Error(`STOP: wrote ${created + updated} rows, expected ${UNIVERSE_SIZE}.`);
}
console.log('expansion draft pool metadata seeded.');
