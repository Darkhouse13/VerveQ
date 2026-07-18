/**
 * THE DRAW — share-link landing contract (Ticket I acceptance).
 *
 * Covers: slug scheme + unguessability, getSharedRun payload sanitization
 * (exact key set; zero card names / card ids / seed / choiceLog), the isToday
 * flag on both branches, the draw_share_view / draw_share_convert funnel
 * events, the completed-runs backfill, and the landing CTA (label per
 * isToday + routing to /draw).
 *
 * Runs the real convex/drawShare.ts + convex/draw.ts handlers against the
 * in-memory FakeDb (house pattern — drawServingContract.test.ts).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FakeDb, handlerOf } from "./support/drawFakeConvex";

// vi.hoisted values cannot cross a module boundary, so each suite declares
// its own auth mock rather than sharing one from test/support.
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

import * as draw from "../../convex/draw";
import * as drawSeed from "../../convex/drawSeed";
import * as drawShare from "../../convex/drawShare";
import { randomRunShareSlug } from "../../convex/lib/drawShare";
import { getTodayUTC } from "../../convex/lib/daily";
import { boardNumberForDate } from "../../convex/lib/drawDaily";
import {
  DrawShareLandingView,
  type SharedRunPayload,
} from "../pages/draw/DrawShareLanding";

const SLUG_RE = /^DR[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;

interface Env {
  db: FakeDb;
  ctx: { db: FakeDb; auth: Record<string, never> };
  settingsId: string;
  today: string;
}

async function makeEnv(): Promise<Env> {
  const db = new FakeDb();
  const ctx = { db, auth: {} as Record<string, never> };
  await handlerOf(drawSeed.seedSyntheticCards)(ctx, {});
  const settings = db.rows("drawSettings")[0];
  await db.patch(settings._id, { enabled: true, testerUserIds: [] });
  return { db, ctx, settingsId: settings._id, today: getTodayUTC() };
}

function actAs(userId: string | null) {
  authMock.getAuthUserId.mockResolvedValue(userId);
}

interface RunViewLike {
  phase: string;
  shareSlug: string | null;
}

/** Drive a fresh run to completion for the current auth user. */
async function playToCompletion(env: Env): Promise<RunViewLike> {
  let view = (await handlerOf(draw.startRun)(env.ctx, {})) as RunViewLike;
  const submit = async (choice: unknown) =>
    ((await handlerOf(draw.submitChoice)(env.ctx, { choice })) as { run: RunViewLike }).run;
  while (view.phase === "draft") view = await submit({ type: "pick", offerIndex: 0 });
  while (view.phase !== "done") {
    view =
      view.phase === "bench"
        ? await submit({ type: "bench", squadIndex: 0 })
        : await submit({ type: "push" });
  }
  return view;
}

interface SharedFound extends SharedRunPayload {
  found: true;
}

async function getShared(env: Env, slug: string): Promise<{ found: boolean } & Partial<SharedFound>> {
  return (await handlerOf(drawShare.getSharedRun)(env.ctx, { slug })) as {
    found: boolean;
  } & Partial<SharedFound>;
}

beforeEach(() => {
  authMock.getAuthUserId.mockReset();
  authMock.getAuthUserId.mockResolvedValue(null);
});

// ── slug scheme ──

describe("share slug", () => {
  it("matches the DR + 10-char unguessable scheme and never collides in practice", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const slug = randomRunShareSlug();
      expect(slug).toMatch(SLUG_RE);
      seen.add(slug);
    }
    // Crypto RNG over 31^10 ≈ 8×10^14 — 200 draws colliding would mean the
    // scheme is broken, not that we got unlucky.
    expect(seen.size).toBe(200);
  });

  it("is allocated at completion, exposed only on the done view, distinct per run", async () => {
    const env = await makeEnv();
    const alpha = await env.db.insert("users", { username: "share_alpha" });
    const beta = await env.db.insert("users", { username: "share_beta" });

    actAs(alpha);
    const startView = (await handlerOf(draw.startRun)(env.ctx, {})) as RunViewLike;
    expect(startView.shareSlug).toBeNull();
    const runRowLive = env.db.rows("drawRuns")[0];
    expect(runRowLive.shareSlug).toBeUndefined();

    const doneAlpha = await playToCompletion(env);
    expect(doneAlpha.shareSlug).toMatch(SLUG_RE);
    actAs(beta);
    const doneBeta = await playToCompletion(env);
    expect(doneBeta.shareSlug).toMatch(SLUG_RE);
    expect(doneBeta.shareSlug).not.toBe(doneAlpha.shareSlug);
  });
});

