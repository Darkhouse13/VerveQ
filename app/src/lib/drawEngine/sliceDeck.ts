/**
 * Daily Deck slice generator (Ticket E4 — additive module, owner-sanctioned).
 *
 * WHY THIS EXISTS. c13-1 was tuned and accepted on 50-card synthetic sets
 * (11 club tags at ~10 cards/tag, 6 nations of 5–13 cards, ~uniform eras).
 * real-v4 is 430 cards over 323 club tags / 57 nations — a synergy density
 * ~2.6× lower — and failed the P0-set Tier-2 gate at 88.20% natural
 * full-clear (Ticket E3 step 1, STOP). The ruled remedy is SERVING-LAYER
 * density restoration: each day serves a ~50-card SLICE of the pinned real
 * set, built to the synthetic genome profile the config was tuned on. The
 * engine is untouched — this module only SELECTS cards; board generation,
 * scoring and thresholds are the frozen v1.0 contract.
 *
 * PURITY. Same rules as the rest of the engine: seeded RNG only (rng.ts), no
 * I/O, no Date/Math.random. sliceDeck(dateSeed, fullSet, cfg) is a pure
 * deterministic function — same inputs ⇒ byte-identical slice — so serving
 * can recompute it idempotently and acceptance can replay it exactly.
 *
 * SHAPE TARGET (the synthetic genome, restated as constraints):
 *   - anchor clubs: `anchorClubCount` club tags drawn from tags carrying at
 *     least `minClubCardsForAnchor` cards in the FULL set (and at least
 *     `minAnchorInPool` inside the day's nation pool), with card selection
 *     preferring anchor-carrying cards — restores cards-per-club density.
 *   - nations: exactly `nationCount`, drawn from nations with at least
 *     `minNationCards` cards; every slice card's nation is one of them.
 *   - positions: exact quota from `positionWeights` (10/30/30/30 at c13-1).
 *   - eras: ~uniform targets with availability repair, floored at
 *     `minPerEra` — era is a synergy family, so a starved bucket kills a
 *     third of the chain surface.
 *   - fame mix: at least `minIcons` cards from the top `iconPoolSize` of the
 *     full set by rating (rating is fame-ordered by construction: the
 *     selector maps rating rank k to fameRank k).
 *
 * FAIL-CLOSED. A dateSeed whose drawn nation combo cannot satisfy the
 * constraints is retried with the next seeded combo (bounded by
 * `maxNationDraws`, deterministic); exhaustion THROWS — a slice that cannot
 * meet the profile must never silently ship thinner.
 */

import { rngFromString, rngInt, rngShuffle } from "./rng";
import type { Card, PositionId } from "./types";

const POSITIONS: PositionId[] = ["GK", "DEF", "MID", "ATT"];

