# Repo Inventory

Snapshot of what remains in the VerveQ repo after the 2026-04-21 legacy
cleanup. Source of truth is always the code. This doc is a map, not a
specification.

Corrected against the code on 2026-07-15: entries that no longer exist were
removed and the CI/`app/scripts/` claims were fixed. The tables remain an
abridged 2026-04-21 snapshot — `app/convex/` and `docs/` have both grown well
beyond what is listed here, so treat a missing row as "not inventoried", not
as "does not exist".

## Top-level tree (2 levels deep)

```
.
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── .ops/
│   └── curated-parity/                (gitignored local approval state)
├── archive/                           (gitignored CSV snapshots, historical input)
├── archive_nba.zip                    (gitignored, historical bulk import)
├── LICENSE
├── README.md
├── complete_image_seed_data.json      (gitignored, one-shot seed artifact)
├── data/                              (gitignored raw data pipeline inputs)
├── data_cleaning/                     (gitignored DB cleanup scratch area)
├── docs/                              (abridged — see table below)
│   ├── APP_OVERVIEW.md
│   ├── AUTH.md
│   ├── CODE_OF_CONDUCT.md
│   ├── CONTRIBUTING.md
│   ├── DEPLOYMENT.md
│   ├── DEPLOYMENT_CHECKLIST.md
│   ├── NEW_GAME_MODES.md
│   ├── REPO_INVENTORY.md               (this file)
│   ├── SECURITY.md
│   └── SURVIVAL_MODE_AUDIT.md
├── app/
│   ├── convex/                         (Convex backend — see table below)
│   ├── public/
│   ├── scripts/                        (build/QA tooling — see table below)
│   ├── src/
│   ├── dist/                           (build output)
│   ├── package.json
│   ├── package-lock.json
│   ├── tailwind.config.ts
│   ├── tsconfig*.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── eslint.config.js
│   ├── postcss.config.js
│   ├── components.json
│   └── index.html
├── nba.sqlite                          (gitignored, historical NBA dump)
├── processed_tennis/                   (gitignored tennis pipeline output)
├── questions.json                      (gitignored one-shot seed artifact)
├── scripts/                            (data pipeline — see table below)
├── verify-no-secrets.sh
├── verveq_platform.db                  (gitignored leftover legacy SQLite)
└── verveq_seed_data.json               (gitignored one-shot seed artifact)
```

## app/package.json scripts

| Script | Purpose |
| --- | --- |
| `codegen` | Regenerate `convex/_generated` offline (`scripts/ensureConvexGenerated.mjs`). No deployment credentials needed. Runs automatically before `dev`/`build` via `predev`/`prebuild`. |
| `dev` | Vite dev server (port 5173). |
| `build` | Production Vite build. |
| `build:dev` | Vite build with the development mode flag. |
| `lint` | Run ESLint across the frontend workspace. |
| `check` | **The full gate**: `codegen` + `tsc -b` + `lint` + `test` + `build`. This is what CI runs on every push and PR (`.github/workflows/check.yml`). |
| `preview` | Serve the built `dist/` bundle via Vite preview. |
| `gameplay:curated` | Run the curated-mode regenerate/build/seed workflow (`scripts/runCuratedGameplayWorkflow.ts`). |
| `gameplay:curated-parity` | Destructive curated-parity reseed from `scripts/data/*`. Requires allowlist + signed approval. |
| `gameplay:curated-parity:status` | Read-only readiness self-check for curated parity. |
| `gameplay:curated-parity:inspect` | Read-only inspect: deployment identity, state codes, curated manifest summary. |
| `gameplay:curated-parity:approve` | Generate a single-use signed approval artifact for the current target/manifest. |
| `gameplay:smoke` | Backend parity + gameplay startup smoke checks (`scripts/runCuratedGameplaySmoke.ts`). |
| `content:qa` | Content QA over a batch (`app/scripts/contentQaCli.ts`). Requires a batch path: `npm run content:qa -- <batch>`. |
| `content:qa:baseline` | Content QA baseline run (`app/scripts/contentQaBaseline.ts`). |
| `learn:graph:validate` | Validate the Learn skill graph (`app/scripts/validateLearnSkillGraph.ts`). |
| `test` | Vitest run (single-shot). |
| `test:watch` | Vitest in watch mode. |