// ── payload sanitization ──

describe("getSharedRun sanitization", () => {
  it("serves ONLY the spoiler-free summary — exact keys, zero board content", async () => {
    const env = await makeEnv();
    const user = await env.db.insert("users", { username: "share_sanitize" });
    actAs(user);
    const done = await playToCompletion(env);

    const payload = await getShared(env, done.shareSlug!);
    expect(payload.found).toBe(true);
    // The key set is the contract: a new field here is a deliberate decision.
    expect(Object.keys(payload).sort()).toEqual([
      "boardNumber",
      "dateKey",
      "found",
      "identity",
      "isToday",
      "outcome",
      "score",
      "trail",
    ]);
    expect(payload.boardNumber).toBe(boardNumberForDate(env.today));
    expect(payload.dateKey).toBe(env.today);
    expect(typeof payload.score).toBe("number");
    expect(payload.trail).toMatch(/^(🟩|💥)/u);

    // Zero board contents: no card name, no card id, no seed, no choiceLog.
    const boardDoc = env.db.rows("drawDailyBoards")[0];
    const board = boardDoc.board as { rows: Array<Array<{ id: string; name: string }>> };
    const cards = board.rows.flat();
    expect(cards.length).toBe(18);
    const json = JSON.stringify(payload);
    for (const card of cards) {
      expect(json).not.toContain(card.name);
      expect(json).not.toContain(card.id);
    }
    expect(json.toLowerCase()).not.toContain("seed");
    expect(json).not.toContain(boardDoc.boardSeed as string);
    expect(json).not.toContain("choiceLog");
    expect(json).not.toContain("benchedCardId");
  });

  it("returns found:false (and logs nothing) for unknown, empty, or in-progress slugs", async () => {
    const env = await makeEnv();
    expect(await getShared(env, "DRAAAAAAAAAA")).toEqual({ found: false });
    expect(await getShared(env, "  ")).toEqual({ found: false });
    expect(env.db.rows("funnelEvents").filter((e) => e.type === "draw_share_view")).toHaveLength(0);
  });
});

// ── isToday ──

describe("isToday", () => {
  it("is true while the shared board is live, false once the run's dateKey has passed", async () => {
    const env = await makeEnv();
    const user = await env.db.insert("users", { username: "share_istoday" });
    actAs(user);
    const done = await playToCompletion(env);

    const live = await getShared(env, done.shareSlug!);
    expect(live.isToday).toBe(true);

    // Same run, viewed after the board rolled over: rewind its dateKey.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const runRow = env.db.rows("drawRuns")[0];
    await env.db.patch(runRow._id, { dateKey: yesterday });
    const stale = await getShared(env, done.shareSlug!);
    expect(stale.isToday).toBe(false);
    expect(stale.dateKey).toBe(yesterday);
    expect(stale.boardNumber).toBe(boardNumberForDate(yesterday));
  });
});

// ── funnel events ──

describe("share funnel events", () => {
  it("getSharedRun logs draw_share_view as anon; the CTA logs draw_share_convert", async () => {
    const env = await makeEnv();
    const sharer = await env.db.insert("users", { username: "share_funnel" });
    actAs(sharer);
    const done = await playToCompletion(env);
    const slug = done.shareSlug!;

    // The open — logged-out recipient, so no auth context at all.
    actAs(null);
    await getShared(env, slug);
    const views = env.db.rows("funnelEvents").filter((e) => e.type === "draw_share_view");
    expect(views).toHaveLength(1);
    expect(views[0].actor).toBe("anon");
    expect(views[0].refLinkCode).toBe(slug);

    // Anonymous CTA tap.
    await handlerOf(drawShare.recordShareConvert)(env.ctx, { slug });
    // A signed-in recipient converts under their own actor key.
    const recipient = await env.db.insert("users", { username: "share_recipient" });
    actAs(recipient);
    await handlerOf(drawShare.recordShareConvert)(env.ctx, { slug });

    const converts = env.db.rows("funnelEvents").filter((e) => e.type === "draw_share_convert");
    expect(converts).toHaveLength(2);
    expect(converts[0].actor).toBe("anon");
    expect(converts[1].actor).toBe(`user:${recipient}`);
    expect(converts.every((e) => e.refLinkCode === slug)).toBe(true);

    // Unknown slugs never log a convert.
    await handlerOf(drawShare.recordShareConvert)(env.ctx, { slug: "DRZZZZZZZZZZ" });
    expect(
      env.db.rows("funnelEvents").filter((e) => e.type === "draw_share_convert"),
    ).toHaveLength(2);
  });
});

