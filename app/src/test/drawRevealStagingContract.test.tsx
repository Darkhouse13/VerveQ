/**
 * Ticket G3 — reveal staging contract; Ticket D1 — the staged ledger.
 *
 * Score resolution is a staged LEDGER, not a dump: per-card contribution
 * lines land one by one in engine (payload) order, then YOUR FIVE (the base
 * sum), then one line per GRANTED chain in synergies[] payload order, then
 * the total meets the threshold after a tension beat, and only then
 * CLEARED / BUSTED. A tap skips straight to the verdict. Pacing, not latency
 * theater — with revealMs 0 (every other test) the whole thing is instant,
 * which this file also pins.
 *
 * Every displayed number is a RoundBreakdown / CardRoundBreakdown /
 * SynergyBreakdown field, rounded for display — the UI derives nothing, and
 * these assertions read the expected values off the payload itself.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { RoundStage } from "@/components/draw/RoundStage";
import { LocalMockApi } from "@/lib/drawApi";
import { formatMult } from "@/components/draw/meta";
import type { DrawRules, DrawRunView, DrawToday } from "@/lib/drawApi/types";
import type { Card, Fixture, RoundBreakdown } from "@/lib/drawEngine";

const FIXED_NOW = Date.parse("2026-07-16T12:00:00.000Z");

async function benchResolvedViews(): Promise<{
  before: DrawRunView;
  after: DrawRunView;
  today: DrawToday;
}> {
  const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
  const today = await api.getToday();
  let view = await api.startRun();
  while (view.phase === "draft") {
    view = await api.submitChoice({ type: "pick", offerIndex: 0 });
  }
  const before = view; // bench phase, 0 rounds
  const after = await api.submitChoice({ type: "bench", squadIndex: 0 }); // resolved
  return { before, after, today };
}

const noop = () => {};

// ── D1 hand-built payload ──────────────────────────────────────────────────
// A resolved round with exactly 5 fielded cards and 2 granted chains (club,
// nation — era deliberately NOT granted). Numbers mirror the ticket's
// example shape; the assertions read them back off the payload, never from
// literals the component could have computed itself.

const RULES: DrawRules = {
  rows: 6,
  offersPerRow: 3,
  fixtureCount: 5,
  synergyTable: [1, 1, 1, 1.335, 1.4818, 1.6285],
  bustKeep: 0.1501,
  fullClearBonus: 1.4664,
  formSpread: 0.48,
  maxSynergyFamilies: 3,
};

function squadCards(): Card[] {
  const names = ["OTTO WEIS", "BRUNO KANDE", "IVO PETRIC", "MILO DRAVIC", "SANDRO PIRES", "LEO MAREN"];
  return names.map((name, i) => ({
    id: `CARD_0${i}`,
    name,
    rating: [70, 82, 91, 74, 60, 88][i],
    clubs: ["CLUB_D"],
    nation: "NATION_C",
    era: "ERA_1990s",
    eraIndex: 3,
    position: "MID",
  }));
}

const FIXTURE: Fixture = {
  index: 0,
  archetypeId: "ARCH_FORTRESS_KEEPER",
  modifiers: [{ kind: "position", value: "GK", mult: 3.08 }],
  threshold: 1151,
  isBoss: false,
};

const NEXT_FIXTURE: Fixture = {
  index: 1,
  archetypeId: "ARCH_WALL",
  modifiers: [{ kind: "position", value: "DEF", mult: 2.69 }],
  threshold: 1456,
  isBoss: false,
};

/** 5 fielded cards (CARD_00 benched); cards[2] is the flat short-line case. */
function resolvedRound(): RoundBreakdown {
  return {
    fixtureIndex: 0,
    threshold: FIXTURE.threshold,
    benchedCardId: "CARD_00",
    baseSum: 717.33,
    synergies: [
      { family: "club", tag: "CLUB_D", chain: 4, mult: 1.4818 },
      { family: "nation", tag: "NATION_C", chain: 3, mult: 1.335 },
    ],
    synergyMult: 1.978203,
    score: 1418.98,
    cleared: true,
    cards: [
      { cardId: "CARD_01", rating: 82, form: 1.12, fixtureMult: 3.08, contribution: 282.94 },
      { cardId: "CARD_02", rating: 91, form: 0.94, fixtureMult: 2.69, contribution: 230.11 },
      { cardId: "CARD_03", rating: 74, form: 1, fixtureMult: 1, contribution: 74 },
      { cardId: "CARD_04", rating: 60, form: 1.31, fixtureMult: 0.37, contribution: 29.08 },
      { cardId: "CARD_05", rating: 88, form: 0.71, fixtureMult: 1.62, contribution: 101.2 },
    ],
  };
}

