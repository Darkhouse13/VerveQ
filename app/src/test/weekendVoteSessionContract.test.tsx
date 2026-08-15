/**
 * EYE-TEST-TEN — the vote session's surfaces, as a render contract.
 *
 * The pure rules are pinned in fantasyCrowdSession.test.ts; what is left to
 * lock is the wiring the views own and nothing else can check:
 *
 *  1. WHICH didn't-see buttons appear. A pair spanning two fixtures must NOT
 *     offer one combined button — that button would retire a game the voter
 *     never spoke about.
 *  2. That a didn't-see sends the side-specific choice, so the cascade retires
 *     the right fixture.
 *  3. That the progress line speaks the ten and NEVER the 300-pair ceiling.
 *  4. That the reveal renders post-vote copy only, with no percentage below
 *     the sample threshold.
 *  5. That the done-state offers "keep going" and frames it as uncounted.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// The house i18n mock (fantasyBudgetSquadUi precedent): defaultValue with
// interpolation, so the assertions below read the copy the voter reads.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string } & Record<string, unknown>) => {
      let out = opts?.defaultValue ?? key;
      for (const [k, val] of Object.entries(opts ?? {})) {
        out = out.replace(`{{${k}}}`, String(val));
      }
      return out;
    },
    i18n: { language: "en" },
  }),
}));

import {
  DoneView,
  FixturePickerView,
  RevealView,
  VoteStackView,
  type ConsensusReveal,
  type ServedPair,
  type ServeResult,
} from "@/pages/shell/weekend/VoteScreen";

const PLAYER = {
  playerId: "p1",
  fixtureId: "f1",
  name: "Player One",
  position: "MID",
  clubId: "c1",
  clubName: "Club One",
  opponentClubId: "c2",
  opponentName: "Club Two",
  isHome: true,
  minutes: 90,
  goals: 0,
  assists: 0,
  redCard: false,
  fixture: {
    leagueId: 39,
    kickoffAt: Date.UTC(2026, 7, 15, 14, 0),
    homeClubId: "c1",
    awayClubId: "c2",
    homeGoals: 1,
    awayGoals: 0,
  },
};

function pair(over: Partial<Record<string, unknown>> = {}): ServedPair {
  return {
    status: "served",
    pairId: "pair1",
    served: 4,
    cap: 300,
    progress: { voted: 3, goal: 10, complete: false },
    players: [PLAYER, { ...PLAYER, playerId: "p2", fixtureId: "f2", name: "Player Two" }],
    ...over,
  } as unknown as ServedPair;
}

const sameFixturePair = () =>
  pair({
    players: [PLAYER, { ...PLAYER, playerId: "p2", name: "Player Two" }],
  });

const reveal = (over: Partial<ConsensusReveal>): ConsensusReveal =>
  ({ total: 41, withYou: 28, percent: 68, lowSample: false, majority: true, ...over }) as
    ConsensusReveal;

describe("the didn't-see affordances (EYE-TEST-TEN §2)", () => {
  it("offers per-card buttons and NO combined one when the pair spans two fixtures", () => {
    render(<VoteStackView serve={pair()} busy={false} onVote={() => undefined} />);
    expect(screen.getByTestId("didnt-see-a")).toBeTruthy();
    expect(screen.getByTestId("didnt-see-b")).toBeTruthy();
    // The one that would be a lie about which game he answered for.
    expect(screen.queryByTestId("didnt-see-both")).toBeNull();
  });

  it("adds the combined button only when both cards share a fixture", () => {
    render(<VoteStackView serve={sameFixturePair()} busy={false} onVote={() => undefined} />);
    expect(screen.getByTestId("didnt-see-a")).toBeTruthy();
    expect(screen.getByTestId("didnt-see-both")).toBeTruthy();
  });

  it("sends the side-specific choice so the cascade retires the right fixture", () => {
    const onVote = vi.fn();
    render(<VoteStackView serve={pair()} busy={false} onVote={onVote} />);
    fireEvent.click(screen.getByTestId("didnt-see-b"));
    expect(onVote).toHaveBeenCalledWith("unseen_b");
  });

  it("falls back to one combined DIDN'T WATCH against a backend with no fixtureId", () => {
    // DEPLOYMENT topology: frontend CI ships on push, Convex is manual. A
    // pre-EYE-TEST-TEN payload cannot cascade, and sending it `unseen_*` would
    // be rejected by its validator — so the old control, and the old wire word.
    const onVote = vi.fn();
    const legacy = pair({
      players: [
        { ...PLAYER, fixtureId: undefined },
        { ...PLAYER, playerId: "p2", fixtureId: undefined, name: "Player Two" },
      ],
    });
    render(<VoteStackView serve={legacy} busy={false} onVote={onVote} />);
    expect(screen.queryByTestId("didnt-see-a")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /didn't watch/i }));
    expect(onVote).toHaveBeenCalledWith("skip");
  });
});

describe("the progress line (EYE-TEST-TEN §3)", () => {
  it("speaks the ten, never the 300-pair ceiling", () => {
    render(<VoteStackView serve={pair()} busy={false} onVote={() => undefined} />);
    expect(screen.getByTestId("vote-progress").textContent).toBe("3 of 10");
    expect(screen.queryByText(/300/)).toBeNull();
    expect(screen.queryByText(/pairs this weekend/i)).toBeNull();
  });

  it("holds the display at the goal for a volunteer past it", () => {
    render(
      <VoteStackView
        serve={pair({ progress: { voted: 14, goal: 10, complete: true } })}
        busy={false}
        onVote={() => undefined}
      />,
    );
    expect(screen.getByTestId("vote-progress").textContent).toBe("10 of 10");
  });

  it("renders nothing rather than a wrong count against a backend with no progress", () => {
    const legacy = pair({ progress: undefined });
    render(<VoteStackView serve={legacy} busy={false} onVote={() => undefined} />);
    expect(screen.queryByTestId("vote-progress")).toBeNull();
  });
});

describe("the empty and re-edit states (EYE-TEST-TEN §1)", () => {
  it("greets zero selections as a valid answer, not an error", () => {
    const empty: ServeResult = { status: "no_fixtures" };
    render(
      <VoteStackView
        serve={empty}
        busy={false}
        onVote={() => undefined}
        onEditPicker={() => undefined}
      />,
    );
    expect(screen.getByTestId("vote-no-fixtures")).toBeTruthy();
    expect(screen.getByText(/that's a fine answer/i)).toBeTruthy();
    // The way back in is offered from the empty state itself.
    expect(screen.getByRole("button", { name: /add games/i })).toBeTruthy();
  });

  it("keeps '+ add games' reachable from the stack", () => {
    const onEditPicker = vi.fn();
    render(
      <VoteStackView
        serve={pair()}
        busy={false}
        onVote={() => undefined}
        onEditPicker={onEditPicker}
      />,
    );
    fireEvent.click(screen.getByTestId("vote-add-games"));
    expect(onEditPicker).toHaveBeenCalled();
  });
});

describe("the picker's retired rows (EYE-TEST-TEN §2)", () => {
  const PICKER_FIXTURES = [
    {
      fixtureId: "f1",
      leagueId: 39,
      kickoffAt: Date.UTC(2026, 7, 15, 14, 0),
      status: "finished",
      homeClubId: "c1",
      awayClubId: "c2",
      homeName: "Club One",
      awayName: "Club Two",
      homeGoals: 1,
      awayGoals: 0,
      scored: true,
    },
    {
      fixtureId: "f2",
      leagueId: 39,
      kickoffAt: Date.UTC(2026, 7, 15, 16, 30),
      status: "finished",
      homeClubId: "c3",
      awayClubId: "c4",
      homeName: "Club Three",
      awayName: "Club Four",
      homeGoals: 2,
      awayGoals: 2,
      scored: true,
    },
  ] as never;

  it("shows a retired game as answered-for and offers no tap the server would refuse", () => {
    const onToggle = vi.fn();
    render(
      <FixturePickerView
        fixtures={PICKER_FIXTURES}
        selected={new Set(["f1"])}
        unseen={new Set(["f2"])}
        busy={false}
        editing
        onToggle={onToggle}
        onContinue={() => undefined}
      />,
    );
    const rows = screen.getAllByTestId("picker-fixture");
    expect(rows[1].getAttribute("data-retired")).toBe("1");
    expect(rows[1].textContent).toMatch(/didn't see this one/i);
    // Not a button at all — a retired row is a statement.
    expect(rows[1].tagName).toBe("DIV");
    fireEvent.click(rows[1]);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("keeps un-retired rows tappable", () => {
    const onToggle = vi.fn();
    render(
      <FixturePickerView
        fixtures={PICKER_FIXTURES}
        selected={new Set()}
        unseen={new Set(["f2"])}
        busy={false}
        editing={false}
        onToggle={onToggle}
        onContinue={() => undefined}
      />,
    );
    const rows = screen.getAllByTestId("picker-fixture");
    expect(rows[0].getAttribute("data-retired")).toBe("0");
    fireEvent.click(rows[0]);
    expect(onToggle).toHaveBeenCalledWith("f1");
  });
});

describe("the reveal (EYE-TEST-TEN §4)", () => {
  it("says the majority share when the voter is with it", () => {
    render(<RevealView reveal={reveal({})} />);
    expect(screen.getByTestId("vote-reveal-line").textContent).toBe("68% went with you");
    expect(screen.getByTestId("vote-reveal").getAttribute("data-tone")).toBe("with");
  });

  it("names the voter's own share when he is in the minority", () => {
    render(<RevealView reveal={reveal({ withYou: 13, percent: 32, majority: false })} />);
    expect(screen.getByTestId("vote-reveal-line").textContent).toBe("You're with the 32%");
  });

  it("shows no percentage at all below the sample threshold", () => {
    render(
      <RevealView reveal={reveal({ total: 3, withYou: 2, percent: null, lowSample: true })} />,
    );
    expect(screen.getByTestId("vote-reveal-line").textContent).toBe(
      "You're one of the first on this one.",
    );
    expect(screen.queryByText(/%/)).toBeNull();
    // No bar either — there is no share to draw.
    expect(screen.queryByTestId("vote-reveal-bar")).toBeNull();
  });
});

describe("the done-state (EYE-TEST-TEN §3)", () => {
  it("closes the ten and frames the extra work as uncounted", () => {
    const onKeepGoing = vi.fn();
    render(
      <DoneView
        progress={{ voted: 10, goal: 10 }}
        exhausted={false}
        onKeepGoing={onKeepGoing}
      />,
    );
    expect(screen.getByText("That's today's ten.")).toBeTruthy();
    expect(screen.getByText("The crowd thanks you.")).toBeTruthy();
    const keepGoing = screen.getByTestId("vote-keep-going");
    expect(keepGoing.textContent).toMatch(/don't count/i);
    fireEvent.click(keepGoing);
    expect(onKeepGoing).toHaveBeenCalled();
  });

  it("closes an exhausted short set as a finish, with nothing left to volunteer for", () => {
    // Few fixtures picked ⇒ fewer than ten pairs exist. The set is whatever
    // exists and the done-state fires anyway — never a "no more pairs" failure.
    render(
      <DoneView progress={{ voted: 4, goal: 10 }} exhausted onKeepGoing={() => undefined} />,
    );
    expect(screen.getByText("That's every game you picked.")).toBeTruthy();
    expect(screen.getByText("The crowd thanks you.")).toBeTruthy();
    expect(screen.queryByTestId("vote-keep-going")).toBeNull();
  });
});