## app/convex/ files

Live Convex backend surface. Session-based server-authoritative game logic.

| File | Purpose |
| --- | --- |
| `achievements.ts` | Achievement list/check queries and mutations. |
| `auth.config.ts` | Convex Auth configuration. |
| `auth.ts` | Convex Auth provider wiring (Password + Anonymous). |
| `blitz.ts` | Blitz game-mode mutations/queries (60s rapid-fire). |
| `careerPath.ts` | Career Path curated-club-history sessions. Replaced Who Am I in 2026-07; dataset is bundled (`data/football_career_paths.json`), not in DB tables. |
| `crons.ts` | Scheduled cron jobs (daily season + ELO decay). |
| `dailyChallenge.ts` | Daily challenge creation, attempt gating, forfeit. |
| `eloDecay.ts` | Internal ELO decay run + public decay queries. |
| `forge.ts` | Community question creation / voting. |
| `games.ts` | Game completion — ELO update, history row, per-mode finalizers. |
| `higherLower.ts` | Higher/Lower curated-pool sessions. |
| `http.ts` | HTTP router (Convex Auth HTTP endpoints). |
| `leaderboards.ts` | Leaderboard queries. |
| `profile.ts` | User profile queries. |
| `quizSessions.ts` | Multiple-choice quiz sessions with image-question limiter. |
| `schema.ts` | All Convex table definitions, indexes, and TTLs. |
| `seasonManager.ts` | Season check/rollover internal mutation. |
| `seedAchievements.ts` | One-shot achievement catalog seed. |
| `seedQuestions.ts` | Quiz question seed (text + image via Convex Storage). |
| `seedSportsData.ts` | Curated sports-data seed (players/teams/pools/facts/grid/clues). |
| `sports.ts` | Supported sports list query. |
| `storage.ts` | Convex Storage upload-URL mutation. |
| `survivalSessions.ts` | Survival game-mode mutations/queries (initials → name guess). |
| `users.ts` | Current user / profile ensure. |
| `verveGrid.ts` | VerveGrid curated-board sessions. |
| `_generated/api.d.ts` | Convex-generated API types. |
| `_generated/api.js` | Convex-generated API module. |
| `_generated/dataModel.d.ts` | Convex-generated data model types. |
| `_generated/server.d.ts` | Convex-generated server types. |
| `_generated/server.js` | Convex-generated server runtime. |
| `lib/daily.ts` | Daily date helpers and deterministic shuffles. |
| `lib/elo.ts` | ELO math — K-factor, tiers, performance, rating clamp. |
| `lib/fuzzy.ts` | Levenshtein distance + `findBestMatch` for answer validation. |
| `lib/scoring.ts` | Time-based scoring helpers and `normalizeAnswer`. |
| `data/football_career_paths.json` | Career Path club-history dataset (bundled with the Convex functions). |
| `data/football_player_metadata.json` | Football hint metadata (club/position/nationality/era). |
| `data/football_survival_index.json` | Curated Survival index (football slice). |
| `data/nba_player_metadata.json` | NBA hint metadata. |
| `data/nba_survival_data.json` | NBA initials → players map. |
| `data/survival_initials_map.json` | Football initials → players map. |
| `data/survival_initials_map_tennis.json` | Tennis initials → players map. |
| `data/tennis_player_metadata.json` | Tennis hint metadata. |

## scripts/ files

Data pipeline and curated-parity tooling.

