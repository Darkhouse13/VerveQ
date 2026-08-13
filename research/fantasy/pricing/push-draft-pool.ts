/**
 * TICKET FW-3 — seed the draft-room pool metadata onto DEV.
 *
 * Reads pricing/price-final.json (the FW-PR2 Phase C artifact already living
 * on the DEV players table as `price`) and pushes the fields the R1 auto-pick
 * tie ladder needs — pool cohort, proxy score — plus the display club name,
 * into the fantasyDraftPoolMeta side table via
 * fantasyDraftRooms:upsertDraftPoolMeta. fantasyPlayers is never touched.
 *
 * Keyed by providerPlayerId (the apiFootballId), not by the artifact's
 * convexId: provider ids are stable across deployments, so this same artifact
 * seeds any environment.
 *
 * Idempotent — re-running rewrites identical rows. STOPs if any artifact row
 * has no matching player on the deployment (a missing player means the
 * players table and the artifact have drifted, which FW-PR2 says cannot
 * happen silently).
 *
 * Run: npx tsx pricing/push-draft-pool.ts
 * Deployment: whatever app/.env.local names (DEV: admired-warthog-495).
 *
 * FW-REPRICE-2 live path: `--live` appends `--prod` to every convex run AND
 * refuses to start unless CONFIRM_LIVE_DEPLOY=different-lynx-153 — the same
 * two-signal discipline as push-expansion-pool.ts. FW-REPRICE parked the live
 * push because a half-push would leave prod's two cohorts inconsistent; the
 * mission that opened this path (FW-REPRICE-2) pushes BOTH artifacts, whole,
 * in one sitting, which is the stated condition for it.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const FINAL_PATH = path.join(PRICING_DIR, 'price-final.json');
const APP_DIR = path.join(PRICING_DIR, '..', '..', '..', 'app');

/** FW-REPRICE-2 re-cut (2026-08-14): 2,895 before. */
const UNIVERSE_SIZE = 2_953;
const CHUNK_SIZE = 250;

interface FinalPlayer {
  convexId: string;
  apiFootballId: number;
  name: string;
  club: string;
  position: string;
  pool: 'topfive' | 'promoted' | 'flagged';
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
    `STOP: price-final.json holds ${artifact.players.length} players, expected ${UNIVERSE_SIZE}.`,
  );
}

const entries = artifact.players.map((p) => ({
  providerPlayerId: String(p.apiFootballId),
  pool: p.pool,
  proxy: p.proxy ?? null,
  clubName: p.club,
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
console.log('draft pool metadata seeded.');
