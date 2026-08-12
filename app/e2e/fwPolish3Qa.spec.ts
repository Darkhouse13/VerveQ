/**
 * FW-POLISH-3 O5 — the four owner-spotted fixes, at 380px against DEV.
 *
 *  1. GW label: the hub says exactly what getOpenGameweek says, and the
 *     ordinal is playable (≥ 1) — the coverage-epoch rule keeps historical
 *     imports off the label (O1).
 *  2. Crew deletion: create → typed-confirm delete → gone from the crews
 *     hub; a crew with a COMPLETED draft (draftSheetForUser) shows no delete
 *     affordance at all (O2).
 *  3. Slot-context picker: a GK slot opens with NO position tab row; the
 *     league → club drill reaches a named club's players in two taps; the
 *     deliberate-mismatch path stays reachable via the sheet's single
 *     "All positions" entry (O3).
 *  4. The leagues line: gone from the picker, present as the squad-screen
 *     strip, collapsing to a count at 4+ leagues with tap-to-expand (O4).
 *
 * Hygiene as ever: console-error-free, no horizontal scroll, screenshots
 * committed, and everything created is purged (purgeUiRun owns simloop_*).
 */

import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const RUN_TAG = `simloop_uifwp3${Date.now() % 100_000}`;

test.use({ viewport: { width: 380, height: 844 } });

function convexRun(fn: string, args: Record<string, unknown> = {}): unknown {
  const out = execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

async function expectNoHorizontalScroll(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, `${label} must not scroll horizontally`).toBeLessThanOrEqual(1);
}

/** Mirrors src/lib/leagueNames.ts — e2e does not import app code. */
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

