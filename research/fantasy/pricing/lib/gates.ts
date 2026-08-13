/**
 * MISSION FW-REPRICE — the R2 and R3 gates.
 *
 * They live here, apart from the script that generates prices, because the
 * mission requires them "asserted in the seed pipeline, run on both
 * deployments". A gate that only ever runs against the file it was computed
 * from proves the file self-consistent; running the same function against the
 * prices RE-EXPORTED from a deployment proves the deployment right.
 *
 * ── R2, within-club sanity (owner ruling 2026-08-12) ──
 *
 * "For every club and position, the player with the most last-season minutes
 * must price >= every teammate at that position, unless his per-90 proxy
 * trails by a documented margin."
 *
 * The leader is chosen by 2025-26 minutes in his own pricing league set —
 * literally "last-season minutes" — not by the season the price was computed
 * from, so a player rescued by the prior-season rule never becomes leader on
 * the strength of a season the ruling did not name.
 *
 * Three things are documented here rather than assumed, because the first
 * FW-REPRICE run surfaced all three and each is a real boundary of the rule.
 *
 * 1. THE COMPARISON IS WITHIN A POOL. Cohort separation is LOCKED: "no
 *    cross-league comparison". A promoted club's 2026-27 squad holds both
 *    promoted-cohort players (priced in a 4.0-6.5 band off second-division
 *    minutes) and players who spent 2025-26 in the top five (priced in a
 *    4.0-13.0 band off top-five minutes). Their prices are not denominated in
 *    comparable units, so ordering one against the other is exactly the
 *    cross-league comparison the lock forbids — MEASURED: 5 of the 12 first-run
 *    inversions were this and nothing else (Schalke, Ipswich, Deportivo,
 *    Venezia, Monza, every one a promoted club). Cross-pool pairs are counted
 *    and reported, never silently dropped, but they cannot be asserted.
 *
 * 2. THE RULING'S SUBJECT IS A CLEAR STARTER. The mission's goal is that "a
 *    club's clear starter outprices his backups". Where the most-played player
 *    at a club and position played under the method's own 900' thinness bar,
 *    that club has no clear starter at that position and there is no
 *    starter-versus-backup ordering to assert — asserting one would be
 *    asserting noise. Those groups are counted and reported as
 *    `noClearStarter`. This cannot excuse the case the mission names: Diogo
 *    Costa played 2,907'.
 *
 * 3. THE MARGIN IS 5%. The leader is exempt against a teammate whose per-90
 *    proxy beats his by more than a twentieth. 5% is where the proxy stops
 *    being able to tell two players apart: PROXY_METHOD.md declares the
 *    method's own approximation error — ramps evaluated at season-average
 *    rates (Jensen), the linearized concession penalty, omitted own goals —
 *    and a gap inside that error is noise, so an inversion inside it is a
 *    violation. Above it the teammate is genuinely better per minute and the
 *    ruling's own escape hatch applies. MEASURED: the surviving same-pool
 *    inversions sit at +8.3% to +10.5% per-90 (van Hecke over Senesi, Antony
 *    over Hernández, Thomasson over Rongier) — all real, none noise.
 *
 * ── R3, distribution sanity ──
 *
 * "Per position per pool, no more than the genuine elite at the ceiling — if
 * more than ~3 players per position share a cohort ceiling, the rank mapping
 * is too compressed."
 *
 * The gate counts players at the top price of each pool+position. The bound is
 * 5 rather than 3, and the reason is arithmetic rather than laxity: prices
 * round to the half point, so every player within a quarter-point of the top
 * shares it. In a narrow cohort band (promoted 4.0-6.5) a quarter point is 10%
 * of the whole band, so four players legitimately land there without any
 * compression at all. Five is comfortably below the failure this gate exists
 * to catch — the pre-mission Liga Portugal keepers, where 15 of 30 shared 6.0.
 * Every count is reported, not just the failures, so a drift toward the bound
 * is visible before it trips.
 *
 * ── Overrides ──
 *
 * overrides.json applies LAST and always wins (locked contract, PROXY_METHOD.md
 * "Owner price overrides"). A gate that failed the seed because an owner
 * override inverted a club's keepers would be a gate asserting the owner may
 * not overrule the formula. So a violation involving an overridden row is
 * REPORTED and does not stop the pipeline; everything else is a STOP. This is
 * the same split price-final.ts already draws for ceilings and monotonicity.
 */

