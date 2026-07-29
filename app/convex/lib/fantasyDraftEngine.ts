/**
 * Weekend Fantasy — the draft engine, as pure functions (FW-3).
 *
 * DRAFT_ROOM_SPEC v1.1.0 plus the seven FW-3 owner rulings (2026-07-29).
 * Everything the draft-room mutations decide is defined exactly once here —
 * snake order, chess-clock math, auto-pick selection, the default team sheet,
 * log reconstruction — so the whole rule surface is unit-testable without a
 * database, and the mutations in fantasyDraftRooms.ts stay thin wrappers
 * (house posture, per lib/fantasySquadRules.ts).
 *
 * PURE: no Convex imports, no clock reads — every instant is a parameter.
 * Determinism is a spec requirement, not a style choice: the same seed and the
 * same pick inputs must reproduce the identical draft log (ticket gate), which
 * is why every ordering below ends in a total order and nothing ever consults
 * Math.random or Date.now.
 */

import {
  PER_CLUB_CAP,
  PRICE_MIN,
  SQUAD_SIZE,
  type SlotRole,
} from "./fantasyConstants";

// ── seeded RNG ──
//
// Same generator family as challengeArenas.ts (hashString / seededRandom /
// seededShuffle). Duplicated rather than imported on purpose: the Arena file
// keeps them private, and the FW-1-approved posture is that a mode's test
// surface must not couple to another mode's internals. The draft log records
// the seed (ruling R4), so this exact algorithm is part of the replay
// contract — changing it invalidates recorded drafts.

