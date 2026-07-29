/**
 * TICKET FW-PR1 Step 4 (amended FW-PR1c) — Phase B owner artifacts, generated
 * from proxy-scores.json + price-draft.json. Deterministic: same input, same
 * markdown.
 *
 *   PRICE_REVIEW.md     the Phase B owner artifact under direct value pricing
 *                       (FW-PR1c): top 25 per position by draft price, price
 *                       histograms per half-step, promoted top-15.
 *   FLAGS.md            (a) floor-flagged players by club, most prominent
 *                       first; (b) top-30 proxy-rank vs minutes-rank gaps.
 *   DISTRIBUTION.md     per-position proxy deciles + price histograms.
 *   PROMOTED_COHORT.md  13 clubs, cohort-internal ordering, 4.0–6.5 band
 *                       mapping (owner rulings FW-PR1 item 2 / FW-PR1c).
 *
 * ANCHOR_GRID.md is retired (FW-PR1c) and no longer generated — the file on
 * disk is a pointer note.
 *
 * Run: npx tsx pricing/price-draft.ts && npx tsx pricing/build-artifacts.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRICING_DIR = path.dirname(fileURLToPath(import.meta.url));

const POSITIONS = ['GK', 'DEF', 'MID', 'ATT'] as const;

/** FW-PR1c ruling: direct value pricing. Ceilings from proxy maxima on scale. */
const CEILING: Record<(typeof POSITIONS)[number], number> = { MID: 13.0, ATT: 12.5, DEF: 9.0, GK: 6.0 };
const FLOOR = 4.0;
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

interface Priced {
  apiFootballId: number;
  name: string;
  club: string;
  position: (typeof POSITIONS)[number];
  pool: 'topfive' | 'promoted' | 'flagged';
  proxy: number | null;
  minutes: number;
  price: number;
}

const data = JSON.parse(fs.readFileSync(path.join(PRICING_DIR, 'proxy-scores.json'), 'utf-8')) as {
  manifest: { generatedAt: string; counts: Record<string, number> };
  players: Scored[];
  flagged: Flagged[];
};
const draft = JSON.parse(fs.readFileSync(path.join(PRICING_DIR, 'price-draft.json'), 'utf-8')) as {
  manifest: { generatedAt: string };
  players: Priced[];
};

const f2 = (x: number): string => x.toFixed(2);
const f1 = (x: number): string => x.toFixed(1);

/** Half-steps from a position's ceiling down to the 4.0 floor. */
function halfSteps(pos: (typeof POSITIONS)[number]): number[] {
  const out: number[] = [];
  for (let p = CEILING[pos]; p >= FLOOR - 1e-9; p -= 0.5) out.push(Math.round(p * 2) / 2);
  return out;
}

/** Per-position histogram rows: price → counts per pool. */
function histogram(pos: (typeof POSITIONS)[number]): string {
  const group = draft.players.filter((p) => p.position === pos);
  let out = `| Price | topfive | promoted | flagged | total |\n| --- | --- | --- | --- | --- |\n`;
  for (const price of halfSteps(pos)) {
    const at = group.filter((p) => p.price === price);
    const c = (pool: Priced['pool']): number => at.filter((p) => p.pool === pool).length;
    out += `| ${f1(price)} | ${c('topfive')} | ${c('promoted')} | ${c('flagged')} | ${at.length} |\n`;
  }
  return out;
}
const byProxyDesc = (a: Scored, b: Scored): number => b.proxy - a.proxy;

