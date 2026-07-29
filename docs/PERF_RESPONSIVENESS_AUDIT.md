# Performance & Responsiveness Audit — 2026-07-29

Two user-complaint investigations and the fixes they produced, in the style of
`INSIDE_OUT_AUDIT.md` (findings with file refs, resolution status inline).
Fix commits: **`d2d269e`** (image delivery + question-serving latency) and
**`aabc786`** (navigation responsiveness + dead-click/scroll hardening). Both
are live on prod (backend `different-lynx-153` + frontend, deployed same day).

---

## Complaint 1 — "Image questions never show the image; questions take ~2s to arrive"

### Root causes found (all FIXED in `d2d269e`)

| # | Cause | Where | Fix |
| --- | --- | --- | --- |
| 1 | `QuestionImage` reset its loading state in a passive effect, racing the `<img>` load event. On a cache hit the load fired first, the effect re-set `loading=true`, and nothing ever cleared it — the "Loading media…" overlay stayed forever with the image invisible. Timing-dependent, worst in the arena (whose preloader makes cache hits the norm). | `app/src/components/QuestionImage.tsx` | Reset synchronously at render (state-from-props pattern) + reconcile with `img.complete` in an effect. |
| 2 | Quiz/Blitz/Daily/Duels resolved only `imageId` and silently dropped `imageUrl` — while the image cap counted both kinds. 144 `imageUrl` rows exist in prod. The arena was the only mode with the correct fallback. | `quizSessions.ts`, `blitz.ts`, `dailyChallenge.ts`, `duels.ts` | Shared `resolveQuestionImageUrl` (`app/convex/lib/questionServe.ts`): `imageUrl ?? storage.getUrl(imageId)`. Daily snapshots now carry `imageUrl` through the freeze (schema + `snapshotQuestion`). |
| 3 | Two sequential round trips before the first question (start → getQuestion), and per-question fetches fired only AFTER the 400/800ms reveal pause. In Blitz all of it burned the 60s clock. | `useSoloBlitz.ts`, `useSoloQuiz.ts`, `blitz.ts`, `quizSessions.ts` | `withFirstQuestion` opt-in on `blitz.start` / `createSession` (first question ships in the same response; optional so the old bundle survived the backend-first deploy window). `getQuestion` returns `nextImageUrl`; clients pre-warm it. Blitz fires the next-question fetch concurrently with the reveal pause. |
| 4 | Time scoring punished latency: the serve stamp predates network transit + render + image decode, and the ≤1s full-score window was unreachable. Duels already had a 2.5s grace (`DUEL_GRACE_SEC`); solo quiz and Daily had none. | `quizSessions.checkAnswer`, `dailyChallenge.submitAnswer` | `QUIZ_SERVE_GRACE_SEC = 1.5`, `DAILY_SERVE_GRACE_SEC = 2.5` (`app/convex/lib/scoring.ts`). Contract tests updated for the new curve. |
| 5 | Pipeline could admit unrenderable/oversized images: Forge accepted raw HEIC up to 2MB straight into the live pool; seeds stored whatever blob the source returned and discarded the source URL; QA validated an `imageId` as "non-empty string". | `ImageDropzone.tsx`, `forge.ts`, `seedQuestions.ts`, `contentQaCli.ts` | Dropzone decodes/downscales (1280px)/re-encodes to JPEG/PNG before upload (kills HEIC; undecodable files are rejected client-side). `forge.submit` validates storage metadata server-side. `seedImageBatch` rejects non-renderable/oversized blobs and retains `imageSourceUrl` (new optional `quizQuestions` field). New paginated ops audit: `npx convex run opsContentIntegrity:auditQuestionImages [--prod]` — see docs/CONTENT_QA.md. |

### Verification

- Full prod audit ran clean the same day: **2,514 storage-image questions, 0
  dangling blobs, 0 unrenderable, 0 oversized** — the complaints were entirely
  causes 1–3, not lost storage.
- 1,186 vitest tests green; backend rehearsed on dev
  (`admired-warthog-495`) before `npx convex deploy` to prod.

---

## Complaint 2 — "The app sometimes doesn't respond to clicks or scrolls"

Verdict: **not noise.** Several mechanisms were found, two deterministic. No
field data existed to check complaints against (Sentry is errors-only by
design; PostHog autocapture/rage-click detection deliberately off) — that gap
is itself now closed (see telemetry below).

### Root causes found (FIXED in `aabc786`)