| File | Purpose |
| --- | --- |
| `buildVerveGridBoards.ts` | Build curated VerveGrid boards from the approved index. |
| `curatedParityDeploymentSafety.ts` | Destructive-guard evaluator: deployment kind, allowlist, approval, apply-session. |
| `curatedParityTrustAnchor.ps1` | Windows DPAPI helper for read/ensure of the curated-parity trust anchor. |
| `curatedParityTrustAnchor.ts` | Cross-platform trust-anchor driver (DPAPI / macOS Keychain). |
| `curatedSeedManifest.ts` | Curated seed manifest: version, hashes, counts across `scripts/data/*`. |
| `fetchSportsData.ts` | API-FOOTBALL + NBA pipeline — players/teams/fixtures into `scripts/data/*`. |
| `pipeline-config.json` | Leagues / seasons / scopes driving the fetch scripts. |
| `runCuratedGameplaySmoke.ts` | Backend parity + runtime-startup smoke checks for curated modes. |
| `runCuratedGameplayWorkflow.ts` | Unified regenerate / build / seed workflow for curated modes. |
| `runCuratedParityWorkflow.ts` | Destructive curated-parity reseed workflow (status/inspect/approve/apply). |
| `seedSportsDatabase.ts` | HTTP-client bulk seeder for Convex sports data from `scripts/data/*`. |
| `cache/` | Gitignored API fetch cache (`scripts/cache/`). |
| `data/` | Gitignored curated-parity seed artifacts (`scripts/data/*`). |

## app/scripts/ files

Build and QA tooling for the app workspace. Not empty: `ensureConvexGenerated.mjs`
is a hard dependency of `npm run codegen`, and therefore of `npm run check` and
the whole CI gate.

| File | Purpose |
| --- | --- |
| `ensureConvexGenerated.mjs` | Offline regeneration of `convex/_generated` (gitignored build output). Backs `npm run codegen`; needs no Convex credentials, which is what lets `check.yml` run secret-free. |
| `contentQaCli.ts` | Content QA CLI over a batch (`npm run content:qa -- <batch>`). |
| `contentQaBaseline.ts` | Content QA baseline run (`npm run content:qa:baseline`). |
| `validateLearnSkillGraph.ts` | Learn skill-graph validation (`npm run learn:graph:validate`). |
| `seedLearnContent.ts` | Learn content seeding. |
| `smokeLearnFlow.ts` | Learn flow smoke checks. |
| `renderHomeOgImage.ts` | Renders the home OG share image. |
| `lib/deployTarget.ts` | Shared deployment-target resolution helper. |

## docs/ files

| File | Purpose |
| --- | --- |
| `APP_OVERVIEW.md` | Comprehensive product overview of game modes, sports, data scale. |
| `AUTH.md` | The auth reference: Convex Auth providers, password policy, reset flow, required env vars. |
| `CODE_OF_CONDUCT.md` | Standard contributor Code of Conduct. |
| `CONTRIBUTING.md` | Contribution guide: real stack, real gate, PR flow. |
| `DEPLOYMENT.md` | Current deployment reality — what a master push does, host topology, rollback. Reconciled against `deploy.yml` on 2026-07-15. |
| `DEPLOYMENT_CHECKLIST.md` | Superseded historical rollout checklist; deploys are automated (see DEPLOYMENT.md). |
| `NEW_GAME_MODES.md` | Curated runtime layers for Higher/Lower and VerveGrid; correctly records Who Am I as removed 2026-07 (replaced by Career Path, `app/convex/careerPath.ts`). One stale claim: its status table and shared rules still call the frontend rollout "externally blocked when deploy access/config is missing" — `deploy.yml` ships the frontend on every master push. |
| `REPO_INVENTORY.md` | This inventory. |
| `SECURITY.md` | Security disclosure policy. Auth section rewritten 2026-07-15; deployment notes are superseded by DEPLOYMENT.md. |
| `SURVIVAL_MODE_AUDIT.md` | Full Survival mode technical audit. Convex is live; Python backend rows are historical. |

---

## Findings

### Dead imports / dangling references

