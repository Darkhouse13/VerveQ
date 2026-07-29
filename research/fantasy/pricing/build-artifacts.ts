/**
 * TICKET FW-PR1 Step 4 — Phase B owner artifacts, generated from
 * proxy-scores.json. Deterministic: same input, same markdown.
 *
 *   ANCHOR_GRID.md      28 slots (4 positions × 7 price points), top-five pool
 *                       ONLY (owner ruling item 5), candidate + 2 alternates.
 *   FLAGS.md            (a) floor-flagged players by club, most prominent
 *                       first; (b) top-30 proxy-rank vs minutes-rank gaps.
 *   DISTRIBUTION.md     per-position proxy deciles, top-five pool, promoted
 *                       cohort appendix.
 *   PROMOTED_COHORT.md  13 clubs, cohort-internal ordering, proposed 4.0–6.5
 *                       mapping (owner ruling item 2).
 *
 * Run: npx tsx pricing/build-artifacts.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));

const POSITIONS = ['GK', 'DEF', 'MID', 'ATT'] as const;

/**
 * FW-PR1b ruling: per-position anchor points so price tracks expected points
 * across positions — a 13.0 is a MID/ATT ceiling the GK band cannot reach
 * (proxy max 5.75). Ceilings read from each position's proxy maximum rounded
 * to the 0.5 scale; GK compressed to 5 anchors over its 2.26–5.75 band.
 * Common 4.0 floor. 26 slots total, asserted below.
 */
const ANCHOR_PRICES: Record<(typeof POSITIONS)[number], readonly number[]> = {
  MID: [13.0, 11.5, 10.0, 8.5, 7.0, 5.5, 4.0],
  ATT: [12.5, 11.0, 9.5, 8.0, 6.5, 5.0, 4.0],
  DEF: [9.0, 8.0, 7.0, 6.0, 5.5, 4.5, 4.0],
  GK: [6.0, 5.5, 5.0, 4.5, 4.0],
};
const EXPECTED_SLOT_COUNT = 26;
const PROMOTED_BAND_TOP = 6.5;
const PROMOTED_BAND_FLOOR = 4.0;
const RANK_GAP_TOP_N = 30;

interface Scored {
  apiFootballId: number;
  name: string;
  clubName: string;
  position: (typeof POSITIONS)[number];
  pool: 'topfive' | 'promoted';
  minutes: number;
  apps: number;
  rawPer90: number;
  shrinkWeight: number;
  proxy: number;
}
interface Flagged {
  apiFootballId: number;
  name: string;
  clubName: string;
  position: string;
  reason: string;
  partialMinutes: number;
  partialApps: number;
}

const data = JSON.parse(fs.readFileSync(path.join(PRICING_DIR, 'proxy-scores.json'), 'utf-8')) as {
  manifest: { generatedAt: string; counts: Record<string, number> };
  players: Scored[];
  flagged: Flagged[];
};

const f2 = (x: number): string => x.toFixed(2);
const byProxyDesc = (a: Scored, b: Scored): number => b.proxy - a.proxy;

