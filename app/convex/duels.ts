import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  areRankedEligibleUsers,
  isFullAccountUserDoc,
  isUsernameRequiredUserDoc,
} from "./lib/authz";
import { orderAnswerOptions } from "./lib/answerOptions";
import { calculateTimeScore, normalizeAnswer } from "./lib/scoring";

const TOTAL_DUEL_QUESTIONS = 10;
const DUEL_TTL_MS = 72 * 60 * 60 * 1000;
const NEAR_EXPIRY_MS = 6 * 60 * 60 * 1000;
const QUESTION_BASE_POINTS = 100;

type DuelSide = "challenger" | "opponent";
type DuelQuestionResult = NonNullable<
  Doc<"duels">["challengerResult"]
>["perQuestion"][number];
type DuelResult = NonNullable<Doc<"duels">["challengerResult"]>;

function normalizeMode(mode: string) {
  const normalized = mode.trim().toLowerCase();
  if (normalized !== "quiz" && normalized !== "came_first") {
    throw new Error("Async duels currently support quiz and came_first only");
  }
  return normalized;
}

function assertAccountUser(user: Doc<"users"> | null, label: string) {
  if (!isFullAccountUserDoc(user)) {
    throw new Error(`${label} must be a registered account with a username`);
  }
}

function assertUsernameUser(user: Doc<"users"> | null, label: string) {
  if (!isUsernameRequiredUserDoc(user)) {
    throw new Error(`${label} must have a username`);
  }
}

function randomCode(prefix: string, length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let code = prefix;
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return code;
}

