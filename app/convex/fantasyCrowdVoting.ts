/**
 * Weekend Fantasy — crowd voting (FW-LAUNCH O2, CROWD_VOTING_SPEC v1.0.1).
 *
 * The eye-test instrument. Server-served pairwise votes ("who had the better
 * game?") move a per-gameweek Elo per player; at settlement the frozen
 * ratings derive each player's crowd factor and the factor reaches scores as
 * NEW fantasyPlayerScores versions — never a mutation, never a second
 * mirroring rule. Rules live in lib/fantasyCrowd.ts (pure); this module is
 * the authorized wrapper plus the one pipeline hook.
 *
 * The band discipline (STANDING RULE 6): deriveCrowdFactors is in ±15% by
 * construction, and applyCrowdFactorsForGameweek still calls
 * assertCrowdFactorInBand on every factor before writing — the pipeline's
 * rejection stays the safety net, exercised on every write.
 *
 * Windows (LOCKED): voting opens at each fixture's full-time and closes at
 * the gameweek's finality instant; the factor applied is the frozen one;
 * a settled gameweek is immune to everything here.
 *
 * Anti-abuse per spec §Anti-abuse: pairs are server-chosen, single-use per
 * user, capped per gameweek, liquidity-targeted, and a user is never served
 * a pair containing any player in any of their squads this gameweek.
 *
 * EYE-TEST-SERVE adds two things and changes no rule: serving RANKS the
 * eligible set by what a vote is worth to the crowd (invisible to the voter),
 * and a didn't-see can be taken back for five seconds — the selection, never
 * the pair.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  CROWD_LIQUIDITY_THRESHOLD,
  CROWD_ELO_START,
  CROWD_SERVE_CAP_PER_GAMEWEEK,
  CROWD_SERVE_PRICE_LOOKUP_MAX,
  CROWD_SESSION_GOAL,
  CROWD_UNDO_WINDOW_MS,
  consensusOf,
  consensusRevealOf,
  deriveCrowdFactors,
  eligibleForSelection,
  eloUpdate,
  newlyRetiredOf,
  pairKeyOf,
  rankForServing,
  selectionAfterCascade,
  selectionAfterUndo,
  serveCardContextOf,
  serveGateOf,
  serveJitterOf,
  serveValueOf,
  todayStartOf,
  todaysTenOf,
  undoWindowOpenAt,
  unseenAfterUndo,
  unseenFixturesOf,
  type ConsensusReveal,
  type CrowdRatingEntry,
  type ServeCandidate,
  type ServeCardContext,
  type TodaysTenProgress,
  type UnseenSide,
} from "./lib/fantasyCrowd";
import { assertCrowdFactorInBand } from "./lib/fantasyScorePipeline";
import { clubLabel } from "./fantasyPlayerCard";
import { findOpenGameweek } from "./fantasyDraftRooms";
import { currentScoreRow, gameweekScoringRow } from "./fantasyScores";

export const SIGN_IN_REQUIRED = "Sign in to vote.";
export const VOTING_CLOSED = "Voting for this gameweek has closed.";
export const PAIR_NOT_FOUND = "That pair is not yours to vote on.";
export const PAIR_ALREADY_USED = "That pair has already been answered.";
export const SERVE_CAP_REACHED =
  "You have reached this gameweek's voting limit — thank you for the eyes.";
/** EYE-TEST-SERVE. The undo's four refusals, each said plainly: the window is
 *  short by design and a voter who missed it is told it closed, not that
 *  something broke. */
export const UNDO_EXPIRED = "That one's already settled — the game stays retired.";
export const UNDO_ALREADY_DONE = "You already took that one back.";
export const UNDO_NOT_UNSEEN = "That answer retired nothing to undo.";
export const UNDO_NOTHING_TO_RESTORE = "There's nothing to put back.";

// ── shared guards ──

async function requireUserId(ctx: MutationCtx | QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error(SIGN_IN_REQUIRED);
  return userId;
}

/** Voting is open while the gameweek's finality instant is ahead AND the
 *  settlement stamp has not landed. Both, deliberately: the stamp can only
 *  trail the instant, and neither alone survives a re-windowed gameweek. */
async function votingWindowOpen(
  ctx: MutationCtx | QueryCtx,
  gameweek: Doc<"fantasyGameweeks">,
  now: number,
): Promise<boolean> {
  if (now >= gameweek.finalityAt) return false;
  const scoring = await gameweekScoringRow(ctx, gameweek._id);
  return scoring?.state !== "final";
}

// ── the appeared pool ──

interface AppearedPlayer {
  playerId: Id<"fantasyPlayers">;
  providerPlayerId: string;
  fixtureId: Id<"fantasyFixtures">;
  leagueId: number;
  /** The current stat revision — the served card's memory (minutes, factual
   *  events, appeared-for club) rides on it (EYE-TEST-CONTEXT). */
  statRow: Doc<"fantasyFixtureStats">;
}

/**
 * Players who APPEARED (minutes > 0 on their current stat revision) in a
 * finished fixture of this gameweek — the spec's voteable population. Built
 * from FW-4's raw stat rows, which exist from the first post-fixture ingest.
 */