// ── backfill ──

describe("backfillShareSlugs", () => {
  it("allocates slugs for completed runs only and is idempotent", async () => {
    const env = await makeEnv();
    const user = await env.db.insert("users", { username: "share_backfill" });
    actAs(user);
    const done = await playToCompletion(env);
    const preSlug = done.shareSlug!;
    // A pre-Ticket-I completed run (no slug) and an in-progress run.
    const legacy = await env.db.insert("drawRuns", {
      userId: user,
      dateKey: "2026-07-10",
      boardId: env.db.rows("drawDailyBoards")[0]._id,
      choiceLog: [],
      status: "banked",
      score: 100,
      result: { finalScore: 100, roundsCleared: 1, outcome: "banked", rounds: [] },
      startedAt: 1,
      completedAt: 2,
    });
    const live = await env.db.insert("drawRuns", {
      userId: user,
      dateKey: "2026-07-11",
      boardId: env.db.rows("drawDailyBoards")[0]._id,
      choiceLog: [],
      status: "drafting",
      startedAt: 3,
    });

    const first = (await handlerOf(drawShare.backfillShareSlugs)(env.ctx, {})) as {
      scanned: number;
      allocated: number;
    };
    expect(first.allocated).toBe(1);
    expect((await env.db.get(legacy))!.shareSlug).toMatch(SLUG_RE);
    expect((await env.db.get(live))!.shareSlug).toBeUndefined();
    // The completion-allocated slug is untouched.
    expect(env.db.rows("drawRuns")[0].shareSlug).toBe(preSlug);

    const second = (await handlerOf(drawShare.backfillShareSlugs)(env.ctx, {})) as {
      allocated: number;
    };
    expect(second.allocated).toBe(0);
  });
});

// ── landing CTA (label + routing) ──

describe("DrawShareLandingView CTA", () => {
  const payload = (isToday: boolean): SharedRunPayload => ({
    boardNumber: 18,
    dateKey: "2026-07-18",
    outcome: "banked",
    trail: "🟩🟩🏦",
    identity: "CLUB D SPINE ×1.63",
    score: 1234,
    isToday,
  });

  function renderLanding(isToday: boolean, onConvert: () => void) {
    return render(
      <MemoryRouter initialEntries={["/s/r/DRTESTTESTAA"]}>
        <Routes>
          <Route
            path="/s/r/:slug"
            element={
              <DrawShareLandingView
                payload={payload(isToday)}
                slug="DRTESTTESTAA"
                onConvert={onConvert}
              />
            }
          />
          <Route path="/draw" element={<div data-testid="draw-route-probe" />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("live board: 'beat {score}' CTA, converts and routes to /draw", () => {
    const onConvert = vi.fn();
    renderLanding(true, onConvert);
    const cta = screen.getByTestId("draw-share-landing-cta");
    expect(cta.textContent).toContain("PLAY TODAY'S BOARD — BEAT 1,234");
    // The share card itself rendered (same ShareCard as the result screen).
    expect(screen.getByTestId("draw-share-card")).toBeTruthy();
    fireEvent.click(cta);
    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("draw-route-probe")).toBeTruthy();
  });

  it("expired board: plain CTA, still routes to /draw", () => {
    const onConvert = vi.fn();
    renderLanding(false, onConvert);
    const cta = screen.getByTestId("draw-share-landing-cta");
    expect(cta.textContent).toBe("PLAY TODAY'S BOARD");
    fireEvent.click(cta);
    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("draw-route-probe")).toBeTruthy();
  });
});