function quantile(sorted: number[], q: number): number {
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const header = (title: string): string =>
  `# ${title}\n\n_Generated ${data.manifest.generatedAt} from proxy-scores.json (SCORING_SPEC v0.5.1 proxy — a RANKING signal, not scores; method and declared approximations in PROXY_METHOD.md)._\n\n`;

// -------------------------------------------------------------- ANCHOR_GRID.md
{
  // FW-PR1b gate: grid arithmetic must match the ruling exactly.
  const slotCount = POSITIONS.reduce((sum, pos) => sum + ANCHOR_PRICES[pos].length, 0);
  if (slotCount !== EXPECTED_SLOT_COUNT) {
    throw new Error(`STOP: grid arithmetic — ${slotCount} slots, ruling says ${EXPECTED_SLOT_COUNT}`);
  }
  for (const pos of POSITIONS) {
    const points = ANCHOR_PRICES[pos];
    const onScale = points.every((p) => p >= 4.0 && Math.round(p * 2) === p * 2);
    const descending = points.every((p, i) => i === 0 || p < points[i - 1]);
    if (!onScale || !descending || points[points.length - 1] !== 4.0) {
      throw new Error(`STOP: ${pos} anchor points malformed: ${points.join('/')}`);
    }
  }

  let md = header('FW-PR1b — Anchor grid (Phase B owner pass)');
  md += `**${EXPECTED_SLOT_COUNT} slots on per-position price points (owner ruling FW-PR1b).** Prices are denominated in expected points: a uniform 13.0-per-position grid would hand GK and DEF ceilings their proxy bands never reach (GK tops out at 5.75/90, MID at 13.33/90), so each position's ceiling is read from its own proxy maximum rounded to the 0.5 scale — MID 13.0, ATT 12.5, DEF 9.0, GK 6.0 (compressed to 5 anchors over its narrow band). Common 4.0 floor.\n\nCandidates are drawn from the **top-five proxied pool only** (${data.manifest.counts.topfive} players; promoted cohort and flagged players are priced separately). Top anchor = the position's #1 by proxy; floor anchor = the bottom of the position; evenly spaced proxy-rank quantiles between. Each slot: candidate plus the two nearest alternates. Confirm or swap each slot; interpolation between confirmed anchors is Phase C.\n`;

  for (const pos of POSITIONS) {
    const pool = data.players.filter((p) => p.pool === 'topfive' && p.position === pos).sort(byProxyDesc);
    const points = ANCHOR_PRICES[pos];
    md += `\n## ${pos} (${pool.length} proxied, ${points.length} anchors)\n\n`;
    md += `| Price | Candidate | Proxy /90 | Minutes | Alternate A | Alternate B |\n`;
    md += `| --- | --- | --- | --- | --- | --- |\n`;
    points.forEach((price, i) => {
      const q = i / (points.length - 1);
      const idx = Math.round(q * (pool.length - 1));
      // Alternates: the two nearest distinct neighbours, pulled inward at the
      // ends so every slot carries exactly two.
      const altIdx =
        idx === 0 ? [idx + 1, idx + 2] : idx === pool.length - 1 ? [idx - 1, idx - 2] : [idx - 1, idx + 1];
      const cand = pool[idx];
      const alts = altIdx.map((j) => pool[j]);
      // FW-PR1b gate: candidate + 2 alternates, three distinct proxy scores.
      if (alts.some((p) => p === undefined) || new Set([cand, ...alts].map((p) => p.proxy)).size !== 3) {
        throw new Error(`STOP: ${pos} lacks depth at the ${price.toFixed(1)} point (idx ${idx} of ${pool.length})`);
      }
      const cell = (p: Scored): string => `${p.name} (${p.clubName}) ${f2(p.proxy)}, ${p.minutes}'`;
      md += `| **${price.toFixed(1)}** | **${cand.name}** (${cand.clubName}) | ${f2(cand.proxy)} | ${cand.minutes}' | ${cell(alts[0])} | ${cell(alts[1])} |\n`;
    });
  }
  fs.writeFileSync(path.join(PRICING_DIR, 'ANCHOR_GRID.md'), md);
}

// -------------------------------------------------------------------- FLAGS.md
{
  let md = header('FW-PR1 — Flags (Phase B editorial eye)');

  md += `## (a) Floor-flagged players — no usable 2025-26 league minutes (${data.flagged.length})\n\n`;
  md += `Default **4.0 floor** (owner ruling). Grouped by club, largest group first; within a club, any partial 2025-26 data (cup/other-competition minutes seen in the pulls) sorts first so likely first-teamers surface. Owner may attach a price to any name via overrides.json.\n\n`;
  const clubs = new Map<string, Flagged[]>();
  for (const p of data.flagged) {
    const list = clubs.get(p.clubName) ?? [];
    list.push(p);
    clubs.set(p.clubName, list);
  }
  for (const [club, list] of [...clubs.entries()].sort((a, b) => b[1].length - a[1].length)) {
    list.sort((a, b) => b.partialMinutes - a.partialMinutes || a.name.localeCompare(b.name));
    md += `**${club}** (${list.length}): `;
    md += list
      .map((p) => `${p.name} [${p.position}${p.partialMinutes > 0 ? `, ${p.partialMinutes}' partial` : ''}]`)
      .join(', ');
    md += `\n\n`;
  }

  md += `## (b) Top-${RANK_GAP_TOP_N} proxy-rank vs minutes-rank gaps (likely role changes / data artifacts)\n\n`;
  md += `Ranks computed within position, top-five pool. A large gap means the proxy sees something minutes do not (or vice versa) — worth an editorial eye before anchoring.\n\n`;
  md += `| Pos | Player | Club | Proxy rank | Minutes rank | Gap | Proxy /90 | Minutes |\n`;
  md += `| --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  const gapped: Array<{ p: Scored; proxyRank: number; minutesRank: number; gap: number }> = [];
  for (const pos of POSITIONS) {
    const pool = data.players.filter((p) => p.pool === 'topfive' && p.position === pos);
    const proxyRank = new Map([...pool].sort(byProxyDesc).map((p, i) => [p.apiFootballId, i + 1]));
    const minutesRank = new Map([...pool].sort((a, b) => b.minutes - a.minutes).map((p, i) => [p.apiFootballId, i + 1]));
    for (const p of pool) {
      const pr = proxyRank.get(p.apiFootballId) as number;
      const mr = minutesRank.get(p.apiFootballId) as number;
      gapped.push({ p, proxyRank: pr, minutesRank: mr, gap: Math.abs(pr - mr) });
    }
  }
  gapped.sort((a, b) => b.gap - a.gap);
  for (const { p, proxyRank, minutesRank, gap } of gapped.slice(0, RANK_GAP_TOP_N)) {
    md += `| ${p.position} | ${p.name} | ${p.clubName} | ${proxyRank} | ${minutesRank} | ${gap} | ${f2(p.proxy)} | ${p.minutes}' |\n`;
  }
  fs.writeFileSync(path.join(PRICING_DIR, 'FLAGS.md'), md);
}

// ------------------------------------------------------------- DISTRIBUTION.md
{
  let md = header('FW-PR1 — Proxy distribution (the shape being anchored)');
  md += `Deciles of shrunk proxy per 90, by position. d10 = 10th percentile (weak end), d90 = 90th (strong end).\n\n`;
  md += `**Anchor price points are per position (owner ruling FW-PR1b)**, ceilings read from each position's proxy maximum rounded to the 0.5 scale, so price is denominated in expected points:\n\n`;
  for (const pos of POSITIONS) {
    md += `- ${pos}: ${ANCHOR_PRICES[pos].map((p) => p.toFixed(1)).join(' / ')} (${ANCHOR_PRICES[pos].length} anchors)\n`;
  }
  md += `\n`;

  const table = (players: Scored[], label: string, withAnchors: boolean): string => {
    const anchorCol = withAnchors ? ' Anchor points |' : '';
    const anchorSep = withAnchors ? ' --- |' : '';
    let out = `## ${label}\n\n| Pos | n | min | d10 | d20 | d30 | d40 | median | d60 | d70 | d80 | d90 | max |${anchorCol}\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |${anchorSep}\n`;
    for (const pos of POSITIONS) {
      const values = players.filter((p) => p.position === pos).map((p) => p.proxy).sort((a, b) => a - b);
      if (values.length === 0) continue;
      const cells = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((q) => f2(quantile(values, q)));
      const anchors = withAnchors ? ` ${ANCHOR_PRICES[pos].map((p) => p.toFixed(1)).join(' / ')} |` : '';
      out += `| ${pos} | ${values.length} | ${f2(values[0])} | ${cells.join(' | ')} | ${f2(values[values.length - 1])} |${anchors}\n`;
    }
    return out + '\n';
  };

  md += table(data.players.filter((p) => p.pool === 'topfive'), `Top-five pool (${data.manifest.counts.topfive}) — the anchor-grid population`, true);
  md += table(
    data.players.filter((p) => p.pool === 'promoted'),
    `Promoted cohort (${data.manifest.counts.promoted}) — COHORT-INTERNAL scale, not comparable to the table above`,
    false,
  );
  md += `Flagged (no proxy, 4.0 floor): ${data.flagged.length}. Universe total ${data.manifest.counts.topfive + data.manifest.counts.promoted + data.flagged.length}.\n`;
  fs.writeFileSync(path.join(PRICING_DIR, 'DISTRIBUTION.md'), md);
}

// --------------------------------------------------------- PROMOTED_COHORT.md
{
  const cohort = data.players.filter((p) => p.pool === 'promoted');
  let md = header('FW-PR1 — Promoted cohort (Phase B owner pass)');
  md += `${cohort.length} players at the 13 promoted clubs, proxied on their 2025-26 **second-division** aggregates. COHORT-INTERNAL ordering only — these proxies are never comparable to the top-five pool, and no cross-league discount exists (owner ruling). Pricing rule: **4.0–6.5 band, ordered by cohort-internal rank**; the proposed mapping below distributes each position across the band by rank quantile in 0.5 steps. Any exception above 6.5 is an owner-named override in overrides.json, never automatic.\n\nNote (FW-PR1b): with per-position anchor points, this 4.0–6.5 band now overlaps the full GK range (4.0–6.0) and the lower DEF anchors (4.0–6.0) **by design** — promoted pricing remains cohort-internal and is unaffected by the anchor re-slice.\n\n`;
  const clubCounts = new Map<string, number>();
  for (const p of cohort) clubCounts.set(p.clubName, (clubCounts.get(p.clubName) ?? 0) + 1);
  md += `Clubs: ${[...clubCounts.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n})`).join(', ')}. `;
  md += `Cohort members without usable second-division minutes are in FLAGS.md at the 4.0 floor.\n`;

  const steps = Math.round((PROMOTED_BAND_TOP - PROMOTED_BAND_FLOOR) / 0.5); // 5
  for (const pos of POSITIONS) {
    const pool = cohort.filter((p) => p.position === pos).sort(byProxyDesc);
    if (pool.length === 0) continue;
    md += `\n## ${pos} (${pool.length})\n\n| # | Player | Club | Proxy /90 (cohort) | Minutes | Proposed price |\n| --- | --- | --- | --- | --- | --- |\n`;
    pool.forEach((p, i) => {
      const q = pool.length === 1 ? 0 : i / (pool.length - 1);
      const price = PROMOTED_BAND_TOP - 0.5 * Math.round(q * steps);
      md += `| ${i + 1} | ${p.name} | ${p.clubName} | ${f2(p.proxy)} | ${p.minutes}' | ${price.toFixed(1)} |\n`;
    });
  }
  fs.writeFileSync(path.join(PRICING_DIR, 'PROMOTED_COHORT.md'), md);
}

console.log('wrote ANCHOR_GRID.md, FLAGS.md, DISTRIBUTION.md, PROMOTED_COHORT.md');
