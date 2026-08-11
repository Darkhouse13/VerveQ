/**
 * Weekend Fantasy FW-T1 — transfer classification rules, as pure unit tests.
 *
 * Covers the ticket's five classes (a–e), record identity (the idempotence
 * key), window filtering, cross-feed dedupe (an internal transfer appears in
 * both clubs' feeds), the loan flag, the out-of-order guard, and the
 * departed-player exclusion in auto-pick. The write path (applyTransferChunk)
 * is a thin executor of these decisions; its DB-level idempotence is proven
 * operationally by the re-run gate (second backfill = zero-op).
 */

import { describe, expect, it } from "vitest";

import type { FeedTransferEntry } from "../../convex/fantasyApiFootball";
import {
  classifyTransfer,
  collectCandidates,
  isLoanType,
  laterMoveAlreadyApplied,
  transferKey,
  type TransferCandidate,
} from "../../convex/lib/fantasyTransferRules";
import {
  selectAutoPickWithRung,
  type DraftPoolPlayer,
} from "../../convex/lib/fantasyDraftEngine";

// ── builders ──

const COVERED = new Set(["100", "200", "300"]); // three covered clubs
const WINDOW = { windowFromDay: "2026-07-01", coveredClubIds: COVERED };

function entry(over: {
  playerId?: number | null;
  playerName?: string | null;
  moves?: {
    date?: string | null;
    type?: string | null;
    inId?: number | null;
    inName?: string | null;
    outId?: number | null;
    outName?: string | null;
  }[];
}): FeedTransferEntry {
  return {
    player: { id: over.playerId === undefined ? 7 : over.playerId, name: over.playerName ?? "Player Seven" },
    update: "2026-08-10T00:00:00+00:00",
    transfers: (over.moves ?? []).map((m) => ({
      date: m.date === undefined ? "2026-08-01" : m.date,
      type: m.type ?? "€ 10m",
      teams: {
        in: m.inId === undefined ? { id: 100, name: "Covered FC" } : m.inId === null ? null : { id: m.inId, name: m.inName ?? `club ${m.inId}` },
        out: m.outId === undefined ? { id: 999, name: "Outside FC" } : m.outId === null ? null : { id: m.outId, name: m.outName ?? `club ${m.outId}` },
      },
    })),
  };
}

function candidate(over: Partial<TransferCandidate> = {}): TransferCandidate {
  return {
    providerPlayerId: "7",
    playerName: "Player Seven",
    transferDate: "2026-08-01",
    rawFromClubId: "999",
    rawToClubId: "100",
    fromClubName: "Outside FC",
    toClubName: "Covered FC",
    transferType: "€ 10m",
    ...over,
  };
}

// ── record identity ──

describe("transfer record identity (P1 idempotence key)", () => {
  it("keys on player + date + both sides", () => {
    expect(transferKey(candidate())).toBe("7|2026-08-01|999|100");
  });

  it("keys a missing side as '?' so a re-serve with less data collides (safe: no-op, not double-apply)", () => {
    expect(transferKey(candidate({ rawFromClubId: null }))).toBe("7|2026-08-01|?|100");
  });
});

// ── collection: window, scope, dedupe ──

describe("collectCandidates — window, scope, cross-feed dedupe", () => {
  it("drops moves dated before the window and counts them", () => {
    const result = collectCandidates(
      [entry({ moves: [{ date: "2026-06-30" }, { date: "2026-07-01" }] })],
      WINDOW,
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.beforeWindow).toBe(1);
  });

  it("drops moves touching no covered club as out of scope", () => {
    const result = collectCandidates(
      [entry({ moves: [{ inId: 888, outId: 999 }] })],
      WINDOW,
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.outOfScope).toBe(1);
  });

  it("collapses the same internal transfer served by both clubs' feeds onto one candidate", () => {
    const move = { inId: 100, outId: 200 };
    const result = collectCandidates(
      [entry({ moves: [move] }), entry({ moves: [move] })],
      WINDOW,
    );
    expect(result.candidates).toHaveLength(1);
  });

  it("counts records with no player id or unparseable date as malformed, never guesses", () => {
    const result = collectCandidates(
      [
        entry({ playerId: null, moves: [{}] }),
        entry({ moves: [{ date: "August 1st" }] }),
      ],
      WINDOW,
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.malformed).toBe(2);
  });

  it("orders candidates by date so moves apply chronologically", () => {
    const result = collectCandidates(
      [
        entry({
          moves: [
            { date: "2026-08-05", inId: 200, outId: 100 },
            { date: "2026-07-10", inId: 100, outId: 999 },
          ],
        }),
      ],
      WINDOW,
    );
    expect(result.candidates.map((c) => c.transferDate)).toEqual([
      "2026-07-10",
      "2026-08-05",
    ]);
  });
});

