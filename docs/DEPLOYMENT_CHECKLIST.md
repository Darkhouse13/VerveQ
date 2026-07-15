# Deployment Checklist - Closed

> **This checklist is closed and kept for history. Do not work from it.**
>
> It existed to track one thing: curated modes that were finished in the repo
> but could not be rolled out because this workspace had no remote frontend
> deploy path. That premise is gone. `.github/workflows/deploy.yml` deploys the
> Convex backend to production and publishes the frontend over SSH on **every
> push to `master`** — automatically, with no confirmation step and nothing
> externally blocked. The blockers this document tracked were already phantom.
>
> For deployment, read [DEPLOYMENT.md](DEPLOYMENT.md) — what a master push does,
> host topology, and rollback. For current mode/runtime status, read
> [README.md](../README.md).

## Why it is closed

- **The blockers were not real.** The three "separate remote frontend rollout" items, and the out-of-scope note about "assuming a remote frontend deployment path exists", described a workspace limitation rather than the pipeline. The pipeline ships the frontend on every master push (`deploy.yml:63-76`).
- **One of its subjects no longer exists.** Who Am I was removed in 2026-07 and replaced by Career Path (`app/convex/careerPath.ts`).
- **The rest is duplicated and better maintained elsewhere.** Mode availability lives in README.md; the curated-parity safety model lives in README.md and the workflow itself; deployment reality lives in DEPLOYMENT.md.

## Historical record

Kept as a record of what was true when this checklist was last maintained. The
dev-backend and validation-target rows asserted deployment state that cannot be
confirmed from the repo — treat them as last-known-good, not as current fact.

Completed in repo:

- [x] Survival earlier football quality work completed
- [x] Higher or Lower complete in repo
- [x] VerveGrid complete in repo
- [x] Who Am I complete in repo *(mode later removed — replaced by Career Path)*

Curated parity safety model (still current; see README.md):

- [x] Authoritative curated parity workflow exists for dev/preview backend reseeds
- [x] Destructive curated parity is fail-closed unless the exact deployment+URL pair is deliberately allowlisted in gitignored local ops config
- [x] Destructive curated parity requires a short-lived local approval artifact tied to the exact target and manifest seed version
- [x] Destructive curated parity approvals are single-use in practice and recorded in local approval history before the first destructive step
- [x] Destructive curated parity signatures rely on non-repo-local supported-platform trust anchors instead of a repo-local mutable secret file
- [x] Curated seed metadata/version is stored in Convex and can be inspected per table
- [x] Curated smoke checks compare backend seed metadata against repo artifact parity before runtime startup checks

Mode availability at close (current source: README.md):

- [x] Survival remains multi-sport in current runtime
- [x] Higher or Lower is football-only in frontend and backend
- [x] VerveGrid is football-only in frontend and backend
- [x] Career Path is football-only in frontend and backend

## Source-of-truth docs

- [x] `README.md` reflects current gameplay/runtime status
- [x] `docs/DEPLOYMENT.md` reflects current deployment reality — reconciled line-for-line against `deploy.yml` on 2026-07-15
- [ ] `docs/NEW_GAME_MODES.md` — current on mode scope (it records Who Am I as removed), but it still carries the same false premise this checklist did: a "Separate remote frontend rollout" column reading "externally blocked when deploy access/config is missing", and a shared rule calling that an operational blocker. The frontend ships on every master push. Its runtime-layer detail for Higher or Lower and VerveGrid remains useful.
