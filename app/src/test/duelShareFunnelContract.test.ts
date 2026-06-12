import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const authMock = vi.hoisted(() => ({
  getAuthUserId: vi.fn(async () => null as string | null),
}));

vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMock.getAuthUserId,
  convexAuth: () => ({
    auth: {},
    signIn: () => {},
    signOut: () => {},
    store: {},
    isAuthenticated: () => false,
  }),
}));

import {
  buildCrawlerHtml,
  buildShareCardSvg,
  buildShareCardTexts,
  cardVariantToken,
  escapeHtml,
  isCrawlerUserAgent,
  parseShareRoutePath,
  resolveSharePublicBase,
} from "../../convex/lib/duelShareCard";
import * as duelShare from "../../convex/duelShare";
import {
  isSyntheticEvent,
  isSyntheticUsername,
  recordChallengeIssued,
  recordFirstMatchComplete,
} from "../../convex/funnel";
import * as funnel from "../../convex/funnel";
import { buildShareUrl } from "../lib/duel";

function handlerOf<T>(fn: T): (ctx: unknown, args: unknown) => Promise<unknown> {
  const registered = fn as {
    _handler?: (ctx: unknown, args: unknown) => Promise<unknown>;
  };
  if (typeof registered._handler !== "function") {
    throw new Error("not a Convex registered function with a handler");
  }
  return registered._handler;
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A duel row carrying everything the share surface must never expose.
const SENSITIVE_DUEL = {
  _id: "duel_1",
  challengerId: "user_challenger",
  opponentId: "user_opponent",
  opponentGuestTokenHash: "deadbeefdeadbeef",
  opponentUsernameSnapshot: "secret_opponent",
  type: "sports",
  sport: "football",
  difficulty: "easy",
  mode: "quiz",
  seed: "secret_seed",
  questionChecksums: ["secret_checksum_1", "secret_checksum_2"],
  challengerResult: {
    score: 740,
    completedAt: 1000,
    perQuestion: [
      {
        questionIndex: 0,
        checksum: "secret_checksum_1",
        answer: "secret answer",
        correct: true,
        score: 100,
        timeTaken: 2,
        servedAt: 1,
        answeredAt: 3,
      },
    ],
  },
  opponentResult: { score: 310, perQuestion: [] },
  status: "awaiting_opponent",
  linkCode: "DQTESTLINK01",
  createdAt: 1,
  expiresAt: 9999999999999,
};

const CHALLENGER_DOC = {
  _id: "user_challenger",
  username: "hamza",
  displayName: "Hamza",
  email: "private@example.com",
};

describe("share route crawler/human classification", () => {
  it("classifies link-preview fetchers as crawlers", () => {
    const crawlerAgents = [
      "WhatsApp/2.23.20.0",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      // iMessage masquerades as facebookexternalhit + Twitterbot
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
      "Twitterbot/1.0",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "TelegramBot (like TwitterBot)",
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
      "LinkedInBot/1.0",
      "Googlebot/2.1 (+http://www.google.com/bot.html)",
      "curl/8.5.0",
    ];
    for (const ua of crawlerAgents) {
      expect(isCrawlerUserAgent(ua), ua).toBe(true);
    }
  });

  it("classifies real browsers as humans", () => {
    const humanAgents = [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    ];
    for (const ua of humanAgents) {
      expect(isCrawlerUserAgent(ua), ua).toBe(false);
    }
  });

  it("treats a missing user-agent as a crawler (never logs a tap)", () => {
    expect(isCrawlerUserAgent(null)).toBe(true);
    expect(isCrawlerUserAgent("")).toBe(true);
  });
});

describe("share route path parsing", () => {
  it("parses page and card paths", () => {
    expect(parseShareRoutePath("/s/d/DQTESTLINK01")).toEqual({
      linkCode: "DQTESTLINK01",
      kind: "page",
    });
    expect(parseShareRoutePath("/s/d/DQTESTLINK01/card.png")).toEqual({
      linkCode: "DQTESTLINK01",
      kind: "card",
    });
  });

  it("rejects malformed or hostile paths", () => {
    expect(parseShareRoutePath("/s/d/")).toBeNull();
    expect(parseShareRoutePath("/s/d/%3Cscript%3E")).toBeNull();
    expect(parseShareRoutePath("/s/d/../secrets")).toBeNull();
    expect(parseShareRoutePath("/other/DQTESTLINK01")).toBeNull();
  });
});

describe("OG card content contract", () => {
  it("renders the score-to-beat taunt when the challenger completed", () => {
    const texts = buildShareCardTexts({
      found: true,
      challengerName: "Hamza",
      challengerScore: 740,
    });
    expect(texts.title).toBe("Hamza scored 740. Your move.");
    expect(texts.line2).toBe("scored 740.");
  });

  it("renders the challenge taunt before the challenger completes", () => {
    const texts = buildShareCardTexts({
      found: true,
      challengerName: "Hamza",
      challengerScore: null,
    });
    expect(texts.title).toBe("Hamza challenged you — can you beat them?");
  });

  it("falls back to a generic non-personalized card on lookup failure", () => {
    const texts = buildShareCardTexts({
      found: false,
      challengerName: null,
      challengerScore: null,
    });
    expect(texts.title).toBe("You've been challenged on VerveQ");
    expect(JSON.stringify(texts)).not.toContain("null");
  });

  it("escapes hostile display names in HTML and SVG", () => {
    const hostile = `<script>"x"&'y'`;
    const texts = buildShareCardTexts({
      found: true,
      challengerName: hostile,
      challengerScore: 5,
    });
    const html = buildCrawlerHtml({
      title: texts.title,
      description: texts.description,
      imageUrl: "https://example.convex.site/s/d/DQX/card.png?v=abc",
      duelUrl: "https://verveq.com/duel/DQX",
    });
    const svg = buildShareCardSvg(texts);
    expect(html).not.toContain("<script>");
    expect(svg).not.toContain("<script>");
    expect(escapeHtml(hostile)).not.toMatch(/[<>"]/);
  });

  it("keeps the score and PII out of every URL (one-way variant token)", () => {
    const withScore = cardVariantToken("DQTESTLINK01", 740);
    const pending = cardVariantToken("DQTESTLINK01", null);
    expect(withScore).toMatch(/^[0-9a-f]{16}$/);
    expect(withScore).not.toBe(pending);
    // Same inputs → same token (stable cache key); score change busts it.
    expect(cardVariantToken("DQTESTLINK01", 740)).toBe(withScore);
    expect(cardVariantToken("DQTESTLINK01", 741)).not.toBe(withScore);
  });

  it("crawler HTML carries OG + twitter card tags and no duel internals", () => {
    const texts = buildShareCardTexts({
      found: true,
      challengerName: "Hamza",
      challengerScore: 740,
    });
    const html = buildCrawlerHtml({
      title: texts.title,
      description: texts.description,
      imageUrl: "https://example.convex.site/s/d/DQTESTLINK01/card.png?v=abc",
      duelUrl: "https://verveq.com/duel/DQTESTLINK01",
    });
    for (const tag of [
      'property="og:title"',
      'property="og:description"',
      'property="og:image"',
      'property="og:url"',
      'name="twitter:card" content="summary_large_image"',
    ]) {
      expect(html).toContain(tag);
    }
    // Nothing about the opponent, answers, checksums, aliases, or emails.
    for (const forbidden of [
      "secret_opponent",
      "secret_checksum",
      "secret answer",
      "secret_seed",
      "deadbeefdeadbeef",
      "private@example.com",
      "310", // opponent score
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });
});

describe("share URL branding", () => {
  it("FE share links live on the vanity host by default", () => {
    expect(buildShareUrl("DQTESTLINK01")).toBe(
      "https://verveq.com/s/d/DQTESTLINK01",
    );
  });

  it("FE share base is overridable for non-prod environments", () => {
    vi.stubEnv("VITE_SHARE_BASE_URL", "https://staging.verveq.com/");
    expect(buildShareUrl("DQTESTLINK01")).toBe(
      "https://staging.verveq.com/s/d/DQTESTLINK01",
    );
    vi.unstubAllEnvs();
  });

  it("og:image base prefers the configured public host over the request origin", () => {
    const origin = "https://example.convex.site";
    expect(resolveSharePublicBase("https://verveq.com", origin)).toBe(
      "https://verveq.com",
    );
    expect(resolveSharePublicBase("https://verveq.com/", origin)).toBe(
      "https://verveq.com",
    );
    // Unset or malformed config fails safe to the deployment's own origin.
    expect(resolveSharePublicBase(undefined, origin)).toBe(origin);
    expect(resolveSharePublicBase("  ", origin)).toBe(origin);
    expect(resolveSharePublicBase("verveq.com", origin)).toBe(origin);
    expect(resolveSharePublicBase("https://verveq.com/extra/path", origin)).toBe(
      origin,
    );
  });
});

describe("synthetic test-actor exclusion", () => {
  it("flags known smoke/QA username prefixes only", () => {
    expect(isSyntheticUsername("drop_smoke_a_x7")).toBe(true);
    expect(isSyntheticUsername("qa_mobile_2")).toBe(true);
    expect(isSyntheticUsername("coldqa32452")).toBe(true);
    expect(isSyntheticUsername("hamza")).toBe(false);
    expect(isSyntheticUsername("aqa_player")).toBe(false);
    // "coldqa" must not widen to "cold" — usernames are user-chosen.
    expect(isSyntheticUsername("colduser99")).toBe(false);
    expect(isSyntheticUsername("cold")).toBe(false);
    expect(isSyntheticUsername(undefined)).toBe(false);
  });

  it("excludes events by synthetic actor and by synthetic challenger ref", () => {
    const synthetic = new Set(["user_smoke"]);
    // Account event from the smoke account itself.
    expect(
      isSyntheticEvent({ actor: "user:user_smoke" } as never, synthetic),
    ).toBe(true);
    // Anonymous link_tap on a smoke duel — actor carries no identity, the
    // challenger ref is what ties it to the smoke run.
    expect(
      isSyntheticEvent(
        { actor: "anon", refChallengerId: "user_smoke" } as never,
        synthetic,
      ),
    ).toBe(true);
    // Guest completion on a smoke duel.
    expect(
      isSyntheticEvent(
        { actor: "guest:deadbeef", refChallengerId: "user_smoke" } as never,
        synthetic,
      ),
    ).toBe(true);
    // The smoke run's deliberate bogus-code tap (no duel, no user tie).
    expect(
      isSyntheticEvent(
        { actor: "anon", refLinkCode: "DQZZZZZZZZ99" } as never,
        synthetic,
      ),
    ).toBe(true);
    // Real traffic survives.
    expect(
      isSyntheticEvent(
        { actor: "user:user_real", refChallengerId: "user_captain" } as never,
        synthetic,
      ),
    ).toBe(false);
    expect(isSyntheticEvent({ actor: "anon" } as never, synthetic)).toBe(false);
    expect(
      isSyntheticEvent(
        { actor: "anon", refLinkCode: "DQREALCODE01" } as never,
        synthetic,
      ),
    ).toBe(false);
  });

  it("dropTestMetrics drops coldqa* actors from every aggregation but keeps cold* players", async () => {
    const now = 10_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const users = [
      { _id: "user_coldqa", username: "coldqa32452", _creationTime: 1000 },
      { _id: "user_colduser", username: "colduser99", _creationTime: 1000 },
      { _id: "user_smoke", username: "drop_smoke_1", _creationTime: 1000 },
      { _id: "user_qa", username: "qa_mobile_2", _creationTime: 1000 },
    ];
    const events = [
      // coldqa32452's own events across all four types — all must vanish.
      { type: "link_tap", actor: "user:user_coldqa", ts: 2000 },
      { type: "challenge_issued", actor: "user:user_coldqa", ts: 2000 },
      {
        type: "first_match_complete",
        actor: "user:user_coldqa",
        refLinkCode: "DQCOLDQA0001",
        ts: 2000,
        meta: { side: "opponent" },
      },
      { type: "defeated_player_return", actor: "user:user_coldqa", ts: 2000 },
      // Attribution chain: anon tap on a coldqa duel must vanish too.
      {
        type: "link_tap",
        actor: "anon",
        refLinkCode: "DQCOLDQA0001",
        refChallengerId: "user_coldqa",
        ts: 2000,
      },
      // Existing exclusions still hold.
      { type: "link_tap", actor: "user:user_smoke", ts: 2000 },
      { type: "challenge_issued", actor: "user:user_qa", ts: 2000 },
      // colduser99 is a real player — their events must all survive.
      {
        type: "link_tap",
        actor: "user:user_colduser",
        refLinkCode: "DQREAL000001",
        ts: 2000,
      },
      { type: "challenge_issued", actor: "user:user_colduser", ts: 2000 },
      {
        type: "first_match_complete",
        actor: "user:user_colduser",
        refLinkCode: "DQREAL000001",
        ts: 2000,
        meta: { side: "opponent" },
      },
    ];
    const marks = [
      { userId: "user_coldqa", duelId: "duel_c", defeatedAt: now - 1000 },
      { userId: "user_colduser", duelId: "duel_r", defeatedAt: now - 1000 },
    ];
    const tableRows = (table: string) =>
      table === "users" ? users : table === "funnelEvents" ? events : marks;
    const db = {
      query: (table: string) => ({
        take: async () => tableRows(table),
        withIndex: (
          _name: string,
          qb: (q: Record<string, unknown>) => unknown,
        ) => {
          const constraints: Array<{
            op: "eq" | "gte" | "lt";
            field: string;
            value: unknown;
          }> = [];
          const q = {
            eq: (field: string, value: unknown) => {
              constraints.push({ op: "eq", field, value });
              return q;
            },
            gte: (field: string, value: unknown) => {
              constraints.push({ op: "gte", field, value });
              return q;
            },
            lt: (field: string, value: unknown) => {
              constraints.push({ op: "lt", field, value });
              return q;
            },
          };
          qb(q as never);
          const rows = tableRows(table).filter((row) =>
            constraints.every(({ op, field, value }) => {
              const actual = (row as Record<string, unknown>)[field] as never;
              if (op === "eq") return actual === value;
              if (op === "gte") return actual >= (value as never);
              return actual < (value as never);
            }),
          );
          return { take: async () => rows };
        },
      }),
      get: async (id: string) => users.find((u) => u._id === id) ?? null,
    };
    const metrics = (await handlerOf(funnel.dropTestMetrics)({ db }, {})) as {
      excludedSyntheticActors: number;
      counts: Record<string, number>;
      linkTapToFirstMatch: { tappedLinks: number; convertedLinks: number };
      newPlayersIssuingChallengeWithin48h: { newPlayers: number };
    };
    // coldqa32452, drop_smoke_1, qa_mobile_2 — but never colduser99.
    expect(metrics.excludedSyntheticActors).toBe(3);
    expect(metrics.counts).toMatchObject({
      link_tap: 1,
      challenge_issued: 1,
      first_match_complete: 1,
      defeated_player_return: 0,
      defeatMarks: 1,
    });
    expect(metrics.linkTapToFirstMatch).toEqual({
      tappedLinks: 1,
      convertedLinks: 1,
    });
    expect(metrics.newPlayersIssuingChallengeWithin48h.newPlayers).toBe(1);
  });
});

describe("duelShare server data contract", () => {
  it("exposes only the challenger display label and score", async () => {
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({ first: async () => SENSITIVE_DUEL }),
        }),
        get: async () => CHALLENGER_DOC,
      },
    };
    const result = (await handlerOf(duelShare.getShareCardData)(ctx, {
      linkCode: "DQTESTLINK01",
    })) as Record<string, unknown>;
    expect(result).toEqual({
      found: true,
      challengerName: "Hamza",
      challengerScore: 740,
    });
    expect(Object.keys(result).sort()).toEqual([
      "challengerName",
      "challengerScore",
      "found",
    ]);
  });

  it("hides the score until the challenger has completed", async () => {
    const pendingDuel = {
      ...SENSITIVE_DUEL,
      challengerResult: { score: 200, perQuestion: [] },
    };
    const ctx = {
      db: {
        query: () => ({ withIndex: () => ({ first: async () => pendingDuel }) }),
        get: async () => CHALLENGER_DOC,
      },
    };
    const result = (await handlerOf(duelShare.getShareCardData)(ctx, {
      linkCode: "DQTESTLINK01",
    })) as { challengerScore: number | null };
    expect(result.challengerScore).toBeNull();
  });

  it("degrades to found:false on unknown linkCode instead of throwing", async () => {
    const ctx = {
      db: {
        query: () => ({ withIndex: () => ({ first: async () => null }) }),
        get: async () => null,
      },
    };
    const result = await handlerOf(duelShare.getShareCardData)(ctx, {
      linkCode: "DQUNKNOWN999",
    });
    expect(result).toEqual({
      found: false,
      challengerName: null,
      challengerScore: null,
    });
  });

  it("logLinkTap inserts one anon event attributed to the duel challenger", async () => {
    const inserts: Array<{ table: string; doc: Record<string, unknown> }> = [];
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({ first: async () => SENSITIVE_DUEL }),
        }),
        insert: async (table: string, doc: Record<string, unknown>) => {
          inserts.push({ table, doc });
          return "event_1";
        },
      },
    };
    await handlerOf(duelShare.logLinkTap)(ctx, { linkCode: "DQTESTLINK01" });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe("funnelEvents");
    expect(inserts[0].doc).toMatchObject({
      type: "link_tap",
      actor: "anon",
      refLinkCode: "DQTESTLINK01",
      refChallengerId: "user_challenger",
    });
  });
});