export interface SliceConfig {
  /** Cards per slice (the synthetic genome's setSize). */
  sliceSize: number;
  /** Anchor club tags per slice. */
  anchorClubCount: number;
  /** A club tag is anchor-ELIGIBLE with at least this many cards in the full set. */
  minClubCardsForAnchor: number;
  /** ...and at least this many cards inside the day's nation pool. */
  minAnchorInPool: number;
  /** Distinct nations per slice. */
  nationCount: number;
  /** A nation is eligible with at least this many cards in the full set. */
  minNationCards: number;
  /** Position mix (proportions; quotas are exact per slice). */
  positionWeights: Record<PositionId, number>;
  /** Minimum slice cards in every era bucket. */
  minPerEra: number;
  /**
   * Nation-cluster shaping to the synthetic profile (observed 13/9/8/8/7/5).
   * The floor keeps every chosen nation a viable chain (the oracle needs
   * several medium routes); the cap starves the chaser's mega-chain (a 20+
   * card nation cluster lets the heuristic full-clear too often — P1d).
   */
  minPerNation: number;
  maxPerNation: number;
  /**
   * Cap on any single club tag's slice membership (0 = off). Chain DEPTH is
   * the chaser's whole strategy while the oracle's clearability rides the
   * NUMBER of viable mid-size routes — flattening the top club chains trades
   * chaser full-clears (P1d) for nothing on P0.
   */
  maxPerClub: number;
  /** Fame-mix guard: at least this many icons per slice... */
  minIcons: number;
  /** ...where an icon is one of the top-K full-set cards by rating. */
  iconPoolSize: number;
  /** Minimum fraction of slice cards carrying at least one anchor tag. */
  minAnchorCoverage: number;
  /**
   * Rating floor for slice membership (0 = off). Dead boards under c13-1 are
   * low-face + low-overlap draws; trimming the full set's weakest ratings
   * lifts the floor of every draft line without touching thresholds.
   */
  minCardRating: number;
  /** Bounded deterministic nation-combo redraws before failing closed. */
  maxNationDraws: number;
  /**
   * Feasible combos to score before committing (>=1). The first feasible
   * combo is often mediocre — per-slice P0 spreads ~3pp with it — so the
   * generator builds up to this many feasible slices and keeps the one with
   * the most same-tag triples (the raw material of a synergy-cleared line).
   * Deterministic: candidates come from the same seeded combo stream.
   */
  comboCandidates: number;
}

/** The pinned Daily Deck profile (Ticket E4). Tuned via acceptance only —
 * c13-1 itself is untouchable. */
export const DAILY_SLICE_CONFIG_V1: SliceConfig = {
  sliceSize: 46,
  anchorClubCount: 8,
  minClubCardsForAnchor: 6,
  minAnchorInPool: 5,
  nationCount: 6,
  minNationCards: 8,
  positionWeights: { GK: 1, DEF: 3, MID: 3, ATT: 3 },
  minPerEra: 10,
  minPerNation: 5,
  maxPerNation: 16,
  maxPerClub: 14,
  minIcons: 12,
  iconPoolSize: 50,
  minAnchorCoverage: 0.75,
  minCardRating: 72,
  maxNationDraws: 400,
  comboCandidates: 64,
};

/**
 * Density score used to choose among feasible slices: same-tag triple count
 * across all three synergy families. A triple is the minimum fieldable chain
 * that turns a synergy multiplier on, so triple count is the raw material of
 * a clearing line; slices with more of them strand fewer boards.
 */
export function sliceTripleScore(slice: Card[]): number {
  const tally = (get: (c: Card) => string[]) => {
    const m = new Map<string, number>();
    for (const c of slice) for (const t of get(c)) m.set(t, (m.get(t) ?? 0) + 1);
    let s = 0;
    for (const n of m.values()) if (n >= 3) s += (n * (n - 1) * (n - 2)) / 6;
    return s;
  };
  return tally((c) => c.clubs) + tally((c) => [c.nation]) + tally((c) => [c.era]);
}

const ERA_COUNT = 4;

function positionQuotas(cfg: SliceConfig): Record<PositionId, number> {
  const total = POSITIONS.reduce((s, p) => s + cfg.positionWeights[p], 0);
  const quota = {} as Record<PositionId, number>;
  let assigned = 0;
  POSITIONS.forEach((p, i) => {
    quota[p] =
      i === POSITIONS.length - 1
        ? cfg.sliceSize - assigned
        : Math.round((cfg.sliceSize * cfg.positionWeights[p]) / total);
    assigned += quota[p];
  });
  return quota;
}

/** Top-K of the full set by rating (ties by id) — the icon pool. */
function iconIds(fullSet: Card[], k: number): Set<string> {
  return new Set(
    fullSet
      .slice()
      .sort((a, b) => b.rating - a.rating || (a.id < b.id ? -1 : 1))
      .slice(0, k)
      .map((c) => c.id),
  );
}

interface AttemptFailure {
  reason: string;
}

/**
 * One nation-combo attempt: returns the slice or a failure reason (the
 * caller retries with the next seeded combo — bounded, deterministic).
 */