function hashString(value: string) {
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

function guestTokenHash(token: string) {
  const trimmed = token.trim();
  if (trimmed.length < 16) {
    throw new Error("Guest duel token must be at least 16 characters");
  }
  return hashString(`duel-guest:${trimmed}`);
}

function pairKeyFor(userAId: Id<"users">, userBId: Id<"users">) {
  const [a, b] = [userAId, userBId].sort() as [Id<"users">, Id<"users">];
  return { pairKey: `${a}|${b}`, userAId: a, userBId: b };
}

function seededRandom(seed: string) {
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

function seededShuffle<T>(items: T[], seed: string) {
  const out = [...items];
  const rand = seededRandom(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function getQuestionChecksumsForDuel(
  ctx: Pick<MutationCtx, "db">,
  args: {
    type: "sports" | "knowledge";
    category?: string;
    sport?: string;
    difficulty: "easy" | "intermediate" | "hard";
    mode: string;
    seed: string;
  },
) {
  const mode = normalizeMode(args.mode);
  const sportKey = args.type === "knowledge" ? "knowledge" : args.sport;
  if (!sportKey) {
    throw new Error("Sport is required for sports duels");
  }
  if (args.type === "sports" && sportKey === "knowledge") {
    throw new Error("Use type=knowledge for knowledge duels");
  }

  const candidates = await ctx.db
    .query("quizQuestions")
    .withIndex("by_sport_difficulty", (q) =>
      q.eq("sport", sportKey).eq("difficulty", args.difficulty),
    )
    .collect();

  const filtered = candidates.filter((question) => {
    if (mode === "came_first") {
      return question.category === "which_came_first";
    }
    if (args.category) {
      return question.category === args.category;
    }
    return question.category !== "which_came_first";
  });

  const stable = filtered.sort((a, b) => a.checksum.localeCompare(b.checksum));
  const picked = seededShuffle(stable, args.seed).slice(0, TOTAL_DUEL_QUESTIONS);
  if (picked.length < TOTAL_DUEL_QUESTIONS) {
    throw new Error(
      `Not enough duel questions for ${sportKey}/${args.difficulty}/${args.category ?? mode}: ${picked.length}/${TOTAL_DUEL_QUESTIONS}`,
    );
  }

  return picked.map((question) => question.checksum);
}

async function generateUniqueLinkCode(ctx: Pick<MutationCtx, "db">) {
  for (let i = 0; i < 8; i += 1) {
    const linkCode = randomCode("DQ", 10);
    const existing = await ctx.db
      .query("duels")
      .withIndex("by_linkCode", (q) => q.eq("linkCode", linkCode))
      .first();
    if (!existing) return linkCode;
  }
  throw new Error("Could not allocate a unique duel link code");
}

function emptyResult(): DuelResult {
  return { score: 0, perQuestion: [] };
}

function getResultForSide(duel: Doc<"duels">, side: DuelSide): DuelResult {
  return side === "challenger"
    ? duel.challengerResult ?? emptyResult()
    : duel.opponentResult ?? emptyResult();
}

function getServedAtForSide(duel: Doc<"duels">, side: DuelSide) {
  return side === "challenger"
    ? [...(duel.challengerServedAt ?? [])]
    : [...(duel.opponentServedAt ?? [])];
}

function patchForSide(
  side: DuelSide,
  patch: {
    result?: DuelResult;
    servedAt?: number[];
  },
) {
  const out: Record<string, unknown> = {};
  if (patch.result) {
    out[side === "challenger" ? "challengerResult" : "opponentResult"] =
      patch.result;
  }
  if (patch.servedAt) {
    out[side === "challenger" ? "challengerServedAt" : "opponentServedAt"] =
      patch.servedAt;
  }
  return out;
}

async function identifyParticipant(
  ctx: Pick<QueryCtx, "db"> & Parameters<typeof getAuthUserId>[0],
  duel: Doc<"duels">,
  guestToken?: string,
): Promise<{
  side: DuelSide;
  userId: Id<"users"> | null;
  isGuest: boolean;
}> {
  const userId = await getAuthUserId(ctx);
  if (userId === duel.challengerId) {
    return { side: "challenger", userId, isGuest: false };
  }
  if (duel.opponentId && userId === duel.opponentId) {
    return { side: "opponent", userId, isGuest: false };
  }
  if (!duel.opponentId && guestToken && duel.opponentGuestTokenHash) {
    if (guestTokenHash(guestToken) === duel.opponentGuestTokenHash) {
      return { side: "opponent", userId: null, isGuest: true };
    }
  }
  throw new Error("Not authorized for this duel");
}

async function ensureQuestionServed(
  ctx: Pick<MutationCtx, "db">,
  duel: Doc<"duels">,
  side: DuelSide,
  now: number,
) {
  if (duel.status !== "awaiting_opponent") return duel;
  const result = getResultForSide(duel, side);
  if (result.completedAt) return duel;
  const nextIndex = result.perQuestion.length;
  if (nextIndex >= duel.questionChecksums.length) return duel;

  const servedAt = getServedAtForSide(duel, side);
  if (servedAt[nextIndex]) return duel;
  servedAt[nextIndex] = now;

  await ctx.db.patch(duel._id, patchForSide(side, { servedAt }));
  return {
    ...duel,
    ...(side === "challenger"
      ? { challengerServedAt: servedAt }
      : { opponentServedAt: servedAt }),
  } as Doc<"duels">;
}

async function publicQuestion(
  ctx: Pick<MutationCtx, "db" | "storage">,
  checksum: string,
) {
  const question = await ctx.db
    .query("quizQuestions")
    .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
    .first();
  if (!question) throw new Error("Question not found");

  const imageUrl = question.imageId
    ? await ctx.storage.getUrl(question.imageId)
    : null;
  return {
    checksum: question.checksum,
    question: question.question,
    options: orderAnswerOptions(
      question.options,
      question.correctAnswer,
      question.checksum,
    ),
    category: question.category,
    difficulty: question.difficulty,
    imageUrl,
  };
}

function sanitizeOwnResult(result: DuelResult) {
  return {
    score: result.score,
    completedAt: result.completedAt ?? null,
    perQuestion: result.perQuestion.map((answer) => ({
      questionIndex: answer.questionIndex,
      checksum: answer.checksum,
      answer: answer.answer,
      correct: answer.correct,
      score: answer.score,
      timeTaken: answer.timeTaken,
      answeredAt: answer.answeredAt,
    })),
  };
}

function sanitizeOpponentResult(result: DuelResult | undefined) {
  return {
    score: result?.score ?? 0,
    completedAt: result?.completedAt ?? null,
    answeredCount: result?.perQuestion.length ?? 0,
  };
}

async function buildDuelView(
  ctx: Pick<MutationCtx, "db" | "storage">,
  duel: Doc<"duels">,
  side: DuelSide,
) {
  const myResult = getResultForSide(duel, side);
  const opponentResult =
    side === "challenger" ? duel.opponentResult : duel.challengerResult;
  const nextIndex = myResult.perQuestion.length;
  const hasCurrent =
    duel.status === "awaiting_opponent" &&
    !myResult.completedAt &&
    nextIndex < duel.questionChecksums.length;

  const challenger = await ctx.db.get(duel.challengerId);
  const opponent = duel.opponentId ? await ctx.db.get(duel.opponentId) : null;

  return {
    duelId: duel._id,
    role: side,
    status: duel.status,
    type: duel.type,
    category: duel.category ?? null,
    sport: duel.sport ?? null,
    difficulty: duel.difficulty,
    mode: duel.mode,
    createdAt: duel.createdAt,
    expiresAt: duel.expiresAt,
    questionCount: duel.questionChecksums.length,
    questionChecksums:
      duel.status === "awaiting_opponent" ? [] : duel.questionChecksums,
    seed: duel.status === "awaiting_opponent" ? null : duel.seed,
    linkCode: side === "challenger" ? duel.linkCode ?? null : null,
    challenger: {
      id: duel.challengerId,
      username: challenger?.username ?? "Unknown",
      displayName: challenger?.displayName ?? challenger?.username ?? "Unknown",
    },
    opponent: duel.opponentId
      ? {
          id: duel.opponentId,
          username:
            opponent?.username ?? duel.opponentUsernameSnapshot ?? "Opponent",
          displayName:
            opponent?.displayName ??
            opponent?.username ??
            duel.opponentUsernameSnapshot ??
            "Opponent",
        }
      : {
          id: null,
          username: duel.opponentUsernameSnapshot ?? "Link opponent",
          displayName: duel.opponentUsernameSnapshot ?? "Link opponent",
        },
    myResult: sanitizeOwnResult(myResult),
    opponentResult: sanitizeOpponentResult(opponentResult),
    winnerId: duel.winnerId ?? null,
    currentQuestion: hasCurrent
      ? await publicQuestion(ctx, duel.questionChecksums[nextIndex])
      : null,
  };
}

async function queueNotification(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  args: {
    userId: Id<"users">;
    duelId: Id<"duels">;
    kind: "duel_resolved" | "opponent_beat_score" | "duel_near_expiry";
    title: string;
    body: string;
    now: number;
  },
) {
  const existing = await ctx.db
    .query("challengeNotifications")
    .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
    .collect();
  if (
    existing.some(
      (notification) =>
        notification.duelId === args.duelId && notification.kind === args.kind,
    )
  ) {
    return;
  }

  const notificationId = await ctx.db.insert("challengeNotifications", {
    userId: args.userId,
    duelId: args.duelId,
    kind: args.kind,
    title: args.title,
    body: args.body,
    createdAt: args.now,
    emailStatus: "queued",
  });

  const user = await ctx.db.get(args.userId);
  if (user?.email) {
    await ctx.scheduler.runAfter(0, internal.notifications.sendDuelEmail, {
      notificationId,
      to: user.email,
      subject: args.title,
      text: args.body,
    });
  } else {
    await ctx.db.patch(notificationId, { emailStatus: "skipped" });
  }
}

async function applyRivalryOnce(
  ctx: Pick<MutationCtx, "db">,
  duel: Doc<"duels">,
  winnerId: Id<"users"> | undefined,
  now: number,
) {
  if (duel.rivalryAppliedAt || !duel.opponentId) return false;
  if (!(await areRankedEligibleUsers(ctx, [duel.challengerId, duel.opponentId]))) {
    return true;
  }

  const { pairKey, userAId, userBId } = pairKeyFor(
    duel.challengerId,
    duel.opponentId,
  );
  const aWon = winnerId === userAId;
  const bWon = winnerId === userBId;
  const draw = !winnerId;

  const existing = await ctx.db
    .query("rivalries")
    .withIndex("by_pair", (q) => q.eq("pairKey", pairKey))
    .first();

  if (existing) {
    const currentStreakHolderId = draw
      ? undefined
      : existing.currentStreakHolderId === winnerId
        ? winnerId
        : winnerId;
    const currentStreakLen = draw
      ? 0
      : existing.currentStreakHolderId === winnerId
        ? existing.currentStreakLen + 1
        : 1;
    await ctx.db.patch(existing._id, {
      aWins: existing.aWins + (aWon ? 1 : 0),
      bWins: existing.bWins + (bWon ? 1 : 0),
      draws: existing.draws + (draw ? 1 : 0),
      currentStreakHolderId,
      currentStreakLen,
      lastDuelId: duel._id,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("rivalries", {
      pairKey,
      userAId,
      userBId,
      aWins: aWon ? 1 : 0,
      bWins: bWon ? 1 : 0,
      draws: draw ? 1 : 0,
      currentStreakHolderId: winnerId,
      currentStreakLen: winnerId ? 1 : 0,
      lastDuelId: duel._id,
      updatedAt: now,
    });
  }

  return true;
}

async function resolveDuelIfReady(
  ctx: Pick<MutationCtx, "db" | "scheduler">,
  duelId: Id<"duels">,
  now: number,
  forceExpired = false,
) {
  const duel = await ctx.db.get(duelId);
  if (!duel || duel.status !== "awaiting_opponent") return duel;

  const challengerDone = !!duel.challengerResult?.completedAt;
  const opponentDone = !!duel.opponentResult?.completedAt;
  const expired = forceExpired || now >= duel.expiresAt;
  if (!expired && (!challengerDone || !opponentDone)) return duel;

  const challengerScore = duel.challengerResult?.score ?? 0;
  const opponentScore = duel.opponentResult?.score ?? 0;
  const winnerId =
    challengerScore > opponentScore
      ? duel.challengerId
      : opponentScore > challengerScore && duel.opponentId
        ? duel.opponentId
        : undefined;
  const status = expired && (!challengerDone || !opponentDone)
    ? "expired"
    : "resolved";

  const rivalryApplied = await applyRivalryOnce(ctx, duel, winnerId, now);

  await ctx.db.patch(duelId, {
    status,
    winnerId,
    resolvedAt: now,
    ...(rivalryApplied ? { rivalryAppliedAt: now } : {}),
  });

  await queueNotification(ctx, {
    userId: duel.challengerId,
    duelId,
    kind: "duel_resolved",
    title: "Duel resolved",
    body: `Your ${duel.type} duel has been resolved.`,
    now,
  });
  if (duel.opponentId) {
    await queueNotification(ctx, {
      userId: duel.opponentId,
      duelId,
      kind: "duel_resolved",
      title: "Duel resolved",
      body: `Your ${duel.type} duel has been resolved.`,
      now,
    });
  }

  return await ctx.db.get(duelId);
}

async function createDuelDocument(
  ctx: Pick<MutationCtx, "db">,
  args: {
    challengerId: Id<"users">;
    opponentId?: Id<"users">;
    opponentUsernameSnapshot?: string;
    type: "sports" | "knowledge";
    category?: string;
    sport?: string;
    difficulty: "easy" | "intermediate" | "hard";
    mode: string;
    linkCode?: string;
    rematchOfDuelId?: Id<"duels">;
  },
) {
  const mode = normalizeMode(args.mode);
  const now = Date.now();
  const seed = hashString(
    `${args.challengerId}:${args.opponentId ?? args.linkCode ?? "link"}:${args.type}:${args.sport ?? "knowledge"}:${args.category ?? ""}:${args.difficulty}:${mode}:${now}:${randomCode("", 8)}`,
  );
  const questionChecksums = await getQuestionChecksumsForDuel(ctx, {
    type: args.type,
    category: mode === "came_first" ? "which_came_first" : args.category,
    sport: args.type === "knowledge" ? "knowledge" : args.sport,
    difficulty: args.difficulty,
    mode,
    seed,
  });

  return await ctx.db.insert("duels", {
    challengerId: args.challengerId,
    opponentId: args.opponentId,
    opponentUsernameSnapshot: args.opponentUsernameSnapshot,
    type: args.type,
    category: mode === "came_first" ? "which_came_first" : args.category,
    sport: args.type === "knowledge" ? "knowledge" : args.sport,
    difficulty: args.difficulty,
    mode,
    seed,
    questionChecksums,
    challengerServedAt: [],
    opponentServedAt: [],
    challengerResult: emptyResult(),
    opponentResult: emptyResult(),
    status: "awaiting_opponent",
    linkCode: args.linkCode,
    rematchOfDuelId: args.rematchOfDuelId,
    createdAt: now,
    expiresAt: now + DUEL_TTL_MS,
  });
}

export const create = mutation({
  args: {
    type: v.union(v.literal("sports"), v.literal("knowledge")),
    category: v.optional(v.string()),
    sport: v.optional(v.string()),
    difficulty: v.union(
      v.literal("easy"),
      v.literal("intermediate"),
      v.literal("hard"),
    ),
    mode: v.string(),
    opponentUserId: v.optional(v.id("users")),
    viaLink: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const viaLink = args.viaLink === true;
    if (viaLink === !!args.opponentUserId) {
      throw new Error("Choose either opponentUserId or viaLink");
    }

    const challenger = await ctx.db.get(userId);
    if (viaLink) {
      assertUsernameUser(challenger, "Challenger");
    } else {
      assertAccountUser(challenger, "Challenger");
    }

    let opponentUsernameSnapshot: string | undefined;
    if (args.opponentUserId) {
      if (args.opponentUserId === userId) {
        throw new Error("Cannot duel yourself");
      }
      const opponent = await ctx.db.get(args.opponentUserId);
      assertAccountUser(opponent, "Opponent");
      opponentUsernameSnapshot = opponent.username;
    }

    const linkCode = viaLink ? await generateUniqueLinkCode(ctx) : undefined;
    const duelId = await createDuelDocument(ctx, {
      challengerId: userId,
      opponentId: args.opponentUserId,
      opponentUsernameSnapshot,
      type: args.type,
      category: args.category,
      sport: args.type === "knowledge" ? "knowledge" : args.sport,
      difficulty: args.difficulty,
      mode: args.mode,
      linkCode,
    });

    return { duelId, linkCode: linkCode ?? null };
  },
});

export const getMyDuel = mutation({
  args: {
    duelId: v.id("duels"),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { duelId, guestToken }) => {
    const duel = await ctx.db.get(duelId);
    if (!duel) throw new Error("Duel not found");
    const participant = await identifyParticipant(ctx, duel, guestToken);
    const current =
      Date.now() >= duel.expiresAt
        ? await resolveDuelIfReady(ctx, duelId, Date.now(), true) ?? duel
        : await ensureQuestionServed(ctx, duel, participant.side, Date.now());
    return await buildDuelView(ctx, current, participant.side);
  },
});

export const getByLinkCode = mutation({
  args: {
    linkCode: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { linkCode, guestToken }) => {
    const duel = await ctx.db
      .query("duels")
      .withIndex("by_linkCode", (q) => q.eq("linkCode", linkCode.trim()))
      .first();
    if (!duel) throw new Error("Duel not found");
    if (Date.now() >= duel.expiresAt) {
      const expired = await resolveDuelIfReady(ctx, duel._id, Date.now(), true);
      if (!expired) throw new Error("Duel expired");
      return await buildDuelView(ctx, expired, "opponent");
    }
    if (duel.status !== "awaiting_opponent") {
      throw new Error("Duel is no longer open");
    }

    const userId = await getAuthUserId(ctx);
    if (userId === duel.challengerId) {
      throw new Error("Challenger cannot claim their own link duel");
    }

    let updated = duel;
    if (userId) {
      const user = await ctx.db.get(userId);
      assertUsernameUser(user, "Opponent");
      if (duel.opponentId && duel.opponentId !== userId) {
        throw new Error("This link duel has already been claimed");
      }
      if (!duel.opponentId) {
        if (duel.opponentGuestTokenHash) {
          if (
            !guestToken ||
            guestTokenHash(guestToken) !== duel.opponentGuestTokenHash
          ) {
            throw new Error("This guest duel is already held by another token");
          }
        }
        await ctx.db.patch(duel._id, {
          opponentId: userId,
          opponentUsernameSnapshot: user?.username,
        });
        updated = {
          ...duel,
          opponentId: userId,
          opponentUsernameSnapshot: user?.username,
        } as Doc<"duels">;
      }
    } else {
      if (!guestToken) {
        throw new Error("Guest token is required for guest link duels");
      }
      if (duel.opponentId) {
        throw new Error("This link duel belongs to an account opponent");
      }
      const tokenHash = guestTokenHash(guestToken);
      if (
        duel.opponentGuestTokenHash &&
        duel.opponentGuestTokenHash !== tokenHash
      ) {
        throw new Error("This link duel has already been claimed");
      }
      if (!duel.opponentGuestTokenHash) {
        await ctx.db.patch(duel._id, {
          opponentGuestTokenHash: tokenHash,
          opponentUsernameSnapshot: "Guest opponent",
        });
        updated = {
          ...duel,
          opponentGuestTokenHash: tokenHash,
          opponentUsernameSnapshot: "Guest opponent",
        } as Doc<"duels">;
      }
    }

    const served = await ensureQuestionServed(ctx, updated, "opponent", Date.now());
    return await buildDuelView(ctx, served, "opponent");
  },
});

export const submitAnswer = mutation({
  args: {
    duelId: v.id("duels"),
    questionIndex: v.number(),
    answer: v.string(),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { duelId, questionIndex, answer, guestToken }) => {
    const duel = await ctx.db.get(duelId);
    if (!duel) throw new Error("Duel not found");
    if (duel.status !== "awaiting_opponent") {
      throw new Error("Duel is not active");
    }
    if (Date.now() >= duel.expiresAt) {
      await resolveDuelIfReady(ctx, duelId, Date.now(), true);
      throw new Error("Duel expired");
    }

    const participant = await identifyParticipant(ctx, duel, guestToken);
    const result = getResultForSide(duel, participant.side);
    if (result.completedAt) throw new Error("Duel result is locked");
    if (questionIndex !== result.perQuestion.length) {
      throw new Error("Question submitted out of order");
    }

    const checksum = duel.questionChecksums[questionIndex];
    if (!checksum) throw new Error("Question index out of range");

    const servedAt = getServedAtForSide(duel, participant.side);
    const questionServedAt = servedAt[questionIndex];
    if (!questionServedAt) {
      throw new Error("Question has not been served by the server");
    }

    const question = await ctx.db
      .query("quizQuestions")
      .withIndex("by_checksum", (q) => q.eq("checksum", checksum))
      .first();
    if (!question) throw new Error("Question not found");

    const now = Date.now();
    const timeTaken = Math.max(0, (now - questionServedAt) / 1000);
    const correct =
      normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer);
    const score = correct
      ? calculateTimeScore(QUESTION_BASE_POINTS, timeTaken)
      : 0;
    const nextPerQuestion: DuelQuestionResult[] = [
      ...result.perQuestion,
      {
        questionIndex,
        checksum,
        answer,
        correct,
        score,
        timeTaken,
        servedAt: questionServedAt,
        answeredAt: now,
      },
    ];
    const nextResult: DuelResult = {
      ...result,
      score: result.score + score,
      perQuestion: nextPerQuestion,
    };

    if (questionIndex + 1 < duel.questionChecksums.length) {
      servedAt[questionIndex + 1] = now;
    }

    await ctx.db.patch(
      duelId,
      patchForSide(participant.side, {
        result: nextResult,
        servedAt,
      }),
    );

    await ctx.db.patch(question._id, {
      usageCount: question.usageCount + 1,
      timesAnswered: question.timesAnswered + 1,
      timesCorrect: question.timesCorrect + (correct ? 1 : 0),
    });

    if (
      participant.side === "opponent" &&
      duel.challengerResult?.completedAt &&
      nextResult.score > duel.challengerResult.score
    ) {
      await queueNotification(ctx, {
        userId: duel.challengerId,
        duelId,
        kind: "opponent_beat_score",
        title: "Your duel score was beaten",
        body: "Your opponent has passed your async duel score.",
        now,
      });
    }

    return {
      correct,
      score,
      totalScore: nextResult.score,
      timeTaken,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? null,
    };
  },
});

export const complete = mutation({
  args: {
    duelId: v.id("duels"),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { duelId, guestToken }) => {
    const duel = await ctx.db.get(duelId);
    if (!duel) throw new Error("Duel not found");
    if (duel.status !== "awaiting_opponent") {
      return { status: duel.status, winnerId: duel.winnerId ?? null };
    }

    const participant = await identifyParticipant(ctx, duel, guestToken);
    const result = getResultForSide(duel, participant.side);
    if (!result.completedAt) {
      if (result.perQuestion.length < duel.questionChecksums.length) {
        throw new Error("All duel questions must be answered before complete");
      }
      await ctx.db.patch(
        duelId,
        patchForSide(participant.side, {
          result: { ...result, completedAt: Date.now() },
        }),
      );
    }

    const resolved = await resolveDuelIfReady(ctx, duelId, Date.now(), false);
    return {
      status: resolved?.status ?? "awaiting_opponent",
      winnerId: resolved?.winnerId ?? null,
    };
  },
});

export const decline = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const duel = await ctx.db.get(duelId);
    if (!duel || duel.opponentId !== userId) {
      throw new Error("Duel not found");
    }
    if (duel.status !== "awaiting_opponent") {
      return { status: duel.status };
    }
    await ctx.db.patch(duelId, { status: "declined", resolvedAt: Date.now() });
    return { status: "declined" };
  },
});

export const attachGuestResult = mutation({
  args: {
    duelId: v.id("duels"),
    guestToken: v.string(),
  },
  handler: async (ctx, { duelId, guestToken }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    assertUsernameUser(user, "Opponent");

    const duel = await ctx.db.get(duelId);
    if (!duel) throw new Error("Duel not found");
    if (duel.opponentId && duel.opponentId !== userId) {
      throw new Error("Duel already attached to another account");
    }
    if (duel.challengerId === userId) {
      throw new Error("Cannot attach guest result to challenger");
    }
    if (!duel.opponentGuestTokenHash) {
      throw new Error("No guest result is pending for this duel");
    }
    if (guestTokenHash(guestToken) !== duel.opponentGuestTokenHash) {
      throw new Error("Guest token does not match this duel");
    }

    await ctx.db.patch(duelId, {
      opponentId: userId,
      opponentUsernameSnapshot: user?.username,
    });

    const updated = await ctx.db.get(duelId);
    if (!updated) throw new Error("Duel not found");
    if (
      updated.status === "resolved" ||
      updated.status === "expired" ||
      (updated.challengerResult?.completedAt && updated.opponentResult?.completedAt)
    ) {
      const now = Date.now();
      const challengerScore = updated.challengerResult?.score ?? 0;
      const opponentScore = updated.opponentResult?.score ?? 0;
      const winnerId =
        challengerScore > opponentScore
          ? updated.challengerId
          : opponentScore > challengerScore
            ? userId
            : undefined;
      const rivalryApplied = await applyRivalryOnce(
        ctx,
        { ...updated, opponentId: userId } as Doc<"duels">,
        winnerId,
        now,
      );
      await ctx.db.patch(duelId, {
        winnerId,
        ...(rivalryApplied ? { rivalryAppliedAt: now } : {}),
      });
    }

    return { attached: true };
  },
});

export const rematch = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const duel = await ctx.db.get(duelId);
    if (!duel) throw new Error("Duel not found");
    if (userId !== duel.challengerId && userId !== duel.opponentId) {
      throw new Error("Not authorized for this duel");
    }

    const opponentId =
      userId === duel.challengerId ? duel.opponentId : duel.challengerId;
    const viaLink = !opponentId;
    const linkCode = viaLink ? await generateUniqueLinkCode(ctx) : undefined;
    const user = await ctx.db.get(userId);
    if (viaLink) {
      assertUsernameUser(user, "Challenger");
    } else {
      assertAccountUser(user, "Challenger");
    }
    const opponent = opponentId ? await ctx.db.get(opponentId) : null;
    if (opponentId) assertAccountUser(opponent, "Opponent");

    const newDuelId = await createDuelDocument(ctx, {
      challengerId: userId,
      opponentId,
      opponentUsernameSnapshot:
        opponent?.username ?? (viaLink ? "Link opponent" : undefined),
      type: duel.type,
      category: duel.category,
      sport: duel.sport,
      difficulty: duel.difficulty,
      mode: duel.mode,
      linkCode,
      rematchOfDuelId: duelId,
    });

    return { duelId: newDuelId, linkCode: linkCode ?? null };
  },
});

