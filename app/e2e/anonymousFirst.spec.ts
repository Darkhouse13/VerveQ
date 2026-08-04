/**
 * FR-1B — anonymous-first identity, end-to-end against DEV Convex.
 *
 * Not part of `npm run check` (same rule as weekendMobile.spec.ts): it boots
 * the real app against the DEV deployment and drives real flows, so it runs on
 * demand, with the flag on:
 *
 *   VITE_ANONYMOUS_FIRST_ENABLED=true VITE_V2_SHELL_ENABLED=true \
 *     npx playwright test e2e/anonymousFirst.spec.ts
 *
 * Every test starts from a genuinely cold visitor: Playwright gives each test a
 * fresh context and no `storageState` is reused, so there is no auth token, no
 * device nonce and no tab-guest flag — the state a first-time arrival has.
 *
 * Each surface asserts THREE things together, because any one alone can pass
 * while the feature is broken: the URL did not bounce to an account screen, a
 * real Convex session token now exists, and the mode's own content rendered
 * (proof the server accepted the silent identity, not just that a screen
 * mounted).
 */
import { test, expect, type Page } from "@playwright/test";

const SHOTS = "e2e/artifacts/fr1b";

function freshName(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`.slice(
    0,
    24,
  );
}

/** True once Convex Auth has stored a session token for this browser. */
async function hasSession(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    Object.keys(window.localStorage).some((k) =>
      k.startsWith("__convexAuthJWT"),
    ),
  );
}

/**
 * The users doc id this browser is authenticated as. Convex Auth's JWT carries
 * `sub = "<users doc id>|<session id>"`, so the first segment is the same id
 * `getAuthUserId` resolves server-side. This is the evidence for "each rung
 * upgrades IN PLACE": captured before and after a claim, it must not move.
 */
async function currentUserId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const key = Object.keys(window.localStorage).find((k) =>
      k.startsWith("__convexAuthJWT"),
    );
    const jwt = key ? window.localStorage.getItem(key) : null;
    const payload = jwt?.split(".")[1];
    if (!payload) return null;
    try {
      const claims = JSON.parse(
        atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
      ) as { sub?: string };
      return claims.sub?.split("|")[0] ?? null;
    } catch {
      return null;
    }
  });
}

/**
 * Dismiss the first-run language prompt.
 *
 * PRE-EXISTING and unrelated to FR-1B (`FirstRunLanguagePrompt`, untouched by
 * this ticket): a cold visitor gets a modal language chooser before anything
 * else. It is a real `<dialog>`, so everything behind it leaves the a11y tree
 * and no role-based query can reach the page until it is closed. Closing it
 * first is what lets these tests assert on the mode underneath — and it is
 * worth stating plainly that "zero interstitials" in this spec means zero
 * IDENTITY interstitials; this one still stands in front of play.
 */
async function dismissLanguagePrompt(page: Page) {
  const close = page.getByRole("button", { name: "Close" });
  if (await close.count()) await close.first().click().catch(() => {});
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** No account screen was interposed anywhere on the way in. */
async function expectNoInterstitial(page: Page, route: string) {
  await expect(page).toHaveURL(new RegExp(route.replace(/[?]/g, "\\?")));
  await expect(page.getByText("How do you want to play?")).toHaveCount(0);
  await expect(page.getByText("Pick a username")).toHaveCount(0);
}

test.describe("FR-1B anonymous-first", () => {
  test("a: cold visitor plays the Daily with zero interstitials", async ({
    page,
  }) => {
    await page.goto("/v2/daily?sport=football");
    await dismissLanguagePrompt(page);

    await expect(page.getByText(/Q \d+\/10/)).toBeVisible({ timeout: 45_000 });
    await expectNoInterstitial(page, "/v2/daily");
    expect(await hasSession(page)).toBe(true);
    // The server accepted the silent identity and dealt a real attempt:
    // this is the Daily's own chrome, not a generic screen.
    await expect(
      page.getByText("Daily Challenge", { exact: true }).first(),
    ).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/a-daily-cold.png`, fullPage: true });
  });

  test("b: cold visitor plays Higher or Lower instantly; tier control works", async ({
    page,
  }) => {
    await page.goto("/v2/higher-lower?sport=football");
    await dismissLanguagePrompt(page);

    await expect(page.getByText("WHO HAS MORE?").first()).toBeVisible({
      timeout: 45_000,
    });
    await expectNoInterstitial(page, "/v2/higher-lower");
    expect(await hasSession(page)).toBe(true);

    // Tier control is present pre-run and defaults to easy.
    const easy = page.getByRole("button", { name: "Easy", exact: true });
    await expect(easy).toBeVisible();
    await expect(easy).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: `${SHOTS}/b1-hl-cold-easy.png`, fullPage: true });

    // Switching re-provisions the run at the new ceiling, through the URL.
    await page.getByRole("button", { name: "Hard", exact: true }).click();
    await expect(page).toHaveURL(/difficulty=hard/);
    await expect(page.getByRole("button", { name: "Hard", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByText("WHO HAS MORE?").first()).toBeVisible({
      timeout: 45_000,
    });
    await page.screenshot({ path: `${SHOTS}/b2-hl-hard.png`, fullPage: true });
  });

  test("c: cold visitor reaches Learn on an anonymous session", async ({
    page,
  }) => {
    await page.goto("/v2/learn");
    await dismissLanguagePrompt(page);

    await expect(page.getByText("TODAY'S SESSION").first()).toBeVisible({
      timeout: 45_000,
    });
    await expectNoInterstitial(page, "/v2/learn");
    expect(await hasSession(page)).toBe(true);
    // Subjects come from `learn.getLearnSubjects`, which is requireUserId —
    // seeing them proves the backend served the anonymous identity.
    await expect(page.getByText("Geography").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/c-learn-cold.png`, fullPage: true });
  });

  test("d: ranked Quiz shows a clean full-account wall, intent preserved", async ({
    page,
  }) => {
    await page.goto("/v2/quiz?sport=football");
    await dismissLanguagePrompt(page);

    await expect(page.getByText("Full account required").first()).toBeVisible({
      timeout: 30_000,
    });
    // Ranked does NOT mint: the wall is the answer, not a silent session.
    expect(await hasSession(page)).toBe(false);
    await page.screenshot({ path: `${SHOTS}/d1-ranked-wall.png`, fullPage: true });

    await page.getByRole("button", { name: /get started/i }).click();
    await expect(page).toHaveURL(/\/v2\/account\?next=%2Fv2%2Fquiz/);
    await page.screenshot({ path: `${SHOTS}/d2-intent-kept.png`, fullPage: true });
  });

  test("e: cold visitor plays VerveGrid; tier control works", async ({
    page,
  }) => {
    await page.goto("/v2/verve-grid?sport=football");
    await dismissLanguagePrompt(page);

    await expect(page.getByText("VerveGrid").first()).toBeVisible({
      timeout: 60_000,
    });
    await expectNoInterstitial(page, "/v2/verve-grid");
    expect(await hasSession(page)).toBe(true);

    const easy = page.getByRole("button", { name: "Easy", exact: true });
    await expect(easy).toBeVisible();
    await expect(easy).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Medium", exact: true }).click();
    await expect(page).toHaveURL(/difficulty=intermediate/);
    await page.screenshot({ path: `${SHOTS}/e-grid-cold.png`, fullPage: true });
  });

  test("f: a second cold visitor on the same IP is also served", async ({
    page,
  }) => {
    // The permit gate is per-IP with generous windows (50/10min, 150/day), so
    // consecutive visitors on one network must both sail through. This is the
    // observation the ticket asks for, not a limit probe.
    await page.goto("/v2/blitz?sport=football");
    await dismissLanguagePrompt(page);
    await expect(page.getByText("60-second sprint").first()).toBeVisible({
      timeout: 45_000,
    });
    expect(await hasSession(page)).toBe(true);
    await page.screenshot({ path: `${SHOTS}/f-second-visitor.png`, fullPage: true });
  });

  test("g: claim prompt after a Blitz run upgrades the SAME users doc", async ({
    page,
  }) => {
    test.slow(); // the real 60s Blitz clock has to run out
    await page.goto("/v2/blitz?sport=football");
    await dismissLanguagePrompt(page);
    await expect(page.getByText("60-second sprint").first()).toBeVisible({
      timeout: 45_000,
    });

    const before = await currentUserId(page);
    expect(before).toBeTruthy();

    // Answer whatever is on screen until the buzzer, so the run banks a real
    // score rather than a zero.
    const deadline = Date.now() + 70_000;
    while (Date.now() < deadline) {
      if (await page.getByText(/blitz score/i).count()) break;
      const choice = page
        .locator('button:has(span:text-matches("^[ABCD]$"))')
        .first();
      if (await choice.count()) await choice.click({ timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(900);
    }
    await expect(page.getByText(/blitz score/i).first()).toBeVisible({
      timeout: 60_000,
    });

    // The score is readable BEFORE anything is asked — the prompt never blocks it.
    await page.screenshot({ path: `${SHOTS}/g1-blitz-result.png`, fullPage: true });
    await expect(
      page.getByText(/you're not on the board yet/i).first(),
    ).toBeVisible();

    const name = freshName("fr1b");
    await page.getByLabel("Username").fill(name);
    await page.getByRole("button", { name: /claim my name/i }).click();

    await expect(
      page.getByText(new RegExp(`on the board as @${name}`, "i")),
    ).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS}/g2-claimed.png`, fullPage: true });

    // IN PLACE: same users doc id before and after the claim. A merge/copy
    // shim would surface here as a different id.
    expect(await currentUserId(page)).toBe(before);

    // ── rung 2 → rung 3, same doc ──────────────────────────────────────────
    // The ticket's upgrade chain: anonymous → username → full account, one
    // users doc throughout. `upgradeUsernameOnly` links a password credential
    // to the EXISTING doc rather than creating one, so the id must again hold.
    await page.goto("/v2/upgrade");
    await dismissLanguagePrompt(page);
    const email = `${name}@example.com`;
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Fr1b-Verify-2026!");
    await page
      .getByLabel(/confirm/i)
      .first()
      .fill("Fr1b-Verify-2026!");
    await page.getByRole("button", { name: /create full account/i }).click();

    // Wait for the POSITIVE success signal — the form redirects home only on a
    // completed upgrade. Asserting the form's absence instead would pass while
    // the page is merely still rendering, and end the test (tearing down the
    // browser) before the mutation had landed.
    await expect(page).toHaveURL(/\/v2$/, { timeout: 60_000 });
    await page.screenshot({ path: `${SHOTS}/g4-upgraded.png`, fullPage: true });
    expect(await currentUserId(page)).toBe(before);

    // Ranked is now open on the very same identity — the rung-3 proof, stated
    // as a question actually being dealt rather than as a wall being absent.
    await page.goto("/v2/quiz?sport=football");
    await dismissLanguagePrompt(page);
    await expect(page.getByText(/Q \d+\/10/)).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Full account required")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/g5-ranked-open.png`, fullPage: true });

    // Emitted for the DB-level board + doc checks that follow this spec.
    console.log(`FR1B_CLAIM userId=${before} username=${name} email=${email}`);
  });

  /**
   * REGRESSION. FR-1B moves the tier a cold visitor starts at; it must not
   * change anything for people who already have an account. This signs in with
   * a real credential and plays both a SessionRoute mode and a ranked one.
   *
   * Credentials come from the environment so this stays runnable against a
   * deployment whose data this spec did not create:
   *   FR1B_REGRESSION_EMAIL=... FR1B_REGRESSION_PASSWORD=... npx playwright test
   */
  test("regression: an existing full account signs in and plays casual + ranked", async ({
    page,
  }) => {
    const email = process.env.FR1B_REGRESSION_EMAIL;
    const password = process.env.FR1B_REGRESSION_PASSWORD;
    test.skip(!email || !password, "set FR1B_REGRESSION_EMAIL / _PASSWORD");

    await page.goto("/v2/account");
    await dismissLanguagePrompt(page);
    await page.getByRole("button", { name: /sign in/i }).first().click();
    await page.getByPlaceholder("Email").fill(email!);
    await page.getByPlaceholder("Password", { exact: true }).fill(password!);
    await page
      .getByRole("button", { name: /^sign in$/i })
      .last()
      .click();
    // Wait for the redirect that only a COMPLETED sign-in produces. Navigating
    // straight to the next route here would abandon the in-flight mutation and
    // then assert against a still-logged-out app.
    await expect(page).toHaveURL(/\/v2$/, { timeout: 60_000 });

    // Signed in: ranked is open (full-account tier intact).
    await page.goto("/v2/quiz?sport=football");
    await dismissLanguagePrompt(page);
    await expect(page.getByText(/Q \d+\/10/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Full account required")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/h1-existing-ranked.png`, fullPage: true });

    // …and a SessionRoute mode still works for them, with NO claim prompt
    // (they already have a name — the prompt must never nag an named user).
    await page.goto("/v2/blitz?sport=football");
    await dismissLanguagePrompt(page);
    await expect(page.getByText("60-second sprint").first()).toBeVisible({
      timeout: 45_000,
    });
    await page.screenshot({ path: `${SHOTS}/h2-existing-casual.png`, fullPage: true });
  });
});