async function appearedPlayers(
  ctx: MutationCtx | QueryCtx,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<AppearedPlayer[]> {
  const fixtures = await ctx.db
    .query("fantasyFixtures")
    .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweekId))
    .collect();
  const finished = new Map<string, Doc<"fantasyFixtures">>();
  for (const fixture of fixtures) {
    if (fixture.status === "finished") finished.set(fixture._id, fixture);
  }
  if (finished.size === 0) return [];

  const statRows = await ctx.db
    .query("fantasyFixtureStats")
    .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweekId))
    .collect();

  // Highest revision per (fixture, player) is current.
  const currentByKey = new Map<string, Doc<"fantasyFixtureStats">>();
  for (const row of statRows) {
    const key = `${row.fixtureId}:${row.providerPlayerId}`;
    const seen = currentByKey.get(key);
    if (seen === undefined || row.revision > seen.revision) currentByKey.set(key, row);
  }

  const appeared: AppearedPlayer[] = [];
  for (const row of currentByKey.values()) {
    if (row.playerId === undefined) continue;
    if (row.stats.minutes <= 0) continue;
    const fixture = finished.get(row.fixtureId);
    if (fixture === undefined) continue;
    appeared.push({
      playerId: row.playerId,
      providerPlayerId: row.providerPlayerId,
      fixtureId: row.fixtureId,
      leagueId: fixture.leagueId,
      statRow: row,
    });
  }
  return appeared;
}

/** Every player in any of the user's squads this gameweek — budget or crew.
 *  Conflict exclusion is enforced at serve time (LOCKED). */
async function conflictedPlayerIds(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<Set<string>> {
  const squads = await ctx.db
    .query("fantasySquads")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const conflicted = new Set<string>();
  for (const squad of squads) {
    if (squad.gameweekId !== gameweekId) continue;
    const slots = await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
      .collect();
    for (const slot of slots) {
      if (slot.playerId !== undefined) conflicted.add(slot.playerId);
    }
  }
  return conflicted;
}

// ── the fixture picker (EYE-TEST-TEN) ──

/** The user's picker row for a gameweek, or null if never asked. */
async function watchedRowOf(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<Doc<"fantasyCrowdWatched"> | null> {
  return await ctx.db
    .query("fantasyCrowdWatched")
    .withIndex("by_user_gameweek", (q) =>
      q.eq("userId", userId).eq("gameweekId", gameweekId),
    )
    .first();
}

/**
 * Record which games the user says he caught. Ids are validated against THIS
 * gameweek's fixtures and deduped — a fixture from another gameweek (or a
 * fabricated id) is dropped rather than stored, so the selection can never
 * widen the voteable population beyond what serving would allow anyway.
 *
 * An empty list is accepted and stored: "didn't watch anything this weekend"
 * is an answer, and the row's existence is what distinguishes it from never
 * having been asked.
 *
 * A fixture already retired by a didn't-see is dropped too. That is what makes
 * "never serves them a pair from an unseen fixture again" hold for the whole
 * gameweek rather than until the next save: the voter has already answered for
 * that game, and the re-edit exists for games he never spoke about.
 */
export async function setWatchedFixturesFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  gameweek: Doc<"fantasyGameweeks">,
  fixtureIds: readonly Id<"fantasyFixtures">[],
  now: number,
): Promise<{ selected: Id<"fantasyFixtures">[]; unseen: Id<"fantasyFixtures">[] }> {
  const gameweekFixtures = await ctx.db
    .query("fantasyFixtures")
    .withIndex("by_gameweek_kickoff", (q) => q.eq("gameweekId", gameweek._id))
    .collect();
  const known = new Set<string>(gameweekFixtures.map((f) => f._id));
  const existing = await watchedRowOf(ctx, userId, gameweek._id);
  const unseen = existing?.unseenFixtureIds ?? [];

  const requested: Id<"fantasyFixtures">[] = [];
  const seen = new Set<string>();
  for (const fixtureId of fixtureIds) {
    if (!known.has(fixtureId) || seen.has(fixtureId)) continue;
    seen.add(fixtureId);
    requested.push(fixtureId);
  }
  const selected = selectionAfterCascade(requested, unseen) as Id<"fantasyFixtures">[];

  if (existing === null) {
    await ctx.db.insert("fantasyCrowdWatched", {
      userId,
      gameweekId: gameweek._id,
      fixtureIds: selected,
      updatedAt: now,
    });
  } else {
    await ctx.db.patch(existing._id, { fixtureIds: selected, updatedAt: now });
  }
  return { selected, unseen: [...unseen] };
}

export const setWatchedFixtures = mutation({
  args: { fixtureIds: v.array(v.id("fantasyFixtures")) },
  handler: async (ctx, { fixtureIds }) => {
    const userId = await requireUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) throw new Error(VOTING_CLOSED);
    return setWatchedFixturesFor(ctx, userId, gameweek, fixtureIds, Date.now());
  },
});

/** The picker's current answer, for the "+ add games" re-edit. Null selection
 *  = never asked; an empty array = answered "nothing". */
export const getWatchedFixtures = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return null;
    // One shape from both branches: a signed-out caller has never been asked
    // and has retired nothing.
    if (userId === null) {
      return { gameweekId: gameweek._id, selected: null, unseen: [] };
    }
    const row = await watchedRowOf(ctx, userId, gameweek._id);
    return {
      gameweekId: gameweek._id,
      selected: row === null ? null : row.fixtureIds,
      /** Retired by a didn't-see — the picker shows these as answered-for
       *  rather than as unpicked, so a tap that would do nothing isn't
       *  offered. */
      unseen: row?.unseenFixtureIds ?? [],
    };
  },
});

// ── serving ──

export type ServeResult =
  | { status: "closed" }
  /** EYE-TEST-TEN: the picker has never been answered for this gameweek —
   *  the session's first screen, not an error. */
  | { status: "needs_picker" }
  /** Answered, but nothing is selected — either "didn't watch anything" or
   *  every picked game has since been retired by a didn't-see. */
  | { status: "no_fixtures" }
  | { status: "cap_reached"; served: number; cap: number; progress: TodaysTenProgress }
  | { status: "exhausted"; served: number; cap: number; progress: TodaysTenProgress }
  | {
      status: "served";
      pairId: Id<"fantasyCrowdPairs">;
      served: number;
      cap: number;
      progress: TodaysTenProgress;
      players: [ServedPlayer, ServedPlayer];
    };