export interface GateRow {
  readonly apiFootballId: number;
  readonly name: string;
  readonly clubId: number;
  readonly clubName: string;
  readonly position: string;
  readonly pool: string;
  readonly price: number;
  /** 2025-26 minutes in his own pricing league set — decides the R2 leader. */
  readonly lastSeasonMinutes: number;
  /** per-90 proxy actually used for his price; null for flagged players. */
  readonly per90: number | null;
  readonly overridden?: boolean;
}

/** The leader is exempt against a teammate whose per-90 beats his by more than this. */
export const R2_TRAIL_MARGIN = 0.05;
/**
 * Below this many 2025-26 minutes the most-played player at a club+position is
 * not a "clear starter" and R2 has no ordering to assert. Same constant the
 * season-selection rule uses for a thin season — not a second bar.
 */
export const R2_CLEAR_STARTER_MINUTES = 900;
/** See the header: 5, for the half-point rounding width of a narrow band. */
export const R3_MAX_AT_CEILING = 5;

export interface R2Violation {
  readonly clubName: string;
  readonly clubId: number;
  readonly position: string;
  readonly leader: string;
  readonly leaderMinutes: number;
  readonly leaderPrice: number;
  readonly leaderPer90: number | null;
  readonly other: string;
  readonly otherMinutes: number;
  readonly otherPrice: number;
  readonly otherPer90: number | null;
  /** true when an owner override is what produced the inversion */
  readonly involvesOverride: boolean;
}

export interface R2Result {
  readonly clubs: number;
  /** club+position+pool groups of two or more — the groups actually asserted */
  readonly assertedGroups: number;
  /** groups skipped because nobody reached 900' (see header note 2) */
  readonly noClearStarterGroups: number;
  readonly comparisons: number;
  /** groups where the leader strictly outprices every teammate */
  readonly strictlyLeading: number;
  /** groups where the leader only ties his best teammate */
  readonly tied: number;
  readonly exemptedByMargin: number;
  /** same club+position, different pool — incomparable by the locked cohort rule */
  readonly crossPoolPairs: number;
  readonly violations: readonly R2Violation[];
  /** violations an owner override caused — reported, never a STOP */
  readonly overrideViolations: readonly R2Violation[];
}

