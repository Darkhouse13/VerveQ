/**
 * Weekend Fantasy — the reclamation court (FW-LAUNCH O3,
 * RECLAMATION_COURT_SPEC v1.0.1).
 *
 * Position verdicts only: "the feed says he played DEF; he actually played
 * MID." Lifecycle: file (rate-limited, duplicates merge) → endorse (free,
 * threshold max(15, 0.5% actives)) → trial (votes weighted 0.5 + rater
 * accuracy; filer and holders excluded) → verdict in the Tuesday 21:00–23:59
 * window → re-score.
 *
 * The ruling's effect on scores is a NEW fantasyPlayerScores version,
 * re-scored through the engine (scoreAllContexts) from the CURRENT stored
 * stat revision with the changed verdict — never a mutation (rule 5). A
 * passed claim is also the standing override applyFixtureStats reads, so a
 * later feed revision before finality cannot reset a ruling.
 *
 * Hard invariant, enforced twice over: no court path touches a settled
 * gameweek — every write here re-checks the settlement stamp, and the
 * re-score additionally refuses a final row or a past-finality clock.
 *
 * Rules live in lib/fantasyCourtRules.ts (pure); this module is the
 * authorized wrapper plus the resolver the cron drives.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  COURT_FILINGS_PER_GAMEWEEK,
  endorsementThresholdOf,
  filingClosesAt,
  inVerdictWindow,
  quorumOf,
  trialPasses,
  validArgument,
  votingClosesAt,
} from "./lib/fantasyCourtRules";
import { raterWeightOf } from "./lib/fantasyCrowd";
import {
  scoreAllContexts,
  statHashOf,
  slotValidator,
  type PlayerFixtureLine,
} from "./lib/fantasyScorePipeline";
import { matchContextFor } from "./lib/fantasyFeedStats";
import type { Slot } from "./lib/fantasyScoring";
import { currentScoreRow, gameweekScoringRow, isAfterFinality } from "./fantasyScores";
import { raterAccuracyOf } from "./fantasyCrowdVoting";
import { findOpenGameweek } from "./fantasyDraftRooms";

export const SIGN_IN_REQUIRED = "Sign in to use the court.";
export const FILING_CLOSED = "Filing for this gameweek has closed.";
export const FILING_LIMIT_REACHED = `You have used your ${COURT_FILINGS_PER_GAMEWEEK} filings for this gameweek.`;
export const CLAIM_NOT_FOUND = "That claim does not exist.";
export const NOT_ON_TRIAL = "That claim is not on trial.";
export const VOTING_CLOSED_COURT = "The court's voting window has closed.";
export const ALREADY_VOTED = "You have already voted on this claim.";
export const CONFLICTED_VOTER =
  "You hold this player in a squad this gameweek — the court does not seat conflicted jurors.";
export const FILER_CANNOT_VOTE = "The filer does not vote on their own claim.";
export const REBUTTAL_TAKEN = "The counter-argument slot is already taken.";
export const BAD_ARGUMENT = "The argument must be 1–280 characters.";
export const GAMEWEEK_SETTLED = "This gameweek has settled — the court is closed.";
export const PLAYER_DID_NOT_APPEAR =
  "No appearance is on record for that player in that fixture.";
export const SAME_POSITION = "That is already the verdict on record.";

// ── shared ──

async function requireUserId(ctx: MutationCtx | QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error(SIGN_IN_REQUIRED);
  return userId;
}

/** Refuses every court write on a settled gameweek — the hard invariant. */
async function assertNotSettled(
  ctx: MutationCtx | QueryCtx,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<void> {
  const scoring = await gameweekScoringRow(ctx, gameweekId);
  if (scoring?.state === "final") throw new Error(GAMEWEEK_SETTLED);
}

/** Distinct squad-holding users this gameweek — the "actives" number the
 *  thresholds read (OWNER DECISION 1; floors dominate at launch scale). */
async function activeUsersOf(
  ctx: MutationCtx | QueryCtx,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<number> {
  const squads = await ctx.db
    .query("fantasySquads")
    .withIndex("by_gameweek", (q) => q.eq("gameweekId", gameweekId))
    .collect();
  return new Set(squads.map((s) => s.userId as string)).size;
}

/** Does this user hold the player in ANY squad this gameweek? (Trial
 *  exclusion, LOCKED — same rule as crowd conflict exclusion.) */
async function holdsPlayer(
  ctx: MutationCtx | QueryCtx,
  userId: Id<"users">,
  gameweekId: Id<"fantasyGameweeks">,
  playerId: Id<"fantasyPlayers">,
): Promise<boolean> {
  const squads = await ctx.db
    .query("fantasySquads")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  for (const squad of squads) {
    if (squad.gameweekId !== gameweekId) continue;
    const slots = await ctx.db
      .query("fantasySquadSlots")
      .withIndex("by_squad", (q) => q.eq("squadId", squad._id))
      .collect();
    if (slots.some((slot) => slot.playerId === playerId)) return true;
  }
  return false;
}

async function promoteIfPastThreshold(
  ctx: MutationCtx,
  claim: Doc<"fantasyCourtClaims">,
  endorsements: number,
  now: number,
): Promise<void> {
  const threshold = endorsementThresholdOf(await activeUsersOf(ctx, claim.gameweekId));
  if (claim.status === "filing" && endorsements >= threshold) {
    // "any claim past threshold: opens immediately" — no Monday wait.
    await ctx.db.patch(claim._id, { status: "trial", trialOpenedAt: now });
  }
}

// ── filing ──

export async function fileClaimFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  gameweek: Doc<"fantasyGameweeks">,
  args: {
    playerId: Id<"fantasyPlayers">;
    fixtureId: Id<"fantasyFixtures">;
    claimedPosition: Slot;
    argument: string;
  },
  now: number,
): Promise<{ claimId: Id<"fantasyCourtClaims">; merged: boolean }> {
  await assertNotSettled(ctx, gameweek._id);
  if (now >= filingClosesAt(gameweek.finalityAt)) throw new Error(FILING_CLOSED);
  if (!validArgument(args.argument)) throw new Error(BAD_ARGUMENT);

  const player = await ctx.db.get(args.playerId);
  if (player === null) throw new Error(PLAYER_DID_NOT_APPEAR);
  const fixture = await ctx.db.get(args.fixtureId);
  if (fixture === null || fixture.gameweekId !== gameweek._id) {
    throw new Error(PLAYER_DID_NOT_APPEAR);
  }
  // Filing opens at full-time, and only an appearance can carry a verdict.
  if (fixture.status !== "finished") throw new Error(PLAYER_DID_NOT_APPEAR);
  const statRow = await ctx.db
    .query("fantasyFixtureStats")
    .withIndex("by_fixture_player_revision", (q) =>
      q.eq("fixtureId", args.fixtureId).eq("providerPlayerId", player.providerPlayerId),
    )
    .order("desc")
    .first();
  if (statRow === null || statRow.stats.minutes <= 0) {
    throw new Error(PLAYER_DID_NOT_APPEAR);
  }

  const scoreRow = await currentScoreRow(ctx, gameweek._id, player.providerPlayerId);
  const positionAtFiling = scoreRow?.verdictPosition ?? statRow.feedPosition;
  if (positionAtFiling === args.claimedPosition) throw new Error(SAME_POSITION);

  // Duplicate claims merge into the first — endorsements pool, no split
  // courts. A merged filing is an endorsement, and costs no filing slot.
  const existing = await ctx.db
    .query("fantasyCourtClaims")
    .withIndex("by_gameweek_claimKey", (q) =>
      q
        .eq("gameweekId", gameweek._id)
        .eq("providerPlayerId", player.providerPlayerId)
        .eq("fixtureId", args.fixtureId)
        .eq("claimedPosition", args.claimedPosition),
    )
    .first();
  if (existing !== null && (existing.status === "filing" || existing.status === "trial")) {
    await endorseClaimFor(ctx, userId, existing._id, now);
    return { claimId: existing._id, merged: true };
  }

  const filed = await ctx.db
    .query("fantasyCourtClaims")
    .withIndex("by_filer_gameweek", (q) =>
      q.eq("filedBy", userId).eq("gameweekId", gameweek._id),
    )
    .collect();
  if (filed.length >= COURT_FILINGS_PER_GAMEWEEK) throw new Error(FILING_LIMIT_REACHED);

  const claimId = await ctx.db.insert("fantasyCourtClaims", {
    gameweekId: gameweek._id,
    fixtureId: args.fixtureId,
    providerPlayerId: player.providerPlayerId,
    playerId: args.playerId,
    claimedPosition: args.claimedPosition,
    positionAtFiling,
    filedBy: userId,
    argument: args.argument.trim(),
    filedAt: now,
    status: "filing",
    endorsements: 1, // the filer is the first endorser
  });
  await ctx.db.insert("fantasyCourtEndorsements", { claimId, userId, at: now });
  return { claimId, merged: false };
}

export const fileClaim = mutation({
  args: {
    playerId: v.id("fantasyPlayers"),
    fixtureId: v.id("fantasyFixtures"),
    claimedPosition: slotValidator,
    argument: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) throw new Error(FILING_CLOSED);
    return fileClaimFor(ctx, userId, gameweek, args, Date.now());
  },
});

