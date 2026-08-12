/**
 * FW-IMMERSE A4 — matchday hub contract.
 *
 * Locks on the inverted hub's honesty rules:
 *  - the hero speaks in countdown / in-play / played states derived ONLY
 *    from the fixtures payload and `now` — and renders nothing without data
 *    (fail-quiet: a backend predating getWeekendFixtures shows the old hub);
 *  - the squad status card's settled label derives from the settlement stamp
 *    (state === "final" with nothing awaiting), never from the clock — the
 *    component takes no clock at all;
 *  - a fixture card's scoreline comes only from feed goals in a scoreline
 *    state; postponed reads OFF; a scored fixture carries the points-in tick.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// A bare i18n instance so t() interpolates its defaultValue strings — the
// assertions below read interpolated copy ("5 spots still open").
beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    resources: {},
    interpolation: { escapeValue: false },
  });
});

import { MatchdayHero, SquadStatusCard } from "@/pages/shell/weekend/WeekendHubScreen";
import type { SquadScorePayload } from "@/pages/shell/weekend/WeekendHubScreen";
import { FixtureCard } from "@/pages/shell/weekend/FixturesScreen";
import type {
  WeekendFixturesPayload,
  WeekendFixtureRow,
} from "@/pages/shell/weekend/FixturesScreen";

const NOW = Date.UTC(2026, 7, 15, 14, 0, 0);

let fixtureSeq = 0;
function fixture(overrides: Partial<WeekendFixtureRow>): WeekendFixtureRow {
  fixtureSeq += 1;
  return {
    fixtureId: `fx-${fixtureSeq}`,
    leagueId: 88,
    kickoffAt: NOW + 3_600_000,
    status: "scheduled",
    homeClubId: "h",
    awayClubId: "a",
    homeName: "Telstar",
    awayName: "Sparta Rotterdam",
    homeGoals: null,
    awayGoals: null,
    scored: false,
    ...overrides,
  } as WeekendFixtureRow;
}

function payload(fixtures: WeekendFixtureRow[]): WeekendFixturesPayload {
  return {
    gameweekId: "gw-1",
    season: "2026-2027",
    gwNumber: 1,
    status: "upcoming",
    finalityAt: NOW + 7 * 86_400_000,
    fixtures,
  } as WeekendFixturesPayload;
}

function squadScore(overrides: Partial<SquadScorePayload>): SquadScorePayload & {
  gwNumber: number;
} {
  return {
    total: 0,
    state: "provisional",
    finalityAt: NOW,
    finalizedAt: null,
    scoredSlots: 0,
    awaitingSlots: 0,
    emptySlots: 0,
    awaiting: false,
    slots: [],
    gwNumber: 1,
    ...overrides,
  } as unknown as SquadScorePayload & { gwNumber: number };
}

describe("MatchdayHero", () => {
  it("renders nothing without a fixtures payload (fail-quiet)", () => {
    const { container } = render(<MatchdayHero gwNumber={1} payload={null} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("before any ball is kicked: first-kickoff countdown with the opening fixture", () => {
    render(
      <MatchdayHero
        gwNumber={1}
        payload={payload([
          fixture({ kickoffAt: NOW + 26 * 3_600_000 + 5 * 60_000 + 9_000 }),
          fixture({ kickoffAt: NOW + 30 * 3_600_000 }),
        ])}
        now={NOW}
      />,
    );
    expect(screen.getByText(/First kickoff in/i)).toBeInTheDocument();
    expect(screen.getByTestId("matchday-countdown").textContent).toBe("26:05:09");
    expect(screen.getByText(/Telstar v Sparta Rotterdam/)).toBeInTheDocument();
  });

  it("mid-weekend with more to come: next-kickoff countdown plus the pulse line", () => {
    render(
      <MatchdayHero
        gwNumber={1}
        payload={payload([
          fixture({ status: "finished", kickoffAt: NOW - 8 * 3_600_000, scored: true }),
          fixture({ status: "live", kickoffAt: NOW - 3_600_000 }),
          fixture({ kickoffAt: NOW + 1_800_000 }),
        ])}
        now={NOW}
      />,
    );
    expect(screen.getByText(/Next kickoff in/i)).toBeInTheDocument();
    expect(screen.getByTestId("matchday-countdown").textContent).toBe("00:30:00");
    expect(screen.getByText("1 in play · 1 played · 1 scored")).toBeInTheDocument();
  });

  it("nothing ahead but balls in play: the in-play count is the number", () => {
    render(
      <MatchdayHero
        gwNumber={1}
        payload={payload([
          fixture({ status: "live", kickoffAt: NOW - 3_600_000 }),
          fixture({ status: "live", kickoffAt: NOW - 1_800_000 }),
          fixture({ status: "finished", kickoffAt: NOW - 9 * 3_600_000 }),
        ])}
        now={NOW}
      />,
    );
    expect(screen.getByText(/In play now/i)).toBeInTheDocument();
    expect(screen.getByTestId("matchday-countdown").textContent).toBe("2");
  });

  it("weekend played: scored-over-total, no invented countdown", () => {
    render(
      <MatchdayHero
        gwNumber={1}
        payload={payload([
          fixture({ status: "finished", kickoffAt: NOW - 9 * 3_600_000, scored: true }),
          fixture({ status: "finished", kickoffAt: NOW - 8 * 3_600_000 }),
        ])}
        now={NOW}
      />,
    );
    expect(screen.getByText(/Weekend played/i)).toBeInTheDocument();
    expect(screen.getByTestId("matchday-countdown").textContent).toBe("1/2");
  });
});

describe("SquadStatusCard", () => {
  it("an unfinished 13 leads with the open spots", () => {
    render(
      <SquadStatusCard score={squadScore({ emptySlots: 5 })} onOpen={() => {}} />,
    );
    expect(screen.getByText("5 spots still open")).toBeInTheDocument();
  });

  it("provisional points while anything awaits — even past finality (stamp rule)", () => {
    render(
      <SquadStatusCard
        score={squadScore({ total: 34.5, scoredSlots: 10, awaitingSlots: 3, state: "final" })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/34\.5/)).toBeInTheDocument();
    expect(screen.getByText(/provisional/i)).toBeInTheDocument();
    expect(screen.getByText(/3 awaiting/)).toBeInTheDocument();
  });

  it("settled only when the stamp says final AND nothing awaits", () => {
    render(
      <SquadStatusCard
        score={squadScore({ total: 61.2, scoredSlots: 13, state: "final" })}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByText(/settled/i)).toBeInTheDocument();
  });

  it("taps through to the squad", () => {
    let opened = false;
    render(
      <SquadStatusCard
        score={squadScore({ emptySlots: 1 })}
        onOpen={() => {
          opened = true;
        }}
      />,
    );
    fireEvent.click(screen.getByTestId("squad-status-card"));
    expect(opened).toBe(true);
  });
});

describe("FixtureCard", () => {
  it("a played fixture with feed goals shows the scoreline and FT", () => {
    render(
      <FixtureCard
        fixture={fixture({
          status: "finished",
          kickoffAt: NOW - 9 * 3_600_000,
          homeGoals: 2,
          awayGoals: 1,
        })}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("fixture-score").textContent).toBe("2–1");
    expect(screen.getByText("FT")).toBeInTheDocument();
  });

  it("a postponed fixture reads OFF with its badge — never a scoreline", () => {
    render(
      <FixtureCard
        fixture={fixture({ status: "postponed", homeGoals: 0, awayGoals: 0 })}
        now={NOW}
      />,
    );
    expect(screen.queryByTestId("fixture-score")).not.toBeInTheDocument();
    expect(screen.getByTestId("fixture-kickoff").textContent).toBe("OFF");
    expect(screen.getByText("Postponed")).toBeInTheDocument();
  });

  it("a scored fixture carries the points-in tick; an unscored one doesn't", () => {
    const { rerender } = render(
      <FixtureCard
        fixture={fixture({
          status: "finished",
          kickoffAt: NOW - 9 * 3_600_000,
          scored: true,
        })}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("fixture-points-in")).toBeInTheDocument();
    rerender(
      <FixtureCard
        fixture={fixture({ status: "finished", kickoffAt: NOW - 9 * 3_600_000 })}
        now={NOW}
      />,
    );
    expect(screen.queryByTestId("fixture-points-in")).not.toBeInTheDocument();
  });

  it("locks once kicked off: a started fixture shows the lock, an upcoming one doesn't", () => {
    const { rerender } = render(
      <FixtureCard fixture={fixture({ kickoffAt: NOW - 60_000 })} now={NOW} />,
    );
    expect(screen.getByTestId("fixture-lock")).toBeInTheDocument();
    rerender(<FixtureCard fixture={fixture({ kickoffAt: NOW + 60_000 })} now={NOW} />);
    expect(screen.queryByTestId("fixture-lock")).not.toBeInTheDocument();
  });
});
