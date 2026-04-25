# Deployment Checklist - Current Operational Status

This checklist tracks the current gameplay rollout reality, not the older legacy infrastructure plan.

## Completed in repo

- [x] Survival earlier football quality work completed
- [x] Higher or Lower complete in repo
- [x] VerveGrid complete in repo
- [x] Who Am I complete in repo

## Live in dev backend

- [x] Higher or Lower approved runtime layers deployed to dev Convex backend
- [x] VerveGrid curated board runtime deployed to dev Convex backend
- [x] Who Am I approved clue runtime deployed to dev Convex backend
- [x] Authoritative curated parity workflow exists for dev/preview backend reseeds
- [x] Destructive curated parity is fail-closed unless the exact deployment+URL pair is deliberately allowlisted in gitignored local ops config
- [x] Destructive curated parity requires a short-lived local approval artifact tied to the exact target and manifest seed version
- [x] Destructive curated parity approvals are single-use in practice and recorded in local approval history before the first destructive step
- [x] Destructive curated parity signatures now rely on non-repo-local supported-platform trust anchors instead of a repo-local mutable secret file
- [x] Curated seed metadata/version is stored in Convex and can be inspected per table

## Validated on reachable target

- [x] Higher or Lower validated on reachable static frontend target
- [x] VerveGrid validated on reachable static frontend target
- [x] Who Am I validated on reachable static frontend target
- [x] Curated smoke checks compare backend seed metadata against repo artifact parity before runtime startup checks

## Current mode availability truth

- [x] Survival remains multi-sport in current runtime
- [x] Higher or Lower is football-only in frontend and backend
- [x] VerveGrid is football-only in frontend and backend
- [x] Who Am I is football-only in frontend and backend

## Current operational blockers

- [ ] Separate remote frontend rollout for Higher or Lower
- [ ] Separate remote frontend rollout for VerveGrid
- [ ] Separate remote frontend rollout for Who Am I

These three items are currently blocked externally when remote deploy access/config is missing. They are not treated as repo gameplay bugs.

## Current source-of-truth docs

- [x] `README.md` reflects current gameplay/runtime status
- [x] `docs/NEW_GAME_MODES.md` reflects current curated mode runtime layers
- [x] `docs/DEPLOYMENT.md` reflects current deployment/validation reality
- [x] Curated parity command is documented as the primary backend alignment path
- [x] Curated parity safe self-check/status command is documented as the primary read-only readiness path
- [x] Curated parity inspect/approve/apply safety model is documented for approved dev/preview targets
- [x] Curated parity docs explain that replay requires a fresh approve step
- [x] Curated parity docs explain platform/backend support plus trust-anchor availability vs missing/unusable states
- [x] Curated parity docs use consistent local allowlist / trust anchor / approval artifact / apply session terminology

## Explicitly out of scope for this checklist

- Survival valid-answer expansion
- Reopening football identity matching without a concrete blocker
- New gameplay feature work
- Assuming a remote frontend deployment path exists when this workspace lacks access/config
