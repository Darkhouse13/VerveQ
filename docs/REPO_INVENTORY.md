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
| `dev_up.py` | Legacy launcher for deleted FastAPI backend + Expo frontend — see Findings. |
| `generators/` | Legacy Python question-generator stubs referenced only by deleted tests — see Findings. |
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
