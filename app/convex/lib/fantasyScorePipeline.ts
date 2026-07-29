/**
 * The scoring pipeline's pure half (FW-4).
 *
 * Everything here is a total function of its arguments: the content hash that
 * makes ingest idempotent (R2/R4), the eight-way score grid a player-fixture row
 * carries, the crowd band the PIPELINE enforces (R5), and the scoreability test
 * (R7). `fantasyScores.ts` is the transactional shell around these.
 *
 * Why pure and separate: every rule in here is one a test should be able to
 * corner without a database, and the hash in particular must be stable across
 * deployments forever — a hash that changed shape would re-score every fixture
 * ever ingested and version every score row a second time.
 */

import { v, type Infer } from "convex/values";
import {
  applyCrowdFactor,
  CROWD_FACTOR_LIMIT,
  scorePlayer,
  type MatchContext,
  type PlayerMatchStats,
  type Slot,
  type SlotRole,
  type TimedPlayerEvent,
} from "./fantasyScoring";
import { fantasyPlayerStatsValidator } from "./fantasyScoreValidators";

// ─────────────────────────────────────────────────────── validator ↔ engine

/**
 * The schema's stat validator and the engine's `PlayerMatchStats` describe the
 * same 27 fields, and these two assignments are what keeps that true: add a
 * field to one and this file stops compiling. Cheaper than the failure it
 * prevents, which is a stat the feed carries, the table stores, and the engine
 * silently never sees.
 */
type ValidatedStats = Infer<typeof fantasyPlayerStatsValidator>;
const _statsValidatorDescribesEngine: PlayerMatchStats = {} as ValidatedStats;
const _engineDescribesStatsValidator: ValidatedStats = {} as PlayerMatchStats;
void _statsValidatorDescribesEngine;
void _engineDescribesStatsValidator;

// ─────────────────────────────────────────────────────────────── the grid

export const SLOTS: readonly Slot[] = ["GK", "DEF", "MID", "ATT"];
export const SLOT_ROLES: readonly SlotRole[] = ["starter", "finisher"];

export type SlotScores = Record<Slot, number>;

/** Every way a fielded slot can name a player — SCORING_SPEC §Position templates. */
export interface BaseScoreGrid {
  readonly starter: SlotScores;
  readonly finisher: SlotScores;
}

/** One player's scoreable line for one fixture. */
export interface PlayerFixtureLine {
  readonly stats: PlayerMatchStats;
  /** From the FIXTURE score, never from a player row — `conceded` is keeper-only (G2). */
  readonly context: MatchContext;
  readonly events: readonly TimedPlayerEvent[];
  /** Null for a starter. NEVER 0 for a substitute (G4). */
  readonly entryMinute: number | null;
  /** The feed's lineup position (R6). Null only ever on a 0-minute line. */
  readonly verdictPosition: Slot | null;
}

/**
 * Score one line in all eight contexts, at crowdFactor 0.
 *
 * The crowd factor is deliberately NOT applied here: R5 stores base and factor
 * separately and derives the total on read, so the stored grid is the base grid.
 *
 * A finisher's events are entry-filtered by the ENGINE (it takes the whole event
 * list plus the entry minute), so this passes the same input for both roles and
 * lets the one implementation of §Finishers do the filtering.
 *
 * `verdictPosition === null` is only legal on a line with no minutes, where the
 * engine returns 0 before it reaches a template — so the verdict it is handed
 * cannot change the number. Passing the fielded slot in that case keeps the
 * mismatch dampener out of it, which is the only honest choice: with no verdict
 * from the feed there is no mismatch to assert.
 */
export function scoreAllContexts(line: PlayerFixtureLine): BaseScoreGrid {
  const input = { stats: line.stats, context: line.context, events: line.events };
  const grid = { starter: {}, finisher: {} } as {
    starter: Partial<SlotScores>;
    finisher: Partial<SlotScores>;
  };

  for (const role of SLOT_ROLES) {
    for (const slot of SLOTS) {
      const verdict = line.verdictPosition ?? slot;
      const result = scorePlayer(
        input,
        { position: slot, role },
        verdict,
        // A starter is scored from the aggregate line; only a finisher's entry
        // minute is an input, and an unused finisher's is null by definition.
        role === "finisher" ? line.entryMinute : null,
        0,
      );
      grid[role][slot] = result.points;
    }
  }

  return grid as BaseScoreGrid;
}

/** The ledger behind one cell of the grid, re-derived on demand for display. */
export function explainContext(
  line: PlayerFixtureLine,
  slot: Slot,
  role: SlotRole,
  crowdFactor: number,
) {
  return scorePlayer(
    { stats: line.stats, context: line.context, events: line.events },
    { position: slot, role },
    line.verdictPosition ?? slot,
    role === "finisher" ? line.entryMinute : null,
    crowdFactor,
  );
}