| # | Cause | Where | Fix |
| --- | --- | --- | --- |
| 1 | `v7_startTransition` + all-lazy routes + zero pending UI: a tab tap changed **no pixels** until the route chunk downloaded (the old screen stays painted through a transition). Tab buttons had no pressed style, no tap-highlight, and the active highlight derives from the (deferred) location. | `App.tsx:121`, `ShellNav.tsx` | `pendingPath` state moves the highlight on press; `active:opacity-60` pressed style on both navs. |
| 2 | No route prefetch anywhere — every first visit to a tab paid a cold chunk fetch. | — | `app/src/lib/shellPrefetch.ts`: idle-time warm of the four tab chunks once the shell paints (Vite dedupes with the `lazy()` imports). |
| 3 | Deploys delete the previous release's hashed chunks; a tab open across a deploy 404s on its next lazy route with **no recovery path** — dead tap, then the error card. | all `lazy()` sites | `app/src/lib/lazyWithRetry.ts`: one automatic reload per session on a failed dynamic import (session-flagged so a broken network can't loop). Used by every route in `App.tsx` + `EntryRoutes.tsx`. |
| 4 | `FirstRunLanguagePrompt` unmounted an **open** Radix dialog via an early `return null` when a first-run visitor navigated to `/privacy`/`/terms` — skipping Radix's close path and risking a stranded `body { pointer-events: none }` + non-passive touchmove blocker (`react-remove-scroll`) that eats every click/scroll for the rest of the session. Best fit for the severe "whole app stopped responding" reports. | `FirstRunLanguagePrompt.tsx` | Suppression now drives the `open` prop (dialog closes through Radix's cleanup, stays mounted); plus an unmount insurance effect that clears any inline `pointer-events` left on `<body>`. |
| 5 | Viewport meta lacked `viewport-fit=cover`, so `env(safe-area-inset-bottom)` resolved to 0 on notched iPhones and the bottom nav's tap targets sat inside the home-indicator gesture zone. | `index.html` | Added `viewport-fit=cover`. |
| 6 | Render-perf drains on low-end devices: `AuthContext` provider value was an unmemoized 20-field literal above the router (every `users.me` push re-rendered every `useAuth` consumer app-wide); `BlitzClock`'s `onTick` fired at 10Hz into parent state; the infinite `pulse-urgent` (40px-blur text-shadow) and `fire-pulse` (whole-surface background) animations ignored `prefers-reduced-motion`. | `AuthContext.tsx`, `BlitzClock.tsx`, `index.css` | Value + `authUser` memoized (all action callbacks were already `useCallback`-stable); `onTick` fires on whole-second changes only; app-wide `prefers-reduced-motion` block (infinite animations off, one-shot feedback cues shortened, not removed). |

### Known-but-not-fixed (accepted or deferred)

- **Entry bundle**: ~242 kB gzip on the critical path before any route chunk
  (posthog-js, @sentry/react, convex client, 8 eager v1 screens; no
  `manualChunks` in `vite.config.ts`). Deferred — biggest remaining lever
  together with a CDN.
- **No CDN**: all assets and Convex storage images serve from single origins;
  distant users pay full transit on first fetch. Infrastructure decision, not
  code.
- **Nav chrome lives inside the swapped route element** (no persistent layout
  route), so tab changes remount the whole chrome and both Suspense fallbacks
  are chrome-less. Mitigated by #1/#2 above; a layout-route refactor is the
  clean fix but was judged too invasive for this pass.
- Screens that render `null`/chrome-less blocks while loading
  (`ShellProfileScreen` hard-block, `ForgeScreen`, `RivalsScreen`, several
  result screens) — `RanksScreen` documents the partial-paint pattern to copy.
- Nested hidden-scrollbar scrollers with no `overscroll-behavior`/
  `touch-action`, and the `100vh` App wrapper vs `100dvh` shell mismatch
  (document rubber-band behind the never-scroll shell).
- `ChallengeArenaScreen` body-scroll-lock effect keyed on an unstable
  `onClose` (unlock/relock churn while the help modal is open). Cosmetic.

### Field telemetry (new)

`perf_vitals` — one sendBeacon summary per page lifetime
(`app/src/lib/perfVitals.ts`, armed in `main.tsx`, documented in
docs/ANALYTICS.md): `worst_inp_ms`, `high_inp_count` (interactions >200ms),
`interaction_count`, `long_task_count`, `long_task_total_ms`,
`device_memory_gb`, `cpu_cores`, `connection_type`. Read it in PostHog to
confirm/deny future responsiveness complaints and to target the deferred items
above (e.g. if `high_inp_count` clusters on 4x-core/`3g` devices, the entry
bundle is the next lever).

### Historical context found during the investigation

- The only prior *confirmed* dead-click bug: Higher/Lower ghost-click restart
  (`3382d52`) — a tap's trailing click landing on a freshly mounted button.
- A recurring P1 family of "controls unreachable below an unscrollable fold"
  (QA_BUGLOG items 009/009b/034; commits `089e3bc`, `8d62afd`, `0470f3a`,
  `a50bd8f`) — geometric unresponsiveness, all previously fixed.
- No PWA/service worker exists, so stale-SW caching was ruled out.