- Stray top-level files left behind by the deleted stack: `verveq_platform.db` (SQLite, was written by the Python backend), `complete_image_seed_data.json`, `questions.json`, `verveq_seed_data.json`. All gitignored, none referenced by live code.

### CI

The legacy `.github/workflows/tests.yml` was removed in Stage 1 and **has since
been replaced**. Two workflows now cover the app stack:

- `.github/workflows/check.yml` — runs `npm run check` (codegen + `tsc -b` + lint + vitest + build) on every push to master and every PR. Verifies only; never deploys, and references no secrets.
- `.github/workflows/deploy.yml` — on every push to master, deploys the Convex backend to prod (`different-lynx-153`) and then publishes the frontend over SSH. See `docs/DEPLOYMENT.md`.

### Docs still describing deleted surfaces

- `README.md` — rewritten since; now covers the full Play/Compete/Learn/Forge surface and carries a per-doc freshness audit. No longer the gap described here.
- `docs/APP_OVERVIEW.md` — accurate high-level product overview, no references to deleted surfaces.
- `docs/CONTRIBUTING.md` — rewritten 2026-07-15; the legacy FastAPI / React Native guidance is gone.
- `docs/SECURITY.md` — auth section rewritten 2026-07-15 (Convex Auth, not JWT). The deployment notes still defer to `docs/DEPLOYMENT.md`.
- `docs/SURVIVAL_MODE_AUDIT.md` — now labels deleted Python backend rows as historical and notes that Daily Survival is declared but not playable.

### .env samples that drifted from actual env usage

- `.env.example` and `.env.production.example` were deleted in Stage 1. Neither is present today, and `.gitignore` re-includes `*.example`, so their absence is real rather than an ignore-rule artefact — but the "deleted in Stage 1" provenance is not checkable from the repo. The live runtime expects `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` in `app/.env.local` (plus optional API-FOOTBALL / TheSportsDB keys read by `scripts/fetchSportsData.ts`). Server-side auth/email vars live on the Convex dashboard, not in `.env.local` — see `docs/AUTH.md`. A fresh `app/.env.local.example` documenting the current variables would close this gap.
- Root `.env` is gitignored but still present and contains stale values for the deleted stack. Worth a manual audit before deleting.

### TODO / FIXME on live code paths

- `app/convex/survivalSessions.ts:~126` — `famousWeight` is stored on the session but never used for weighted selection (noted in `SURVIVAL_MODE_AUDIT.md:§4`). Protected scope — do not reopen without a concrete blocker.
- `app/src/pages/SurvivalScreen.tsx` — protected Survival scope; do not reopen implementation details without a concrete blocker.
- ~~`app/tailwind.config.ts:120` — `require()` call triggers `@typescript-eslint/no-require-imports`.~~ **Not reproducible as cited.** The file is 93 lines long, so line 120 does not exist, and it contains no `require()` at all — the animate plugin is pulled in via an ESM `import`. Whether this was fixed or the citation was always wrong is not determinable from the repo; `npm run lint` is the authority, and it is a hard gate in `npm run check`.
- ~~`app/src/components/ui/{command,textarea}.tsx` — empty interface lint errors.~~ Both files are gone (absent and untracked; nothing in `.gitignore` covers them).

### Things that look stale but are not safe to delete without confirmation

- `verify-no-secrets.sh` at repo root. Written for the old deployment model; still runs `git ls-files` style checks that remain partially valid, but it references the deleted FastAPI assumptions. Keep or replace rather than silently delete.
- `archive/` (CSV dumps), `archive_nba.zip` (730 MB), `nba.sqlite` (2.2 GB), `processed_tennis/`, `data_cleaning/` — all historical pipeline inputs referenced by non-destructive fetch scripts. Gitignored. Keep as local-only working data.
- `app/vite-*.log`, `app/vite-preview-*.log`, `app/serve-phase3*.log` — leftover ad-hoc log files from Phase 3 validation. Gitignored via `*.log`, safe to delete locally.