// ── endorsement ──

export async function endorseClaimFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  claimId: Id<"fantasyCourtClaims">,
  now: number,
): Promise<{ endorsements: number }> {
  const claim = await ctx.db.get(claimId);
  if (claim === null) throw new Error(CLAIM_NOT_FOUND);
  await assertNotSettled(ctx, claim.gameweekId);
  const gameweek = await ctx.db.get(claim.gameweekId);
  if (gameweek === null) throw new Error(CLAIM_NOT_FOUND);
  if (now >= filingClosesAt(gameweek.finalityAt)) throw new Error(FILING_CLOSED);
  if (claim.status !== "filing" && claim.status !== "trial") throw new Error(FILING_CLOSED);

  const prior = await ctx.db
    .query("fantasyCourtEndorsements")
    .withIndex("by_claim_user", (q) => q.eq("claimId", claimId).eq("userId", userId))
    .first();
  if (prior !== null) return { endorsements: claim.endorsements };

  await ctx.db.insert("fantasyCourtEndorsements", { claimId, userId, at: now });
  const endorsements = claim.endorsements + 1;
  await ctx.db.patch(claimId, { endorsements });
  await promoteIfPastThreshold(ctx, claim, endorsements, now);
  return { endorsements };
}

export const endorseClaim = mutation({
  args: { claimId: v.id("fantasyCourtClaims") },
  handler: async (ctx, { claimId }) => {
    const userId = await requireUserId(ctx);
    return endorseClaimFor(ctx, userId, claimId, Date.now());
  },
});

