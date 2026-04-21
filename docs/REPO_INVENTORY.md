# Repo Inventory

Snapshot of what remains in the VerveQ repo after the 2026-04-21 legacy
cleanup. Source of truth is always the code. This doc is a map, not a
specification.

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
├── CLAUDE.md                          (guidance for Claude Code sessions)
├── LICENSE
├── README.md
├── complete_image_seed_data.json      (gitignored, one-shot seed artifact)
├── convex_function_spec.txt           (Convex API snapshot)
├── coverage/                          (leftover test coverage output)
├── data/                              (gitignored raw data pipeline inputs)
├── data_cleaning/                     (gitignored DB cleanup scratch area)
├── docs/
│   ├── APP_OVERVIEW.md
│   ├── CODE_OF_CONDUCT.md
│   ├── CONTRIBUTING.md
│   ├── CURATED_GAMEPLAY_REACHABLE_TARGET_CHECKLIST.md
│   ├── DEPLOYMENT.md
│   ├── DEPLOYMENT_CHECKLIST.md
│   ├── DESIGN_PROMPT.md
│   ├── NEW_GAME_MODES.md
│   ├── REPO_INVENTORY.md               (this file)
│   ├── SECURITY.md
│   └── SURVIVAL_MODE_AUDIT.md
├── frontend-web/
│   ├── convex/                         (Convex backend — see table below)
│   ├── public/
│   ├── scripts/                        (empty after cleanup)
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
├── node_modules/                       (stray empty dir at repo root, see Findings)
├── processed_tennis/                   (gitignored tennis pipeline output)
├── questions.json                      (gitignored one-shot seed artifact)
├── scripts/                            (data pipeline — see table below)
├── verify-no-secrets.sh
├── verveq_platform.db                  (gitignored leftover legacy SQLite)
└── verveq_seed_data.json               (gitignored one-shot seed artifact)
```

## frontend-web/package.json scripts

| Script | Purpose |
| --- | --- |
| `dev` | Vite dev server (port 5173). |
| `build` | Production Vite build. |
| `build:dev` | Vite build with the development mode flag. |
| `lint` | Run ESLint across the frontend workspace. |
| `preview` | Serve the built `dist/` bundle via Vite preview. |
| `gameplay:curated` | Run the curated-mode regenerate/build/seed workflow (`scripts/runCuratedGameplayWorkflow.ts`). |
| `gameplay:curated-parity` | Destructive curated-parity reseed from `scripts/data/*`. Requires allowlist + signed approval. |
| `gameplay:curated-parity:status` | Read-only readiness self-check for curated parity. |
| `gameplay:curated-parity:inspect` | Read-only inspect: deployment identity, state codes, curated manifest summary. |
| `gameplay:curated-parity:approve` | Generate a single-use signed approval artifact for the current target/manifest. |
| `gameplay:smoke` | Backend parity + gameplay startup smoke checks (`scripts/runCuratedGameplaySmoke.ts`). |
| `test` | Vitest run (single-shot). |
| `test:watch` | Vitest in watch mode. |

## frontend-web/convex/ files

Live Convex backend surface. Session-based server-authoritative game logic.

| File | Purpose |
| --- | --- |
| `achievements.ts` | Achievement list/check queries and mutations. |
| `auth.config.ts` | Convex Auth configuration. |
| `auth.ts` | Convex Auth provider wiring (Password + Anonymous). |
| `blitz.ts` | Blitz game-mode mutations/queries (60s rapid-fire). |
| `challenges.ts` | Player-to-player challenge lifecycle. |
| `crons.ts` | Scheduled cron jobs (daily season + ELO decay). |
| `dailyChallenge.ts` | Daily challenge creation, attempt gating, forfeit. |
| `dailyLeaderboard.ts` | Daily leaderboard queries. |
| `eloDecay.ts` | Internal ELO decay run + public decay queries. |
| `forge.ts` | Community question creation / voting. |
| `games.ts` | Game completion — ELO update, history row, per-mode finalizers. |
| `higherLower.ts` | Higher/Lower curated-pool sessions. |
| `http.ts` | HTTP router (Convex Auth HTTP endpoints). |
| `leaderboards.ts` | Leaderboard queries. |
| `liveMatches.ts` | Real-time 1v1 match state + ELO matchmaking. |
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
| `whoAmI.ts` | Who Am I curated-clue sessions. |
| `_generated/api.d.ts` | Convex-generated API types. |
| `_generated/api.js` | Convex-generated API module. |
| `_generated/dataModel.d.ts` | Convex-generated data model types. |
| `_generated/server.d.ts` | Convex-generated server types. |
| `_generated/server.js` | Convex-generated server runtime. |
| `lib/daily.ts` | Daily date helpers and deterministic shuffles. |
| `lib/elo.ts` | ELO math — K-factor, tiers, performance, rating clamp. |
| `lib/fuzzy.ts` | Levenshtein distance + `findBestMatch` for answer validation. |
| `lib/scoring.ts` | Time-based scoring helpers and `normalizeAnswer`. |
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
| `fetchData.ts` | TheSportsDB data pipeline (bio + honors + contracts). |
| `fetchSportsData.ts` | API-FOOTBALL + NBA pipeline — players/teams/fixtures into `scripts/data/*`. |
| `generate_football_metadata.js` | One-shot: build football player metadata from `archive/players.csv`. |
| `generate_image_dataset.js` | One-shot: fetch images from TheSportsDB, produce image-question dataset. |
| `pipeline-config.json` | Leagues / seasons / scopes driving the fetch scripts. |
| `runCuratedGameplaySmoke.ts` | Backend parity + runtime-startup smoke checks for curated modes. |
| `runCuratedGameplayWorkflow.ts` | Unified regenerate / build / seed workflow for curated modes. |
| `runCuratedParityWorkflow.ts` | Destructive curated-parity reseed workflow (status/inspect/approve/apply). |
| `seedSportsDatabase.ts` | HTTP-client bulk seeder for Convex sports data from `scripts/data/*`. |
| `cache/` | Gitignored API fetch cache (`scripts/cache/`). |
| `data/` | Gitignored curated-parity seed artifacts (`scripts/data/*`). |

## docs/ files

| File | Purpose |
| --- | --- |
| `APP_OVERVIEW.md` | Comprehensive product overview of game modes, sports, data scale. |
| `CODE_OF_CONDUCT.md` | Standard contributor Code of Conduct. |
| `CONTRIBUTING.md` | Contribution guide. Needs refresh — see Findings. |
| `CURATED_GAMEPLAY_REACHABLE_TARGET_CHECKLIST.md` | Closeout checklist for Higher/Lower, VerveGrid, Who Am I. |
| `DEPLOYMENT.md` | Current deployment + validation reality (frontend-web + Convex + curated parity). |
| `DEPLOYMENT_CHECKLIST.md` | Current operational rollout checklist. |
| `DESIGN_PROMPT.md` | UI redesign brief. References deleted React Native stack — see Findings. |
| `NEW_GAME_MODES.md` | Source of truth for Higher/Lower, VerveGrid, Who Am I. |
| `REPO_INVENTORY.md` | This inventory. |
| `SECURITY.md` | Security disclosure policy. Describes JWT-era auth — see Findings. |
| `SURVIVAL_MODE_AUDIT.md` | Full Survival mode technical audit. References deleted Python backend files — see Findings. |

## Dependencies declared in frontend-web/package.json with zero imports in the repo

Searched `frontend-web/src/**`, `frontend-web/convex/**`, `frontend-web/tailwind.config.ts`, `frontend-web/vite.config.ts`, `frontend-web/postcss.config.js` and repo-wide for `from "<pkg>"` / `from "<pkg>/..."` / `require("<pkg>")`.

- `@auth/core` — no import site. Transitive of `@convex-dev/auth` but not directly used by first-party code.
- `@hookform/resolvers` — no import site. `react-hook-form` is also declared but used only via `components/ui/form.tsx`.
- `date-fns` — no import site.
- `zod` — no import site.

Not auto-removed in Stage 1 because they were not in the task's explicit candidate list. Verified to have zero direct imports; safe to drop in a follow-up after one more sanity check in CI.

---

## Findings

### Dead imports / dangling references

- `scripts/generate_football_metadata.js` reads `archive/players.csv`. The CSV is gitignored and may not exist on a fresh clone.
- Top-level `node_modules/` is an empty directory — an artefact of prior tooling; no `package.json` at repo root. Safe to delete.
- Stray top-level files left behind by the deleted stack: `verveq_platform.db` (SQLite, was written by the Python backend), `complete_image_seed_data.json`, `questions.json`, `verveq_seed_data.json`. All gitignored, none referenced by live code.
- `coverage/` at repo root is leftover output from the deleted Jest/Pytest suites.

### Tests that silently skip, no longer run, or reference deleted paths

- The legacy `.github/workflows/tests.yml` was removed in Stage 1. No replacement CI workflow exists yet for the frontend-web stack.

### Docs still describing deleted surfaces

- `README.md` — current content is Convex-focused and accurate after Stage 1, but nothing describes the Live Match, Quiz, Blitz, Daily, or Forge modes that still ship in `frontend-web/convex/`. The coverage table only lists Survival, Higher/Lower, VerveGrid, and Who Am I. Accurate but incomplete.
- `docs/APP_OVERVIEW.md` — accurate high-level product overview, no references to deleted surfaces.
- `docs/CONTRIBUTING.md` — "Project Structure" section still claims `backend/` (FastAPI), `frontend/` (React Native), and `tests/` exist. All three were deleted in Stage 1. Refresh this file.
- `docs/DESIGN_PROMPT.md` — framed explicitly around "Platform: React Native + Expo (iOS, Android, Web from one codebase)". The repo has been web-only (Vite) for some time.
- `docs/SECURITY.md` — lists JWT tokens and "configurable period" expiry as the auth model. Current auth is Convex Auth (Password + Anonymous); JWT claims are not the primary story.
- `docs/SURVIVAL_MODE_AUDIT.md` — Sections 2, 4, 5, and 15 explicitly document the deleted Python backend files (`backend/sports/survival_engine.py`, `backend/services/survival_session.py`, `backend/routes/survival/*`, `backend/sports/utils.py`). The Convex half of the audit is still accurate and is the source of truth for Survival; the Python-side tables are now historical/archival.

### .env samples that drifted from actual env usage

- `.env.example` and `.env.production.example` were deleted in Stage 1. No replacement exists. The live runtime expects `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL` in `frontend-web/.env.local` (plus optional API-FOOTBALL / TheSportsDB keys read by `scripts/fetchSportsData.ts` and `scripts/fetchData.ts`). A fresh `frontend-web/.env.local.example` documenting the current variables would close this gap.
- Root `.env` is gitignored but still present and contains stale values for the deleted stack. Worth a manual audit before deleting.

### TODO / FIXME on live code paths

- `frontend-web/convex/survivalSessions.ts:~126` — `famousWeight` is stored on the session but never used for weighted selection (noted in `SURVIVAL_MODE_AUDIT.md:§4`). Protected scope — do not reopen without a concrete blocker.
- `frontend-web/src/pages/SurvivalScreen.tsx:230` and `frontend-web/src/pages/DailySurvivalScreen.tsx:193` — ESLint flags `useHintMut` being called inside a non-hook handler (`react-hooks/rules-of-hooks`). Protected Survival scope, not touched by cleanup.
- `frontend-web/tailwind.config.ts:120` — `require()` call triggers `@typescript-eslint/no-require-imports`. Pre-existing.
- `frontend-web/src/components/ui/{command,textarea}.tsx` — empty interface lint errors (`@typescript-eslint/no-empty-object-type`). shadcn/ui template leftovers.

### Things that look stale but are not safe to delete without confirmation

- `verify-no-secrets.sh` at repo root. Written for the old deployment model; still runs `git ls-files` style checks that remain partially valid, but it references the deleted FastAPI assumptions. Keep or replace rather than silently delete.
- `archive/` (CSV dumps), `archive_nba.zip` (730 MB), `nba.sqlite` (2.2 GB), `processed_tennis/`, `data_cleaning/` — all historical pipeline inputs referenced by non-destructive fetch scripts. Gitignored. Keep as local-only working data.
- `frontend-web/scripts/` is now an empty directory (both seed scripts removed in Stage 1). Harmless but could be deleted for cleanliness.
- `frontend-web/vite-*.log`, `frontend-web/vite-preview-*.log`, `frontend-web/serve-phase3*.log` — leftover ad-hoc log files from Phase 3 validation. Gitignored via `*.log`, safe to delete locally.
- `docs/CURATED_GAMEPLAY_REACHABLE_TARGET_CHECKLIST.md` is currently untracked (never committed). Decide whether to commit or delete.
- `convex_function_spec.txt` (163 KB, untracked) — a Convex API dump snapshot. Not referenced by any tooling. Either commit as an audit artefact or delete.
- Dependencies `@auth/core`, `@hookform/resolvers`, `date-fns`, `zod` are unused (see above). Not auto-removed because they were not in the task's explicit candidate list.