/** One served card: identity plus the card's memory (EYE-TEST-CONTEXT).
 *  The context fields — appeared-for club, opponent, venue, fixture line,
 *  minutes, factual events — come from lib/fantasyCrowd.serveCardContextOf;
 *  everything on it is a stored fact of fantasyFixtures / the current
 *  fantasyFixtureStats revision. Nothing evaluative, by ruling. */
export interface ServedPlayer extends ServeCardContext {
  playerId: Id<"fantasyPlayers">;
  /** EYE-TEST-TEN: which game this card's memory belongs to. The surface
   *  compares the two sides' ids to decide whether ONE combined didn't-see
   *  button is honest, and sends it back so the cascade retires the right
   *  fixture. */
  fixtureId: Id<"fantasyFixtures">;
  name: string;
  position: "GK" | "DEF" | "MID" | "ATT";
}

/**
 * Serve the caller's next pair (the core — fantasyCrowdSim drives this
 * without a session, same seam as fantasySquads' `…For` functions).
 *
 * Pair-serving per spec §Pair-serving: same-fixture by default, same-league
 * same-gameweek as fallback, never cross-league; conflicts excluded at serve
 * time; one serve per pair per user, ever.
 *
 * EYE-TEST-SERVE ranks WITHIN that eligible set — coverage, then how contested
 * the pair is, then draft relevance (lib/fantasyCrowd §smart serving). It is
 * ordering only: every pair this function could have served before, it can
 * still serve, and every pair it refused, it still refuses. The spec's
 * "probability weights toward under-voted players" is now a deterministic
 * ranking with a per-user tie-break rather than a random one — same intent,
 * testable.
 */
export async function servePairFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  gameweek: Doc<"fantasyGameweeks">,
  now: number,
  clientDayStart?: number | null,
): Promise<ServeResult> {
  if (!(await votingWindowOpen(ctx, gameweek, now))) return { status: "closed" };

  // The picker gates serving BEFORE any pair is chosen or inserted: a voter
  // who has not answered it gets the first screen, never a pair he then has
  // to skip. Both gate exits are pre-insert, so neither burns a pair or a
  // serve-cap slot.
  const watched = await watchedRowOf(ctx, userId, gameweek._id);
  const gate = serveGateOf(watched?.fixtureIds ?? null);
  if (gate.kind === "needs_picker") return { status: "needs_picker" };
  if (gate.kind === "no_fixtures") return { status: "no_fixtures" };

  const priorPairs = await ctx.db
    .query("fantasyCrowdPairs")
    .withIndex("by_user_gameweek", (q) =>
      q.eq("userId", userId).eq("gameweekId", gameweek._id),
    )
    .collect();
  const progress = todaysTenOf(
    priorPairs.filter((p) => p.status === "voted").map((p) => p.votedAt),
    todayStartOf(now, clientDayStart),
  );
  if (priorPairs.length >= CROWD_SERVE_CAP_PER_GAMEWEEK) {
    return {
      status: "cap_reached",
      served: priorPairs.length,
      cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
      progress,
    };
  }
  const servedKeys = new Set(priorPairs.map((p) => p.pairKey));

  const appeared = await appearedPlayers(ctx, gameweek._id);
  const conflicted = await conflictedPlayerIds(ctx, userId, gameweek._id);
  const eligible = eligibleForSelection(appeared, gate.fixtureIds, conflicted);
  if (eligible.length < 2) {
    return {
      status: "exhausted",
      served: priorPairs.length,
      cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
      progress,
    };
  }

  const ratings = await ctx.db
    .query("fantasyCrowdRatings")
    .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
    .collect();
  const ratingByPlayer = new Map(ratings.map((r) => [r.playerId as string, r]));
  const votesOf = (p: AppearedPlayer) => ratingByPlayer.get(p.playerId)?.voteCount ?? 0;

  // EYE-TEST-SERVE — the ranking's inputs. Coverage and the running split come
  // from the rating rows already in hand; the draft-relevance term needs a
  // price, which lives on the player doc, so it is bought for at most
  // CROWD_SERVE_PRICE_LOOKUP_MAX candidates and spent in COVERAGE order — the
  // only candidates that can realistically win the ranking. Everyone past the
  // cap ranks with relevance 0, which is the same direction the coverage term
  // already put them in. Nothing here narrows `eligible`.
  const byCoverage = [...eligible].sort(
    (a, b) => votesOf(a) - votesOf(b) || (a.playerId < b.playerId ? -1 : 1),
  );
  const priceLookup = byCoverage.slice(0, CROWD_SERVE_PRICE_LOOKUP_MAX);
  const priceDocs = await Promise.all(priceLookup.map((p) => ctx.db.get(p.playerId)));
  const priceByPlayer = new Map<string, number>();
  let maxPrice = 0;
  priceDocs.forEach((doc, i) => {
    const price = doc?.price ?? null;
    if (price === null || !Number.isFinite(price)) return;
    priceByPlayer.set(priceLookup[i].playerId, price);
    if (price > maxPrice) maxPrice = price;
  });

  const candidateOf = (p: AppearedPlayer): ServeCandidate => ({
    playerId: p.playerId,
    voteCount: ratingByPlayer.get(p.playerId)?.voteCount ?? 0,
    rating: ratingByPlayer.get(p.playerId)?.rating ?? CROWD_ELO_START,
    price: priceByPlayer.get(p.playerId) ?? null,
  });
  // Per-user, per-player, and stable: two voters break the same tie in
  // different orders (nobody hammers one under-voted head in lockstep), and
  // one voter's serve is a function of stored state rather than of entropy.
  const jitterOf = (p: AppearedPlayer) => serveJitterOf(`${userId}:${p.playerId}`);

  const rankPlayers = (
    rows: readonly AppearedPlayer[],
    target: AppearedPlayer | null,
  ): AppearedPlayer[] => {
    const anchor = target === null ? null : candidateOf(target);
    return rankForServing(
      rows.map((p) => ({
        playerId: p.playerId as string,
        value:
          anchor === null
            ? serveValueOf(candidateOf(p), null, maxPrice).value
            : serveValueOf(anchor, candidateOf(p), maxPrice).value,
        jitter: jitterOf(p),
        player: p,
      })),
    ).map((row) => row.player);
  };

  // Targets by their own value to the crowd; partners by the value of the
  // PAIR, which is where the contested term lives. The tiers below are
  // unchanged rules, not ranking: same fixture first, then same league, never
  // cross-league (LOCKED) — the ranking only orders WITHIN each tier.
  for (const target of rankPlayers(eligible, null)) {
    const sameFixture = rankPlayers(
      eligible.filter(
        (p) => p.fixtureId === target.fixtureId && p.playerId !== target.playerId,
      ),
      target,
    );
    const sameLeague = rankPlayers(
      eligible.filter(
        (p) => p.fixtureId !== target.fixtureId && p.leagueId === target.leagueId,
      ),
      target,
    );
    for (const partner of [...sameFixture, ...sameLeague]) {
      const pairKey = pairKeyOf(target.playerId, partner.playerId);
      if (servedKeys.has(pairKey)) continue;

      const pairId = await ctx.db.insert("fantasyCrowdPairs", {
        gameweekId: gameweek._id,
        userId,
        playerAId: target.playerId,
        playerBId: partner.playerId,
        fixtureAId: target.fixtureId,
        fixtureBId: partner.fixtureId,
        pairKey,
        servedAt: now,
        status: "served",
      });
      const sides = [target, partner];
      const docs = await Promise.all(
        sides.map(async (p) => ({
          player: await ctx.db.get(p.playerId),
          fixture: await ctx.db.get(p.fixtureId),
        })),
      );
      // Club labels for both sides of both fixtures via the bounded
      // pool-meta walk (getWeekendFixtures precedent) — at most four clubs
      // per serve, and a same-fixture pair shares its two.
      const clubNames = new Map<string, string>();
      for (const { fixture } of docs) {
        for (const clubId of [fixture?.homeClubId, fixture?.awayClubId]) {
          if (clubId === undefined || clubNames.has(clubId)) continue;
          const label = await clubLabel(ctx, clubId);
          if (label !== null) clubNames.set(clubId, label);
        }
      }
      const players = sides.map((p, i): ServedPlayer => {
        const doc = docs[i].player;
        const fixture = docs[i].fixture;
        return {
          playerId: p.playerId,
          fixtureId: p.fixtureId,
          name: doc?.name ?? "…",
          position: doc?.feedPosition ?? "MID",
          ...serveCardContextOf({
            appearedClubId: p.statRow.clubId,
            stats: p.statRow.stats,
            fixture: {
              leagueId: fixture?.leagueId ?? p.leagueId,
              kickoffAt: fixture?.kickoffAt ?? 0,
              homeClubId: fixture?.homeClubId ?? "",
              awayClubId: fixture?.awayClubId ?? "",
              homeGoals: fixture?.homeGoals ?? null,
              awayGoals: fixture?.awayGoals ?? null,
            },
            clubNames,
          }),
        };
      });
      return {
        status: "served",
        pairId,
        served: priorPairs.length + 1,
        cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
        progress,
        players: [players[0], players[1]],
      };
    }
  }

  return {
    status: "exhausted",
    served: priorPairs.length,
    cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
    progress,
  };
}