function quantile(sorted: number[], q: number): number {
  const idx = q * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const header = (title: string): string =>
  `# ${title}\n\n_Generated ${data.manifest.generatedAt} from proxy-scores.json (SCORING_SPEC v0.5.1 proxy — a RANKING signal, not scores; method and declared approximations in PROXY_METHOD.md)._\n\n`;

// ------------------------------------------------------------- PRICE_REVIEW.md
{
  let md = header('FW-PR1c — Price review (Phase B owner pass)');
  md += `**Direct value pricing (owner ruling FW-PR1c).** The quantile anchor grid is retired — it decoupled price from expected points wherever the distribution is non-uniform. Draft price = proxy clamped to [4.0, position ceiling], rounded half-up to the 0.5 scale (ceilings MID 13.0 / ATT 12.5 / DEF 9.0 / GK 6.0). Promoted cohort: 4.0–6.5 band by cohort-internal rank (GK band-top capped at the 6.0 position ceiling). Flagged: 4.0 floor. overrides.json applies LAST in Phase C and always wins. Full list: price-draft.json (${draft.players.length} players).\n`;

  for (const pos of POSITIONS) {
    const top = draft.players
      .filter((p) => p.position === pos && p.pool === 'topfive')
      .sort((a, b) => b.price - a.price || (b.proxy ?? 0) - (a.proxy ?? 0))
      .slice(0, 25);
    md += `\n## ${pos} — top 25 by draft price\n\n| # | Player | Club | Price | Proxy /90 | Minutes |\n| --- | --- | --- | --- | --- | --- |\n`;
    top.forEach((p, i) => {
      md += `| ${i + 1} | ${p.name} | ${p.club} | **${f1(p.price)}** | ${f2(p.proxy ?? 0)} | ${p.minutes}' |\n`;
    });
  }

  md += `\n# Price histograms (count at each half-step, all pools)\n`;
  for (const pos of POSITIONS) {
    md += `\n## ${pos}\n\n${histogram(pos)}`;
  }

  const promotedTop = draft.players
    .filter((p) => p.pool === 'promoted')
    .sort((a, b) => (b.proxy ?? 0) - (a.proxy ?? 0))
    .slice(0, 15);
  md += `\n# Promoted cohort — top 15 (cohort-internal proxy, band prices)\n\n| # | Player | Club | Pos | Band price | Proxy /90 (cohort) | Minutes |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
  promotedTop.forEach((p, i) => {
    md += `| ${i + 1} | ${p.name} | ${p.club} | ${p.position} | **${f1(p.price)}** | ${f2(p.proxy ?? 0)} | ${p.minutes}' |\n`;
  });
  fs.writeFileSync(path.join(PRICING_DIR, 'PRICE_REVIEW.md'), md);
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
  let md = header('FW-PR1 — Proxy distribution and draft prices');
  md += `Deciles of shrunk proxy per 90, by position. d10 = 10th percentile (weak end), d90 = 90th (strong end). Under direct value pricing (FW-PR1c) price = clamp+round of proxy, so the decile tables read straight onto the price histograms that follow (ceilings MID 13.0 / ATT 12.5 / DEF 9.0 / GK 6.0, common 4.0 floor).\n\n`;

  const table = (players: Scored[], label: string): string => {
    let out = `## ${label}\n\n| Pos | n | min | d10 | d20 | d30 | d40 | median | d60 | d70 | d80 | d90 | max |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
    for (const pos of POSITIONS) {
      const values = players.filter((p) => p.position === pos).map((p) => p.proxy).sort((a, b) => a - b);
      if (values.length === 0) continue;
      const cells = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((q) => f2(quantile(values, q)));
      out += `| ${pos} | ${values.length} | ${f2(values[0])} | ${cells.join(' | ')} | ${f2(values[values.length - 1])} |\n`;
    }
    return out + '\n';
  };

  md += table(data.players.filter((p) => p.pool === 'topfive'), `Top-five pool (${data.manifest.counts.topfive}) — priced by the direct formula`);
  md += table(
    data.players.filter((p) => p.pool === 'promoted'),
    `Promoted cohort (${data.manifest.counts.promoted}) — COHORT-INTERNAL scale, not comparable to the table above`,
  );
  md += `Flagged (no proxy, 4.0 floor): ${data.flagged.length}. Universe total ${data.manifest.counts.topfive + data.manifest.counts.promoted + data.flagged.length}.\n`;
  md += `\n# Draft price histograms (all pools; from price-draft.json)\n`;
  for (const pos of POSITIONS) {
    md += `\n## ${pos}\n\n${histogram(pos)}`;
  }
  fs.writeFileSync(path.join(PRICING_DIR, 'DISTRIBUTION.md'), md);
}

// --------------------------------------------------------- PROMOTED_COHORT.md
{
  const cohort = data.players.filter((p) => p.pool === 'promoted');
  let md = header('FW-PR1 — Promoted cohort (Phase B owner pass)');
  md += `${cohort.length} players at the 13 promoted clubs, proxied on their 2025-26 **second-division** aggregates. COHORT-INTERNAL ordering only — these proxies are never comparable to the top-five pool, and no cross-league discount exists (owner ruling). Pricing rule: **4.0–6.5 band, ordered by cohort-internal rank**. Any exception above 6.5 is an owner-named override in overrides.json, never automatic.\n\n**Band mapping (FW-PR1c, rank → half-step):** within each position, sorted by cohort proxy descending, \`price = min(6.5 − 0.5 × round(5 × (rank−1)/(N−1)), position ceiling)\` — rank #1 takes the band top, the last rank takes 4.0, ranks between spread evenly across the six half-steps. The position-ceiling term binds only for GK, whose 6.0 ceiling (FW-PR1c) sits below the 6.5 band top; the 4.0–6.5 band otherwise overlaps the full GK price range and the lower DEF range by design — promoted pricing remains cohort-internal.\n\n`;
  const clubCounts = new Map<string, number>();
  for (const p of cohort) clubCounts.set(p.clubName, (clubCounts.get(p.clubName) ?? 0) + 1);
  md += `Clubs: ${[...clubCounts.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} (${n})`).join(', ')}. `;
  md += `Cohort members without usable second-division minutes are in FLAGS.md at the 4.0 floor.\n`;

  // Prices come from price-draft.json — the single source of truth — rather
  // than recomputing the mapping here and risking drift.
  const draftPrice = new Map(draft.players.map((p) => [p.apiFootballId, p.price]));
  for (const pos of POSITIONS) {
    const pool = cohort.filter((p) => p.position === pos).sort(byProxyDesc);
    if (pool.length === 0) continue;
    md += `\n## ${pos} (${pool.length})\n\n| # | Player | Club | Proxy /90 (cohort) | Minutes | Band price |\n| --- | --- | --- | --- | --- | --- |\n`;
    pool.forEach((p, i) => {
      md += `| ${i + 1} | ${p.name} | ${p.clubName} | ${f2(p.proxy)} | ${p.minutes}' | ${f1(draftPrice.get(p.apiFootballId) as number)} |\n`;
    });
  }
  fs.writeFileSync(path.join(PRICING_DIR, 'PROMOTED_COHORT.md'), md);
}

console.log('wrote PRICE_REVIEW.md, FLAGS.md, DISTRIBUTION.md, PROMOTED_COHORT.md');