type DuelSummary = {
  duelId: Id<"duels">;
  role: DuelSide;
  status: Doc<"duels">["status"];
  type: Doc<"duels">["type"];
  category: string | null;
  sport: string | null;
  difficulty: Doc<"duels">["difficulty"];
  mode: string;
  createdAt: number;
  expiresAt: number;
  resolvedAt: number | null;
  questionCount: number;
  linkCode: string | null;
  myScore: number;
  myAnsweredCount: number;
  myCompleted: boolean;
  opponentScore: number;
  opponentAnsweredCount: number;
  opponentCompleted: boolean;
  opponent: {
    userId: Id<"users"> | null;
    username: string;
    displayName: string;
  };
  winnerId: Id<"users"> | null;
  rematchOfDuelId: Id<"duels"> | null;
  bucket: "your_turn" | "awaiting_opponent" | "resolved";
};

async function summarizeForSide(
  ctx: Pick<QueryCtx, "db">,
  duel: Doc<"duels">,
  side: DuelSide,
): Promise<DuelSummary> {
  const myResult = getResultForSide(duel, side);
  const opponentResult =
    side === "challenger" ? duel.opponentResult : duel.challengerResult;
  const myCompleted = !!myResult.completedAt;
  const opponentCompleted = !!opponentResult?.completedAt;
  const opponentUserId =
    side === "challenger" ? duel.opponentId ?? null : duel.challengerId;
  const opponentUser = opponentUserId ? await ctx.db.get(opponentUserId) : null;

  let bucket: DuelSummary["bucket"] = "awaiting_opponent";
  if (duel.status === "awaiting_opponent") {
    bucket = myCompleted ? "awaiting_opponent" : "your_turn";
  } else {
    bucket = "resolved";
  }

  const fallbackName =
    side === "challenger"
      ? duel.opponentUsernameSnapshot ?? "Link opponent"
      : "Challenger";

  return {
    duelId: duel._id,
    role: side,
    status: duel.status,
    type: duel.type,
    category: duel.category ?? null,
    sport: duel.sport ?? null,
    difficulty: duel.difficulty,
    mode: duel.mode,
    createdAt: duel.createdAt,
    expiresAt: duel.expiresAt,
    resolvedAt: duel.resolvedAt ?? null,
    questionCount: duel.questionChecksums.length,
    linkCode: side === "challenger" ? duel.linkCode ?? null : null,
    myScore: myResult.score,
    myAnsweredCount: myResult.perQuestion.length,
    myCompleted,
    opponentScore: opponentResult?.score ?? 0,
    opponentAnsweredCount: opponentResult?.perQuestion.length ?? 0,
    opponentCompleted,
    opponent: {
      userId: opponentUserId,
      username: opponentUser?.username ?? fallbackName,
      displayName:
        opponentUser?.displayName ?? opponentUser?.username ?? fallbackName,
    },
    winnerId: duel.winnerId ?? null,
    rematchOfDuelId: duel.rematchOfDuelId ?? null,
    bucket,
  };
}

