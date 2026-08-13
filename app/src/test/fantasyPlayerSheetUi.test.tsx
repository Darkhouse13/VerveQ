/**
 * Weekend Fantasy FW-SCOUT — the player detail sheet's display law.
 *
 * Renders the real PlayerSheet against stubbed getPlayerCard payloads and
 * asserts the mission's product rules AS RENDERED:
 *
 *   - stats, never a recommendation: no rating/rank/composite string appears
 *     anywhere in the sheet, for any payload;
 *   - absence renders in words, never as 0: a flagged player reads "not
 *     enough football on record", a missing stat row simply isn't there,
 *     empty history says history builds as weekends settle;
 *   - per-90 derivation is the only arithmetic: displayed values equal
 *     total × 90 / minutes of the served line;
 *   - provisional history rows carry the Provisional badge and the crowd
 *     factor renders signed;
 *   - ownership below the floor renders NOTHING (the payload's inSquads:
 *     null), at/above it renders the percentage;
 *   - early-season current rows (< 180') render apps/minutes only.
 *
 * Only convex/react and i18n are mocked (the house pattern).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const queryMock = vi.hoisted(() => ({
  card: undefined as unknown,
}));

vi.mock("convex/react", () => ({
  useQuery: (_ref: unknown, args: unknown) => (args === "skip" ? undefined : queryMock.card),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string } & Record<string, unknown>) => {
      let out = opts?.defaultValue ?? key;
      for (const [k, val] of Object.entries(opts ?? {})) {
        out = out.replace(`{{${k}}}`, String(val));
      }
      return out;
    },
    i18n: {},
  }),
}));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

import { PlayerSheet } from "@/components/weekend/PlayerSheet";

const BASE_CARD = {
  playerId: "p1",
  providerPlayerId: "19617",
  name: "M. Olise",
  position: "MID",
  clubId: "157",
  clubName: "Bayern München",
  leagueId: 78,
  price: 13,
  active: true,
  pool: "topfive",
  weekend: {
    gameweekId: "gw1",
    gwNumber: 1,
    kickoffAt: Date.now() + 86_400_000,
    fixtureStatus: "scheduled",
    opponentName: "Leipzig",
    isHome: true,
  },
  seasons: [
    {
      season: "2025-26",
      source: "pricing-seed",
      pulledAt: 1,
      leagueLabel: "Bundesliga",
      line: {
        minutes: 2317, apps: 32, goals: 15, assists: 19, keyPasses: 81,
        tackles: 24, interceptions: 13, shotsOn: 50, saves: 0,
        csRate: 0.3529, gaPerMatch: 1.0588,
      },
      partial: null,
    },
  ],
  ownership: { totalSquads: 3, inSquads: null },
  history: [],
};

function openSheet() {
  render(<PlayerSheet playerId="p1" onClose={() => {}} surface="picker" />);
}

beforeEach(() => {
  cleanup();
  queryMock.card = BASE_CARD;
});

describe("FW-SCOUT — PlayerSheet display law", () => {
  it("renders identity, matchup, and per-90 values derived from the served line", () => {
    openSheet();
    expect(screen.getByText("M. Olise")).toBeInTheDocument();
    expect(screen.getByTestId("player-sheet-weekend").textContent).toContain("vs Leipzig");
    const grid = screen.getByTestId("player-sheet-last-season");
    // 15 goals × 90 / 2317' = 0.58; 19 assists → 0.74; 81 key passes → 3.15;
    // 24+13 tackles+int → 1.44; 50 SoT → 1.94 — the only arithmetic allowed.
    expect(grid.textContent).toContain("0.58");
    expect(grid.textContent).toContain("0.74");
    expect(grid.textContent).toContain("3.15");
    expect(grid.textContent).toContain("1.44");
    expect(grid.textContent).toContain("1.94");
    expect(screen.getByText(/32 apps · 2317′/)).toBeInTheDocument();
    // MID: club clean-sheet/concession exposure is NOT shown (by-position rule).
    expect(grid.textContent).not.toContain("0.35");
  });

  it("never renders a recommendation vocabulary", () => {
    openSheet();
    const text = document.body.textContent ?? "";
    for (const banned of ["rating", "rank", "pick score", "recommended", "proxy"]) {
      expect(text.toLowerCase()).not.toContain(banned);
    }
  });

  it("flagged player: absence in words, never zeros; floor pricing named", () => {
    queryMock.card = {
      ...BASE_CARD,
      name: "D. Kownacki",
      pool: "flagged",
      price: 4,
      seasons: [
        {
          season: "2025-26", source: "pricing-seed", pulledAt: 1,
          leagueLabel: "", line: null, partial: null,
        },
      ],
    };
    openSheet();
    expect(screen.getByTestId("player-sheet-pool").textContent).toContain("floor priced");
    expect(screen.getByTestId("player-sheet-no-season").textContent).toContain(
      "Not enough football on record",
    );
    expect(screen.queryByTestId("player-sheet-last-season")).toBeNull();
    // No fabricated zero anywhere in a stats position.
    expect(document.body.textContent).not.toContain("0.00");
  });

  it("flagged with out-of-scope minutes says what exists without dressing it as a season line", () => {
    queryMock.card = {
      ...BASE_CARD,
      pool: "flagged",
      seasons: [
        {
          season: "2025-26", source: "pricing-seed", pulledAt: 1,
          leagueLabel: "", line: null, partial: { minutes: 84, apps: 3 },
        },
      ],
    };
    openSheet();
    expect(screen.getByTestId("player-sheet-no-season").textContent).toContain("84′ outside covered league play");
  });

  it("GK grid shows saves and club rates, labelled per match", () => {
    queryMock.card = {
      ...BASE_CARD,
      name: "J. Drommel",
      position: "GK",
      pool: "eredivisie",
      seasons: [
        {
          season: "2025-26", source: "pricing-seed", pulledAt: 1,
          leagueLabel: "Eredivisie",
          line: {
            minutes: 3060, apps: 34, goals: 0, assists: 0, keyPasses: 2,
            tackles: 1, interceptions: 0, shotsOn: 0, saves: 139,
            csRate: 0.3235, gaPerMatch: 1.8235,
          },
          partial: null,
        },
      ],
    };
    openSheet();
    const grid = screen.getByTestId("player-sheet-last-season");
    // 139 saves × 90 / 3060' = 4.09
    expect(grid.textContent).toContain("4.09");
    expect(grid.textContent).toContain("Club clean sheets /match");
    expect(grid.textContent).toContain("0.32");
    expect(screen.getByText(/club rates per match/)).toBeInTheDocument();
  });

  it("current season below 180' renders apps/minutes only; at 180'+ the grid", () => {
    const current = (minutes: number, apps: number) => ({
      season: "2026-27", source: "api-refresh", pulledAt: 2,
      leagueLabel: "Bundesliga",
      line: {
        minutes, apps, goals: 2, assists: 1, keyPasses: 6,
        tackles: 3, interceptions: 1, shotsOn: 5, saves: 0,
        csRate: null, gaPerMatch: null,
      },
      partial: null,
    });
    queryMock.card = { ...BASE_CARD, seasons: [current(90, 1), BASE_CARD.seasons[0]] };
    openSheet();
    expect(screen.getByTestId("player-sheet-early-season").textContent).toContain("1 apps, 90′");
    expect(screen.queryByTestId("player-sheet-this-season")).toBeNull();

    cleanup();
    queryMock.card = { ...BASE_CARD, seasons: [current(180, 2), BASE_CARD.seasons[0]] };
    openSheet();
    // 2 goals × 90 / 180' = 1.00 — the grid unlocks exactly at the threshold.
    expect(screen.getByTestId("player-sheet-this-season").textContent).toContain("1.00");
    // Last season stays rendered alongside — primary until form accrues.
    expect(screen.getByTestId("player-sheet-last-season")).toBeInTheDocument();
  });

  it("ownership: hidden when the payload hides it, a percentage when served", () => {
    openSheet();
    expect(screen.queryByTestId("player-sheet-ownership")).toBeNull();

    cleanup();
    queryMock.card = { ...BASE_CARD, ownership: { totalSquads: 12, inSquads: 3 } };
    openSheet();
    expect(screen.getByTestId("player-sheet-ownership").textContent).toContain("25%");
    expect(screen.getByTestId("player-sheet-ownership").textContent).toContain("(3/12)");
  });

  it("history: provisional badge, signed crowd factor, sparse-friendly empty state", () => {
    openSheet();
    expect(screen.getByTestId("player-sheet-no-history").textContent).toContain(
      "history builds as weekends settle",
    );

    cleanup();
    queryMock.card = {
      ...BASE_CARD,
      history: [
        {
          gameweekId: "gw1", season: "2026-2027", gwNumber: 1,
          points: 8.5, state: "provisional", crowdFactor: 0.07, appearances: 1,
        },
      ],
    };
    openSheet();
    const history = screen.getByTestId("player-sheet-history");
    expect(history.textContent).toContain("GW 1");
    expect(history.textContent).toContain("8.5");
    expect(screen.getByText("Provisional")).toBeInTheDocument();
    expect(history.textContent).toContain("crowd +7%");
  });
});
