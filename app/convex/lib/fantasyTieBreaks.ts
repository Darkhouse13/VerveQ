/**
 * Weekend Fantasy — tie-break ladders (FW-LAUNCH O4). PURE.
 *
 * DRAFT_ROOM_SPEC v1.2.1 ledger item 5, LOCKED:
 *   weekend tie  → higher single-player score → fewer auto-picks → shared
 *   crew table tie (equal cumulative points) → head-to-head weekend wins
 *                → still level = shared, displayed as tied
 *
 * The weekend ladder is the comparator; the table ladder consumes it: two
 * members tied on cumulative points compare their head-to-head record —
 * the count of weekends each won directly against the other, each weekend
 * decided by points first and then the weekend ladder's rungs.
 *
 * A weekend with missing data decides nothing: if either side's points are
 * null the comparison abstains, and a rung whose input is unavailable falls
 * through rather than guessing (no invented facts).
 */

/** One member's comparable result for one weekend (one room). */
export interface WeekendComparable {
  /** The weekend total; null when nothing is scored — never 0. */
  readonly points: number | null;
  /** Highest single-slot score in the squad that weekend. */
  readonly topPlayerScore: number | null;
  /** This member's auto-picks in that room's draft (from the draft log). */
  readonly autoPicks: number | null;
}

/**
 * The weekend ladder: > 0 when `a` wins the weekend, < 0 when `b` does,
 * 0 when it is shared (or undecidable). Each rung decides alone; a rung
 * with a null on either side falls through.
 */
export function compareWeekendResult(a: WeekendComparable, b: WeekendComparable): number {
  if (a.points === null || b.points === null) return 0;
  if (a.points !== b.points) return a.points - b.points;

  if (a.topPlayerScore !== null && b.topPlayerScore !== null && a.topPlayerScore !== b.topPlayerScore) {
    return a.topPlayerScore - b.topPlayerScore;
  }

  if (a.autoPicks !== null && b.autoPicks !== null && a.autoPicks !== b.autoPicks) {
    // FEWER auto-picks wins: the human sheet beats the bot's.
    return b.autoPicks - a.autoPicks;
  }

  return 0; // shared
}

export interface TiedGroupMember<K> {
  readonly key: K;
  /** roomId → this member's comparable, for every weekend they were seated. */
  readonly weekends: ReadonlyMap<string, WeekendComparable>;
}

export interface TiedGroupResult<K> {
  readonly key: K;
  /** Head-to-head weekend wins against the other tied members. */
  readonly h2hWins: number;
  /** 0-based position within the group after the ladder. */
  readonly subRank: number;
  /** True when the ladder is exhausted and the member still shares subRank. */
  readonly stillTied: boolean;
}

/**
 * Order one cumulative-points-tied group by head-to-head weekend wins.
 *
 * H2H is pairwise over the weekends BOTH members contested: each such
 * weekend awards one win via the weekend ladder (or none, when shared).
 * A member's score is their total wins against the rest of the group —
 * the natural multi-way extension of the two-member rule. Equal totals
 * remain tied: the ladder ends there, by ruling.
 */
export function orderTiedGroup<K>(members: readonly TiedGroupMember<K>[]): TiedGroupResult<K>[] {
  const wins = new Map<number, number>(members.map((_, i) => [i, 0]));

  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      for (const [roomId, mine] of members[i].weekends) {
        const theirs = members[j].weekends.get(roomId);
        if (theirs === undefined) continue;
        const cmp = compareWeekendResult(mine, theirs);
        if (cmp > 0) wins.set(i, (wins.get(i) ?? 0) + 1);
        else if (cmp < 0) wins.set(j, (wins.get(j) ?? 0) + 1);
      }
    }
  }

  const ordered = members
    .map((member, index) => ({ member, index, h2hWins: wins.get(index) ?? 0 }))
    .sort((a, b) => b.h2hWins - a.h2hWins || a.index - b.index);

  return ordered.map((entry, position) => {
    // Competition-style sub-rank: equal win totals share the position of
    // their first member.
    let subRank = position;
    while (subRank > 0 && ordered[subRank - 1].h2hWins === entry.h2hWins) subRank -= 1;
    const stillTied = ordered.some(
      (other) => other.member !== entry.member && other.h2hWins === entry.h2hWins,
    );
    return { key: entry.member.key, h2hWins: entry.h2hWins, subRank, stillTied };
  });
}
