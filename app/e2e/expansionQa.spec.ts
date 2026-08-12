/**
 * FW-EXPAND O6 — eight-league universe QA at 380px.
 *
 * Window-agnostic by design: the spec asks the deployment which leagues play
 * the open window (getWeekendLeagues) and asserts against THAT, so it holds
 * on a Championship-heavy midweek exactly as on an all-in weekend.
 *
 *  1. The hub's "This weekend" line names every in-window league, in the
 *     server's fixture-count order.
 *  2. In the picker (Show all on), every one of the EIGHT seeded leagues is
 *     visible via a flagship club; in-window clubs carry the U1 matchup line
 *     ("· vs X (H|A)"), out-of-window clubs carry the No fixture badge.
 *  3. A squad takes one pick from EACH in-window league (the mission's
 *     "every league buildable" gate, scoped to what the window permits).
 *
 * Same invariants and hygiene as weekendMobile.spec.ts: no horizontal
 * scroll, console-error-free, guest tagged for purgeUiRun.
 */

import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const RUN_TAG = `simloop_ui${Date.now() % 1_000_000}`;

test.use({ viewport: { width: 380, height: 844 } });

function convexRun(fn: string, args: Record<string, unknown> = {}): unknown {
  const out = execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], {
    cwd: process.cwd(),
    encoding: "utf8",
    // getMarket ships the whole ~4.7k-player pool — far past the 1MB default.
    maxBuffer: 64 * 1024 * 1024,
  });
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

/** Clear the picker's slot-position pre-filter through its ONE affordance:
 *  the "All positions" entry in the League/Club filter sheet (FW-POLISH-3 O3). */
async function enableAllPositions(page: Page) {
  await page.getByTestId("picker-league-chip").click();
  await page.getByTestId("picker-all-positions").click();
  await expect(page.getByTestId("picker-all-positions-chip")).toBeVisible();
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, `${label} must not scroll horizontally`).toBeLessThanOrEqual(1);
}

/** Mirrors src/lib/leagueNames.ts — inlined because e2e does not import app code. */
const LEAGUE_NAMES: Record<number, string> = {
  39: "Premier League",
  140: "La Liga",
  135: "Serie A",
  78: "Bundesliga",
  61: "Ligue 1",
  88: "Eredivisie",
  94: "Liga Portugal",
  40: "Championship",
};

/** One distinctive flagship club per league — chosen so a substring search
 *  cannot collide with player names or other clubs. */
const FLAGSHIP_CLUB: Record<number, string> = {
  39: "Arsenal",
  140: "Barcelona",
  135: "Juventus",
  78: "Dortmund",
  61: "Marseille",
  88: "Ajax",
  94: "Benfica",
  40: "Wrexham",
};