// ── rebuttal ──

export async function rebutClaimFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  claimId: Id<"fantasyCourtClaims">,
  text: string,
  now: number,
): Promise<{ ok: true }> {
  const claim = await ctx.db.get(claimId);
  if (claim === null) throw new Error(CLAIM_NOT_FOUND);
  await assertNotSettled(ctx, claim.gameweekId);
  // FW-CR1 item 3: the rebuttal is a TRIAL feature. A claim still gathering
  // endorsements has no hearing to answer, and a counter-argument spent there
  // would burn the single slot before any juror could read it — the slot must
  // survive filing intact.
  if (claim.status !== "trial") throw new Error(NOT_ON_TRIAL);
  if (claim.rebuttal !== undefined) throw new Error(REBUTTAL_TAKEN);
  if (!validArgument(text)) throw new Error(BAD_ARGUMENT);
  const gameweek = await ctx.db.get(claim.gameweekId);
  if (gameweek === null) throw new Error(CLAIM_NOT_FOUND);
  if (now >= votingClosesAt(gameweek.finalityAt)) throw new Error(VOTING_CLOSED_COURT);
  await ctx.db.patch(claimId, { rebuttal: { userId, text: text.trim(), at: now } });
  return { ok: true };
}

export const rebutClaim = mutation({
  args: { claimId: v.id("fantasyCourtClaims"), text: v.string() },
  handler: async (ctx, { claimId, text }) => {
    const userId = await requireUserId(ctx);
    return rebutClaimFor(ctx, userId, claimId, text, Date.now());
  },
});

// ── trial voting ──

