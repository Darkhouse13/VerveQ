# Analytics

Product analytics run on PostHog (EU cloud, project `218670`). This document is
the contract: what fires, when, with which properties, how identity is stitched,
and how synthetic verification data is kept out of real analysis.

The governing rule, and the reason most of the design below looks the way it
does: **an event fires on a real user action or a real server state transition,
never on a route change.** A single-page app fires no pageview when someone
plays, and a redirect fires one when nobody did anything — so navigation is not
evidence of gameplay. Anything derived from a URL is provenance only, and is
marked as such.

## Where it lives

| Concern | File |
| --- | --- |
| Init, gating, identity, `track` | `app/src/lib/analytics.ts` |
| Pageviews (route change) | `app/src/components/AnalyticsPageviews.tsx` |
| Game loop registry | `app/src/lib/gameAnalytics.ts` |
| Entry door (provenance) | `app/src/lib/entrySource.ts` |
| SEO curiosity funnel | `app/public/games/funnel.js` |
| Server-origin capture | `app/convex/lib/posthogServer.ts` |
| Scripted verification pass | `app/scripts/analyticsVerificationPass.mjs` |

Init is fail-closed: the SDK only starts in a **production build** carrying
`VITE_POSTHOG_KEY`. Dev, preview and key-less builds are a complete no-op.
Autocapture, session recording and `$pageleave` are off; nothing leaves the
client except what is listed below.

## Event taxonomy

### Core loop (SPA)

All three are keyed on the **server-minted session id** — the only honest
evidence that a game exists. A navigation that mints no session is silent.

| Event | Fires when | Properties |
| --- | --- | --- |
| `game_started` | a session mutation **resolves** with an id | `mode`, `entry_source`, `is_authenticated`, `account_state`, `start_trigger` |
| `game_completed` | a real terminal state with a real outcome | `mode`, `score`, `questions_answered`, `duration_seconds`, `result` |
| `game_abandoned` | left mid-game (unmount, or `pagehide`) | `mode`, `questions_answered_before_exit`, `exit_signal` |

`start_trigger` is load-bearing. **Every mode provisions its session in a mount
effect, and Career Path has no play CTA at all** — so arriving *is* starting.
A `game_started` carrying `start_trigger: "auto"` means *a game was
provisioned*, *not* *someone chose to play*, and includes visitors who bounced
in a second. Read engagement from `questions_answered`; the honest
"landed but never played" cohort is `game_abandoned` with
`questions_answered_before_exit: 0`.