test("FW-EXPAND: eight leagues seeded, matchup lines, one pick per in-window league", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });

  // What does the open window actually hold?
  const weekend = convexRun("fantasyMarket:getWeekendLeagues") as {
    gwNumber: number;
    leagues: { leagueId: number; fixtureCount: number }[];
  } | null;
  expect(weekend, "an open gameweek must exist").not.toBeNull();
  const inWindow = weekend!.leagues.map((l) => l.leagueId);
  expect(inWindow.length, "the open window must hold at least one league").toBeGreaterThan(0);

  // ── 1. hub framing: every in-window league named, server order.
  //      FW-POLISH-3 O4: 4+ leagues collapse to a count with tap-to-expand. ──
  await page.goto("/v2/weekend");
  const leaguesLine = page.getByTestId("weekend-hub-leagues-line");
  await expect(leaguesLine).toBeVisible({ timeout: 45_000 });
  const joinedLeagues = `This weekend: ${inWindow.map((id) => LEAGUE_NAMES[id]).join(" + ")}`;
  if (inWindow.length <= 3) {
    await expect(leaguesLine).toContainText(joinedLeagues);
  } else {
    await expect(leaguesLine).toContainText(`This weekend: ${inWindow.length} leagues`);
    await leaguesLine.click();
    await expect(leaguesLine).toContainText(joinedLeagues);
    await leaguesLine.click(); // collapse back — the hub's resting state
  }
  await page.screenshot({ path: "e2e/artifacts/expansion-hub-380.png", fullPage: true });

  // ── guest onboarding through the squad door ──
  await page.getByTestId("weekend-door-squad").click();
  await page.getByText("Play as a guest").click();
  await page.getByRole("textbox").first().fill(RUN_TAG);
  await page.getByRole("button", { name: "Start playing" }).click();
  await expect(page.getByText("Building for")).toBeVisible({ timeout: 45_000 });
  await page.getByText("Start building").click();
  await expect(page.getByTestId("weekend-pitch")).toBeVisible({ timeout: 45_000 });

  // What the market itself says: per league, a club that PLAYS this window
  // (an in-window league is staggered — its flagship may well rest) and a
  // club that does not.
  const market = convexRun("fantasyMarket:getMarket") as {
    players: {
      name: string;
      leagueId: number;
      clubName: string | null;
      price: number | null;
      kickoffAt: number | null;
      opponentName: string | null;
    }[];
  };
  const playingClubOf = new Map<number, string>();
  for (const p of market.players) {
    if (p.kickoffAt !== null && p.clubName !== null && !playingClubOf.has(p.leagueId)) {
      playingClubOf.set(p.leagueId, p.clubName);
    }
  }
  for (const leagueId of inWindow) {
    expect(
      playingClubOf.has(leagueId),
      `market must hold a playing club for league ${leagueId}`,
    ).toBe(true);
  }

  // ── 2. every seeded league visible in the picker; U1 matchup where the
  //      club plays, the badge where it does not ──
  await page.getByTestId("pitch-slot-0").click();
  await expect(page.getByRole("button", { name: "Pick", exact: true }).first()).toBeVisible({
    timeout: 45_000,
  });
  // FW-POLISH-3 O3: the tab row is gone — the one all-positions affordance
  // lives in the League/Club filter sheet.
  await enableAllPositions(page);
  await page.getByRole("button", { name: "Show all", exact: true }).click();
  const search = page.getByPlaceholder("Search name or club…");

  const rowsFor = (club: string) =>
    page
      .getByTestId("picker-row")
      .filter({ has: page.getByTestId("picker-club-line").filter({ hasText: club }) });

  for (const [leagueIdRaw, club] of Object.entries(FLAGSHIP_CLUB)) {
    const leagueId = Number(leagueIdRaw);
    // 2a: the league is seeded — its flagship club is in the market.
    await search.fill(club);
    await expect(
      rowsFor(club).first(),
      `${LEAGUE_NAMES[leagueId]} (${club}) must be in the market`,
    ).toBeVisible({ timeout: 30_000 });

    // 2b: U1 — a club that plays this window carries the matchup line…
    const playing = playingClubOf.get(leagueId);
    if (playing !== undefined) {
      await search.fill(playing);
      await expect(
        rowsFor(playing).first().getByTestId("picker-club-line"),
        `${playing} plays this window — matchup line expected`,
      ).toContainText(/· vs .+ \((H|A)\)/, { timeout: 30_000 });
    } else {
      // …and a league with no window fixtures shows the badge, never a
      // fabricated opponent.
      await expect(
        rowsFor(club).first().getByText("No fixture"),
        `${club} does not play this window — badge expected`,
      ).toBeVisible();
    }
  }
  await expectNoHorizontalScroll(page, "picker (show all)");
  await page.screenshot({
    path: "e2e/artifacts/expansion-picker-380.png",
    fullPage: false,
  });
  await page.keyboard.press("Escape");

  // ── 3. one pick from EACH in-window league ──
  // Slot 0 is the GK, 1..4 the back line in the default 4-4-2 — enough slots
  // for any realistic window (a window has at most 8 leagues).
  for (let i = 0; i < inWindow.length; i += 1) {
    const leagueId = inWindow[i];
    const club = playingClubOf.get(leagueId) as string;
    await page.getByTestId(`pitch-slot-${i}`).click();
    const pickerSearch = page.getByPlaceholder("Search name or club…");
    await expect(pickerSearch).toBeVisible({ timeout: 30_000 });
    // Clear the slot's position pre-filter so the club's list is never empty
    // for this slot's role (all-positions-eligible; mismatch priced, not
    // banned) — via the sheet's single affordance (FW-POLISH-3 O3).
    await enableAllPositions(page);
    await pickerSearch.fill(club);
    const pick = page.getByRole("button", { name: "Pick", exact: true }).first();
    await expect(pick, `${club} must offer a pickable player`).toBeEnabled({
      timeout: 30_000,
    });
    await pick.click();
    await expect(page.getByTestId(`pitch-slot-${i}`)).toHaveAttribute(
      "data-chip-state",
      /filled|locked|awaiting|scored/,
      { timeout: 30_000 },
    );
  }
  await expectNoHorizontalScroll(page, "pitch (per-league picks)");
  await page.screenshot({
    path: "e2e/artifacts/expansion-pitch-380.png",
    fullPage: true,
  });

  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test.afterAll(() => {
  convexRun("fantasyIntegrationSim:purgeUiRun", {});
});
