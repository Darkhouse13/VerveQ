/**
 * FW-REPRICE R1 — the budget bar for a squad repricing pushed over 91.0.
 *
 * The rule itself is unit-tested against the validator in
 * fantasySquadRules.test.ts. What this file covers is the half the user sees:
 * a grandfathered squad must not be told it is illegal, and the bar must
 * measure against the ceiling that actually binds it. Plus the deploy-window
 * case — CI ships the frontend on its own while Convex is deployed by hand, so
 * this page will briefly run against a server whose `budget` has no
 * `allowance` at all, and it must fall back rather than crash.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string } & Record<string, unknown>) => {
      let out = opts?.defaultValue ?? key;
      for (const [k, val] of Object.entries(opts ?? {})) out = out.replace(`{{${k}}}`, String(val));
      return out;
    },
    i18n: {},
  }),
}));

import { BudgetBar } from "@/pages/shell/weekend/BudgetSquadScreen";
import type { BudgetBreakdown } from "../../convex/lib/fantasySquadRules";

const budget = (over: Partial<BudgetBreakdown>): BudgetBreakdown => ({
  committed: 0,
  live: 0,
  total: 0,
  limit: 91.0,
  allowance: 91.0,
  ...over,
});

describe("budget bar — FW-REPRICE R1 grandfathering", () => {
  it("measures an ordinary squad against the 91.0 budget", () => {
    render(<BudgetBar budget={budget({ live: 84.5, total: 84.5 })} />);
    expect(screen.getByText("84.5")).toBeInTheDocument();
    expect(screen.getByText(/\/ 91\.0/)).toBeInTheDocument();
    expect(screen.getByText("6.5 left")).toBeInTheDocument();
    expect(screen.queryByText(/stays legal/)).not.toBeInTheDocument();
  });

  it("measures a grandfathered squad against its own allowance, not the budget", () => {
    render(<BudgetBar budget={budget({ live: 93.5, total: 93.5, allowance: 93.5 })} />);
    expect(screen.getByText(/\/ 93\.5/)).toBeInTheDocument();
    // headroom is zero, never negative
    expect(screen.getByText("0.0 left")).toBeInTheDocument();
  });

  it("says why the squad is over budget and that it is still legal", () => {
    render(<BudgetBar budget={budget({ live: 93.5, total: 93.5, allowance: 93.5 })} />);
    expect(
      screen.getByText(/New prices put this squad over the 91\.0 budget\. It stays legal/),
    ).toBeInTheDocument();
  });

  it("does not overflow the progress bar for a grandfathered squad", () => {
    render(<BudgetBar budget={budget({ live: 93.5, total: 93.5, allowance: 93.5 })} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemax", "93.5");
    expect(bar).toHaveAttribute("aria-valuenow", "93.5");
  });

  it("falls back to the limit when the server predates `allowance` (deploy window)", () => {
    // A server that predates `allowance` simply omits it.
    const legacy = { committed: 0, live: 80, total: 80, limit: 91.0 } as BudgetBreakdown;
    render(<BudgetBar budget={legacy} />);
    expect(screen.getByText(/\/ 91\.0/)).toBeInTheDocument();
    expect(screen.getByText("11.0 left")).toBeInTheDocument();
  });
});
