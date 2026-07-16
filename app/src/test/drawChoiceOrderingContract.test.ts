/**
 * Choice submission ordering contract (Ticket B).
 *
 * The mock boundary must enforce the frozen engine's phase machine exactly:
 * picks only in draft (one per row, in row order), a bench pick before every
 * round, bank/push only in decision, nothing after done. Out-of-phase and
 * out-of-range submissions reject without corrupting the stored run.
 */
import { describe, it, expect } from "vitest";
import { LocalMockApi } from "@/lib/drawApi";
import { MOCK_ENGINE_CONFIG } from "@/lib/drawApi/mockConfig";
import type { DrawRunView } from "@/lib/drawApi/types";

const FIXED_NOW = Date.parse("2026-07-16T12:00:00.000Z");

function mkApi() {
  return new LocalMockApi({ now: () => FIXED_NOW, storage: null });
}

describe("Draw choice submission ordering", () => {
  it("rejects submissions before a run starts", async () => {
    await expect(mkApi().submitChoice({ type: "pick", offerIndex: 0 })).rejects.toThrow();
  });

  it("walks draft → bench → decision in strict order, rejecting out-of-phase choices", async () => {
    const api = mkApi();
    let view = await api.startRun();
    expect(view.phase).toBe("draft");

    // Draft phase accepts ONLY picks.
    await expect(api.submitChoice({ type: "bench", squadIndex: 0 })).rejects.toThrow();
    await expect(api.submitChoice({ type: "bank" })).rejects.toThrow();
    await expect(api.submitChoice({ type: "pick", offerIndex: 99 })).rejects.toThrow();

    // A rejected submission must not have consumed the row.
    view = await api.startRun();
    expect(view.rowIndex).toBe(0);

    for (let row = 0; row < MOCK_ENGINE_CONFIG.rows; row++) {
      expect(view.phase).toBe("draft");
      expect(view.rowIndex).toBe(row);
      view = await api.submitChoice({ type: "pick", offerIndex: 0 });
      expect(view.squad).toHaveLength(row + 1);
    }
    expect(view.phase).toBe("bench");

    // Bench phase accepts ONLY bench picks.
    await expect(api.submitChoice({ type: "pick", offerIndex: 0 })).rejects.toThrow();
    await expect(api.submitChoice({ type: "push" })).rejects.toThrow();
    await expect(api.submitChoice({ type: "bench", squadIndex: 6 })).rejects.toThrow();

    view = await api.submitChoice({ type: "bench", squadIndex: 0 });
    expect(view.rounds).toHaveLength(1);
    expect(view.rounds[0].fixtureIndex).toBe(0);

    if (view.phase === "decision") {
      // Decision phase accepts ONLY bank/push.
      await expect(api.submitChoice({ type: "pick", offerIndex: 0 })).rejects.toThrow();
      await expect(api.submitChoice({ type: "bench", squadIndex: 0 })).rejects.toThrow();
    }
  });

  it("plays rounds in fixture order and refuses anything after done", async () => {
    const api = mkApi();
    let view: DrawRunView = await api.startRun();
    while (view.phase === "draft") {
      view = await api.submitChoice({ type: "pick", offerIndex: 0 });
    }
    while (view.phase !== "done") {
      if (view.phase === "bench") {
        view = await api.submitChoice({ type: "bench", squadIndex: 0 });
      } else {
        view = await api.submitChoice({ type: "push" });
      }
    }
    // Rounds resolved strictly in fixture order, each with its own bench entry.
    view.rounds.forEach((round, i) => {
      expect(round.fixtureIndex).toBe(i);
      expect(round.benchedCardId).toBeTruthy();
    });
    expect(view.outcome).not.toBeNull();
    expect(view.finalScore).not.toBeNull();

    await expect(api.submitChoice({ type: "bank" })).rejects.toThrow();
    await expect(api.submitChoice({ type: "pick", offerIndex: 0 })).rejects.toThrow();
  });

  it("bank ends the run with finalScore = cumulative", async () => {
    const api = mkApi();
    let view: DrawRunView = await api.startRun();
    while (view.phase === "draft") {
      view = await api.submitChoice({ type: "pick", offerIndex: 0 });
    }
    view = await api.submitChoice({ type: "bench", squadIndex: 0 });
    if (view.phase === "decision") {
      const banked = view.cumulative;
      view = await api.submitChoice({ type: "bank" });
      expect(view.phase).toBe("done");
      expect(view.outcome).toBe("banked");
      expect(view.finalScore).toBe(banked);
    } else {
      // Round 1 bust with this line — still a legal terminal state.
      expect(view.phase).toBe("done");
      expect(view.outcome).toBe("busted");
    }
  });
});