export async function castCourtVoteFor(
  ctx: MutationCtx,
  userId: Id<"users">,
  claimId: Id<"fantasyCourtClaims">,
  vote: "yes" | "no",
  now: number,
): Promise<{ ok: true }> {
  const claim = await ctx.db.get(claimId);
  if (claim === null) throw new Error(CLAIM_NOT_FOUND);
  await assertNotSettled(ctx, claim.gameweekId);
  if (claim.status !== "trial") throw new Error(NOT_ON_TRIAL);
  const gameweek = await ctx.db.get(claim.gameweekId);
  if (gameweek === null) throw new Error(CLAIM_NOT_FOUND);
  if (now >= votingClosesAt(gameweek.finalityAt)) throw new Error(VOTING_CLOSED_COURT);

  // Exclusions, LOCKED: the filer, and anyone holding the player.
  if (claim.filedBy === userId) throw new Error(FILER_CANNOT_VOTE);
  if (claim.playerId !== undefined) {
    if (await holdsPlayer(ctx, userId, claim.gameweekId, claim.playerId)) {
      throw new Error(CONFLICTED_VOTER);
    }
  }

  const prior = await ctx.db
    .query("fantasyCourtVotes")
    .withIndex("by_claim_user", (q) => q.eq("claimId", claimId).eq("userId", userId))
    .first();
  if (prior !== null) throw new Error(ALREADY_VOTED);

  // Weighted by rater accuracy — the sealed game's one place with teeth.
  const accuracy = await raterAccuracyOf(ctx, userId);
  const weight = raterWeightOf(accuracy.accurateVotes, accuracy.scoredVotes);
  await ctx.db.insert("fantasyCourtVotes", { claimId, userId, vote, weight, at: now });
  return { ok: true };
}

export const castCourtVote = mutation({
  args: {
    claimId: v.id("fantasyCourtClaims"),
    vote: v.union(v.literal("yes"), v.literal("no")),
  },
  handler: async (ctx, { claimId, vote }) => {
    const userId = await requireUserId(ctx);
    return castCourtVoteFor(ctx, userId, claimId, vote, Date.now());
  },
});

// ── the docket (read) ──

export const getCourtDocket = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const gameweek = await findOpenGameweek(ctx);
    if (gameweek === null) return null;

    const claims: Doc<"fantasyCourtClaims">[] = [];
    for (const status of ["filing", "trial", "passed", "failed", "died", "expired"] as const) {
      claims.push(
        ...(await ctx.db
          .query("fantasyCourtClaims")
          .withIndex("by_gameweek_status", (q) =>
            q.eq("gameweekId", gameweek._id).eq("status", status),
          )
          .collect()),
      );
    }

    const actives = await activeUsersOf(ctx, gameweek._id);
    const myFilings =
      userId === null
        ? 0
        : (
            await ctx.db
              .query("fantasyCourtClaims")
              .withIndex("by_filer_gameweek", (q) =>
                q.eq("filedBy", userId).eq("gameweekId", gameweek._id),
              )
              .collect()
          ).length;

    const rows = await Promise.all(
      claims.map(async (claim) => {
        const player =
          claim.playerId === undefined ? null : await ctx.db.get(claim.playerId);
        let myEndorsement = false;
        let myVote: "yes" | "no" | null = null;
        if (userId !== null) {
          myEndorsement =
            (await ctx.db
              .query("fantasyCourtEndorsements")
              .withIndex("by_claim_user", (q) =>
                q.eq("claimId", claim._id).eq("userId", userId),
              )
              .first()) !== null;
          const voteRow = await ctx.db
            .query("fantasyCourtVotes")
            .withIndex("by_claim_user", (q) =>
              q.eq("claimId", claim._id).eq("userId", userId),
            )
            .first();
          myVote = voteRow?.vote ?? null;
        }
        return {
          claimId: claim._id,
          playerName: player?.name ?? claim.providerPlayerId,
          claimedPosition: claim.claimedPosition,
          positionAtFiling: claim.positionAtFiling,
          argument: claim.argument,
          rebuttal: claim.rebuttal?.text ?? null,
          status: claim.status,
          endorsements: claim.endorsements,
          filedByMe: userId !== null && claim.filedBy === userId,
          myEndorsement,
          myVote,
          tallies: claim.tallies ?? null,
          filedAt: claim.filedAt,
        };
      }),
    );

    return {
      gameweekId: gameweek._id,
      gwNumber: gameweek.gwNumber,
      finalityAt: gameweek.finalityAt,
      filingClosesAt: filingClosesAt(gameweek.finalityAt),
      votingClosesAt: votingClosesAt(gameweek.finalityAt),
      endorsementThreshold: endorsementThresholdOf(actives),
      quorum: quorumOf(actives),
      myFilings,
      filingsAllowed: COURT_FILINGS_PER_GAMEWEEK,
      claims: rows.sort((a, b) => b.filedAt - a.filedAt),
    };
  },
});

// ── resolution + re-score ──

