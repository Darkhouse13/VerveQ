/**
 * DrawApi sanitization contract (Ticket B, X1/X2).
 *
 * The LocalMockApi must enforce the serving ticket's sanitization at its own
 * boundary — the same rules the later Convex implementation is bound to:
 *   - current draft row only (never the un-reached rows),
 *   - no form before a round resolves,
 *   - no board seed in any response,
 *   - the visible gauntlet (thresholds included) from board start,
 *   - full board revealed only once the run is done.
 * Plus the P0-runtime invariant: the served board is full-clearable, resolved
 * by the deterministic per-date reroll chain (same board for every user).
 */
import { describe, it, expect } from "vitest";
import {
  LocalMockApi,
  boardFullClearable,
  resolveBoardForDate,
} from "@/lib/drawApi";
import {
  MOCK_CARD_SET_SEED,
  MOCK_ENGINE_CONFIG,
} from "@/lib/drawApi/mockConfig";
import { generateCardSet } from "@/lib/drawEngine";
import type { DrawRunView } from "@/lib/drawApi/types";

const FIXED_NOW = Date.parse("2026-07-16T12:00:00.000Z");

function mkApi() {
  return new LocalMockApi({ now: () => FIXED_NOW, storage: null });
}

/** All keys reachable anywhere in a JSON value. */
function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.add(k);
      collectKeys(v, out);
    }
  }
  return out;
}

/** All CARD_xxx ids reachable anywhere in a JSON value. */
function collectCardIds(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    if (/^CARD_\d+$/.test(value)) out.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectCardIds(item, out);
  } else if (value !== null && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) collectCardIds(v, out);
  }
  return out;
}

async function draftAll(api: LocalMockApi): Promise<DrawRunView> {
  let view = await api.startRun();
  while (view.phase === "draft") {
    view = await api.submitChoice({ type: "pick", offerIndex: 0 });
  }
  return view;
}

async function finishRun(api: LocalMockApi): Promise<DrawRunView> {
  let view = await draftAll(api);
  while (view.phase !== "done") {
    if (view.phase === "bench") {
      view = await api.submitChoice({ type: "bench", squadIndex: 0 });
    } else {
      view = await api.submitChoice({ type: "push" });
    }
  }
  return view;
}