export const servePair = mutation({
  args: {
    /** The client's local midnight, so Today's Ten rolls over at the voter's
     *  midnight. Clamped server-side (lib/fantasyCrowd.todayStartOf). */
    dayStartAt: v.optional(v.number()),
  },
  handler: async (ctx, { dayStartAt }): Promise<ServeResult> => {
    const userId = await requireUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return { status: "closed" };
    return servePairFor(ctx, userId, gameweek, Date.now(), dayStartAt);
  },
});

// ── voting ──

/**
 * The tap. "a" | "b" is a judgment; the rest are didn't-sees.
 *
 * `unseen_a` / `unseen_b` are the per-card "didn't see him" — a pair can span
 * two fixtures, so one card's answer must not retire the other's game.
 * `skip` is the combined button, offered only when both cards share a
 * fixture, and remains the wire name a pre-EYE-TEST-TEN client sends.
 */
export type VoteChoice = "a" | "b" | "unseen_a" | "unseen_b" | "skip";

/**
 * EYE-TEST-SERVE — the five-second take-back, returned only when the answer
 * actually retired something. The surface renders it as a toast; the server
 * is what decides whether the offer exists and whether it is still live.
 */
export interface UndoOffer {
  pairId: Id<"fantasyCrowdPairs">;
  /** The games taken off his list, labelled for the toast line. One, almost
   *  always; two only for a combined didn't-see spanning two fixtures. */
  fixtures: { fixtureId: Id<"fantasyFixtures">; label: string }[];
  /** Server instant the offer dies. The client's timer is cosmetic — the undo
   *  mutation re-checks the window against the stored stamp. */
  expiresAt: number;
}

export interface CastVoteResult {
  ok: true;
  /** Post-vote only. A didn't-see gets NO reveal — it is not a vote, and
   *  paying it with a crowd number would make not-watching worth farming. */
  reveal: ConsensusReveal | null;
  progress: TodaysTenProgress;
  /** Present only on a didn't-see that retired a game the voter had picked.
   *  A vote never carries one: the cascade is what is being offered back, and
   *  a judgment retires nothing. */
  undo: UndoOffer | null;
}