/** The total a fielded slot actually scores — R5's derivation, stated once. */
export function totalFor(
  grid: BaseScoreGrid,
  slot: Slot,
  role: SlotRole,
  crowdFactor: number,
): number {
  return applyCrowdFactor(grid[role][slot], crowdFactor);
}

/** True when the mismatch dampener applies to this cell (R6, for read surfaces). */
export function isMismatch(verdictPosition: Slot | null, fieldedSlot: Slot): boolean {
  return verdictPosition !== null && verdictPosition !== fieldedSlot;
}

// ──────────────────────────────────────────────────────────── crowd band

export const CROWD_FACTOR_OUT_OF_BAND =
  "Crowd factor out of band: the pipeline rejects it rather than clamping it";

/**
 * R5, fail-closed: "Any factor outside [-0.15, 0.15] is REJECTED (STOP, do not
 * clamp silently)."
 *
 * Silently clamping is the tempting behaviour and the wrong one — it turns a
 * broken upstream number into a plausible score, and the score is then wrong in
 * a way nothing downstream can detect. Throwing rolls the whole ingest
 * transaction back, which is the only outcome that leaves the data honest.
 *
 * NaN fails too: `Math.abs(NaN) <= 0.15` is false, and a NaN factor would
 * otherwise propagate into every total that touched it.
 */
export function assertCrowdFactorInBand(crowdFactor: number, subject: string): void {
  if (!Number.isFinite(crowdFactor) || Math.abs(crowdFactor) > CROWD_FACTOR_LIMIT) {
    throw new Error(
      `${CROWD_FACTOR_OUT_OF_BAND} (${subject}: ${crowdFactor}, limit ±${CROWD_FACTOR_LIMIT}).`,
    );
  }
}

// ────────────────────────────────────────────────────────── scoreability

/** FW-2's mapped statuses that mean "the match is over and a result stands". */
export const FT_CLASS_STATUS = "finished";

export interface ScoreabilityInput {
  /** FW-2's mapped fixture status. */
  readonly fixtureStatus: string;
  readonly hasPlayerStats: boolean;
  readonly hasEvents: boolean;
  /** Players with minutes but no feed lineup position — no verdict, no template. */
  readonly playedRowsWithoutPosition: number;
  /**
   * Whether the FIXTURE row carries a score. Clean sheets and the concession
   * term are read from it and never from a player line (G2), so a finished
   * fixture with no score on it cannot be scored at all.
   */
  readonly hasFixtureScore: boolean;
  /** Feed rows whose club is neither side of this fixture — a contradiction. */
  readonly rowsWithUnknownClub: number;
}

export interface Scoreability {
  readonly scoreable: boolean;
  /** Set when the fixture is FT-class and STILL not scoreable — R7's alert case. */
  readonly unscoreableReason: string | null;
  /** Why a player of this fixture reads "awaiting data". Null when scoreable. */
  readonly awaitingReason: string | null;
}

/**
 * R7: "A fixture is scoreable only when it is FT-class AND both player stats and
 * events are present. Otherwise it stays unscored and its players read 'awaiting
 * data' — never 0."
 *
 * The two cases below are deliberately distinguished. A fixture that has not
 * finished yet is simply not due — nothing is wrong. A fixture that HAS finished
 * and still has no stat line, no events, or a played row the feed gave no
 * position for, is a data failure: `unscoreableReason` is set, which is what the
 * gameweek alert and the ticket's STOP condition read.
 */
export function scoreabilityOf(input: ScoreabilityInput): Scoreability {
  if (input.fixtureStatus !== FT_CLASS_STATUS) {
    return {
      scoreable: false,
      unscoreableReason: null,
      awaitingReason: `fixture is ${input.fixtureStatus}, not ${FT_CLASS_STATUS}`,
    };
  }

  const missing: string[] = [];
  if (!input.hasPlayerStats) missing.push("no player stat lines in the feed");
  if (!input.hasEvents) missing.push("no events in the feed");
  if (!input.hasFixtureScore) missing.push("the fixture row carries no score (MatchContext, G2)");
  if (input.playedRowsWithoutPosition > 0) {
    missing.push(
      `${input.playedRowsWithoutPosition} played row(s) carry no lineup position, so no verdict template`,
    );
  }
  if (input.rowsWithUnknownClub > 0) {
    missing.push(
      `${input.rowsWithUnknownClub} feed row(s) name a club that is neither side of this fixture`,
    );
  }

  if (missing.length === 0) {
    return { scoreable: true, unscoreableReason: null, awaitingReason: null };
  }

  const reason = `FT-class but structurally unscoreable: ${missing.join("; ")}`;
  return { scoreable: false, unscoreableReason: reason, awaitingReason: reason };
}