describe("DrawApi sanitization contract", () => {
  it("getToday exposes the full gauntlet with thresholds pre-draft (design contract)", async () => {
    const today = await mkApi().getToday();
    expect(today.fixtures).toHaveLength(MOCK_ENGINE_CONFIG.fixtureCount);
    for (const fixture of today.fixtures) {
      expect(fixture.threshold).toBeGreaterThan(0);
      expect(fixture.modifiers.length).toBeGreaterThan(0);
    }
    expect(today.fixtures[today.fixtures.length - 1].isBoss).toBe(true);
    expect(today.playState).toBe("unplayed");
  });

  it("never leaks the board seed, in any phase", async () => {
    const api = mkApi();
    const seen: unknown[] = [await api.getToday()];
    let view = await api.startRun();
    seen.push(view);
    while (view.phase === "draft") {
      view = await api.submitChoice({ type: "pick", offerIndex: 0 });
      seen.push(view);
    }
    view = await api.submitChoice({ type: "bench", squadIndex: 0 });
    seen.push(view);
    for (const value of seen) {
      const keys = collectKeys(value);
      expect(keys.has("seed")).toBe(false);
      expect(keys.has("boardSeed")).toBe(false);
    }
  });

  it("exposes the current draft row only — each view shows offers + picks, nothing else", async () => {
    const api = mkApi();
    let view = await api.startRun();
    expect(view.currentRow).toHaveLength(MOCK_ENGINE_CONFIG.offersPerRow);
    expect(view.fullBoard).toBeNull();

    const rowIds: string[][] = [];
    while (view.phase === "draft") {
      rowIds.push(view.currentRow!.map((c) => c.id));
      // Every card id anywhere in the response is either an offer of the
      // ACTIVE row or an already-picked squad card.
      const visible = collectCardIds(view);
      const allowed = new Set([
        ...view.currentRow!.map((c) => c.id),
        ...view.squad.map((c) => c.id),
      ]);
      expect([...visible].filter((id) => !allowed.has(id))).toEqual([]);
      view = await api.submitChoice({ type: "pick", offerIndex: 0 });
    }
    // 6 distinct rows were shown, one at a time.
    expect(rowIds).toHaveLength(MOCK_ENGINE_CONFIG.rows);
    expect(new Set(rowIds.flat()).size).toBe(
      MOCK_ENGINE_CONFIG.rows * MOCK_ENGINE_CONFIG.offersPerRow,
    );
    expect(view.currentRow).toBeNull();
  });

  it("reveals no form before a round resolves, and per-card form only in played breakdowns", async () => {
    const api = mkApi();
    let view = await api.startRun();
    while (view.phase === "draft") {
      expect(collectKeys(view).has("form")).toBe(false);
      view = await api.submitChoice({ type: "pick", offerIndex: 0 });
    }
    // Bench phase, round not played yet: still no form anywhere.
    expect(view.rounds).toHaveLength(0);
    expect(collectKeys(view).has("form")).toBe(false);

    view = await api.submitChoice({ type: "bench", squadIndex: 0 });
    expect(view.rounds).toHaveLength(1);
    for (const card of view.rounds[0].cards) {
      expect(card.form).toBeGreaterThan(0);
    }
  });

  it("reveals the full board only once the run is done", async () => {
    const api = mkApi();
    const view = await finishRun(api);
    expect(view.phase).toBe("done");
    expect(view.outcome).not.toBeNull();
    expect(view.fullBoard).toHaveLength(MOCK_ENGINE_CONFIG.rows);
    for (const row of view.fullBoard!) {
      expect(row).toHaveLength(MOCK_ENGINE_CONFIG.offersPerRow);
    }
    const today = await api.getToday();
    expect(today.playState).toBe("done");
    const streak = await api.getStreak();
    expect(streak.current).toBe(1);
    const rarity = await api.getRarity();
    expect(rarity.linePercent).toBeGreaterThan(0);
    expect(rarity.linePercent).toBeLessThan(100);
  });

  it("serves the same board to every user (deterministic per-date resolution)", async () => {
    const [a, b] = await Promise.all([mkApi().startRun(), mkApi().startRun()]);
    expect(a.currentRow!.map((c) => c.id)).toEqual(b.currentRow!.map((c) => c.id));
    expect(a.fixtures).toEqual(b.fixtures);
    expect(a.boardNumber).toBe(b.boardNumber);
  });

  // ── Ticket G3: hints + clearance buckets are design-public PRE-round;
  //    exact band values never were an API concern (client arithmetic), but
  //    the hint payload must stay bucket-strings-only and horizon-scoped. ──

  it("serves the hint/clearance rules knobs (published rules of the game)", async () => {
    const today = await mkApi().getToday();
    expect(today.rules.hintReliability).toBe(MOCK_ENGINE_CONFIG.hints!.hintReliability);
    expect(today.rules.clearance).toEqual(MOCK_ENGINE_CONFIG.clearance);
  });

  it("serves hint chips pre-round: bench phase carries the upcoming fixture's hints for the squad only", async () => {
    const api = mkApi();
    let view = await api.startRun();
    // No hints during the draft — the squad isn't formed yet.
    while (view.phase === "draft") {
      expect(view.hints ?? null).toBeNull();
      view = await api.submitChoice({ type: "pick", offerIndex: 0 });
    }
    // Bench phase: exactly one entry, for the fixture about to be played.
    expect(view.phase).toBe("bench");
    expect(view.hints).toHaveLength(1);
    const entry = view.hints![0];
    expect(entry.fixtureIndex).toBe(view.fixtureIndex);
    const squadIds = view.squad.map((c) => c.id).sort();
    expect(Object.keys(entry.byCard).sort()).toEqual(squadIds);
    for (const hint of Object.values(entry.byCard)) {
      expect(["COLD", "NEUTRAL", "HOT"]).toContain(hint);
    }
    // Still no form anywhere pre-resolution — a hint is a bucket, not a draw.
    expect(collectKeys(view).has("form")).toBe(false);

    // Decision phase: the NEXT fixture's hints (the push horizon), only that.
    view = await api.submitChoice({ type: "bench", squadIndex: 0 });
    if (view.phase === "decision") {
      expect(view.hints).toHaveLength(1);
      expect(view.hints![0].fixtureIndex).toBe(view.fixtureIndex + 1);
    }
  });

  it("hints are deterministic and shared: two users see identical chips", async () => {
    const [a, b] = await Promise.all([draftAll(mkApi()), draftAll(mkApi())]);
    expect(a.hints).toEqual(b.hints);
  });

  it("P0-runtime: the served board is full-clearable via the reroll chain", async () => {
    const cardSet = generateCardSet(MOCK_CARD_SET_SEED, MOCK_ENGINE_CONFIG.cardGen);
    const { board, rerolls } = resolveBoardForDate("2026-07-16", cardSet, MOCK_ENGINE_CONFIG);
    expect(rerolls).toBeGreaterThanOrEqual(0);
    expect(boardFullClearable(board, MOCK_ENGINE_CONFIG)).toBe(true);
    // The api serves exactly this board (leaderboard fairness).
    const today = await mkApi().getToday();
    expect(today.fixtures).toEqual(board.fixtures);
  });
});