const UNSEEN_SIDE: Record<"unseen_a" | "unseen_b" | "skip", UnseenSide> = {
  unseen_a: "a",
  unseen_b: "b",
  skip: "both",
};

/**
 * "Real Sociedad — Athletic Club": the retired game, named well enough for a
 * toast the voter has five seconds to read. Degraded loudly, never invented
 * (the getWeekendFixtures rule) — a club without a label renders its raw id,
 * and a fixture that has vanished renders the em dash alone rather than a
 * guess. At most two fixtures per didn't-see, so at most four club walks.
 */
async function fixtureLabel(
  ctx: MutationCtx,
  fixtureId: Id<"fantasyFixtures">,
): Promise<string> {
  const fixture = await ctx.db.get(fixtureId);
  if (fixture === null) return "—";
  const home = (await clubLabel(ctx, fixture.homeClubId)) ?? fixture.homeClubId;
  const away = (await clubLabel(ctx, fixture.awayClubId)) ?? fixture.awayClubId;
  return `${home} — ${away}`;
}

/** Today's Ten for a user, from their answered pairs. */
async function progressFor(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
  gameweekId: Id<"fantasyGameweeks">,
  now: number,
  clientDayStart?: number | null,
): Promise<TodaysTenProgress> {
  const pairs = await ctx.db
    .query("fantasyCrowdPairs")
    .withIndex("by_user_gameweek", (q) =>
      q.eq("userId", userId).eq("gameweekId", gameweekId),
    )
    .collect();
  return todaysTenOf(
    pairs.filter((p) => p.status === "voted").map((p) => p.votedAt),
    todayStartOf(now, clientDayStart),
  );
}

/**
 * The reveal for the pair the caller just voted on.
 *
 * Counted from the stored pairs themselves (by_gameweek_pairKey_status),
 * in the CANONICAL direction — two users can be dealt the same pair with A
 * and B swapped, so "a" is meaningless across rows; the winner's playerId is
 * not. Same orientation rule scoreRaterAccuracy uses, so the number a voter
 * sees live and the frozen consensus he is scored against are the same
 * quantity read at two different times.
 */
async function revealFor(
  ctx: MutationCtx,
  pair: Doc<"fantasyCrowdPairs">,
  callerWinnerId: Id<"fantasyPlayers">,
): Promise<ConsensusReveal> {
  const voted = await ctx.db
    .query("fantasyCrowdPairs")
    .withIndex("by_gameweek_pairKey_status", (q) =>
      q.eq("gameweekId", pair.gameweekId).eq("pairKey", pair.pairKey).eq("status", "voted"),
    )
    .collect();
  let withYou = 0;
  for (const row of voted) {
    const winnerId = row.choice === "a" ? row.playerAId : row.playerBId;
    if (winnerId === callerWinnerId) withYou += 1;
  }
  return consensusRevealOf(withYou, voted.length);
}

export async function castVoteFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  pairId: Id<"fantasyCrowdPairs">,
  choice: VoteChoice,
  now: number,
  clientDayStart?: number | null,
): Promise<CastVoteResult> {
  const pair = await ctx.db.get(pairId);
  if (pair === null || pair.userId !== userId) throw new Error(PAIR_NOT_FOUND);
  // Single-use, checked BEFORE anything is written or read back to the
  // caller: a pair already answered cannot be re-answered, which is also what
  // stops a voter re-requesting a reveal for a pair whose crowd has since
  // moved.
  if (pair.status !== "served") throw new Error(PAIR_ALREADY_USED);

  const gameweek = await ctx.db.get(pair.gameweekId);
  if (gameweek === null) throw new Error(PAIR_NOT_FOUND);
  if (!(await votingWindowOpen(ctx, gameweek, now))) throw new Error(VOTING_CLOSED);

  if (choice !== "a" && choice !== "b") {
    // A didn't-see — costless, no Elo update, no penalty (LOCKED). This
    // branch returns before any rating row is touched, which is where "carries
    // no weight in the crowd factor" is enforced rather than merely intended:
    // deriveCrowdFactors reads fantasyCrowdRatings, and nothing here writes
    // one. scoreRaterAccuracy is likewise blind to it (status "voted" only).
    const side = UNSEEN_SIDE[choice];
    await ctx.db.patch(pair._id, { status: "skipped", unseen: side, votedAt: now });

    // The cascade: retire the fixture(s) he says he didn't see from his
    // picker selection, so every REMAINING pair drawn from that game is
    // excluded for the rest of the gameweek — not just this one.
    const retired = unseenFixturesOf(side, pair.fixtureAId, pair.fixtureBId);
    const watched = await watchedRowOf(ctx, userId, pair.gameweekId);
    let undo: UndoOffer | null = null;
    if (watched !== null) {
      const nextSelected = selectionAfterCascade(watched.fixtureIds, retired);
      // Remembered separately, so a later "+ add games" save cannot resurrect
      // a game he has already answered for (the "never again" half of the
      // cascade rule).
      const nextUnseen = [
        ...new Set([...(watched.unseenFixtureIds ?? []), ...retired]),
      ] as Id<"fantasyFixtures">[];
      await ctx.db.patch(watched._id, {
        fixtureIds: nextSelected as Id<"fantasyFixtures">[],
        unseenFixtureIds: nextUnseen,
        updatedAt: now,
      });

      // EYE-TEST-SERVE: what this one answer actually took away, stored so the
      // undo can be its exact inverse and nothing wider. Written on the pair
      // row rather than derived later because the selection keeps moving —
      // by the time an undo arrives, "what did that tap do" is no longer
      // recoverable from the row it changed.
      const takenBack = newlyRetiredOf(
        retired,
        watched.fixtureIds,
        watched.unseenFixtureIds ?? [],
      ) as Id<"fantasyFixtures">[];
      if (takenBack.length > 0) {
        await ctx.db.patch(pair._id, { retiredFixtureIds: takenBack });
        undo = {
          pairId: pair._id,
          fixtures: await Promise.all(
            takenBack.map(async (fixtureId) => ({
              fixtureId,
              label: await fixtureLabel(ctx, fixtureId),
            })),
          ),
          expiresAt: now + CROWD_UNDO_WINDOW_MS,
        };
      }
    }
    return {
      ok: true,
      reveal: null,
      progress: await progressFor(ctx, userId, pair.gameweekId, now, clientDayStart),
      undo,
    };
  }

  const ratingRowOf = async (
    playerId: Id<"fantasyPlayers">,
  ): Promise<Doc<"fantasyCrowdRatings">> => {
    const existing = await ctx.db
      .query("fantasyCrowdRatings")
      .withIndex("by_gameweek_player", (q) =>
        q.eq("gameweekId", pair.gameweekId).eq("playerId", playerId),
      )
      .first();
    if (existing !== null) return existing;
    const player = await ctx.db.get(playerId);
    const rowId = await ctx.db.insert("fantasyCrowdRatings", {
      gameweekId: pair.gameweekId,
      playerId,
      providerPlayerId: player?.providerPlayerId ?? "",
      rating: CROWD_ELO_START,
      voteCount: 0,
    });
    const row = await ctx.db.get(rowId);
    if (row === null) throw new Error("rating row vanished mid-transaction");
    return row;
  };

  const rowA = await ratingRowOf(pair.playerAId);
  const rowB = await ratingRowOf(pair.playerBId);
  const next = eloUpdate(rowA.rating, rowB.rating, choice === "a");
  await ctx.db.patch(rowA._id, { rating: next.a, voteCount: rowA.voteCount + 1 });
  await ctx.db.patch(rowB._id, { rating: next.b, voteCount: rowB.voteCount + 1 });
  await ctx.db.patch(pair._id, { status: "voted", choice, votedAt: now });

  // Read the tally AFTER the write, so the caller is inside his own crowd —
  // "68% went with you" counts the vote he just cast.
  const reveal = await revealFor(ctx, pair, choice === "a" ? pair.playerAId : pair.playerBId);
  return {
    ok: true as const,
    reveal,
    progress: await progressFor(ctx, userId, pair.gameweekId, now, clientDayStart),
    // A judgment retires nothing, so there is nothing to take back.
    undo: null,
  };
}