// ─────────────────────────────────────────────────────────── content hash

/**
 * FNV-1a, two 32-bit lanes, hex — a 64-bit content hash in 16 characters.
 *
 * Hand-rolled rather than `crypto.subtle`: a Convex mutation must be
 * deterministic and synchronous-friendly, and this is both. 64 bits is sized for
 * the only collision that could matter — two CONSECUTIVE revisions of the SAME
 * (fixture, player) row hashing alike, which would let a real stat correction
 * pass as "unchanged". At 2^-64 per comparison that is not a risk anyone will
 * ever meet; a 32-bit hash would have been ~2^-32, which over a season of
 * revisions is a number worth not writing down.
 */
export function contentHash(canonical: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < canonical.length; i += 1) {
    const code = canonical.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ ((code << 5) | (code >>> 3)), 0x85ebca6b) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/**
 * The canonical serialisation a stat hash is taken over.
 *
 * Built field by field in a FIXED order rather than by `JSON.stringify` over an
 * object, because the hash's stability is a permanent contract: object key order
 * is an implementation detail of whatever built the object, and a re-ordered key
 * would silently re-version every score row in the database. Events are sorted
 * so a feed that returns them in a different order is not mistaken for a
 * revision.
 *
 * Everything that can change a SCORE is in here, and nothing that cannot:
 * the stat line, the timed events, the entry minute, the verdict position, and
 * the match context (a corrected fixture score changes clean sheets and the
 * concession term without touching a single player row — G2).
 */
export function statHashInputOf(line: PlayerFixtureLine): string {
  const s = line.stats;
  const parts: (string | number)[] = [
    "v1", // hash format version — bump only with a deliberate re-score
    s.minutes,
    s.goals,
    s.assists,
    s.shotsTotal,
    s.shotsOn,
    s.keyPasses,
    s.passesTotal,
    s.passesAccurate,
    s.dribblesAttempted,
    s.dribblesCompleted,
    s.tackles,
    s.interceptions,
    s.blocks,
    s.duelsTotal,
    s.duelsWon,
    s.foulsCommitted,
    s.foulsDrawn,
    s.yellowCards,
    s.redCards,
    s.saves,
    s.penaltiesWon,
    s.penaltiesConceded,
    s.penaltiesScored,
    s.penaltiesMissed,
    s.penaltiesSaved,
    s.ownGoals,
    s.wasSubstitute ? 1 : 0,
    line.entryMinute === null ? "-" : line.entryMinute,
    line.verdictPosition ?? "-",
    line.context.teamGoalsFor,
    line.context.teamGoalsAgainst,
    line.context.result,
    line.events.length,
  ];
  const events = [...line.events]
    .sort((x, y) => (x.minute - y.minute) || (x.kind < y.kind ? -1 : x.kind > y.kind ? 1 : 0))
    .map((e) => `${e.minute}:${e.kind}`)
    .join(",");
  return `${parts.join("|")}|${events}`;
}

export function statHashOf(line: PlayerFixtureLine): string {
  return contentHash(statHashInputOf(line));
}

/**
 * The fixture-level hash R2 makes ingest a no-op on.
 *
 * It covers EVERY INPUT to the scoring pass, not just the stat lines: the
 * players' stat hashes AND their crowd factors. That distinction is load-bearing.
 * A crowd factor is not feed data, so it is deliberately absent from a stat hash
 * — but if the fixture-level gate ignored it too, then once CROWD_VOTING ships, a
 * fixture whose votes moved and whose stats did not would be waved through as
 * "already ingested" and never re-scored. Sorted by player id, so feed ordering
 * is not mistaken for a change.
 */
export function fixtureInputHashOf(
  players: readonly { providerPlayerId: string; statHash: string; crowdFactor: number }[],
): string {
  const canonical = [...players]
    .sort((a, b) => (a.providerPlayerId < b.providerPlayerId ? -1 : a.providerPlayerId > b.providerPlayerId ? 1 : 0))
    .map((p) => `${p.providerPlayerId}=${p.statHash}@${p.crowdFactor}`)
    .join("|");
  return contentHash(`fixture-v1|${canonical}`);
}

// Re-exported so a caller never has to reach past this module into the engine
// for the one constant the pipeline is responsible for enforcing.
export { CROWD_FACTOR_LIMIT };

/** Convex validator for a slot, for modules that need it without importing schema. */
export const slotValidator = v.union(
  v.literal("GK"),
  v.literal("DEF"),
  v.literal("MID"),
  v.literal("ATT"),
);
