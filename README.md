# VerveQ

VerveQ is a sports-trivia app built around React + Vite on the frontend and Convex on the backend. The current gameplay roadmap focus has been on quality-hardening the shipped modes rather than expanding scope.

## Current gameplay status

| Mode | Runtime source of truth | Current availability | Current status |
| --- | --- | --- | --- |
| Survival | Bundled survival data in `frontend-web/convex/data/*` plus curated football survival index | Football, basketball, tennis | Existing quality work complete. Do not reopen valid-answer scope casually. |
| Higher or Lower | `higherLowerPools` + `higherLowerFacts` | Football-only in frontend and backend | Complete in repo, live in dev backend, validated on reachable static target. Separate remote frontend rollout is externally blocked. |
| VerveGrid | `verveGridBoards` derived from `verveGridApprovedIndex` | Football-only in frontend and backend | Complete in repo, live in dev backend, validated on reachable static target. Separate remote frontend rollout is externally blocked. |
| Who Am I | `whoAmIApprovedClues` | Football-only in frontend and backend | Complete in repo, live in dev backend, validated on reachable static target. Separate remote frontend rollout is externally blocked. |

## Runtime shape

- `frontend-web/convex/` is the live backend surface.
- Raw provider-shaped artifacts are preserved in `scripts/data/`, but the shipped curated modes now run from approved layers:
- Higher or Lower reads approved pools/facts instead of raw `statFacts`.
- VerveGrid reads curated boards instead of raw `gridIndex`.
- Raw `gridIndex` remains a local pipeline/audit artifact and is not part of default Convex seeding.
- Who Am I reads approved clues instead of raw `whoAmIClues`.
- Survival remains the broader multi-sport mode and is not part of the recent curated-mode frontend availability pass.

## Repo layout

| Path | Purpose |
| --- | --- |
| `frontend-web/` | React app, Convex functions, and bundled runtime data |
| `scripts/` | Data pipeline, sports-data fetch/build scripts, seeding, and support tooling |
| `docs/` | Current operational and gameplay documentation |

## Local development

```bash
cd frontend-web
npm install
npx convex dev
npx vite
```

### Current dev backend

The repo target is currently resolved from `frontend-web/.env.local`, using both `CONVEX_DEPLOYMENT` and `VITE_CONVEX_URL`. Destructive curated parity approval uses gitignored repo-local state under `.ops/curated-parity/`, but the approval-signing trust anchor now lives outside the repo on supported platforms:

- Windows: current-user DPAPI at `%LOCALAPPDATA%\VerveQ\curated-parity\trust-anchor.current-user.dpapi`
- macOS: Keychain generic password item `service=ai.factory.verveq.curated-parity`, `account=current-user`
- Linux/other platforms: no supported non-repo-local backend yet, so destructive approve/apply stay fail-closed

### Curated runtime parity

Destructive curated parity now fails closed by default. It no longer relies on sticky shell approval env vars as the primary path.

Start with the safe self-check:

```bash
cd frontend-web
npm run gameplay:curated-parity:status
```

That command is read-only. It reports the current target, whether destructive parity is still blocked by default, the local allowlist state, trust-anchor readiness, approval artifact state, apply-session state, and the next operator step.

If you also want the current curated manifest in the same read-only flow, run:

```bash
cd frontend-web
npm run gameplay:curated-parity:inspect
```

If the target is allowlisted, create a fresh single-use local approval artifact:

```bash
cd frontend-web
npm run gameplay:curated-parity:approve
```

That approval only works when the exact target is present in the gitignored local ops config:

```text
.ops/curated-parity/approved-targets.local.json
```

The status/inspect flow uses consistent state names:

- `localAllowlist`: `missing`, `malformed`, `matched`, or `unmatched`
- `trustAnchorStatus`: `available`, `missing`, `unsupported`, or `unusable`
- `approvalArtifactStatus`: `missing`, `valid`, `expired`, `mismatch`, `invalid`, or `consumed`
- `applySessionStatus`: `missing`, `active`, `expired`, or `invalid`

If the trust anchor is missing on a supported platform, the approve step creates it for the current local user. If the platform/backend is unavailable or unsupported, approve/apply fail closed.

Then apply parity:

```bash
cd frontend-web
npm run gameplay:curated-parity
```

That workflow prints the detected deployment identity, whether it is allowed or blocked, which safeguard was applied, then reseeds `sportsPlayers`, `sportsTeams`, `higherLowerPools`, `higherLowerFacts`, `verveGridApprovedIndex`, `verveGridBoards`, and `whoAmIApprovedClues` authoritatively from `scripts/data/*`, replaces stale rows deterministically, records the applied artifact version in `curatedSeedMetadata`, consumes the approval before the first destructive step, and requires a fresh `approve` step before any replay or retry. CI and unsupported trust-anchor environments remain blocked for destructive apply.

Common blocked states:

- missing local allowlist -> create/fix `.ops/curated-parity/approved-targets.local.json`
- trust anchor missing -> run `npm run gameplay:curated-parity:approve` on a supported local operator workspace
- trust anchor unsupported/unusable -> use Windows (DPAPI) or macOS (Keychain); Linux destructive approve/apply remains intentionally blocked
- approval consumed -> run `npm run gameplay:curated-parity:approve` again before retrying
- active apply session present -> wait for the current session to finish or expire before retrying

To verify parity plus runtime startup behavior afterward:

```bash
cd frontend-web
npm run gameplay:smoke -- all
```

## Reachable-target validation reality

From this workspace, the reliable validation pattern is:

```bash
cd frontend-web
npm run build
npx serve -s dist -l 3000
```

That serves a production bundle locally against the configured dev Convex backend. This is the "reachable target" referenced in the gameplay closeout notes.

## Deployment reality

- Dev backend deployment is available through Convex from `frontend-web`.
- Reachable static-target frontend validation is available from this workspace.
- Separate remote frontend rollout is not currently available from this workspace when deploy access/config is missing. Treat that as an external operational blocker, not a repo gameplay bug.

## Current docs to trust

- `docs/NEW_GAME_MODES.md` - current source of truth for Higher or Lower, VerveGrid, and Who Am I
- `docs/SURVIVAL_MODE_AUDIT.md` - source of truth for Survival gameplay
- `docs/DEPLOYMENT.md` - current deployment and validation reality
- `docs/DEPLOYMENT_CHECKLIST.md` - current operational status checklist
