/**
 * FW-GO smoke — THE WEEKEND un-gated, on a 380px phone against DEV.
 *
 * The mission's pre-push gate: from the public short link, a fresh guest can
 * (1) reach the new hub, (2) build a budget squad, (3) create a crew and
 * (4) reach a draft lobby — every screen fitting 380px with no horizontal
 * scroll. DEV writes are owned: the guest carries the simloop_ prefix and the
 * suite purges through the sim's own purge, like weekendMobile.spec.ts.
 */
import { execFileSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";

test.use({ viewport: { width: 380, height: 800 } });

const RUN_TAG = `simloop_go${Date.now() % 1_000_000}`;

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

test("FW-GO: short link → hub → budget squad → crew → draft lobby at 380px", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("verveq_lang_chosen", "1");
  });

  // ── the public short link lands on the hub, no session asked ──
  await page.goto("/weekend");
  await expect(page).toHaveURL(/\/v2\/weekend\?/);
  await expect(page.getByTestId("weekend-door-squad")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("weekend-door-crews")).toBeVisible();
  await expect(page.getByTestId("weekend-door-vote")).toBeVisible();
  await expect(page.getByTestId("weekend-door-court")).toBeVisible();
  await expectNoHorizontalScroll(page, "hub");
  await page.screenshot({ path: "e2e/artifacts/weekend-hub-380.png", fullPage: true });

  // ── budget door: guest onboarding, then a real squad on the open GW ──
  await page.getByTestId("weekend-door-squad").click();
  await page.getByText("Play as a guest").click();
  await page.getByRole("textbox").first().fill(RUN_TAG);
  await page.getByRole("button", { name: "Start playing" }).click();

  await expect(page.getByText("Building for")).toBeVisible({ timeout: 45_000 });
  await expectNoHorizontalScroll(page, "create view");
  await page.getByText("Start building").click();
  await expect(page.getByText("/ 91.0")).toBeVisible({ timeout: 45_000 });

  // One real pick through the pitch so the squad exists with money moved.
  await page.getByTestId("pitch-slot-0").click();
  const firstPick = page.getByRole("button", { name: "Pick", exact: true }).first();
  await expect(firstPick).toBeVisible({ timeout: 45_000 });
  await firstPick.click();
  await expect(page.getByText("91.0 left")).toHaveCount(0, { timeout: 30_000 });
  await expectNoHorizontalScroll(page, "squad view");
  await page.screenshot({ path: "e2e/artifacts/weekend-squad-380.png", fullPage: true });

  // ── crews door: create a crew, land on the crew page ──
  await page.goto("/v2/weekend/crews");
  await expect(page.getByText("Create crew")).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalScroll(page, "crews hub");
  await page.getByText("Create crew").click();
  await page.getByRole("textbox").first().fill("FW-O5 SIM");
  await page.getByRole("button", { name: /^Create$/ }).click();
  await expect(page.getByText("Crew code")).toBeVisible({ timeout: 30_000 });
  await expectNoHorizontalScroll(page, "crew page");

  // ── the draft lobby: open this weekend's room and stand in it ──
  await page.getByText("Open this weekend's draft").click();
  await expect(page).toHaveURL(/\/v2\/weekend\/draft\//, { timeout: 30_000 });
  // The lobby: ready toggle + the two-drafter floor line.
  await expect(page.getByText("Ready up")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("A draft needs at least 2 drafters.")).toBeVisible();
  await expectNoHorizontalScroll(page, "draft lobby");
  await page.screenshot({ path: "e2e/artifacts/weekend-lobby-380.png", fullPage: true });
});

test.afterAll(() => {
  convexRun("fantasyIntegrationSim:purgeUiRun", {});
});