export function checkR2(rows: readonly GateRow[]): R2Result {
  // Grouped by club + position + POOL: cohort separation is locked, so two
  // prices from different pools are not comparable quantities (header note 1).
  const groups = new Map<string, GateRow[]>();
  for (const r of rows) {
    const key = `${r.clubId}|${r.position}|${r.pool}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  // Cross-pool pairs at the same club+position, counted for visibility only.
  const byClubPosition = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = `${r.clubId}|${r.position}`;
    const pools = byClubPosition.get(key) ?? new Set<string>();
    pools.add(r.pool);
    byClubPosition.set(key, pools);
  }
  let crossPoolPairs = 0;
  for (const pools of byClubPosition.values()) if (pools.size > 1) crossPoolPairs += 1;

  const violations: R2Violation[] = [];
  const overrideViolations: R2Violation[] = [];
  let comparisons = 0;
  let exemptedByMargin = 0;
  let strictlyLeading = 0;
  let tied = 0;
  let assertedGroups = 0;
  let noClearStarterGroups = 0;

  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // Most last-season minutes. Ties break on price then name so the choice is
    // deterministic across runs and machines.
    const leader = [...list].sort(
      (a, b) =>
        b.lastSeasonMinutes - a.lastSeasonMinutes ||
        b.price - a.price ||
        a.name.localeCompare(b.name),
    )[0];

    if (leader.lastSeasonMinutes < R2_CLEAR_STARTER_MINUTES) {
      noClearStarterGroups += 1;
      continue;
    }
    assertedGroups += 1;

    let strict = true;
    for (const other of list) {
      if (other === leader) continue;
      comparisons += 1;
      if (leader.price >= other.price) {
        if (leader.price === other.price) strict = false;
        continue;
      }
      strict = false;
      // leader is priced BELOW a teammate — is he exempt?
      const lp = leader.per90;
      const op = other.per90;
      const exempt = lp !== null && op !== null && op > lp * (1 + R2_TRAIL_MARGIN);
      if (exempt) {
        exemptedByMargin += 1;
        continue;
      }
      const v: R2Violation = {
        clubName: leader.clubName,
        clubId: leader.clubId,
        position: leader.position,
        leader: leader.name,
        leaderMinutes: leader.lastSeasonMinutes,
        leaderPrice: leader.price,
        leaderPer90: lp,
        other: other.name,
        otherMinutes: other.lastSeasonMinutes,
        otherPrice: other.price,
        otherPer90: op,
        involvesOverride: leader.overridden === true || other.overridden === true,
      };
      if (v.involvesOverride) overrideViolations.push(v);
      else violations.push(v);
    }
    if (strict) strictlyLeading += 1;
    else tied += 1;
  }

  return {
    clubs: new Set(rows.map((r) => r.clubId)).size,
    assertedGroups,
    noClearStarterGroups,
    comparisons,
    strictlyLeading,
    tied,
    exemptedByMargin,
    crossPoolPairs,
    violations,
    overrideViolations,
  };
}

export interface R3Count {
  readonly pool: string;
  readonly position: string;
  readonly ceiling: number;
  readonly atCeiling: number;
  readonly total: number;
}

export interface R3Result {
  readonly counts: readonly R3Count[];
  readonly breaches: readonly R3Count[];
}

/**
 * `ceilingOf` gives the top price the pool+position may reach, so the gate
 * counts players at the BAND top rather than at whatever the maximum priced
 * player happens to be — a cohort nobody reaches the top of is not a breach.
 * Flagged players sit at the floor by definition and are excluded.
 */
export function checkR3(
  rows: readonly GateRow[],
  ceilingOf: (pool: string, position: string) => number | null,
): R3Result {
  const groups = new Map<string, GateRow[]>();
  for (const r of rows) {
    const key = `${r.pool}|${r.position}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const counts: R3Count[] = [];
  for (const [key, list] of groups) {
    const [pool, position] = key.split('|');
    const ceiling = ceilingOf(pool, position);
    if (ceiling === null) continue; // flagged pool: no band
    counts.push({
      pool,
      position,
      ceiling,
      // Overridden rows are the owner's, not the mapping's — an override at
      // the ceiling is not evidence the rank mapping is compressed.
      atCeiling: list.filter((r) => r.price >= ceiling && r.overridden !== true).length,
      total: list.length,
    });
  }
  counts.sort((a, b) => a.pool.localeCompare(b.pool) || a.position.localeCompare(b.position));
  return { counts, breaches: counts.filter((c) => c.atCeiling > R3_MAX_AT_CEILING) };
}

/** Render both gates for a console run. Returns true when nothing STOPs. */
export function reportGates(label: string, r2: R2Result, r3: R3Result, log = console.log): boolean {
  log(`\n── gates (${label}) ──`);
  log(
    `R2 within-club: ${r2.assertedGroups} club+position+pool groups asserted across ${r2.clubs} clubs, ` +
      `${r2.comparisons} leader-vs-teammate comparisons; ` +
      `${r2.strictlyLeading} strictly led, ${r2.tied} tied at the top, ` +
      `${r2.exemptedByMargin} exempt on the ${(R2_TRAIL_MARGIN * 100).toFixed(0)}% per-90 margin; ` +
      `${r2.noClearStarterGroups} groups had no clear starter (nobody reached ${R2_CLEAR_STARTER_MINUTES}'), ` +
      `${r2.crossPoolPairs} club+position sets span pools (incomparable, locked cohort rule)`,
  );
  for (const v of r2.violations.slice(0, 20)) {
    log(
      `  VIOLATION ${v.clubName} ${v.position}: ${v.leader} (${v.leaderMinutes}' , ${v.leaderPrice}) < ` +
        `${v.other} (${v.otherMinutes}', ${v.otherPrice})`,
    );
  }
  for (const v of r2.overrideViolations) {
    log(
      `  override-caused (reported, not a STOP) ${v.clubName} ${v.position}: ${v.leader} ${v.leaderPrice} < ${v.other} ${v.otherPrice}`,
    );
  }
  log(`R3 ceiling scarcity (bound ${R3_MAX_AT_CEILING} per pool+position):`);
  for (const c of r3.counts) {
    log(`  ${c.pool}|${c.position}: ${c.atCeiling} at ${c.ceiling.toFixed(1)} of ${c.total}`);
  }
  const ok = r2.violations.length === 0 && r3.breaches.length === 0;
  if (!ok) {
    log(`GATES FAILED: ${r2.violations.length} R2 violation(s), ${r3.breaches.length} R3 breach(es)`);
  } else {
    log('gates passed: R2 clean, R3 within bound');
  }
  return ok;
}