export const castVote = mutation({
  args: {
    pairId: v.id("fantasyCrowdPairs"),
    choice: v.union(
      v.literal("a"),
      v.literal("b"),
      v.literal("unseen_a"),
      v.literal("unseen_b"),
      v.literal("skip"),
    ),
    dayStartAt: v.optional(v.number()),
  },
  handler: async (ctx, { pairId, choice, dayStartAt }): Promise<CastVoteResult> => {
    const userId = await requireUserId(ctx);
    return castVoteFor(ctx, userId, pairId, choice, Date.now(), dayStartAt);
  },
});

// ── the undo (EYE-TEST-SERVE) ──

export interface UndoUnseenResult {
  ok: true;
  /** The games put back on his list. */
  restored: Id<"fantasyFixtures">[];
}

/**
 * Take back a didn't-see's CASCADE, inside the five-second window.
 *
 * What comes back is the selection: the retired game returns to the picker's
 * list and leaves the retirement ledger, so pairs from it are served again.
 * What does NOT come back is the pair — the row stays `skipped` and its
 * pairKey stays used, because the voter has already answered it and a pair
 * answered twice is a pair that could be answered differently twice.
 *
 * Past the window the retirement is permanent, per the EYE-TEST-TEN cascade
 * ruling. This is a mis-tap remedy with the lifetime of the toast that offers
 * it, not a standing right to reconsider.
 *
 * Refuses on a settled/closed gameweek for the same reason castVote does: the
 * cascade writes a user's voting state, and a closed gameweek's state is done
 * moving.
 */
export async function undoUnseenFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  pairId: Id<"fantasyCrowdPairs">,
  now: number,
): Promise<UndoUnseenResult> {
  const pair = await ctx.db.get(pairId);
  if (pair === null || pair.userId !== userId) throw new Error(PAIR_NOT_FOUND);
  if (pair.status !== "skipped") throw new Error(UNDO_NOT_UNSEEN);
  if (pair.cascadeUndoneAt !== undefined) throw new Error(UNDO_ALREADY_DONE);

  const restored = pair.retiredFixtureIds ?? [];
  if (restored.length === 0) throw new Error(UNDO_NOTHING_TO_RESTORE);
  if (!undoWindowOpenAt(pair.votedAt, now)) throw new Error(UNDO_EXPIRED);

  const gameweek = await ctx.db.get(pair.gameweekId);
  if (gameweek === null) throw new Error(PAIR_NOT_FOUND);
  if (!(await votingWindowOpen(ctx, gameweek, now))) throw new Error(VOTING_CLOSED);

  const watched = await watchedRowOf(ctx, userId, pair.gameweekId);
  if (watched === null) throw new Error(UNDO_NOTHING_TO_RESTORE);

  await ctx.db.patch(watched._id, {
    fixtureIds: selectionAfterUndo(watched.fixtureIds, restored) as Id<"fantasyFixtures">[],
    unseenFixtureIds: unseenAfterUndo(
      watched.unseenFixtureIds ?? [],
      restored,
    ) as Id<"fantasyFixtures">[],
    updatedAt: now,
  });
  // Stamped, and the list left in place: the row keeps saying what the tap
  // did and that it was taken back, which is what refuses a second undo.
  await ctx.db.patch(pair._id, { cascadeUndoneAt: now });

  return { ok: true, restored: [...restored] };
}