async function buildDuelStatus(
  ctx: Pick<QueryCtx, "db">,
  duel: Doc<"duels">,
  side: DuelSide,
) {
  const summary = await summarizeForSide(ctx, duel, side);
  return {
    duelId: summary.duelId,
    role: summary.role,
    status: summary.status,
    resolvedAt: summary.resolvedAt,
    questionCount: summary.questionCount,
    myScore: summary.myScore,
    myAnsweredCount: summary.myAnsweredCount,
    myCompleted: summary.myCompleted,
    opponentScore: summary.opponentScore,
    opponentAnsweredCount: summary.opponentAnsweredCount,
    opponentCompleted: summary.opponentCompleted,
    winnerId:
      summary.status === "resolved" || summary.status === "expired"
        ? summary.winnerId
        : null,
    bucket: summary.bucket,
  };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { yourTurn: [], awaiting: [], resolved: [] };
    }

    const asChallenger = await ctx.db
      .query("duels")
      .withIndex("by_challenger", (q) => q.eq("challengerId", userId))
      .collect();
    const asOpponent = await ctx.db
      .query("duels")
      .withIndex("by_opponent_status", (q) => q.eq("opponentId", userId))
      .collect();

    const seen = new Set<string>();
    const rows: { duel: Doc<"duels">; side: DuelSide }[] = [];
    for (const duel of asChallenger) {
      if (seen.has(duel._id)) continue;
      seen.add(duel._id);
      rows.push({ duel, side: "challenger" });
    }
    for (const duel of asOpponent) {
      if (seen.has(duel._id)) continue;
      seen.add(duel._id);
      rows.push({ duel, side: "opponent" });
    }

    const summaries = await Promise.all(
      rows.map(({ duel, side }) => summarizeForSide(ctx, duel, side)),
    );

    const yourTurn = summaries
      .filter((s) => s.bucket === "your_turn")
      .sort((a, b) => a.expiresAt - b.expiresAt);
    const awaiting = summaries
      .filter((s) => s.bucket === "awaiting_opponent")
      .sort((a, b) => b.createdAt - a.createdAt);
    const resolved = summaries
      .filter((s) => s.bucket === "resolved")
      .sort(
        (a, b) =>
          (b.resolvedAt ?? b.createdAt) - (a.resolvedAt ?? a.createdAt),
      )
      .slice(0, 30);

    return { yourTurn, awaiting, resolved };
  },
});