// ── classification: the five classes ──

describe("classifyTransfer — exactly one of the ticket's five classes", () => {
  it("a. INTERNAL: covered → covered, player known", () => {
    const result = classifyTransfer({
      candidate: candidate({ rawFromClubId: "200", rawToClubId: "100" }),
      playerKnown: true,
      coveredClubIds: COVERED,
    });
    expect(result.classification).toBe("internal");
  });

  it("b. INCOMING known: outside → covered, player already in our table", () => {
    const result = classifyTransfer({
      candidate: candidate({ rawFromClubId: "999", rawToClubId: "100" }),
      playerKnown: true,
      coveredClubIds: COVERED,
    });
    expect(result.classification).toBe("incoming_known");
  });

  it("c. INCOMING new: outside → covered, unknown player", () => {
    const result = classifyTransfer({
      candidate: candidate({ rawFromClubId: "999", rawToClubId: "100" }),
      playerKnown: false,
      coveredClubIds: COVERED,
    });
    expect(result.classification).toBe("incoming_new");
  });

  it("c. INCOMING new even off a covered origin — a player we never carried is new to the universe", () => {
    const result = classifyTransfer({
      candidate: candidate({ rawFromClubId: "200", rawToClubId: "100" }),
      playerKnown: false,
      coveredClubIds: COVERED,
    });
    expect(result.classification).toBe("incoming_new");
  });

  it("d. OUTGOING: covered → outside", () => {
    const result = classifyTransfer({
      candidate: candidate({ rawFromClubId: "100", rawToClubId: "999" }),
      playerKnown: true,
      coveredClubIds: COVERED,
    });
    expect(result.classification).toBe("outgoing");
  });

  it("e. UNRESOLVED: covered origin with a missing destination is logged, never guessed as a departure (R3)", () => {
    const result = classifyTransfer({
      candidate: candidate({ rawFromClubId: "100", rawToClubId: null }),
      playerKnown: true,
      coveredClubIds: COVERED,
    });
    expect(result.classification).toBe("unresolved");
    expect(result.unresolvedReason).toContain("destination club missing");
  });

  it("admits a missing ORIGIN when the destination is covered — the action is identical whatever the origin was", () => {
    const result = classifyTransfer({
      candidate: candidate({ rawFromClubId: null, rawToClubId: "100" }),
      playerKnown: true,
      coveredClubIds: COVERED,
    });
    expect(result.classification).toBe("incoming_known");
  });
});

// ── loans ──

describe("loan flag (loans follow the same rules on current club)", () => {
  it.each([
    ["Loan", true],
    ["loan", true],
    ["€ 25.5m", false],
    ["Free", false],
    ["N/A", false],
    [null, false],
  ])("type %s → loan %s", (type, expected) => {
    expect(isLoanType(type)).toBe(expected);
  });
});

// ── out-of-order guard ──

describe("laterMoveAlreadyApplied — feed backfill must not regress current club", () => {
  it("blocks applying a July move after an August one was applied", () => {
    expect(laterMoveAlreadyApplied("2026-07-10", ["2026-08-05"])).toBe(true);
  });

  it("lets a later move through, and same-date moves apply in deterministic order", () => {
    expect(laterMoveAlreadyApplied("2026-08-05", ["2026-07-10"])).toBe(false);
    expect(laterMoveAlreadyApplied("2026-08-05", ["2026-08-05"])).toBe(false);
  });
});

// ── departed players and selection (P5/P6: excluded from picks, intact in history) ──

describe("departed player exclusion (FW-T1 class d downstream)", () => {
  const poolPlayer = (over: Partial<DraftPoolPlayer>): DraftPoolPlayer => ({
    _id: "p1",
    providerPlayerId: "1",
    clubId: "100",
    price: 8.0,
    active: true,
    pool: "topfive",
    proxy: 90,
    hasFixture: true,
    kickoffAt: 10_000,
    ...over,
  });

  it("auto-pick never selects a departed (inactive) player, whatever his price", () => {
    const departed = poolPlayer({ _id: "gone", providerPlayerId: "1", price: 13.0, active: false });
    const modest = poolPlayer({ _id: "here", providerPlayerId: "2", price: 4.0 });
    const result = selectAutoPickWithRung([departed, modest], {
      pickedPlayerIds: new Set(),
      clubCounts: new Map(),
      favoriteClub: null,
      now: 0,
    });
    expect(result?.player._id).toBe("here");
  });

  it("returns null rather than a departed player when nobody active remains", () => {
    const departed = poolPlayer({ _id: "gone", active: false });
    const result = selectAutoPickWithRung([departed], {
      pickedPlayerIds: new Set(),
      clubCounts: new Map(),
      favoriteClub: null,
      now: 0,
    });
    expect(result).toBeNull();
  });
});
