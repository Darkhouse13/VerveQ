# Curated Gameplay Modes - Current Source of Truth

This document replaces the earlier raw-runtime audit for the three curated gameplay modes:

- Higher or Lower
- VerveGrid
- Who Am I

It documents the runtime layers that are actually in use today, the current availability by mode, and the validation/deployment reality from this workspace.

## Current status summary

| Mode | Complete in repo | Live in dev backend | Validated on reachable target | Separate remote frontend rollout |
| --- | --- | --- | --- | --- |
| Higher or Lower | Yes | Yes | Yes | Externally blocked when deploy access/config is missing |
| VerveGrid | Yes | Yes | Yes | Externally blocked when deploy access/config is missing |
| Who Am I | Yes | Yes | Yes | Externally blocked when deploy access/config is missing |

## Shared rules

- All three modes are currently football-only in both frontend and backend/runtime.
- Raw provider-shaped data is preserved for pipeline and audit use.
- Live runtime uses approved curated layers, not the earlier raw runtime tables.
- Missing remote frontend deploy access/config is an operational blocker, not a repo gameplay bug.

## Higher or Lower

### Live runtime layer

- Approved pools: `higherLowerPools`
- Approved facts: `higherLowerFacts`
- Session backend: `app/convex/higherLower.ts`

### What this replaced

- Earlier raw-session selection from `statFacts`
- Runtime-only context cleanup
- Runtime exposure to all-equal groups, low-entropy groups, and ineligible player facts

### Current behavior

- Football-only in frontend and backend
- Sessions start only from approved pools
- Equal-value pairings are blocked both upstream and defensively in backend selection
- No in-run fact/entity repeats for new sessions
- Clean pool exhaustion ends the run instead of recycling content
- Frontend has explicit unsupported-sport and startup-failure states

## VerveGrid

### Live runtime layer

- Approved cell layer: `verveGridApprovedIndex`
- Curated live boards: `verveGridBoards`
- Session backend: `app/convex/verveGrid.ts`

### What this replaced

- Earlier raw board generation from `gridIndex`
- Brute-force first-valid board construction
- Global sport-wide search results for cell entry

### Current behavior

- Football-only in frontend and backend
- Sessions start from curated seeded boards only
- Board families are precomputed upstream, then selected live
- Search is cell-aware and prioritizes valid candidates for the active cell
- Frontend has explicit unsupported-sport and startup-failure states

### Important operational note

VerveGrid generation is two-stage:

1. build approved grid entries
2. build curated boards from those approved entries

The second stage currently runs through `scripts/buildVerveGridBoards.ts`.
Raw `gridIndex` remains a local pipeline/audit artifact and is no longer part of default Convex seeding for live/dev runtime.

## Who Am I

### Live runtime layer

- Approved clue layer: `whoAmIApprovedClues`
- Session backend: `app/convex/whoAmI.ts`

### What this replaced

- Earlier runtime selection from raw `whoAmIClues`
- Implicit easy/medium-only default selection

### Current behavior

- Football-only in frontend and backend
- Sessions start only from approved clues
- Default no-arg starts use an explicit weighted mix over approved difficulties
- Frontend has explicit unsupported-sport and startup-failure states
- Copy now reflects the approved football clue pool rather than generic multi-sport availability

## Survival in relation to these modes

Survival is not part of this curated-mode document.

- Survival remains the broader multi-sport mode in current runtime.
- Earlier football Survival quality work is already complete.
- Do not reopen Survival valid-answer scope from the new-mode docs.

See `docs/SURVIVAL_MODE_AUDIT.md` for Survival details.

## Validation reality

From this workspace, there are two distinct validation levels:

### Dev backend

- Convex functions and schema can be deployed to the configured dev deployment from `app`.
- The curated mode backends above are live in that dev backend.
- Exact curated runtime parity is now applied from committed repo artifacts with:

```bash
cd app
npm run gameplay:curated-parity:status
```

- The status command is the fastest safe self-check. It is read-only and reports whether destructive parity is still blocked by default, plus the local allowlist, trust-anchor, approval artifact, and apply-session states.
- If you also want the current curated manifest in the same read-only flow, run:

```bash
cd app
npm run gameplay:curated-parity:inspect
```

- The inspect command is the safe preflight. It resolves the current Convex target from `app/.env.local`, prints the detected deployment identity, and tells the operator exactly what to do next.
- Destructive parity is fail-closed by default.
- Authoritative apply now uses a local ops workflow:
  - `CONVEX_DEPLOYMENT` + `VITE_CONVEX_URL` still identify the target in `app/.env.local`
  - approved destructive targets live in the gitignored local file `.ops/curated-parity/approved-targets.local.json`
  - a separate `npm run gameplay:curated-parity:approve` step writes a signed single-use approval artifact for the exact resolved target and current manifest seed version
  - approval signatures and apply-session signatures now come from a supported platform trust anchor outside the repo:
    - Windows current-user DPAPI at `%LOCALAPPDATA%\VerveQ\curated-parity\trust-anchor.current-user.dpapi`
    - macOS Keychain generic password item `service=ai.factory.verveq.curated-parity`, `account=current-user`
  - apply consumes that approval before the first destructive step, records it in local approval history, and requires a fresh `approve` step before any replay or retry
  - destructive child seed steps only run inside the active apply session created by the wrapper
  - if the trust anchor is missing on a supported platform, `approve` creates it; if the backend is unusable, unavailable, or unsupported, approve/apply block safely
- After the target is deliberately allowlisted, generate approval with:

```bash
cd app
npm run gameplay:curated-parity:approve
```

- Then apply with:

```bash
cd app
npm run gameplay:curated-parity
```

- That command authoritatively reseeds the football curated runtime footprint:
  - `sportsPlayers` (football slice only)
  - `sportsTeams` (football slice only)
  - `higherLowerPools`
  - `higherLowerFacts`
  - `verveGridApprovedIndex`
  - `verveGridBoards`
  - `whoAmIApprovedClues`
- It replaces stale backend rows instead of only inserting missing rows.
- It stops before any clear-and-reseed step if the deployment kind is not `dev`/`preview`, the target is not in the local ops allowlist, the approval artifact is missing/expired/mismatched/already consumed, the active apply session is not valid, or the run is happening in CI.
- It stores the applied artifact version, hash, counts, and replace summary in `curatedSeedMetadata`.

### Reachable frontend target

- A production bundle can be built locally and served on a local static port.
- That local static bundle is the reachable target used for validation in this workspace.
- The curated mode frontend flows were validated there against the live dev backend.

### Separate remote frontend rollout

- Not available from this workspace when remote deploy access/config is missing.
- That missing access/config is external to repo correctness.

## Files that now matter most

- `app/convex/higherLower.ts`
- `app/convex/verveGrid.ts`
- `app/convex/whoAmI.ts`
- `app/convex/schema.ts`
- `scripts/seedSportsDatabase.ts`
- `scripts/runCuratedParityWorkflow.ts`
- `scripts/curatedSeedManifest.ts`

## Files this document supersedes conceptually

If older notes or comments imply that these modes still run from raw `statFacts`, raw `gridIndex`, or raw `whoAmIClues`, those notes are stale.