export const getDuelStatus = query({
  args: {
    duelId: v.id("duels"),
    guestToken: v.optional(v.string()),
  },
  handler: async (ctx, { duelId, guestToken }) => {
    const duel = await ctx.db.get(duelId);
    if (!duel) throw new Error("Duel not found");
    const participant = await identifyParticipant(ctx, duel, guestToken);
    return await buildDuelStatus(ctx, duel, participant.side);
  },
});

export const expireStaleDuels = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 200 }) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("duels")
      .withIndex("by_status_expires", (q) =>
        q.eq("status", "awaiting_opponent").lte("expiresAt", now),
      )
      .take(Math.min(limit, 500));

    let resolved = 0;
    for (const duel of stale) {
      await resolveDuelIfReady(ctx, duel._id, now, true);
      resolved++;
    }

    const nearExpiry = await ctx.db
      .query("duels")
      .withIndex("by_status_expires", (q) =>
        q.eq("status", "awaiting_opponent").lte("expiresAt", now + NEAR_EXPIRY_MS),
      )
      .take(Math.min(limit, 500));
    let nudged = 0;
    for (const duel of nearExpiry) {
      if (duel.expiresAt <= now || duel.lastNearExpiryNotifiedAt) continue;
      if (duel.opponentId && !duel.opponentResult?.completedAt) {
        await queueNotification(ctx, {
          userId: duel.opponentId,
          duelId: duel._id,
          kind: "duel_near_expiry",
          title: "Duel expiring soon",
          body: "An async duel is close to expiring.",
          now,
        });
        await ctx.db.patch(duel._id, { lastNearExpiryNotifiedAt: now });
        nudged++;
      }
    }

    return { resolved, nudged };
  },
});