test("FW-POLISH-3: GW label, crew deletion, slot-aware picker, leagues strip", async ({
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

  const gameweek = convexRun("fantasyMarket:getOpenGameweek") as {
    gwNumber: number;
  } | null;
  expect(gameweek, "an open gameweek must exist").not.toBeNull();
  const weekend = convexRun("fantasyMarket:getWeekendLeagues") as {
    leagues: { leagueId: number; fixtureCount: number }[];
  };
  const inWindow = weekend.leagues.map((l) => l.leagueId);

  // ── O1: the hub label is the server's ordinal, and the ordinal is playable ──
  expect(
    gameweek!.gwNumber,
    "a board's ordinal is 1-based — historical imports must never surface",
  ).toBeGreaterThanOrEqual(1);
  await page.goto("/v2/weekend");
  const boardLine = page.getByTestId("weekend-hub-board-line");
  await expect(boardLine).toBeVisible({ timeout: 45_000 });
  await expect(boardLine).toContainText(`Gameweek ${gameweek!.gwNumber} board is open`);
  await expectNoHorizontalScroll(page, "hub");
  await page.screenshot({ path: "e2e/artifacts/fwp3-hub-gw-label-380.png", fullPage: false });

  // ── guest onboarding through the crews door ──
  await page.getByTestId("weekend-door-crews").click();
  await page.getByText("Play as a guest").click();
  await page.getByRole("textbox").first().fill(RUN_TAG);
  await page.getByRole("button", { name: "Start playing" }).click();
  await expect(
    page.getByRole("button", { name: /Create crew/ }),
  ).toBeVisible({ timeout: 45_000 });

  // ── O2a: create a crew, delete it behind the typed confirm ──
  await page.getByRole("button", { name: /Create crew/ }).click();
  await page.getByPlaceholder("Sunday League Legends").fill("FW-O5 SIM");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const deleteOpen = page.getByTestId("crew-delete-open");
  await expect(deleteOpen, "creator of an undrafted crew sees Delete crew").toBeVisible({
    timeout: 45_000,
  });
  await expectNoHorizontalScroll(page, "crew screen");
  await page.screenshot({ path: "e2e/artifacts/fwp3-crew-delete-380.png", fullPage: true });

  await deleteOpen.click();
  const confirmButton = page.getByTestId("crew-delete-confirm");
  await expect(confirmButton).toBeVisible();
  await expect(confirmButton, "confirm is dead until DELETE is typed").toBeDisabled();
  await page.getByTestId("crew-delete-confirm-input").fill("DELETE");
  await expect(confirmButton).toBeEnabled();
  await page.screenshot({ path: "e2e/artifacts/fwp3-crew-delete-confirm-380.png" });
  await confirmButton.click();

  // Back on the crews hub, the crew is gone.
  await expect(page.getByRole("button", { name: /Create crew/ })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText("FW-O5 SIM")).toHaveCount(0);
  await page.screenshot({ path: "e2e/artifacts/fwp3-crews-hub-after-delete-380.png", fullPage: true });

  // ── O2b: a crew with a COMPLETED draft shows no delete path at all ──
  convexRun("fantasyIntegrationSim:draftSheetForUser", { username: RUN_TAG });
  await page.reload();
  await page.getByText("FW-O5 SIM").click();
  await expect(page.getByText("Drafted", { exact: true }).first()).toBeVisible({
    timeout: 45_000,
  });
  await expect(
    page.getByTestId("crew-delete-open"),
    "a completed draft protects the record — no delete affordance",
  ).toHaveCount(0);
  await expectNoHorizontalScroll(page, "protected crew screen");
  await page.screenshot({ path: "e2e/artifacts/fwp3-crew-protected-380.png", fullPage: true });

  // ── O3 + O4: squad screen strip, slot-aware picker, league→club drill ──
  await page.goto("/v2/weekend/squad");
  await expect(page.getByText("Building for")).toBeVisible({ timeout: 45_000 });
  await page.getByText("Start building").click();
  await expect(page.getByTestId("weekend-pitch")).toBeVisible({ timeout: 45_000 });

  // O4: the strip lives on the squad screen; 4+ leagues collapse to a count.
  const strip = page.getByTestId("squad-leagues-strip");
  await expect(strip).toBeVisible();
  const joined = `This weekend: ${inWindow.map((id) => LEAGUE_NAMES[id]).join(" + ")}`;
  if (inWindow.length <= 3) {
    await expect(strip).toContainText(joined);
  } else {
    await expect(strip).toContainText(`This weekend: ${inWindow.length} leagues`);
    await strip.click();
    await expect(strip).toContainText(joined);
    await page.screenshot({ path: "e2e/artifacts/fwp3-squad-strip-expanded-380.png" });
    await strip.click();
  }
  await expectNoHorizontalScroll(page, "squad screen");
  await page.screenshot({ path: "e2e/artifacts/fwp3-squad-strip-380.png", fullPage: false });

  // O3: the GK slot's picker — no tab row, no THIS WEEKEND line.
  await page.getByTestId("pitch-slot-0").click();
  await expect(page.getByTestId("picker-prompt")).toHaveText(
    "Who starts between the sticks?",
    { timeout: 30_000 },
  );
  const dialog = page.getByRole("dialog").filter({ has: page.getByTestId("picker-prompt") });
  await expect(dialog.getByRole("button", { name: "ALL", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "DEF", exact: true })).toHaveCount(0);
  await expect(dialog.getByText(/This weekend:/)).toHaveCount(0);
  await expectNoHorizontalScroll(page, "picker (GK slot)");
  await page.waitForTimeout(450); // let the dialog's slide-in settle for the artifact
  await page.screenshot({ path: "e2e/artifacts/fwp3-picker-gk-380.png" });

  // League → club drill: two taps to a named club's players.
  const drillLeague = inWindow[0];
  const market = convexRun("fantasyMarket:getMarket") as {
    players: {
      name: string;
      leagueId: number;
      clubName: string | null;
      position: string;
      kickoffAt: number | null;
    }[];
  };
  const drillTarget = market.players.find(
    (p) => p.leagueId === drillLeague && p.position === "GK" && p.kickoffAt !== null && p.clubName !== null,
  );
  expect(drillTarget, `league ${drillLeague} must field a GK this window`).toBeDefined();

  await page.getByTestId("picker-league-chip").click();
  const sheet = page.getByTestId("picker-filter-sheet");
  await expect(sheet).toBeVisible();
  await page.screenshot({ path: "e2e/artifacts/fwp3-picker-league-sheet-380.png" });
  await sheet.getByText(LEAGUE_NAMES[drillLeague], { exact: true }).click(); // tap 1
  await page.getByTestId("picker-club-chip").click();
  await expect(sheet).toBeVisible();
  // The club sheet is scoped to the chosen league and searchable.
  await page.getByTestId("picker-club-search").fill(drillTarget!.clubName!.slice(0, 6));
  await page.screenshot({ path: "e2e/artifacts/fwp3-picker-club-sheet-380.png" });
  await sheet.getByText(drillTarget!.clubName!, { exact: true }).click(); // tap 2
  await expect(
    page
      .getByTestId("picker-row")
      .filter({ has: page.getByTestId("picker-club-line").filter({ hasText: drillTarget!.clubName! }) })
      .first(),
    "two taps land on the club's players",
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(drillTarget!.name)).toBeVisible();
  await expectNoHorizontalScroll(page, "picker (club drill)");
  await page.screenshot({ path: "e2e/artifacts/fwp3-picker-drilled-380.png" });

  // The mismatch path: the sheet's single "All positions" affordance.
  await page.getByTestId("picker-league-chip").click();
  await page.getByTestId("picker-all-positions").click();
  await expect(page.getByTestId("picker-all-positions-chip")).toBeVisible();
  const nonGk = market.players.find(
    (p) =>
      p.leagueId === drillLeague &&
      p.clubName === drillTarget!.clubName &&
      p.position !== "GK" &&
      p.kickoffAt !== null,
  );
  if (nonGk !== undefined) {
    await expect(
      page.getByText(nonGk.name).first(),
      "an out-of-position player is on the board for the deliberate pick",
    ).toBeVisible({ timeout: 30_000 });
  }
  await page.screenshot({ path: "e2e/artifacts/fwp3-picker-all-positions-380.png" });
  await page.keyboard.press("Escape");

  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test.afterAll(() => {
  convexRun("fantasyIntegrationSim:purgeUiRun", {});
});