Forced ends: a forced end is a **completion** only when it yields a real scored
outcome. Career Path's tab-switch penalty scores the run and shows a result card
→ completion. Quiz's `penalizeTabSwitch` stamps `abandonedAt` with no score
(`convex/quizSessions.ts`) and Daily's `forfeit` writes `score: 0, forfeited:
true` (`convex/dailyChallenge.ts`) → those are **abandons**; counting them as
completions would inflate completion rate. Survival's cash-out is voluntary and
scored → completion.

Two behaviours worth knowing:

- **Orphaned runs.** A tab holds one live game, so a new session means the
  previous run was left behind and it reports an abandon. This is what a locale
  switch does: `startGame` sits in a `useEffect` with i18n's `t` in scope, so
  changing language re-runs it and mints a fresh server session.
- **Tab-close.** Closing the tab destroys the JS context without React running
  any unmount cleanup, so per-screen handling never sees the most common real
  exit. `armExitAbandonReporting()` (`main.tsx`) covers it via `pagehide` +
  `sendBeacon`. `pagehide` **only**: `visibilitychange → hidden` also fires when
  a tab is merely backgrounded, and someone who switches apps and returns has
  abandoned nothing. The cost is that a mobile session killed while
  backgrounded is never seen — a real gap, preferred to a fabricated event.

### Identity

| Event | Fires when | Properties |
| --- | --- | --- |
| `username_claimed` | a claim **succeeds** | `entry_source`, `via_invite` |
| `account_login` | a password sign-in **succeeds** | `method` |

`username_claimed` is deliberately not hooked to `onComplete()`, which also
fires for a visitor who *already had* a username — that is an arrival, not a
claim. `account_login` fires in the `signIn` callback, not from the identify
effect, which re-runs on every app load for a signed-in user and would read as
a login on every reload.

### Anonymous curiosity funnel (static `/games/*` pages only)

This funnel lives **only** on the six static SEO pages, and that is not
arbitrary: they are the one surface with a real, pressable CTA
(`Play Career Path — free`) and a real fold. In the app, every mode auto-starts
on mount, so `landing_cta_shown` has nothing to hook and `exit_before_play`
("left having never fired `game_started`") could essentially never fire.

| Event | Fires when | Properties |
| --- | --- | --- |
| `landing_viewed` | the page loads (after the SDK is ready) | `entry_source: "seo"`, `mode`, `is_authenticated`, `referrer_domain` |
| `landing_cta_shown` | the CTA is **≥50% in viewport** *and* the tab is foregrounded | `mode` |
| `landing_interacted` | first pre-game interaction, once per type | `interaction_type` (`scroll_past_fold` \| `tap`), `mode` |
| `game_start_intent` | the CTA is pressed | `mode`, `time_on_page_seconds` |
| `exit_before_play` | real exit **without** pressing the CTA | `mode`, `furthest_step`, `time_on_page_seconds`, `exit_signal` |

`furthest_step` ∈ `landing` \| `cta_shown` \| `interacted` — it says how far a
curious visitor got before giving up, and its value is only worth anything
because `landing_cta_shown` requires genuine viewport visibility rather than DOM
presence.

`exit_before_play` is **suppressed when the CTA was pressed**: that is a hand-off
to the app, not a bounce, and firing it would count every converting visitor as
a drop-off. Whether the hand-off led to a game is answered by joining
`game_start_intent` to the SPA's `game_started` at analysis time. That also means
`furthest_step` never takes the value `start_intent` on these pages.

Delivery is `pagehide` **or** `visibilitychange → hidden`, first-one-wins, via
`sendBeacon`. There is no browser event meaning "gone for good", so a
backgrounded tab the visitor later returns to still reports — `exit_signal`
rides along so analysis can separate the two.

These pages load posthog-js from the CDN rather than POSTing to the capture API
by hand, and that is deliberate: the SDK keys its storage off the project token,
so on the same origin the static pages and the SPA **share one anonymous
`distinct_id`**. A visitor who reads `/games/career-path` and clicks through to
`/` is one person. Config mirrors `lib/analytics.ts` — notably
`persistence: "localStorage"`; if these pages used cookies while the SPA used
localStorage they would never share an id and the funnel would measure nothing.

### Server-origin

| Event | Fires when | Properties |
| --- | --- | --- |
| `share_link_opened` | a **human** resolves `/s/d/:linkCode` | `mode: "duel"`, `link_code`, `origin: "server"`, `is_crawler: false` |

`/s/d/` is proxied by nginx straight to a Convex httpAction that serves an OG
card to crawlers and 302s humans onward. The SPA never loads there, so the
server is the only honest origin. It fires only for non-crawlers (the route's
existing user-agent check owns that split, so an unfurl prefetch is never a
person), and is scheduled fire-and-forget so a round trip to PostHog never sits
between the tap and the game.

Its `distinct_id` is minted per open and **cannot** stitch to the opener's
browser: persistence is localStorage, so there is no cookie to read
server-side. Person processing is therefore off (`$process_person_profile:
false`) — API events are identified by default and would otherwise mint a person
per open. The open → play join is analysis-time work via `link_code`, and is
deliberately not asserted in the event.

### Not implemented

`mode_selected` and `share_link_generated` from the original spec are **not
implemented**. Arena (the 8th lifecycle owner) is uninstrumented — its start
lives in the v1 `ChallengeArenaScreen`, shared with the v1 surface.
`/games/index.html` carries the same CTA and its own sitemap entry but is not
instrumented.

## Identity model

**Anonymous persistence is first-party `localStorage`, not cookies.** It
survives restarts (so "not session-only" is satisfied) and avoids the EU consent
obligations a tracking cookie would bring. One consequence to know: localStorage
is **per-origin**, and both `verveq.com` and `www.verveq.com` serve traffic — one
human crossing hosts becomes two anonymous people. Fixing that belongs at the
edge (redirect one host to the other), not here.

`posthog.identify()` binds the anonymous id to the **Convex `users` doc id**
(`user._id`), from an effect keyed on the raw `me` doc (`AuthContext`). Two
traps it exists to avoid:

- `accountState` transiently resolves `loggedOut` on every reload of a signed-in
  session. Identifying during that window misattributes returning users — the
  exact retention corruption this instrumentation exists to fix. Keying on the
  raw doc means the id is simply absent until auth settles.
- **`isAuthenticated` is not usable** for this: it is `!!user || localGuestActive`,
  so it is `true` for tab-local guests with **no server identity**. Those guests
  share the hardcoded literal `guest_tab` (`LOCAL_GUEST_USER`) — identifying it
  would collapse unrelated strangers into one person. `guest_tab` is rejected at
  the library boundary (`NEVER_IDENTIFY`), so no call site has to remember.
  Use `accountState`, via `isRealIdentity()`.

**Pre-claim history is preserved.** Under `person_profiles: "identified_only"`,
PostHog retroactively attributes past anonymous events to the person on
identify; they merely stay *billed* as anonymous (~4x cheaper). `identified_only`
is therefore kept deliberately — it loses nothing here.

`reset()` fires on `logout` and `signOutToGuest`, and clears the identify guard
ref so a re-login by the same account identifies again rather than being skipped.

## Test isolation

One PostHog project holds both real and verification data, so synthetic events
must be filterable — permanently and without exception.

- `posthog.register({ is_test: true, env: "test" })` — **super** properties, so
  they ride on *every* capture including `$pageview`. No call site can forget them.
- A **persisted** `test_anon_*` `distinct_id` (`bootstrap.distinctID`), stable
  for the browser profile.
- `opt_out_useragent_filter: true` — posthog-js silently drops everything an
  automated browser sends (UA blocklist, `navigator.userAgentData.brands`, and
  `navigator.webdriver`). Without this a scripted pass sends nothing and reads
  as a broken app. It stays **on** in production, where it is what keeps crawler
  hits out of the `/games/*` funnel.

All three are gated on `VITE_ANALYTICS_TEST_MODE`, which `deploy/build-and-run.sh`
does **not** forward (it forwards only `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST`),
so real traffic can never be marked as test. The static pages gate instead on
hostname: the live host reports real traffic, anywhere else is silent unless it
opts in with `?vq_test=1`. Server-side, test-ness is derived from the deployment
(`CONVEX_CLOUD_URL`), which is unspoofable.

### Recovering a clean baseline

```sql
-- Exclude every synthetic event. HogQL comparisons are null-safe, so baseline
-- events (which carry no is_test property at all) are correctly RETAINED.
SELECT count()
FROM events
WHERE timestamp >= now() - INTERVAL 180 DAY
  AND NOT (properties.is_test = true)
```

The baseline is a **predicate, not a constant** — real traffic keeps arriving, so
"the baseline" is whatever this filter returns, never a number recorded earlier.
Anchor immutability checks to a timestamp (`timestamp <= toDateTime64(...)`)
rather than a remembered total.

Verification builds run against the **dev** Convex deployment
(`admired-warthog-495`); prod is `different-lynx-153` and is guarded by
`scripts/lib/deployTarget.ts`. PostHog tagging protects the analytics dataset
**only** — it does nothing for the Convex database, so a pass must never be
pointed at prod on the strength of `is_test` alone.

## Verified vs. unverified

Verified 2026-07-15 by `scripts/analyticsVerificationPass.mjs` against dev
(`admired-warthog-495`), 15/15 checks, with events confirmed ingested in PostHog.

**Verified**

- `game_started` on five owners: career-path (`loggedOut`), blitz, higher-lower,
  verve-grid, daily (all `usernameOnly`).
- `game_completed` vs `game_abandoned` are **distinguishable**: completion
  carries `score` / `questions_answered` / `duration_seconds` / `result`; abandon
  carries `questions_answered_before_exit` / `exit_signal`; never both.
- Route changes produce **silence** (`game_started=0`, `game_completed=0`,
  `pageviews=1`) — against a backend proven in the same run to serve real games.
- Tab-close abandons arrive via `pagehide` + `sendBeacon`.
- Full SEO funnel including `exit_before_play` with
  `furthest_step: "interacted"`, and a converting visitor correctly **not**
  counted as an exit.
- **identify-merge at the person level**: one `person_id` holding both the
  pre-claim `test_anon_*` id and the Convex users doc id, with games played
  *while anonymous* appearing under the claimed person. `guest_tab` never sent.
- Baseline cleanly recoverable: 169 synthetic events, **zero** untagged, zero in
  the baseline window, exclusion returns the pre-pass total exactly.

**Not verified**

- **Quiz** and **Survival** — the two full-account owners. Instrumented and
  typechecked, but the pass only reaches username-only modes; **unexercised**.
- **`account_login`** — never fired (needs a real signup/login).
- **`share_link_opened`** — implemented but not observed live. It is a **no-op
  until `POSTHOG_KEY` is set on the Convex deployment**.
- **Arena** — uninstrumented.
- **`/games/index.html`** — not instrumented.

## Bugs surfaced by verification

1. **`bootstrap.distinctID` re-minted per page load** — *fixed*. It applies on
   every init, so each navigation got its own identity; the claim then merged
   only the last page's id and orphaned everything before it. The merge looked
   fine while silently violating the requirement it exists to prove. Now
   persisted (`vq_test_anon_id`). Test-mode only; production never had a
   bootstrap.
2. **First-run language modal double-starts games** — *open, separate ticket*.
   Picking a language changes i18n's `t`, re-creating `startGame` and minting a
   second server session. A first-time visitor on `/play` produces two
   `game_started` and one spurious abandon, inflating starts on the marketed
   path. Visible in data (the orphaned run reports), but it is noise at the top
   of the most important funnel.