function viewFor(rounds: RoundBreakdown[], phase: DrawRunView["phase"]): DrawRunView {
  const cleared = rounds.filter((r) => r.cleared);
  return {
    boardNumber: 1,
    phase,
    rowIndex: 6,
    currentRow: null,
    squad: squadCards(),
    fixtures: [FIXTURE, NEXT_FIXTURE],
    fixtureIndex: rounds.length === 0 ? 0 : rounds[rounds.length - 1].fixtureIndex,
    cumulative: cleared.reduce((sum, r) => sum + r.score, 0),
    rounds,
    outcome: null,
    finalScore: null,
    fullBoard: null,
    hints: null,
  };
}

function renderStage(view: DrawRunView, revealMs: number) {
  return render(
    <RoundStage
      view={view}
      rules={RULES}
      locked={false}
      revealMs={revealMs}
      onBench={noop}
      onBank={noop}
      onPush={noop}
      onContinue={noop}
    />,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("reveal staging (Ticket G3 + D1 ledger)", () => {
  it("stages the ledger: cards in engine order → YOUR FIVE → granted chains in payload order → total → verdict", async () => {
    const round = resolvedRound();
    vi.useFakeTimers();
    const { rerender } = render(
      <RoundStage
        view={viewFor([], "bench")}
        rules={RULES}
        locked={false}
        revealMs={380}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );
    rerender(
      <RoundStage
        view={viewFor([round], "decision")}
        rules={RULES}
        locked={false}
        revealMs={380}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );

    const stage = () => screen.getByTestId("draw-round-stage");
    const cardLine = (i: number) => screen.queryByTestId(`draw-ledger-card-${i}`);
    const beat = async (ms: number) => {
      await act(async () => {
        vi.advanceTimersByTime(ms);
      });
    };

    // Staging is live: nothing landed yet, no verdict, stage marked revealing.
    expect(stage().getAttribute("data-revealing")).toBe("true");
    for (let i = 0; i < 5; i++) expect(cardLine(i)).toBeNull();
    expect(screen.queryByTestId("draw-ledger-base")).toBeNull();
    expect(screen.queryByTestId("draw-ledger-total")).toBeNull();
    expect(screen.queryByTestId("draw-round-verdict")).toBeNull();

    // Beats 1–5: one card line per beat, in the payload's engine order, in
    // lockstep with the bench-strip contribution chips (squad index = card
    // order + 1 here, CARD_00 being benched).
    for (let i = 0; i < 5; i++) {
      await beat(380 + 1);
      expect(cardLine(i)).toBeTruthy();
      expect(cardLine(i + 1)).toBeNull();
      expect(screen.queryByTestId(`draw-contribution-${i + 1}`)).toBeTruthy();
    }
    expect(screen.queryByTestId("draw-ledger-base")).toBeNull();

    // Every displayed number is the payload field (rounded) — name resolved
    // from the squad, fixtureMult labelled with the fixture's archetype name.
    const c0 = round.cards[0];
    expect(cardLine(0)!.textContent).toContain("BRUNO KANDE");
    expect(cardLine(0)!.textContent).toContain(String(c0.rating));
    // D1.1 — the form factor is the payload value (via formatMult), iconed by
    // direction: 🔥 when in form (c0.form 1.12 > 1). Never the literal "FORM".
    expect(cardLine(0)!.textContent).toContain(`🔥${formatMult(c0.form)}`);
    expect(cardLine(0)!.textContent).toContain("FORTRESS ×3.08");
    expect(cardLine(0)!.textContent).toContain(String(Math.round(c0.contribution)));
    const c4 = round.cards[4];
    expect(cardLine(4)!.textContent).toContain("LEO MAREN");
    // ❄ when out of form (c4.form 0.71 < 1).
    expect(cardLine(4)!.textContent).toContain(`❄${formatMult(c4.form)}`);
    expect(cardLine(4)!.textContent).toContain("FORTRESS ×1.62");
    expect(cardLine(4)!.textContent).toContain(String(Math.round(c4.contribution)));
    // The literal "FORM" placeholder is gone from every card line.
    for (let i = 0; i < 5; i++) expect(cardLine(i)!.textContent).not.toContain("FORM");

    // Beat 6: YOUR FIVE, the payload's baseSum.
    await beat(380 + 1);
    const base = screen.getByTestId("draw-ledger-base");
    expect(base.textContent).toContain("YOUR FIVE");
    expect(base.textContent).toContain(String(Math.round(round.baseSum)));
    expect(screen.queryByTestId("draw-ledger-chain-club")).toBeNull();

    // Beat 7: the FIRST granted chain in payload order — and only that one.
    await beat(380 + 1);
    expect(screen.getByTestId("draw-ledger-chain-club").textContent).toContain("CLUB D CHAIN");
    expect(screen.getByTestId("draw-ledger-chain-club").textContent).toContain("×1.48");
    expect(screen.queryByTestId("draw-ledger-chain-nation")).toBeNull();

    // Beat 8: the second granted chain. Era was never granted — no invented
    // ×1 row for an absent family, before or after the reveal completes.
    await beat(380 + 1);
    expect(screen.getByTestId("draw-ledger-chain-nation").textContent).toContain("NATION C CHAIN");
    expect(screen.getByTestId("draw-ledger-chain-nation").textContent).toContain("×1.34");
    expect(screen.queryByTestId("draw-ledger-chain-era")).toBeNull();

    // The tension beat before the total runs 1.4×: one normal beat's worth of
    // time does NOT land the total yet.
    await beat(380);
    expect(screen.queryByTestId("draw-ledger-total")).toBeNull();
    await beat(Math.ceil(380 * 0.4) + 10);
    const total = screen.getByTestId("draw-ledger-total");
    expect(total.textContent).toContain(String(Math.round(round.score)));
    expect(total.textContent).toContain(`NEEDED ${round.threshold}`);
    expect(screen.queryByTestId("draw-round-verdict")).toBeNull();

    // Beat 10: the verdict.
    await beat(380 + 1);
    expect(screen.getByTestId("draw-round-verdict").textContent).toBe("CLEARED");

    // The 1.6× closing beat ends staging; the whole ledger stays on screen.
    await beat(650);
    expect(stage().getAttribute("data-revealing")).toBeNull();
    expect(screen.getByTestId("draw-round-verdict")).toBeTruthy();
    expect(screen.queryByTestId("draw-ledger-chain-era")).toBeNull();

    // Design duration at the default cadence: cards + base + chains at 380,
    // the 1.4× tension beat, the verdict beat and the 1.6× closing beat —
    // inside the ticket's ~2–5s envelope (4560ms for 5 cards + 2 chains).
    const designMs =
      (round.cards.length + 1 + round.synergies.length) * 380 + 380 * 1.4 + 380 + 380 * 1.6;
    expect(designMs).toBeGreaterThanOrEqual(2000);
    expect(designMs).toBeLessThanOrEqual(5000);
  });

  it("collapses a card line to the short form when fixtureMult === 1 and form === 1", () => {
    const round = resolvedRound();
    renderStage(viewFor([round], "decision"), 0);
    const flat = screen.getByTestId("draw-ledger-card-2");
    expect(flat.textContent).toContain("MILO DRAVIC");
    expect(flat.textContent).toContain(`→ ${Math.round(round.cards[2].contribution)}`);
    expect(flat.textContent).not.toContain("FORM");
    expect(flat.textContent).not.toContain("×");
    // Neighbours with a form/fixture push keep the long form — the form factor
    // now shown as its payload value with a direction icon, no "FORM" literal.
    const pushed = screen.getByTestId("draw-ledger-card-1").textContent!;
    expect(pushed).toContain(`❄${formatMult(round.cards[1].form)}`);
    expect(pushed).toContain("× FORTRESS ×");
    expect(pushed).not.toContain("FORM");
  });

  it("omits the form factor when form === 1 but the fixture still moved the card", () => {
    // form on the payload is 1 (nothing to show), fixtureMult isn't — so the
    // line is rating × fixture, no icon, no value, no "FORM". 74 × 2 = 148.
    const base = resolvedRound();
    const round: RoundBreakdown = {
      ...base,
      cards: [
        { cardId: "CARD_01", rating: 74, form: 1, fixtureMult: 2, contribution: 148 },
        ...base.cards.slice(1),
      ],
    };
    renderStage(viewFor([round], "decision"), 0);
    const line = screen.getByTestId("draw-ledger-card-0").textContent!;
    expect(line).toContain("FORTRESS ×2");
    expect(line).toContain(String(Math.round(round.cards[0].contribution)));
    expect(line).not.toContain("FORM");
    expect(line).not.toContain("🔥");
    expect(line).not.toContain("❄");
  });

  it("a failed round reads BUSTED with the bust punch", () => {
    const round: RoundBreakdown = { ...resolvedRound(), cleared: false, score: 900.4 };
    const view: DrawRunView = {
      ...viewFor([round], "done"),
      outcome: "busted",
      finalScore: 0,
      cumulative: 0,
    };
    renderStage(view, 0);
    expect(screen.getByTestId("draw-round-verdict").textContent).toBe("BUSTED");
    expect(screen.getByTestId("draw-round-stage").className).toContain("draw-punch-bust");
  });

  it("a tap skips straight to the verdict — no fake spinners to wait out", async () => {
    const { before, after, today } = await benchResolvedViews();
    vi.useFakeTimers();
    const { rerender } = render(
      <RoundStage
        view={before}
        rules={today.rules}
        locked={false}
        revealMs={380}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );
    rerender(
      <RoundStage
        view={after}
        rules={today.rules}
        locked={false}
        revealMs={380}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );
    expect(screen.queryByTestId("draw-round-verdict")).toBeNull();
    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId("draw-round-stage"));
    });
    // The skip lands the FULL ledger at once: every card line, YOUR FIVE,
    // every granted chain, the total and the verdict.
    expect(screen.getByTestId("draw-round-verdict")).toBeTruthy();
    expect(screen.getByTestId("draw-round-stage").getAttribute("data-revealing")).toBeNull();
    for (let i = 0; i < after.rounds[0].cards.length; i++) {
      expect(screen.getByTestId(`draw-ledger-card-${i}`)).toBeTruthy();
    }
    expect(screen.getByTestId("draw-ledger-base").textContent).toContain(
      String(Math.round(after.rounds[0].baseSum)),
    );
    for (const s of after.rounds[0].synergies) {
      expect(screen.getByTestId(`draw-ledger-chain-${s.family}`)).toBeTruthy();
    }
    expect(screen.getByTestId("draw-ledger-total").textContent).toContain(
      String(Math.round(after.rounds[0].score)),
    );
  });

  it("revealMs 0 resolves instantly (the mode every functional test runs in)", async () => {
    const { before, after, today } = await benchResolvedViews();
    const { rerender } = render(
      <RoundStage
        view={before}
        rules={today.rules}
        locked={false}
        revealMs={0}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );
    rerender(
      <RoundStage
        view={after}
        rules={today.rules}
        locked={false}
        revealMs={0}
        onBench={noop}
        onBank={noop}
        onPush={noop}
        onContinue={noop}
      />,
    );
    expect(screen.getByTestId("draw-round-verdict")).toBeTruthy();
    // The instant path renders the identical ledger content.
    const round = after.rounds[0];
    expect(screen.getByTestId("draw-ledger-card-0").textContent).toContain(
      String(Math.round(round.cards[0].contribution)),
    );
    expect(screen.getByTestId("draw-ledger-base").textContent).toContain(
      String(Math.round(round.baseSum)),
    );
    expect(screen.getByTestId("draw-ledger-total").textContent).toContain(
      String(Math.round(round.score)),
    );
  });
});