export const undoUnseen = mutation({
  args: { pairId: v.id("fantasyCrowdPairs") },
  handler: async (ctx, { pairId }): Promise<UndoUnseenResult> => {
    const userId = await requireUserId(ctx);
    return undoUnseenFor(ctx, userId, pairId, Date.now());
  },
});

// ── status read ──

export const getVotingStatus = query({
  args: { dayStartAt: v.optional(v.number()) },
  handler: async (ctx, { dayStartAt }) => {
    const userId = await getAuthUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return null;
    const now = Date.now();
    const open = await votingWindowOpen(ctx, gameweek, now);
    let served = 0;
    let voted = 0;
    let progress = todaysTenOf([], todayStartOf(now, dayStartAt));
    let pickerAnswered = false;
    if (userId !== null) {
      const pairs = await ctx.db
        .query("fantasyCrowdPairs")
        .withIndex("by_user_gameweek", (q) =>
          q.eq("userId", userId).eq("gameweekId", gameweek._id),
        )
        .collect();
      served = pairs.length;
      voted = pairs.filter((p) => p.status === "voted").length;
      progress = todaysTenOf(
        pairs.filter((p) => p.status === "voted").map((p) => p.votedAt),
        todayStartOf(now, dayStartAt),
      );
      pickerAnswered = (await watchedRowOf(ctx, userId, gameweek._id)) !== null;
    }
    return {
      gameweekId: gameweek._id,
      gwNumber: gameweek.gwNumber,
      finalityAt: gameweek.finalityAt,
      open,
      served,
      voted,
      /** The gameweek ceiling, unchanged. The surface no longer counts
       *  toward it (EYE-TEST-TEN) — `progress` is what a session is about. */
      cap: CROWD_SERVE_CAP_PER_GAMEWEEK,
      goal: CROWD_SESSION_GOAL,
      progress,
      pickerAnswered,
    };
  },
});

// ── factor application (the pipeline hook) ──

export interface ApplyCrowdFactorsResult {
  eligible: boolean;
  reason: string | null;
  written: number;
  unchanged: number;
  insufficient: number;
  done: boolean;
}

const APPLY_CHUNK = 100;

/**
 * Derive the frozen crowd factors and land them as NEW score versions.
 *
 * Called by the settlement driver AFTER the cut and BEFORE finalization, so
 * the rows the finalizer flips already carry their factors. Refuses before
 * finality (the ratings are not frozen yet) and on a settled gameweek
 * (immune, twice over: the early return here and the per-row final-state
 * guard below). Idempotent: a factor equal to the current row's writes
 * nothing, so re-runs converge to zero writes.
 *
 * Chunked like finalizeGameweekChunk: at most APPLY_CHUNK versions per
 * transaction; the driver loops until `done`.
 */
export const applyCrowdFactorsForGameweek = internalMutation({
  args: { gameweekId: v.id("fantasyGameweeks"), now: v.optional(v.number()) },
  handler: async (ctx, args): Promise<ApplyCrowdFactorsResult> => {
    const now = args.now ?? Date.now();
    const gameweek = await ctx.db.get(args.gameweekId);
    if (gameweek === null) throw new Error("Gameweek not found.");

    const scoring = await gameweekScoringRow(ctx, gameweek._id);
    if (scoring?.state === "final") {
      return {
        eligible: false,
        reason: "settled gameweek immune",
        written: 0,
        unchanged: 0,
        insufficient: 0,
        done: true,
      };
    }
    if (now < gameweek.finalityAt) {
      return {
        eligible: false,
        reason: "before finality — ratings are not frozen yet",
        written: 0,
        unchanged: 0,
        insufficient: 0,
        done: true,
      };
    }

    const ratings = await ctx.db
      .query("fantasyCrowdRatings")
      .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweek._id))
      .collect();
    if (ratings.length === 0) {
      return { eligible: true, reason: null, written: 0, unchanged: 0, insufficient: 0, done: true };
    }

    // The percentile population needs every liquid player's verdict, so the
    // whole derivation recomputes each chunk — it is pure arithmetic; only
    // the WRITES are chunked.
    const entries: CrowdRatingEntry[] = [];
    const rowByPlayer = new Map<string, Doc<"fantasyPlayerScores">>();
    for (const rating of ratings) {
      const row = await currentScoreRow(ctx, gameweek._id, rating.providerPlayerId);
      if (row === null || row.verdictPosition === null) continue;
      rowByPlayer.set(rating.providerPlayerId, row);
      entries.push({
        playerId: rating.providerPlayerId,
        verdictPosition: row.verdictPosition,
        rating: rating.rating,
        voteCount: rating.voteCount,
      });
    }

    const results = deriveCrowdFactors(entries);
    let written = 0;
    let unchanged = 0;
    let insufficient = 0;
    for (const result of results) {
      if (result.insufficientVotes) insufficient += 1;
      const current = rowByPlayer.get(result.playerId);
      if (current === undefined) continue;
      if (current.crowdFactor === result.factor) {
        unchanged += 1;
        continue;
      }
      if (current.state === "final") {
        // Settled numbers are immune even row by row — a partially finalized
        // gameweek must never half-apply a crowd.
        continue;
      }
      if (written >= APPLY_CHUNK) {
        return { eligible: true, reason: null, written, unchanged, insufficient, done: false };
      }

      // The safety net, exercised on every write (R5 / STANDING RULE 6).
      assertCrowdFactorInBand(result.factor, `player ${result.playerId}`);

      const version = current.version + 1;
      await ctx.db.insert("fantasyPlayerScores", {
        gameweekId: current.gameweekId,
        fixtureId: current.fixtureId,
        providerPlayerId: current.providerPlayerId,
        ...(current.playerId === undefined ? {} : { playerId: current.playerId }),
        version,
        state: "provisional",
        baseScores: current.baseScores,
        crowdFactor: result.factor,
        verdictPosition: current.verdictPosition,
        statHash: current.statHash,
        rawRevision: current.rawRevision,
        revisedFrom: current.version,
        specVersion: current.specVersion,
        scoredAt: now,
      });
      await ctx.db.patch(current._id, { supersededByVersion: version });
      written += 1;
    }

    return { eligible: true, reason: null, written, unchanged, insufficient, done: true };
  },
});

