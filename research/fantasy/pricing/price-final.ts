/**
 * TICKET FW-PR2 Step 2 — the final price list.
 *
 * price-draft.json (FW-PR1c direct value pricing) with `overrides.json` applied
 * LAST, which is the whole of Phase C's pricing work: the anchor-interpolation
 * step this phase was originally scoped around was retired by FW-PR1c, and the
 * override contract ("Phase C must apply it last, so an override always wins")
 * is unchanged.
 *
 * ── What the override exempts, and what it does not (FW-PR2 owner ruling) ──
 *
 * An override binds to ONE scale rule: the global 4.0-13.0 half-step scale.
 * Post-override output is EXEMPT from the per-position ceilings (MID 13.0 /
 * ATT 12.5 / DEF 9.0 / GK 6.0) and from price-monotonicity in proxy. Lamine
 * Yamal at 13.0 sits above the ATT ceiling of 12.5 and David Raya at 6.0 sits
 * above four keepers with a higher proxy — both are owner-intended, and a gate
 * that rejected them would be a gate asserting the owner may not overrule the
 * formula. Those two gates still run in price-draft.ts, unchanged, against the
 * pre-override draft, which is where they mean something.
 *
 * Gates here (all STOP on failure):
 *   - 2,895 rows, distinct ids, pool counts identical to the draft's
 *   - every price on the 0.5 scale within the global [4.0, 13.0]
 *   - every override id exists in the draft, and its recorded name/club still
 *     match that row (an id typo that happens to hit a real player is caught
 *     by eye here rather than in the seeded table)
 *   - exactly 25 rows differ from the draft, and that set IS the override set
 *
 * Output: pricing/price-final.json. Run: npx tsx pricing/price-final.ts
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const DRAFT_PATH = path.join(PRICING_DIR, 'price-draft.json');
const OVERRIDES_PATH = path.join(PRICING_DIR, 'overrides.json');
const OUT_PATH = path.join(PRICING_DIR, 'price-final.json');

// FW-REPRICE-2 re-cut (2026-08-14): 2,895 before.
const UNIVERSE_SIZE = 2_953;
const EXPECTED_OVERRIDES = 25;
const SCALE_MIN = 4.0;
const SCALE_MAX = 13.0;

interface DraftPlayer {
  convexId: string;
  apiFootballId: number;
  name: string;
  club: string;
  position: string;
  pool: 'topfive' | 'promoted' | 'flagged';
  proxy: number | null;
  minutes: number;
  price: number;
}
interface DraftFile {
  manifest: { generatedAt: string; ruling: string; formula: string; counts: Record<string, number> };
  players: DraftPlayer[];
}
interface OverrideEntry {
  price: number;
  reason: string;
  date: string;
  name?: string;
  club?: string;
}

const draft = JSON.parse(fs.readFileSync(DRAFT_PATH, 'utf-8')) as DraftFile;
const overridesFile = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf-8')) as {
  version: number;
  overrides: Record<string, OverrideEntry>;
};
if (overridesFile.version !== 1) {
  throw new Error(`STOP: overrides.json version ${overridesFile.version}, expected 1`);
}

/**
 * The commit the draft was read at. Recorded so a price list can always be
 * traced back to the exact draft it was built from; `dirty` says the working
 * copy of price-draft.json differs from that commit, which would make the hash
 * a lie if it went unrecorded.
 */
function draftProvenance(): { commit: string; dirty: boolean } {
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: PRICING_DIR, encoding: 'utf-8' }).trim();
  const commit = git('log', '-1', '--format=%H', '--', DRAFT_PATH);
  const dirty = git('status', '--porcelain', '--', DRAFT_PATH).length > 0;
  return { commit, dirty };
}

const onScale = (price: number): boolean =>
  price >= SCALE_MIN && price <= SCALE_MAX && Math.round(price * 2) === price * 2;

// ---- apply overrides LAST ---------------------------------------------------
const byId = new Map(draft.players.map((p) => [p.apiFootballId, p]));
const overrideIds = new Set<number>();
const applied: { id: number; name: string; club: string; position: string; from: number; to: number }[] = [];

