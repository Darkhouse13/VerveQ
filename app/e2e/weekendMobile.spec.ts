/**
 * THE WEEKEND on a phone (FW-POLISH O5): the full loop at 380px against the
 * DEV backend — hub → budget build ON THE PITCH → formation change with
 * players placed (including the displaced-pick tray) → crew create → draft
 * lobby → vote → court. Every screen is asserted to fit the viewport (no
 * horizontal scroll) and the whole run must stay console-error-free.
 *
 * DEV writes are owned: the browser user carries the simloop_ prefix, the
 * crew carries the sim's crew name, and the suite's last step purges through
 * the sim's own purge. One test, one session.
 *
 * Vote and court are asserted as SURFACES (reachable, honest state, fits):
 * whether a pair can actually be served depends on the real window having
 * finished matches, which this suite must not fabricate on DEV.
 */
import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

const RUN_TAG = `simloop_ui${Date.now() % 1_000_000}`;
/** Must match fantasyIntegrationSim.SIM_CREW_NAME so purgeUiRun owns it. */
const SIM_CREW_NAME = "FW-O5 SIM";

test.use({ viewport: { width: 380, height: 844 } });

function convexRun(fn: string, args: Record<string, unknown> = {}): unknown {
  const out = execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], {
    cwd: process.cwd(),
    encoding: "utf8",
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

test("THE WEEKEND full loop at 380px: hub → pitch build → shape change → crew → lobby → vote → court", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  // Pre-choose the language so the first-run prompt's overlay never sits
  // between the test and the account chooser.
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });

  // ── the hub: four doors on the dark canvas, league framing line ──
  await page.goto("/v2/weekend");
  await expect(page.getByTestId("weekend-door-squad")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("weekend-door-crews")).toBeVisible();
  await expect(page.getByTestId("weekend-door-vote")).toBeVisible();
  await expect(page.getByTestId("weekend-door-court")).toBeVisible();
  // D4: the hub says which leagues play this window (fixture-derived).
  await expect(page.getByTestId("weekend-hub-leagues-line")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId("weekend-hub-leagues-line")).toContainText(
    /This weekend:/i,
  );
  await expectNoHorizontalScroll(page, "hub");
  await page.screenshot({ path: "e2e/artifacts/weekend-hub-380.png", fullPage: true });

  // ── guest onboarding through the squad door ──
  await page.getByTestId("weekend-door-squad").click();
  await page.getByText("Play as a guest").click();
  await page.getByRole("textbox").first().fill(RUN_TAG);
  await page.getByRole("button", { name: "Start playing" }).click();

  // ── create: D3 preset chips, never a stepper ──
  await expect(page.getByText("Building for")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("formation-chips")).toBeVisible();
  await expect(page.getByRole("button", { name: "4-4-2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expectNoHorizontalScroll(page, "create view");
  await page.getByText("Start building").click();

  // ── the pitch: 11 open positions + 2 finishers on the touchline ──
  await expect(page.getByTestId("weekend-pitch")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("/ 91.0")).toBeVisible();
  expect(await page.locator('[data-chip-state="empty"]').count()).toBe(13);
  await expectNoHorizontalScroll(page, "pitch (empty)");
  await page.screenshot({
    path: "e2e/artifacts/weekend-pitch-empty-380.png",
    fullPage: true,
  });

  // ── build via the pitch: GK first — the position asks its question ──
  await page.getByTestId("pitch-slot-0").click();
  await expect(page.getByText("Who starts between the sticks?")).toBeVisible();
  const firstPick = page.getByRole("button", { name: "Pick", exact: true }).first();
  await expect(firstPick).toBeVisible({ timeout: 45_000 });
  await firstPick.click();
  await expect(page.getByText("91.0 left")).toHaveCount(0, { timeout: 30_000 });

  // …then the whole back four, to force a displacement later.
  for (const slotIndex of [1, 2, 3, 4]) {
    await page.getByTestId(`pitch-slot-${slotIndex}`).click();
    await expect(page.getByText("Who holds the back line?")).toBeVisible();
    const pick = page.getByRole("button", { name: "Pick", exact: true }).first();
    await expect(pick).toBeVisible({ timeout: 45_000 });
    await pick.click();
    // Manned: any non-empty state (DEV's real window may already carry
    // score rows, so a fresh pick can legitimately read "awaiting").
    await expect(page.getByTestId(`pitch-slot-${slotIndex}`)).toHaveAttribute(
      "data-chip-state",
      /filled|locked|awaiting|scored/,
      { timeout: 30_000 },
    );
  }
  await page.screenshot({
    path: "e2e/artifacts/weekend-pitch-manned-380.png",
    fullPage: true,
  });

  // ── formation change with players placed: 4-4-2 → 3-5-2 displaces one ──
  await page.getByRole("button", { name: "3-5-2" }).click();
  await expect(page.getByText(/no room for/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Switch shape" }).click();
  // The shape switched and the displaced pick waits, visibly, in the tray.
  await expect(page.getByText("Shape — 3-5-2")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("displaced-tray")).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalScroll(page, "pitch (tray)");
  await page.screenshot({
    path: "e2e/artifacts/weekend-shape-tray-380.png",
    fullPage: true,
  });
  // One tap brings him back on (first open slot).
  await page.getByRole("button", { name: "Bring back on" }).first().click();
  await expect(page.getByTestId("displaced-tray")).toHaveCount(0, { timeout: 30_000 });

  // ── crew: create, land on the crew page, open the lobby ──
  await page.goto("/v2/weekend/crews");
  await expect(page.getByText("Create crew")).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalScroll(page, "crews hub");
  await page.getByText("Create crew").click();
  await page.getByRole("textbox").first().fill(SIM_CREW_NAME);
  await page.getByRole("button", { name: /^Create$/ }).click();
  await expect(page.getByText("Crew code")).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalScroll(page, "crew page");
  await page.getByText("Open this weekend's draft").click();
  await expect(page).toHaveURL(/\/v2\/weekend\/draft\//, { timeout: 30_000 });
  await expect(page.getByText("Ready up")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("A draft needs at least 2 drafters.")).toBeVisible();
  await expectNoHorizontalScroll(page, "draft lobby");
  await page.screenshot({ path: "e2e/artifacts/weekend-lobby-380.png", fullPage: true });

  // ── crew sheet of a server-drafted room: pitch with players fixed ──
  const drafted = convexRun("fantasyIntegrationSim:draftSheetForUser", {
    username: RUN_TAG,
  }) as { roomId: string };
  expect(drafted.roomId).toBeTruthy();
  await page.goto(`/v2/weekend/sheet/${drafted.roomId}`);
  await expect(page.getByText("the 13 are the 13 — arrange, don't re-man")).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByTestId("weekend-pitch")).toBeVisible();
  // Players are fixed: a manned chip's sheet offers Move, never Clear.
  await page.getByTestId("pitch-slot-0").click();
  await expect(page.getByLabel("Move")).toBeVisible();
  expect(await page.getByLabel("Clear").count()).toBe(0);
  // A real swap through the atomic setFormation: arm, then tap a target chip.
  await page.getByLabel("Move").click();
  await expect(page.getByText(/Now tap where he goes/)).toBeVisible();
  await page.getByTestId("pitch-slot-1").click();
  await expect(page.getByText(/Now tap where he goes/)).toHaveCount(0, {
    timeout: 30_000,
  });
  await expectNoHorizontalScroll(page, "crew sheet");
  await page.screenshot({ path: "e2e/artifacts/weekend-sheet-380.png", fullPage: true });

  // ── vote: reachable, honest about whether pairs can be served ──
  await page.goto("/v2/weekend/vote");
  await expect(
    page
      .getByText("Who had the better game?")
      .or(page.getByText("Voting is closed right now."))
      .or(page.getByText("No more pairs for now."))
      .or(page.getByText("No board is open right now."))
      .first(),
  ).toBeVisible({ timeout: 45_000 });
  await expectNoHorizontalScroll(page, "vote");
  await page.screenshot({ path: "e2e/artifacts/weekend-vote-380.png", fullPage: true });

  // ── court: the docket renders (or the honest closed card) ──
  await page.goto("/v2/weekend/court");
  await expect(
    page
      .getByText("File a claim")
      .or(page.getByText("No board is open right now."))
      .first(),
  ).toBeVisible({ timeout: 45_000 });
  await expectNoHorizontalScroll(page, "court");
  await page.screenshot({ path: "e2e/artifacts/weekend-court-380.png", fullPage: true });

  // ── the whole loop ran clean ──
  expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
});

test.afterAll(() => {
  convexRun("fantasyIntegrationSim:purgeUiRun", {});
});