// ── rater accuracy (the sealed second game) ──

export interface RaterAccuracyResult {
  eligible: boolean;
  reason: string | null;
  usersScored: number;
  done: boolean;
}

const RATER_CHUNK = 200;

/**
 * Score every user's votes against the frozen consensus, once, after the
 * gameweek settles. Ties have no majority and score nobody. One row per
 * (user, gameweek), written once — re-runs skip scored users, so the pass is
 * idempotent and chunk-safe.
 */
export const scoreRaterAccuracy = internalMutation({
  args: { gameweekId: v.id("fantasyGameweeks"), now: v.optional(v.number()) },
  handler: async (ctx, args): Promise<RaterAccuracyResult> => {
    const now = args.now ?? Date.now();
    const scoring = await gameweekScoringRow(ctx, args.gameweekId);
    if (scoring?.state !== "final") {
      return {
        eligible: false,
        reason: "consensus is frozen only after settlement",
        usersScored: 0,
        done: true,
      };
    }

    const votedPairs = await ctx.db
      .query("fantasyCrowdPairs")
      .withIndex("by_gameweek_status", (q) =>
        q.eq("gameweekId", args.gameweekId).eq("status", "voted"),
      )
      .collect();
    if (votedPairs.length === 0) {
      return { eligible: true, reason: null, usersScored: 0, done: true };
    }

    // Tally in the CANONICAL direction, not the served one: two users can be
    // dealt the same pair with A and B swapped, so "a" is meaningless across
    // rows. The winner's playerId is orientation-free; "low" is the side
    // whose id leads the canonical pairKey.
    const winnerOf = (pair: Doc<"fantasyCrowdPairs">): string =>
      pair.choice === "a" ? pair.playerAId : pair.playerBId;
    const lowOf = (pair: Doc<"fantasyCrowdPairs">): string =>
      pair.playerAId < pair.playerBId ? pair.playerAId : pair.playerBId;
    const tallies = new Map<string, { a: number; b: number }>();
    for (const pair of votedPairs) {
      const tally = tallies.get(pair.pairKey) ?? { a: 0, b: 0 };
      if (winnerOf(pair) === lowOf(pair)) tally.a += 1;
      else tally.b += 1;
      tallies.set(pair.pairKey, tally);
    }

    const byUser = new Map<string, Doc<"fantasyCrowdPairs">[]>();
    for (const pair of votedPairs) {
      const list = byUser.get(pair.userId) ?? [];
      list.push(pair);
      byUser.set(pair.userId, list);
    }

    let usersScored = 0;
    for (const [userIdRaw, pairs] of byUser) {
      const userId = userIdRaw as Id<"users">;
      const existing = await ctx.db
        .query("fantasyCrowdRaterStats")
        .withIndex("by_gameweek_user", (q) =>
          q.eq("gameweekId", args.gameweekId).eq("userId", userId),
        )
        .first();
      if (existing !== null) continue;
      if (usersScored >= RATER_CHUNK) {
        return { eligible: true, reason: null, usersScored, done: false };
      }

      let scoredVotes = 0;
      let accurateVotes = 0;
      for (const pair of pairs) {
        const tally = tallies.get(pair.pairKey);
        // "a" = the canonical low side won; compare directions, not letters.
        const consensus = tally === undefined ? null : consensusOf(tally.a, tally.b);
        if (consensus === null) continue; // a tie convicts nobody
        scoredVotes += 1;
        const votedLow = winnerOf(pair) === lowOf(pair);
        if (votedLow === (consensus === "a")) accurateVotes += 1;
      }
      await ctx.db.insert("fantasyCrowdRaterStats", {
        userId,
        gameweekId: args.gameweekId,
        scoredVotes,
        accurateVotes,
        scoredAt: now,
      });
      usersScored += 1;
    }

    return { eligible: true, reason: null, usersScored, done: true };
  },
});

/** Rolling accuracy across all settled gameweeks — the court's trust input. */
export async function raterAccuracyOf(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<{ scoredVotes: number; accurateVotes: number }> {
  const rows = await ctx.db
    .query("fantasyCrowdRaterStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let scoredVotes = 0;
  let accurateVotes = 0;
  for (const row of rows) {
    scoredVotes += row.scoredVotes;
    accurateVotes += row.accurateVotes;
  }
  return { scoredVotes, accurateVotes };
}

/** Per-player crowd liquidity for a gameweek, for read surfaces that must
 *  say "insufficient votes" rather than nothing (spec §Rating math). */
export async function crowdVotesFor(
  ctx: QueryCtx | MutationCtx,
  gameweekId: Id<"fantasyGameweeks">,
  playerId: Id<"fantasyPlayers">,
): Promise<number> {
  const row = await ctx.db
    .query("fantasyCrowdRatings")
    .withIndex("by_gameweek_player", (q) =>
      q.eq("gameweekId", gameweekId).eq("playerId", playerId),
    )
    .first();
  return row?.voteCount ?? 0;
}

export { CROWD_LIQUIDITY_THRESHOLD };