for (const [key, entry] of Object.entries(overridesFile.overrides)) {
  const id = Number(key);
  if (!Number.isInteger(id)) throw new Error(`STOP: override key "${key}" is not an integer id`);
  const row = byId.get(id);
  if (row === undefined) throw new Error(`STOP: override id ${id} is not in the draft universe`);
  if (entry.name !== undefined && entry.name !== row.name) {
    throw new Error(`STOP: override ${id} names "${entry.name}"; draft row is "${row.name}"`);
  }
  if (entry.club !== undefined && entry.club !== row.club) {
    throw new Error(`STOP: override ${id} (${row.name}) cites club "${entry.club}"; draft row is "${row.club}"`);
  }
  if (!onScale(entry.price)) {
    throw new Error(`STOP: override price ${entry.price} for ${row.name} is off the ${SCALE_MIN}-${SCALE_MAX} half-step scale`);
  }
  overrideIds.add(id);
  applied.push({ id, name: row.name, club: row.club, position: row.position, from: row.price, to: entry.price });
}

const players = draft.players.map((p) => {
  const entry = overridesFile.overrides[String(p.apiFootballId)];
  if (entry === undefined) return { ...p, overridden: false as const };
  return { ...p, price: entry.price, overridden: true as const, draftPrice: p.price };
});

// ---- gates ------------------------------------------------------------------
const counts = {
  topfive: players.filter((p) => p.pool === 'topfive').length,
  promoted: players.filter((p) => p.pool === 'promoted').length,
  flagged: players.filter((p) => p.pool === 'flagged').length,
};
const distinct = new Set(players.map((p) => p.apiFootballId)).size;
console.log(`rows ${players.length} (distinct ids ${distinct}) — topfive ${counts.topfive} + promoted ${counts.promoted} + flagged ${counts.flagged}`);
if (players.length !== UNIVERSE_SIZE || distinct !== UNIVERSE_SIZE) {
  throw new Error(`STOP: expected ${UNIVERSE_SIZE} distinct rows`);
}
for (const pool of ['topfive', 'promoted', 'flagged'] as const) {
  if (counts[pool] !== draft.manifest.counts[pool]) {
    throw new Error(`STOP: pool ${pool} is ${counts[pool]}, draft had ${draft.manifest.counts[pool]}`);
  }
}

for (const p of players) {
  if (!onScale(p.price)) {
    throw new Error(`STOP: off-scale price ${p.price} for ${p.name} (${p.position})`);
  }
}

const draftPriceById = new Map(draft.players.map((p) => [p.apiFootballId, p.price]));
const differing = players.filter((p) => p.price !== draftPriceById.get(p.apiFootballId));
const differingIds = new Set(differing.map((p) => p.apiFootballId));
if (differing.length !== EXPECTED_OVERRIDES) {
  throw new Error(`STOP: ${differing.length} rows differ from the draft, expected exactly ${EXPECTED_OVERRIDES}`);
}
if (overrideIds.size !== EXPECTED_OVERRIDES) {
  throw new Error(`STOP: ${overrideIds.size} overrides declared, expected exactly ${EXPECTED_OVERRIDES}`);
}
for (const id of overrideIds) {
  if (!differingIds.has(id)) {
    throw new Error(`STOP: override ${id} did not change its row's price — the override set and the diff set must be identical`);
  }
}
console.log(`gates passed: partition, ${SCALE_MIN}-${SCALE_MAX} half-step scale, diff set == override set (${EXPECTED_OVERRIDES})`);

// ---- write ------------------------------------------------------------------
const provenance = draftProvenance();
if (provenance.dirty) {
  console.warn('WARNING: price-draft.json differs from its last commit — recorded as dirty in the manifest');
}

applied.sort((a, b) => b.to - a.to || a.name.localeCompare(b.name));
for (const a of applied) {
  console.log(`  override ${a.name} (${a.club}, ${a.position}) ${a.from} -> ${a.to}`);
}

players.sort((a, b) => b.price - a.price || (b.proxy ?? -1) - (a.proxy ?? -1) || a.name.localeCompare(b.name));
fs.writeFileSync(
  OUT_PATH,
  JSON.stringify(
    {
      manifest: {
        generatedAt: new Date().toISOString(),
        ticket: 'FW-PR2 Phase C',
        draftCommit: provenance.commit,
        draftDirty: provenance.dirty,
        draftGeneratedAt: draft.manifest.generatedAt,
        formula: draft.manifest.formula,
        overrideCount: applied.length,
        overrideSource: 'pricing/overrides.json v1 (Phase B owner editorial, 2026-07-29)',
        scale: `${SCALE_MIN}-${SCALE_MAX} in 0.5 steps`,
        ruling:
          'Overrides apply LAST and bind only to the global half-step scale; post-override output is exempt from position ceilings and monotonicity (those gate the pre-override draft in price-draft.ts).',
        counts,
      },
      overridesApplied: applied,
      players,
    },
    null,
    1,
  ),
);
console.log(`wrote ${path.basename(OUT_PATH)} (${players.length} players, ${applied.length} overridden)`);
