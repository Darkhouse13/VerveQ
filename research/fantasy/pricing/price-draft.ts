/**
 * TICKET FW-PR1c — direct value pricing. Quantile-anchor slotting is retired
 * (owner ruling: it decoupled price from expected points wherever the proxy
 * distribution is non-uniform — the MID 11.5 anchor slot carried a 7.41
 * proxy). Pricing is now a direct function of the proxy:
 *
 *   topfive   price = roundHalfUpTo0.5( clamp(proxy, 4.0, ceiling[pos]) )
 *             ceilings: MID 13.0 / ATT 12.5 / DEF 9.0 / GK 6.0
 *   promoted  4.0–6.5 band by cohort-internal per-position rank (unchanged
 *             ruling): price = 6.5 − 0.5 × round(5 × (rank−1)/(N−1))
 *   flagged   4.0 floor (unchanged)
 *
 * overrides.json is NOT read here — it applies LAST in Phase C and always
 * wins (unchanged contract).
 *
 * Gates (all STOP on failure):
 *   - partition: 2,895 exact across the three pools, distinct ids
 *   - every price on the 0.5 scale within [4.0, position ceiling];
 *     promoted prices within [4.0, 6.5]
 *   - monotonicity: within each pool+position, price non-decreasing in proxy
 *
 * Output: pricing/price-draft.json. Run: npx tsx pricing/price-draft.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(PRICING_DIR, 'price-draft.json');

const UNIVERSE_SIZE = 2_895;
const FLOOR = 4.0;
const CEILING: Record<string, number> = { MID: 13.0, ATT: 12.5, DEF: 9.0, GK: 6.0 };
const PROMOTED_BAND_TOP = 6.5;
const PROMOTED_BAND_STEPS = 5; // 6.5 → 4.0 in 0.5 steps

interface Scored {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubName: string;
  position: 'GK' | 'DEF' | 'MID' | 'ATT';
  pool: 'topfive' | 'promoted';
  minutes: number;
  proxy: number;
}
interface Flagged {
  convexId: string;
  apiFootballId: number;
  name: string;
  clubName: string;
  position: 'GK' | 'DEF' | 'MID' | 'ATT';
  reason: string;
  partialMinutes: number;
}

const data = JSON.parse(fs.readFileSync(path.join(PRICING_DIR, 'proxy-scores.json'), 'utf-8')) as {
  players: Scored[];
  flagged: Flagged[];
};

/** Round to the nearest 0.5, ties upward: 4.25 → 4.5, 5.75 → 6.0. */
function roundHalfUpTo05(x: number): number {
  return Math.floor(x * 2 + 0.5) / 2;
}

function onScale(price: number): boolean {
  return price >= FLOOR && Math.round(price * 2) === price * 2;
}

interface Priced {
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

const priced: Priced[] = [];

// ---- topfive: direct formula ------------------------------------------------
for (const p of data.players.filter((s) => s.pool === 'topfive')) {
  const price = roundHalfUpTo05(Math.min(Math.max(p.proxy, FLOOR), CEILING[p.position]));
  priced.push({
    convexId: p.convexId, apiFootballId: p.apiFootballId, name: p.name, club: p.clubName,
    position: p.position, pool: 'topfive', proxy: p.proxy, minutes: p.minutes, price,
  });
}

// ---- promoted: 4.0–6.5 band by cohort-internal per-position rank ------------
for (const position of ['GK', 'DEF', 'MID', 'ATT']) {
  const cohort = data.players
    .filter((s) => s.pool === 'promoted' && s.position === position)
    .sort((a, b) => b.proxy - a.proxy);
  cohort.forEach((p, i) => {
    const q = cohort.length === 1 ? 0 : i / (cohort.length - 1);
    // Band price, then the position ceiling — the ticket's gates require BOTH
    // promoted ⊆ [4.0, 6.5] AND every price ≤ ceiling[pos]. Only GK binds
    // (band top 6.5 > GK ceiling 6.0); min() keeps rank monotonicity intact.
    const price = Math.min(PROMOTED_BAND_TOP - 0.5 * Math.round(q * PROMOTED_BAND_STEPS), CEILING[position]);
    priced.push({
      convexId: p.convexId, apiFootballId: p.apiFootballId, name: p.name, club: p.clubName,
      position: p.position, pool: 'promoted', proxy: p.proxy, minutes: p.minutes, price,
    });
  });
}

// ---- flagged: floor ---------------------------------------------------------
for (const p of data.flagged) {
  priced.push({
    convexId: p.convexId, apiFootballId: p.apiFootballId, name: p.name, club: p.clubName,
    position: p.position, pool: 'flagged', proxy: null, minutes: p.partialMinutes, price: FLOOR,
  });
}

// ---- gates ------------------------------------------------------------------
const counts = {
  topfive: priced.filter((p) => p.pool === 'topfive').length,
  promoted: priced.filter((p) => p.pool === 'promoted').length,
  flagged: priced.filter((p) => p.pool === 'flagged').length,
};
const distinct = new Set(priced.map((p) => p.apiFootballId)).size;
console.log(`partition: topfive ${counts.topfive} + promoted ${counts.promoted} + flagged ${counts.flagged} = ${priced.length} (distinct ${distinct})`);
if (priced.length !== UNIVERSE_SIZE || distinct !== UNIVERSE_SIZE) {
  throw new Error('STOP: partition assertion failed');
}

for (const p of priced) {
  if (!onScale(p.price) || p.price > CEILING[p.position]) {
    throw new Error(`STOP: off-scale price ${p.price} for ${p.name} (${p.position})`);
  }
  if (p.pool === 'promoted' && p.price > PROMOTED_BAND_TOP) {
    throw new Error(`STOP: promoted price ${p.price} above band for ${p.name}`);
  }
}

// monotonicity within pool+position: sort by proxy descending; price must
// never increase as proxy falls (flagged carry no proxy — excluded).
for (const pool of ['topfive', 'promoted'] as const) {
  for (const position of ['GK', 'DEF', 'MID', 'ATT']) {
    const group = priced
      .filter((p) => p.pool === pool && p.position === position)
      .sort((a, b) => (b.proxy as number) - (a.proxy as number));
    for (let i = 1; i < group.length; i += 1) {
      if (group[i].price > group[i - 1].price && (group[i].proxy as number) < (group[i - 1].proxy as number)) {
        throw new Error(
          `STOP: monotonicity violated in ${pool}/${position}: ${group[i].name} (${group[i].proxy}, ${group[i].price}) above ${group[i - 1].name} (${group[i - 1].proxy}, ${group[i - 1].price})`,
        );
      }
    }
  }
}
console.log('gates passed: scale/range, promoted band, monotonicity per pool+position');

priced.sort((a, b) => b.price - a.price || (b.proxy ?? -1) - (a.proxy ?? -1) || a.name.localeCompare(b.name));
fs.writeFileSync(
  OUT_PATH,
  JSON.stringify(
    {
      manifest: {
        generatedAt: new Date().toISOString(),
        ruling: 'FW-PR1c direct value pricing — quantile anchors retired',
        formula: 'topfive: roundHalfUpTo0.5(clamp(proxy, 4.0, ceiling[pos])); promoted: 6.5 - 0.5*round(5*rankQuantile); flagged: 4.0',
        ceilings: CEILING,
        counts,
        note: 'overrides.json applies LAST in Phase C and always wins; not reflected here',
      },
      players: priced,
    },
    null,
    1,
  ),
);
console.log(`wrote ${path.basename(OUT_PATH)} (${priced.length} players)`);