/**
 * The re-score a passed verdict causes: one NEW version for the player,
 * scored by the engine from the CURRENT stored stat revision with the
 * changed verdict. Universal by construction — every squad holding him
 * derives from this one row. Refuses a settled gameweek, a past-finality
 * clock, and a finalized row (rule 5 / R4), and is idempotent: a current
 * row already carrying the verdict writes nothing.
 */
async function rescoreForVerdict(
  ctx: MutationCtx,
  claim: Doc<"fantasyCourtClaims">,
  now: number,
): Promise<{ written: boolean; reason: string | null }> {
  const gameweek = await ctx.db.get(claim.gameweekId);
  if (gameweek === null) return { written: false, reason: "gameweek missing" };
  const scoring = await gameweekScoringRow(ctx, claim.gameweekId);
  if (isAfterFinality(gameweek, scoring, now)) {
    return { written: false, reason: "after finality — scores unchanged (R4)" };
  }

  const current = await currentScoreRow(ctx, claim.gameweekId, claim.providerPlayerId);
  if (current === null) return { written: false, reason: "no score row to revise" };
  if (current.state === "final") return { written: false, reason: "row already final" };
  if (current.verdictPosition === claim.claimedPosition) {
    return { written: false, reason: "verdict already on record" };
  }

  const statRow = await ctx.db
    .query("fantasyFixtureStats")
    .withIndex("by_fixture_player_revision", (q) =>
      q.eq("fixtureId", claim.fixtureId).eq("providerPlayerId", claim.providerPlayerId),
    )
    .order("desc")
    .first();
  if (statRow === null) return { written: false, reason: "no stat revision on record" };
  const fixture = await ctx.db.get(claim.fixtureId);
  if (fixture === null) return { written: false, reason: "fixture missing" };

  const isHome = statRow.clubId === fixture.homeClubId;
  const line: PlayerFixtureLine = {
    stats: statRow.stats,
    context: matchContextFor(
      isHome ? (fixture.homeGoals ?? 0) : (fixture.awayGoals ?? 0),
      isHome ? (fixture.awayGoals ?? 0) : (fixture.homeGoals ?? 0),
    ),
    events: statRow.events,
    entryMinute: statRow.entryMinute,
    verdictPosition: claim.claimedPosition,
  };

  const version = current.version + 1;
  await ctx.db.insert("fantasyPlayerScores", {
    gameweekId: current.gameweekId,
    fixtureId: current.fixtureId,
    providerPlayerId: current.providerPlayerId,
    ...(current.playerId === undefined ? {} : { playerId: current.playerId }),
    version,
    state: "provisional",
    baseScores: scoreAllContexts(line),
    crowdFactor: current.crowdFactor,
    verdictPosition: claim.claimedPosition,
    statHash: statHashOf(line),
    rawRevision: statRow.revision,
    revisedFrom: current.version,
    specVersion: current.specVersion,
    scoredAt: now,
  });
  await ctx.db.patch(current._id, { supersededByVersion: version });
  return { written: true, reason: null };
}

export interface ResolveDueClaimsResult {
  died: number;
  passed: number;
  failed: number;
  expired: number;
  rescored: number;
  gameweeksTouched: number;
}

/**
 * The court's clock, cron-driven. Two acts, split at the finality instant
 * (FW-CR1 item 1):
 *
 *   before finality — claims short of threshold die at Monday 23:59, and
 *     trials RESOLVE inside the verdict window (Tuesday 21:00–23:59): a
 *     verdict is stamped and, when it passes, the re-score lands with it.
 *   at/after finality — nothing is judged. Whatever is still open is stamped
 *     `expired`: no verdict, no tallies, no score touched.
 *
 * The reason for the split is the settlement lag. `finalityAt` is an instant
 * but the settlement stamp is a cron, so there is a window in which the
 * gameweek is past its cut and not yet labelled `final`. The old single pass
 * fired there, stamped a claim `passed`, and then watched `rescoreForVerdict`
 * refuse it under R4 — leaving the court asserting a ruling the scores never
 * received. An outcome the numbers did not get is not an outcome.
 *
 * The window is never missed in practice: it is 2h59m wide against a 15-minute
 * cadence (`cadenceCoversVerdictWindow`, asserted in the rules suite), so a
 * trial expires only if the resolver itself was down for the whole evening.
 * Settled gameweeks are skipped whole, as before.
 */