export function hashString(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rand = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── snake order ──

/** The round-1 pick order: seat indexes 0..n-1, shuffled by the room seed. */
export function snakeOrderFor(seatCount: number, seed: string): number[] {
  const seats = Array.from({ length: seatCount }, (_, i) => i);
  return seededShuffle(seats, seed);
}

/** Total picks in a draft: 13 rounds × every seat (spec: "Rounds | 13"). */
export function totalPicks(seatCount: number): number {
  return seatCount * SQUAD_SIZE;
}

/** 1-based round of a 0-based overall pick index. */
export function roundOfPick(pickIndex: number, seatCount: number): number {
  return Math.floor(pickIndex / seatCount) + 1;
}

/**
 * Whose turn is overall pick `pickIndex` (0-based)? Snake: odd rounds run the
 * order forward, even rounds run it backward (§Lifecycle 3: "1→N, N→1,
 * repeat").
 */
export function seatIndexForPick(
  snakeOrder: readonly number[],
  pickIndex: number,
): number {
  const n = snakeOrder.length;
  const round = Math.floor(pickIndex / n); // 0-based here
  const posInRound = pickIndex % n;
  return round % 2 === 0
    ? snakeOrder[posInRound]
    : snakeOrder[n - 1 - posInRound];
}

// ── chess clock ──

/**
 * Clock a turn has consumed, clamped into [0, bankMs]. The clamp is the whole
 * rule: elapsed can never be negative (a client clock is never consulted —
 * LM12 — but a scheduler CAN fire a hair early) and can never exceed the bank
 * (at the bank the pick is no longer the drafter's to make, ruling R2).
 */
export function elapsedOnTurn(
  turnStartedAt: number,
  now: number,
  bankMs: number,
): number {
  return Math.min(Math.max(0, now - turnStartedAt), bankMs);
}

/** Has this turn drained the whole bank? At exactly zero remaining, yes. */
export function bankExhausted(
  turnStartedAt: number,
  now: number,
  bankMs: number,
): boolean {
  return elapsedOnTurn(turnStartedAt, now, bankMs) >= bankMs;
}

// ── auto-pick (rulings R1, R2, R5) ──

export type DraftPool = "topfive" | "promoted" | "flagged";

/** A pool player reduced to what auto-pick and the board need. */
export interface DraftPoolPlayer {
  readonly _id: string;
  /** Stable provider id — the final deterministic tiebreak (see comparator). */
  readonly providerPlayerId: string;
  readonly clubId: string;
  readonly price: number | null;
  readonly active: boolean;
  readonly pool: DraftPool | null;
  readonly proxy: number | null;
  /** Does this player's club have a fixture in the target gameweek? (R5) */
  readonly hasFixture: boolean;
  /** Kickoff of that fixture, for the started-fixture (hindsight) check. */
  readonly kickoffAt: number | null;
}

const POOL_PRIORITY: Record<DraftPool, number> = {
  topfive: 0,
  promoted: 1,
  flagged: 2,
};

/**
 * The R1 total order: price desc → proxy desc → pool priority
 * (topfive > promoted > flagged) → providerPlayerId asc.
 *
 * The last rung is not in the ruling; it exists because R1's three rungs do
 * not totally order the pool (the whole flagged cohort is priced 4.0 with no
 * proxy) and auto-pick MUST be deterministic — "same seed + same pick inputs →
 * identical log" is a ticket gate. providerPlayerId is the only key that is
 * stable across environments (a Convex id is not), so it is the one that keeps
 * a DEV replay byte-identical to a test replay.
 *
 * A null price sorts as PRICE_MIN (the scale floor — every unproxied player's
 * price by construction); a null proxy sorts below every real proxy; a missing
 * pool row sorts below flagged (auto-pick prefers known quantities).
 */
export function autoPickComparator(
  a: DraftPoolPlayer,
  b: DraftPoolPlayer,
): number {
  const priceA = a.price ?? PRICE_MIN;
  const priceB = b.price ?? PRICE_MIN;
  if (priceA !== priceB) return priceB - priceA;

  const proxyA = a.proxy ?? Number.NEGATIVE_INFINITY;
  const proxyB = b.proxy ?? Number.NEGATIVE_INFINITY;
  if (proxyA !== proxyB) return proxyB - proxyA;

  const poolA = a.pool === null ? 3 : POOL_PRIORITY[a.pool];
  const poolB = b.pool === null ? 3 : POOL_PRIORITY[b.pool];
  if (poolA !== poolB) return poolA - poolB;

  return a.providerPlayerId < b.providerPlayerId
    ? -1
    : a.providerPlayerId > b.providerPlayerId
      ? 1
      : 0;
}

export interface AutoPickContext {
  /** Every player already picked in this room (crew-internal exclusivity). */
  readonly pickedPlayerIds: ReadonlySet<string>;
  /** The picking seat's current club counts. */
  readonly clubCounts: ReadonlyMap<string, number>;
  /** The picking seat's favorite at arm — that club is cap-exempt. */
  readonly favoriteClub: string | null;
  /** Server instant, for the started-fixture check. */
  readonly now: number;
}

/** Would adding one more player of `clubId` break this seat's club cap? */
export function clubCapBlocks(
  clubId: string,
  clubCounts: ReadonlyMap<string, number>,
  favoriteClub: string | null,
): boolean {
  if (favoriteClub !== null && clubId === favoriteClub) return false;
  return (clubCounts.get(clubId) ?? 0) >= PER_CLUB_CAP;
}

/**
 * Choose the auto-pick: best available under the R1 order, "constrained so
 * the remaining sheet stays completable".
 *
 * Eligibility relaxes down a documented ladder rather than failing:
 *   1. unpicked, active, cap-legal, has a fixture that has NOT kicked off —
 *      the normal case. R5 makes auto-pick skip no-fixture players; the
 *      unstarted requirement is the FW-1 hindsight rule (a player whose match
 *      is underway cannot be swapped IN) applied to picks.
 *   2. drop the fixture requirements — if every fixture-having, cap-legal
 *      player is somehow gone, a no-fixture player (who simply scores nothing
 *      this weekend, R5) is still a completable sheet.
 *   3. drop the cap too — unreachable with a real pool (≈96 clubs × cap 3
 *      dwarfs 13 picks), kept so the draft TERMINATES on any input rather
 *      than wedging a room; a rung-3 pick means the pool itself was broken.
 *
 * Within every rung the R1 comparator decides, so the choice is deterministic
 * whichever rung serves it.
 */
export function selectAutoPick(
  pool: readonly DraftPoolPlayer[],
  ctx: AutoPickContext,
): DraftPoolPlayer | null {
  const unpicked = pool.filter(
    (p) => p.active && !ctx.pickedPlayerIds.has(p._id),
  );

  const capOk = (p: DraftPoolPlayer) =>
    !clubCapBlocks(p.clubId, ctx.clubCounts, ctx.favoriteClub);
  const playable = (p: DraftPoolPlayer) =>
    p.hasFixture && p.kickoffAt !== null && p.kickoffAt > ctx.now;

  const rungs: Array<(p: DraftPoolPlayer) => boolean> = [
    (p) => capOk(p) && playable(p),
    (p) => capOk(p),
    () => true,
  ];

  for (const rung of rungs) {
    const candidates = unpicked.filter(rung);
    if (candidates.length > 0) {
      return candidates.sort(autoPickComparator)[0];
    }
  }
  return null; // pool exhausted outright — 13×8 picks can't do this to 2,895
}

// ── default team sheet (ruling R6) ──

export interface DraftedPlayerForSheet {
  readonly _id: string;
  readonly providerPlayerId: string;
  readonly price: number | null;
  readonly feedPosition: SlotRole;
}

export interface DefaultSheetSlot {
  readonly slotIndex: number;
  readonly playerId: string;
  readonly slotRole: SlotRole;
  readonly isFinisher: boolean;
}

/** Ascending price, providerPlayerId ascending as the deterministic tie. */
function byPriceAsc(a: DraftedPlayerForSheet, b: DraftedPlayerForSheet): number {
  const priceA = a.price ?? PRICE_MIN;
  const priceB = b.price ?? PRICE_MIN;
  if (priceA !== priceB) return priceA - priceB;
  return a.providerPlayerId < b.providerPlayerId
    ? -1
    : a.providerPlayerId > b.providerPlayerId
      ? 1
      : 0;
}

/**
 * The untouched-sheet default (R6): 4-4-2, auto-assigned by price.
 *
 * The full algorithm, since R6 asks for the fallback to be documented:
 *
 *  1. GK slot — the cheapest nominal GK among the 13, if any was drafted.
 *     FALLBACK (no GK drafted, legal under position-blind drafting): the
 *     cheapest player of the 13 overall. Rationale: the GK slot's output is
 *     dampened by the mismatch rule whoever stands in it, so the default
 *     wastes its least valuable player there and keeps the expensive picks in
 *     slots that pay full rate. Crude by design (spec §Default team sheet).
 *  2. Finishers — of the remaining 12, the two LOWEST-priced (R6: "finishers
 *     = 2 lowest-priced remaining").
 *  3. The outfield XI — the remaining 10 fill DEF×4, MID×4, ATT×2. Nominal
 *     positions are honored first (players whose feedPosition matches a role
 *     take its slots, most expensive first); players left over after the
 *     match pass fill whatever slots remain, again most expensive first, DEF
 *     before MID before ATT. A drafted squad of 13 attackers therefore still
 *     produces a legal 4-4-2 — position risk is priced by the mismatch rule,
 *     never blocked at build (all-positions-eligible, LOCKED).
 *
 * Slot layout matches fantasySquads.createSquad: XI slots 0..10 in
 * GK→DEF→MID→ATT formation order, finishers at 11 and 12. Every tie anywhere
 * breaks by providerPlayerId ascending, so the default sheet is a pure
 * function of the drafted 13 — same players in, same sheet out, everywhere.
 */
export function defaultSheetAssignment(
  drafted: readonly DraftedPlayerForSheet[],
): DefaultSheetSlot[] {
  if (drafted.length !== SQUAD_SIZE) {
    throw new Error(
      `Default sheet needs exactly ${SQUAD_SIZE} players; got ${drafted.length}.`,
    );
  }

  const remaining = [...drafted].sort(byPriceAsc);

  // 1. GK slot: cheapest nominal GK, else cheapest overall (documented above).
  const gkIndex = remaining.findIndex((p) => p.feedPosition === "GK");
  const keeper = remaining.splice(gkIndex === -1 ? 0 : gkIndex, 1)[0];

  // 2. Finishers: two lowest-priced of the remaining twelve.
  const finishers = remaining.splice(0, 2);

  // 3. Outfield: DEF×4, MID×4, ATT×2, nominal match first, price desc within.
  const quotas: Array<{ role: SlotRole; count: number }> = [
    { role: "DEF", count: 4 },
    { role: "MID", count: 4 },
    { role: "ATT", count: 2 },
  ];
  const outfield = remaining.reverse(); // now price DESC, ties still stable
  const assigned = new Map<SlotRole, DraftedPlayerForSheet[]>();
  const unmatched: DraftedPlayerForSheet[] = [];

  for (const { role, count } of quotas) assigned.set(role, []);
  for (const player of outfield) {
    const quota = quotas.find((q) => q.role === player.feedPosition);
    const bucket = quota === undefined ? null : assigned.get(quota.role)!;
    if (bucket !== null && bucket.length < quota!.count) bucket.push(player);
    else unmatched.push(player);
  }
  for (const { role, count } of quotas) {
    const bucket = assigned.get(role)!;
    while (bucket.length < count) bucket.push(unmatched.shift()!);
  }

  const slots: DefaultSheetSlot[] = [];
  let slotIndex = 0;
  slots.push({
    slotIndex: slotIndex++,
    playerId: keeper._id,
    slotRole: "GK",
    isFinisher: false,
  });
  for (const { role } of quotas) {
    for (const player of assigned.get(role)!) {
      slots.push({
        slotIndex: slotIndex++,
        playerId: player._id,
        slotRole: role,
        isFinisher: false,
      });
    }
  }
  for (const player of finishers) {
    // A finisher keeps its nominal feed position as slotRole — finisher roles
    // are unconstrained by the XI's shape (FW-1 STOP-3).
    slots.push({
      slotIndex: slotIndex++,
      playerId: player._id,
      slotRole: player.feedPosition,
      isFinisher: true,
    });
  }
  return slots;
}

// ── draft-log reconstruction (ticket gate) ──

/** A draft-log row reduced to plain data, in `seq` order. */
export interface DraftLogEntry {
  readonly seq: number;
  readonly entryType: "seed" | "pick";
  readonly seed?: string | undefined;
  readonly snakeOrder?: readonly number[] | undefined;
  readonly pickNumber?: number | undefined;
  readonly round?: number | undefined;
  readonly seatIndex?: number | undefined;
  readonly playerId?: string | undefined;
  readonly auto?: boolean | undefined;
  readonly elapsedMs?: number | undefined;
  readonly bankAfterMs?: number | undefined;
}

export interface DraftReconstruction {
  readonly ok: boolean;
  readonly problems: readonly string[];
  readonly seed: string | null;
  readonly snakeOrder: readonly number[];
  /** seatIndex → playerIds in the order that seat drafted them. */
  readonly picksBySeat: ReadonlyMap<number, readonly string[]>;
  /** seatIndex → bank remaining after its last pick. */
  readonly bankBySeat: ReadonlyMap<number, number>;
}

/**
 * Rebuild a draft from its log alone and verify every structural invariant:
 * the log must fully determine the draft (spec §Draft log — it is the
 * ShareCard raw material AND the argument ledger, so it cannot be lossy).
 *
 * Checks: dense seq from 0; entry 0 is the seed entry; the logged snakeOrder
 * is exactly what the logged seed regenerates (R4 — the seed is recorded so
 * the shuffle can be audited); picks numbered 1..N in seq order with the seat
 * the snake demands; no player picked twice (exclusivity); per-seat banks
 * start at the full bank, never go negative, and match each entry's
 * bankAfterMs.
 */
export function reconstructDraft(
  entries: readonly DraftLogEntry[],
  fullBankMs: number,
): DraftReconstruction {
  const problems: string[] = [];
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);

  sorted.forEach((entry, i) => {
    if (entry.seq !== i) problems.push(`seq gap: expected ${i}, got ${entry.seq}`);
  });

  const head = sorted[0];
  const seed = head?.entryType === "seed" ? (head.seed ?? null) : null;
  const snakeOrder =
    head?.entryType === "seed" ? (head.snakeOrder ?? []) : [];
  if (seed === null || snakeOrder.length === 0) {
    problems.push("log does not open with a seed entry");
  } else {
    const regenerated = snakeOrderFor(snakeOrder.length, seed);
    if (regenerated.join(",") !== snakeOrder.join(",")) {
      problems.push("logged snakeOrder is not what the logged seed generates");
    }
  }

  const picksBySeat = new Map<number, string[]>();
  const bankBySeat = new Map<number, number>();
  const seenPlayers = new Set<string>();
  let pickCount = 0;

  for (const entry of sorted.slice(1)) {
    if (entry.entryType !== "pick") {
      problems.push(`entry seq ${entry.seq} is not a pick`);
      continue;
    }
    pickCount += 1;
    if (entry.pickNumber !== pickCount) {
      problems.push(`pick numbering: expected ${pickCount}, got ${entry.pickNumber}`);
    }
    const expectedSeat =
      snakeOrder.length > 0
        ? seatIndexForPick(snakeOrder, pickCount - 1)
        : undefined;
    if (expectedSeat !== undefined && entry.seatIndex !== expectedSeat) {
      problems.push(
        `pick ${pickCount}: snake demands seat ${expectedSeat}, log has ${entry.seatIndex}`,
      );
    }
    if (entry.playerId === undefined) {
      problems.push(`pick ${pickCount} has no player`);
    } else if (seenPlayers.has(entry.playerId)) {
      problems.push(`pick ${pickCount}: player picked twice (exclusivity)`);
    } else {
      seenPlayers.add(entry.playerId);
    }

    const seat = entry.seatIndex ?? -1;
    const bankBefore = bankBySeat.get(seat) ?? fullBankMs;
    const bankAfter = bankBefore - (entry.elapsedMs ?? 0);
    if (bankAfter < 0) problems.push(`pick ${pickCount}: bank went negative`);
    if (entry.bankAfterMs !== undefined && entry.bankAfterMs !== bankAfter) {
      problems.push(
        `pick ${pickCount}: logged bankAfterMs ${entry.bankAfterMs} != derived ${bankAfter}`,
      );
    }
    bankBySeat.set(seat, bankAfter);
    if (entry.playerId !== undefined) {
      const list = picksBySeat.get(seat) ?? [];
      list.push(entry.playerId);
      picksBySeat.set(seat, list);
    }
  }

  if (snakeOrder.length > 0) {
    const expectedTotal = totalPicks(snakeOrder.length);
    if (pickCount > 0 && pickCount !== expectedTotal) {
      // A partial log is fine mid-draft; reconstruction only demands
      // completeness when the caller says the draft is over — callers assert
      // pickCount themselves. Recorded as a problem only when overfull.
      if (pickCount > expectedTotal) {
        problems.push(`log holds ${pickCount} picks; ${expectedTotal} is the maximum`);
      }
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    seed,
    snakeOrder,
    picksBySeat,
    bankBySeat,
  };
}