function attemptSlice(
  cfg: SliceConfig,
  pool: Card[],
  anchorEligibleFullSet: Set<string>,
  icons: Set<string>,
  rng: () => number,
): Card[] | AttemptFailure {
  // Anchors: tags eligible on the FULL set and dense enough inside the pool.
  const inPool = new Map<string, number>();
  for (const c of pool) for (const t of c.clubs) inPool.set(t, (inPool.get(t) ?? 0) + 1);
  const anchorCandidates = [...inPool.entries()]
    .filter(([t, n]) => anchorEligibleFullSet.has(t) && n >= cfg.minAnchorInPool)
    .map(([t]) => t)
    .sort();
  if (anchorCandidates.length < cfg.anchorClubCount)
    return { reason: `only ${anchorCandidates.length} anchor-eligible tags in pool` };
  // Co-occurring anchor set: seed one anchor at random, then grow by the tag
  // sharing the most cards with the anchors already chosen (ties broken by
  // the seeded shuffle order). Multi-anchor "bridge" cards are what let the
  // oracle route between chains — a random anchor set scatters them.
  const shuffledAnchors = rngShuffle(rng, anchorCandidates.slice());
  const anchors = new Set<string>([shuffledAnchors[0]]);
  while (anchors.size < cfg.anchorClubCount) {
    let bestTag: string | null = null;
    let bestCo = -1;
    for (const t of shuffledAnchors) {
      if (anchors.has(t)) continue;
      let co = 0;
      for (const c of pool) {
        if (!c.clubs.includes(t)) continue;
        if (c.clubs.some((x) => x !== t && anchors.has(x))) co++;
      }
      if (co > bestCo) {
        bestCo = co;
        bestTag = t;
      }
    }
    if (!bestTag) break;
    anchors.add(bestTag);
  }

  const anchorScore = (c: Card) => c.clubs.reduce((s, t) => s + (anchors.has(t) ? 1 : 0), 0);

  // Era targets: ~uniform with availability repair, floored at minPerEra.
  const eraAvail = Array.from({ length: ERA_COUNT }, () => 0);
  for (const c of pool) eraAvail[c.eraIndex]++;
  const base = Math.floor(cfg.sliceSize / ERA_COUNT);
  const eraTarget = Array.from({ length: ERA_COUNT }, () => base);
  const extraOrder = rngShuffle(
    rng,
    Array.from({ length: ERA_COUNT }, (_, e) => e),
  );
  for (let i = 0; i < cfg.sliceSize - base * ERA_COUNT; i++) eraTarget[extraOrder[i]]++;
  // Repair: cap by availability, push deficit onto eras with the most spare.
  let deficit = 0;
  for (let e = 0; e < ERA_COUNT; e++) {
    if (eraAvail[e] < eraTarget[e]) {
      deficit += eraTarget[e] - eraAvail[e];
      eraTarget[e] = eraAvail[e];
    }
  }
  while (deficit > 0) {
    const order = Array.from({ length: ERA_COUNT }, (_, e) => e)
      .filter((e) => eraAvail[e] > eraTarget[e])
      .sort((a, b) => eraAvail[b] - eraTarget[b] - (eraAvail[a] - eraTarget[a]) || a - b);
    if (order.length === 0) return { reason: "era repair exhausted pool" };
    eraTarget[order[0]]++;
    deficit--;
  }
  for (let e = 0; e < ERA_COUNT; e++) {
    if (eraTarget[e] < cfg.minPerEra)
      return { reason: `era ${e} target ${eraTarget[e]} below floor ${cfg.minPerEra}` };
  }

  // Joint (position, era) fill: one unit at a time into the feasible cell
  // with the least remaining availability (most-constrained first). A wedge
  // fails the attempt — the caller redraws the nation combo.
  const posQuota = positionQuotas(cfg);
  const cellCards = new Map<string, Card[]>();
  const shuffled = rngShuffle(rng, pool.slice());
  // Anchor preference: stable sort by anchor coverage, seeded order within.
  shuffled.sort((a, b) => anchorScore(b) - anchorScore(a));
  for (const c of shuffled) {
    const k = `${c.position}|${c.eraIndex}`;
    const arr = cellCards.get(k);
    if (arr) arr.push(c);
    else cellCards.set(k, [c]);
  }
  const posNeed = { ...posQuota };
  const eraNeed = eraTarget.slice();
  const cellQuota = new Map<string, number>();
  for (let unit = 0; unit < cfg.sliceSize; unit++) {
    let bestKey: string | null = null;
    let bestSlack = Infinity;
    for (const p of POSITIONS) {
      if (posNeed[p] <= 0) continue;
      for (let e = 0; e < ERA_COUNT; e++) {
        if (eraNeed[e] <= 0) continue;
        const k = `${p}|${e}`;
        const slack = (cellCards.get(k)?.length ?? 0) - (cellQuota.get(k) ?? 0);
        if (slack > 0 && slack < bestSlack) {
          bestSlack = slack;
          bestKey = k;
        }
      }
    }
    if (!bestKey) return { reason: "joint position×era fill wedged" };
    cellQuota.set(bestKey, (cellQuota.get(bestKey) ?? 0) + 1);
    const p = bestKey.split("|")[0] as PositionId;
    posNeed[p]--;
    eraNeed[Number(bestKey.split("|")[1])]--;
  }

  // Card pick: one global loop, nation-aware. Priority per pick: a nation
  // still under its floor outranks everything, then anchor coverage, then the
  // seeded order. A card whose nation sits at the cap is skipped while any
  // alternative exists; a wedge fails the attempt (combo redraw).
  const slice: Card[] = [];
  const chosen = new Set<string>();
  const nationTally = new Map<string, number>();
  const clubTally = new Map<string, number>();
  const clubCapped = (c: Card) =>
    cfg.maxPerClub > 0 && c.clubs.some((t) => (clubTally.get(t) ?? 0) >= cfg.maxPerClub);
  const cellRemaining = new Map(cellQuota);
  for (let unit = 0; unit < cfg.sliceSize; unit++) {
    // Most-constrained cell first: the cell with the least slack between its
    // cap-eligible candidates and its remaining quota fills before the big
    // nations exhaust their caps elsewhere (a global best-priority order
    // wedges exactly there — era-0 cells are served almost entirely by the
    // largest nations).
    let bestKey: string | null = null;
    let bestSlack = Infinity;
    for (const [k, q] of cellRemaining) {
      if (q <= 0) continue;
      let eligible = 0;
      for (const c of cellCards.get(k) ?? []) {
        if (chosen.has(c.id)) continue;
        if ((nationTally.get(c.nation) ?? 0) >= cfg.maxPerNation) continue;
        if (clubCapped(c)) continue;
        eligible++;
      }
      if (eligible < q) return { reason: "nation-aware fill wedged (caps exhausted a cell)" };
      const slack = eligible - q;
      if (slack < bestSlack) {
        bestSlack = slack;
        bestKey = k;
      }
    }
    if (!bestKey) return { reason: "nation-aware fill wedged (no cell fillable)" };
    let best: Card | null = null;
    let bestPriority = -Infinity;
    const iconsPicked = slice.reduce((s, c) => s + (icons.has(c.id) ? 1 : 0), 0);
    for (const c of cellCards.get(bestKey) ?? []) {
      if (chosen.has(c.id)) continue;
      const tally = nationTally.get(c.nation) ?? 0;
      if (tally >= cfg.maxPerNation) continue;
      if (clubCapped(c)) continue;
      const underFloor = tally < cfg.minPerNation ? 1 : 0;
      // Icon-aware: while the fame-mix quota is unmet, an icon outranks
      // anchor coverage (a post-hoc swap keeps failing under nation caps —
      // icons cluster in the biggest nations, so they must be taken as the
      // caps still allow).
      const iconBoost = iconsPicked < cfg.minIcons && icons.has(c.id) ? 50 : 0;
      // cellCards is anchor-desc within seeded order; earlier cards win ties.
      const priority = underFloor * 100 + iconBoost + anchorScore(c) * 10;
      if (priority > bestPriority) {
        bestPriority = priority;
        best = c;
      }
    }
    if (!best) return { reason: "nation-aware fill wedged (cell empty under caps)" };
    slice.push(best);
    chosen.add(best.id);
    nationTally.set(best.nation, (nationTally.get(best.nation) ?? 0) + 1);
    for (const t of best.clubs) clubTally.set(t, (clubTally.get(t) ?? 0) + 1);
    cellRemaining.set(bestKey, (cellRemaining.get(bestKey) ?? 0) - 1);
  }
  for (const [n, t] of nationTally)
    if (t < cfg.minPerNation)
      return { reason: `nation ${n} at ${t} below floor ${cfg.minPerNation}` };
  if (nationTally.size < cfg.nationCount)
    return { reason: `only ${nationTally.size}/${cfg.nationCount} nations represented` };

  // Fame-mix guard: swap icons in WITHIN a (position, era) cell so quotas
  // survive, evicting the lowest-anchor-coverage non-icon. Nation-safe: the
  // swap may not push the incoming nation over the cap nor drop the victim's
  // nation under the floor.
  let iconCount = slice.filter((c) => icons.has(c.id)).length;
  while (iconCount < cfg.minIcons) {
    let done = false;
    for (const [k] of cellQuota) {
      const incomings = (cellCards.get(k) ?? []).filter(
        (c) => icons.has(c.id) && !chosen.has(c.id) && !clubCapped(c),
      );
      for (const incoming of incomings) {
        const inTally = nationTally.get(incoming.nation) ?? 0;
        const victims = slice
          .filter(
            (c) =>
              `${c.position}|${c.eraIndex}` === k &&
              !icons.has(c.id) &&
              (c.nation === incoming.nation ||
                ((nationTally.get(c.nation) ?? 0) > cfg.minPerNation && inTally < cfg.maxPerNation)),
          )
          .sort((a, b) => anchorScore(a) - anchorScore(b) || (a.id < b.id ? -1 : 1));
        if (victims.length === 0) continue;
        const victim = victims[0];
        slice.splice(slice.findIndex((c) => c.id === victim.id), 1, incoming);
        chosen.delete(victim.id);
        chosen.add(incoming.id);
        nationTally.set(victim.nation, (nationTally.get(victim.nation) ?? 0) - 1);
        nationTally.set(incoming.nation, (nationTally.get(incoming.nation) ?? 0) + 1);
        for (const t of victim.clubs) clubTally.set(t, (clubTally.get(t) ?? 0) - 1);
        for (const t of incoming.clubs) clubTally.set(t, (clubTally.get(t) ?? 0) + 1);
        iconCount++;
        done = true;
        break;
      }
      if (done) break;
    }
    if (!done) return { reason: `fame-mix guard unsatisfiable (${iconCount}/${cfg.minIcons} icons)` };
  }

  const covered = slice.filter((c) => anchorScore(c) > 0).length;
  if (covered / slice.length < cfg.minAnchorCoverage)
    return {
      reason: `anchor coverage ${covered}/${slice.length} below ${cfg.minAnchorCoverage}`,
    };

  // Board derivation samples by array position — return in stable id order,
  // the same order the serving layer's loadCardSet uses.
  return slice.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Deterministic Daily Deck slice: same (dateSeed, fullSet, cfg, scoreSlice) ⇒
 * identical slice. Throws (fail-closed) when no feasible slice exists within
 * cfg.maxNationDraws seeded nation combos.
 *
 * `scoreSlice` ranks the feasible candidate slices (higher wins); it defaults
 * to sliceTripleScore. Callers that can afford it inject an oracle-backed
 * scorer (probe boards on FIXED internal seeds → dead-rate screening); the
 * callback must itself be pure and deterministic, which keeps this function's
 * purity contract intact. Serving and acceptance MUST inject the same scorer,
 * or they will disagree on the day's slice.
 */
export function sliceDeck(
  dateSeed: string,
  fullSet: Card[],
  cfg: SliceConfig,
  scoreSlice: (slice: Card[]) => number = sliceTripleScore,
  /**
   * Optional early-exit bar: a candidate scoring at least this is accepted
   * immediately (no further combos probed). Lets an expensive scorer stop as
   * soon as a good-enough slice appears while best-of-comboCandidates remains
   * the bound. Determinism unaffected — the stream order is fixed.
   */
  scoreTarget?: number,
): Card[] {
  if (fullSet.length < cfg.sliceSize)
    throw new Error(`sliceDeck: full set has ${fullSet.length} cards < sliceSize ${cfg.sliceSize}`);
  const rng = rngFromString(`sliceDeck|${dateSeed}`);

  // Rating floor (minCardRating): trims the working set BEFORE any tallies so
  // eligibility (nations, anchors) reflects what a slice can actually hold.
  const workSet =
    cfg.minCardRating > 0 ? fullSet.filter((c) => c.rating >= cfg.minCardRating) : fullSet;
  if (workSet.length < cfg.sliceSize)
    throw new Error(
      `sliceDeck: rating floor ${cfg.minCardRating} leaves ${workSet.length} cards < sliceSize ${cfg.sliceSize}`,
    );

  const nationCount = new Map<string, number>();
  for (const c of workSet) nationCount.set(c.nation, (nationCount.get(c.nation) ?? 0) + 1);
  const eligibleNations = [...nationCount.entries()]
    .filter(([, n]) => n >= cfg.minNationCards)
    .map(([n]) => n)
    .sort();
  if (eligibleNations.length < cfg.nationCount)
    throw new Error(
      `sliceDeck: only ${eligibleNations.length} nations with >=${cfg.minNationCards} cards (need ${cfg.nationCount})`,
    );

  const clubCount = new Map<string, number>();
  for (const c of workSet) for (const t of c.clubs) clubCount.set(t, (clubCount.get(t) ?? 0) + 1);
  const anchorEligible = new Set(
    [...clubCount.entries()].filter(([, n]) => n >= cfg.minClubCardsForAnchor).map(([t]) => t),
  );
  const icons = iconIds(workSet, cfg.iconPoolSize);

  const failures: string[] = [];
  let best: Card[] | null = null;
  // -Infinity, not -1: an injected scorer may legitimately return a negative
  // score (the acceptance scorer penalises chaser full-clear excess below
  // zero), and a -1 floor would silently discard every such feasible slice.
  let bestScore = -Infinity;
  let feasible = 0;
  for (let attempt = 0; attempt < cfg.maxNationDraws; attempt++) {
    const nations = new Set(
      rngShuffle(rng, eligibleNations.slice()).slice(0, cfg.nationCount),
    );
    const pool = workSet.filter((c) => nations.has(c.nation));
    const result = attemptSlice(cfg, pool, anchorEligible, icons, rng);
    if (Array.isArray(result)) {
      feasible++;
      const score = scoreSlice(result);
      if (score > bestScore) {
        bestScore = score;
        best = result;
      }
      if (scoreTarget !== undefined && score >= scoreTarget) return result;
      if (feasible >= Math.max(1, cfg.comboCandidates)) return best as Card[];
      continue;
    }
    failures.push(`[${[...nations].sort().join(",")}] ${result.reason}`);
  }
  // Fewer candidates than asked but at least one feasible slice: the stream
  // ran dry, not the profile — serve the best found.
  if (best) return best;
  throw new Error(
    `sliceDeck: no feasible slice for dateSeed "${dateSeed}" within ${cfg.maxNationDraws} nation draws:\n` +
      failures.slice(0, 8).join("\n"),
  );
}