export const resolveDueClaims = internalMutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args): Promise<ResolveDueClaimsResult> => {
    const now = args.now ?? Date.now();
    const result: ResolveDueClaimsResult = {
      died: 0,
      passed: 0,
      failed: 0,
      expired: 0,
      rescored: 0,
      gameweeksTouched: 0,
    };

    const gameweeks: Doc<"fantasyGameweeks">[] = [];
    for (const status of ["upcoming", "live", "settling"] as const) {
      gameweeks.push(
        ...(await ctx.db
          .query("fantasyGameweeks")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect()),
      );
    }

    for (const gameweek of gameweeks) {
      const scoring = await gameweekScoringRow(ctx, gameweek._id);
      if (scoring?.state === "final") continue; // settled: immune, skipped whole

      let touched = false;

      // ── the expiry pass: at/after finality, nothing is judged ──
      if (now >= gameweek.finalityAt) {
        for (const status of ["filing", "trial"] as const) {
          const open = await ctx.db
            .query("fantasyCourtClaims")
            .withIndex("by_gameweek_status", (q) =>
              q.eq("gameweekId", gameweek._id).eq("status", status),
            )
            .collect();
          for (const claim of open) {
            // Unresolved at finality. No verdict, no tallies, no re-score —
            // the ONLY thing recorded is that the clock ran out.
            await ctx.db.patch(claim._id, { status: "expired", resolvedAt: now });
            result.expired += 1;
            touched = true;
          }
        }
        if (touched) result.gameweeksTouched += 1;
        continue;
      }

      if (now >= filingClosesAt(gameweek.finalityAt)) {
        const filing = await ctx.db
          .query("fantasyCourtClaims")
          .withIndex("by_gameweek_status", (q) =>
            q.eq("gameweekId", gameweek._id).eq("status", "filing"),
          )
          .collect();
        for (const claim of filing) {
          // Short of threshold at Monday 23:59: dies silently, slot kept.
          await ctx.db.patch(claim._id, { status: "died", resolvedAt: now });
          result.died += 1;
          touched = true;
        }
      }

      if (inVerdictWindow(gameweek.finalityAt, now)) {
        const trials = await ctx.db
          .query("fantasyCourtClaims")
          .withIndex("by_gameweek_status", (q) =>
            q.eq("gameweekId", gameweek._id).eq("status", "trial"),
          )
          .collect();
        const quorum = quorumOf(await activeUsersOf(ctx, gameweek._id));
        for (const claim of trials) {
          const votes = await ctx.db
            .query("fantasyCourtVotes")
            .withIndex("by_claim", (q) => q.eq("claimId", claim._id))
            .collect();
          let weightedYes = 0;
          let weightedNo = 0;
          let rawYes = 0;
          let rawNo = 0;
          for (const vote of votes) {
            if (vote.vote === "yes") {
              weightedYes += vote.weight;
              rawYes += 1;
            } else {
              weightedNo += vote.weight;
              rawNo += 1;
            }
          }
          const passes = trialPasses({
            rawVotes: votes.length,
            weightedYes,
            weightedNo,
            quorum,
          });
          const tallies = {
            rawVotes: votes.length,
            rawYes,
            rawNo,
            weightedYes,
            weightedNo,
            quorum,
          };
          if (passes) {
            const rescore = await rescoreForVerdict(ctx, claim, now);
            await ctx.db.patch(claim._id, {
              status: "passed",
              resolvedAt: now,
              tallies,
            });
            result.passed += 1;
            if (rescore.written) result.rescored += 1;
          } else {
            await ctx.db.patch(claim._id, { status: "failed", resolvedAt: now, tallies });
            result.failed += 1;
          }
          touched = true;
        }
      }

      if (touched) result.gameweeksTouched += 1;
    }

    return result;
  },
});

/**
 * Passed verdict overrides for a gameweek, keyed by provider player id —
 * what the ingest path consults so a feed revision between a ruling and
 * finality re-scores WITH the ruling instead of resetting it.
 */
export async function passedVerdictsOf(
  ctx: QueryCtx | MutationCtx,
  gameweekId: Id<"fantasyGameweeks">,
): Promise<Map<string, Slot>> {
  const passed = await ctx.db
    .query("fantasyCourtClaims")
    .withIndex("by_gameweek_status", (q) =>
      q.eq("gameweekId", gameweekId).eq("status", "passed"),
    )
    .collect();
  const map = new Map<string, Slot>();
  for (const claim of passed) map.set(claim.providerPlayerId, claim.claimedPosition);
  return map;
}