describe("funnel event hooks", () => {
  it("first_match_complete fires once per actor", async () => {
    const inserts: Array<Record<string, unknown>> = [];
    const makeCtx = (existing: unknown) => ({
      db: {
        query: () => ({ withIndex: () => ({ first: async () => existing }) }),
        insert: async (_table: string, doc: Record<string, unknown>) => {
          inserts.push(doc);
          return "event_1";
        },
      },
    });

    const first = await recordFirstMatchComplete(
      makeCtx(null) as never,
      {
        actor: "guest:deadbeefdeadbeef",
        duel: SENSITIVE_DUEL as never,
        side: "opponent",
        now: 5000,
      },
    );
    expect(first).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      type: "first_match_complete",
      actor: "guest:deadbeefdeadbeef",
      refLinkCode: "DQTESTLINK01",
      refChallengerId: "user_challenger",
    });

    const second = await recordFirstMatchComplete(
      makeCtx(inserts[0]) as never,
      {
        actor: "guest:deadbeefdeadbeef",
        duel: SENSITIVE_DUEL as never,
        side: "opponent",
        now: 6000,
      },
    );
    expect(second).toBe(false);
    expect(inserts).toHaveLength(1);
  });

  it("challenge_issued is attributed to the issuer's recruiter", async () => {
    const inserts: Array<Record<string, unknown>> = [];
    const recruitedDuel = {
      _id: "duel_0",
      challengerId: "user_captain",
      opponentId: "user_gen1",
      createdAt: 100,
    };
    const ctx = {
      db: {
        query: () => ({
          withIndex: () => ({ collect: async () => [recruitedDuel] }),
        }),
        insert: async (_table: string, doc: Record<string, unknown>) => {
          inserts.push(doc);
          return "event_1";
        },
      },
    };
    await recordChallengeIssued(ctx as never, {
      challengerId: "user_gen1" as never,
      duelId: "duel_2" as never,
      linkCode: "DQNEWLINK001",
      viaLink: true,
      now: 9000,
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      type: "challenge_issued",
      actor: "user:user_gen1",
      refLinkCode: "DQNEWLINK001",
      refChallengerId: "user_captain",
    });
  });

  it("challenge_issued without a recruiter marks an organic captain", async () => {
    const inserts: Array<Record<string, unknown>> = [];
    const ctx = {
      db: {
        query: () => ({ withIndex: () => ({ collect: async () => [] }) }),
        insert: async (_table: string, doc: Record<string, unknown>) => {
          inserts.push(doc);
          return "event_1";
        },
      },
    };
    await recordChallengeIssued(ctx as never, {
      challengerId: "user_captain" as never,
      duelId: "duel_9" as never,
      viaLink: false,
      now: 9000,
    });
    expect(inserts[0].refChallengerId).toBeUndefined();
  });

  it("sessionHeartbeat is a no-op for unauthenticated callers", async () => {
    authMock.getAuthUserId.mockResolvedValue(null);
    const ctx = {
      db: {
        get: async () => {
          throw new Error("must not touch db");
        },
      },
    };
    const result = await handlerOf(funnel.sessionHeartbeat)(ctx, {});
    expect(result).toEqual({ ok: true });
  });

  it("sessionHeartbeat fires defeated_player_return for a stale defeat mark", async () => {
    authMock.getAuthUserId.mockResolvedValue("user_loser");
    const now = 10_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const mark = {
      _id: "mark_1",
      userId: "user_loser",
      duelId: "duel_1",
      defeatedAt: now - 2 * 60 * 60 * 1000,
    };
    const inserts: Array<Record<string, unknown>> = [];
    const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const ctx = {
      db: {
        get: async (id: string) =>
          id === "user_loser"
            ? { _id: "user_loser", lastSeenAt: undefined }
            : SENSITIVE_DUEL,
        patch: async (id: string, patch: Record<string, unknown>) => {
          patches.push({ id, patch });
        },
        query: () => ({ withIndex: () => ({ collect: async () => [mark] }) }),
        insert: async (_table: string, doc: Record<string, unknown>) => {
          inserts.push(doc);
          return "event_1";
        },
      },
    };
    await handlerOf(funnel.sessionHeartbeat)(ctx, {});
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      type: "defeated_player_return",
      actor: "user:user_loser",
      refLinkCode: "DQTESTLINK01",
      refChallengerId: "user_challenger",
    });
    expect(
      patches.some((p) => p.id === "mark_1" && p.patch.returnFiredAt === now),
    ).toBe(true);
  });

  it("sessionHeartbeat does not fire for a same-session defeat", async () => {
    authMock.getAuthUserId.mockResolvedValue("user_loser");
    const now = 10_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const mark = {
      _id: "mark_1",
      userId: "user_loser",
      duelId: "duel_1",
      defeatedAt: now - 60 * 1000, // one minute ago — same session
    };
    const inserts: Array<Record<string, unknown>> = [];
    const ctx = {
      db: {
        get: async () => ({ _id: "user_loser", lastSeenAt: undefined }),
        patch: async () => {},
        query: () => ({ withIndex: () => ({ collect: async () => [mark] }) }),
        insert: async (_table: string, doc: Record<string, unknown>) => {
          inserts.push(doc);
          return "event_1";
        },
      },
    };
    await handlerOf(funnel.sessionHeartbeat)(ctx, {});
    expect(inserts).toHaveLength(0);
  });
});
