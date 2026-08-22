# Backup and restore

VerveQ keeps nothing irreplaceable on the Hetzner box — the nginx container is
stateless and rebuildable from a git tag. Everything irreplaceable lives in the
production Convex deployment `different-lynx-153`. This document covers the copy
of that data we control, and how to put it back.

Rehearsed end to end on 2026-08-22. Numbers below are from that rehearsal, not
estimates.

## Where snapshots live

`r2://verveq-backups` (Cloudflare R2, Western Europe). Written by
`.github/workflows/backup-convex.yml`, which runs in GitHub Actions — **not on
the Hetzner box**, deliberately: a backup job living on the machine it protects
stops running in exactly the situation you need it, and the prod deploy key
never lands on a shared server.

| prefix | when | contents | kept |
|---|---|---|---|
| `daily/` | Mon–Sat 03:17 UTC | tables only, ~17 MB zipped | 14 days |
| `weekly/` | Sunday 03:17 UTC | full, incl. file storage, ~550 MB | 8 weeks |
| `monthly/` | 1st, 03:47 UTC | full | 6 months |
| `manual/` | on demand | full | 90 days |

Retention is enforced by **R2 lifecycle rules keyed to those prefixes**. Renaming
a prefix in the workflow without changing the rule means objects stop expiring
and the bill grows quietly. Change both.

### Why the daily tier skips file storage

`_storage` is ~86% of the bytes and is mostly duel share cards, which regenerate.
But `seedQuestions.ts` also stores **question images** there, read back via
`question.imageId` in `challengeArenas.ts` and `forge.ts`. Those are content, not
cache — dropping file storage entirely would mean image questions come back
broken. Hence weekly full snapshots rather than never.

## Before any schema change or backfill

Migrations are where real data dies, and the scheduled snapshot may be up to 24
hours old. Take one first:

```
gh workflow run backup-convex.yml --repo Darkhouse13/VerveQ -f tier=manual
gh run watch --repo Darkhouse13/VerveQ
```

Wait for it to go green before touching the schema. The workflow verifies the
archive opens and contains the expected tables before uploading, so a green run
means a usable snapshot, not just a completed upload.

## Restoring

> **The dangerous part.** `--replace` and `--replace-all` delete data in the
> target deployment. `convex import` writes to whatever `CONVEX_DEPLOY_KEY`
> points at, and if that variable is set to prod in your shell, a restore
> intended for dev wipes production instead. **Always print the target first.**

```bash
cd app

# 1. Confirm where you are about to write. Never skip this.
echo "deploy key: '${CONVEX_DEPLOY_KEY:-<unset>}'"
grep CONVEX_DEPLOYMENT .env.local

# 2. Fetch the snapshot (rclone needs --s3-no-check-bucket: the R2 token is
#    scoped to objects in one bucket and cannot answer a bucket-level probe,
#    which otherwise fails with a misleading 403 AccessDenied).
export RCLONE_S3_PROVIDER=Cloudflare RCLONE_S3_REGION=auto
export RCLONE_S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
export RCLONE_S3_ACCESS_KEY_ID=... RCLONE_S3_SECRET_ACCESS_KEY=...
export RCLONE_S3_NO_CHECK_BUCKET=true
rclone lsl :s3:verveq-backups                       # pick the snapshot
rclone copyto :s3:verveq-backups/daily/<file>.zip ./restore.zip

# 3. Check it before trusting it.
unzip -t restore.zip

# 4. Restore. --replace restores the tables present in the snapshot;
#    --replace-all additionally deletes tables absent from it (use that only
#    for a true full-deployment rollback).
env -u CONVEX_DEPLOY_KEY npx convex import --replace -y restore.zip

# 5. Verify independently — re-export and compare row counts against the
#    snapshot you restored from. "The command exited 0" is not verification.
env -u CONVEX_DEPLOY_KEY npx convex export --path after.zip
```

To restore **production**, set `CONVEX_DEPLOY_KEY` to the prod key for step 4
only, and say the deployment name out loud before you press enter.

## What the rehearsal proved

Prod snapshot (17 MB, 99 tables) restored into the dev deployment with
`--replace`, then dev returned to its prior state from its own safety snapshot.
Row counts after restore, compared against the source archive:

| table | source | restored |
|---|---|---|
| users | 477 | 477 |
| userRatings | 51 | 51 |
| gameSessions | 176 | 176 |
| quizQuestions | 11,126 | 11,126 |
| higherLowerFacts | 84,828 | 84,828 |
| dailyChallenges | 464 | 464 |

204,260 documents imported. Every table matched.

## Known gotchas

- **rclone against R2 needs `--s3-no-check-bucket`.** Without it, writes fail
  with `403 AccessDenied` that looks like a bad token but is not.
- **The first R2 write may return `501 NotImplemented` and succeed on retry** —
  a checksum-algorithm mismatch. The workflow sets
  `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` to avoid it with aws-cli.
- **The Convex CLI version is pinned** in the workflow so a CLI release cannot
  change the archive format under this runbook.
- **The backup does not cover Convex functions or environment variables** — only
  data. Functions live in git; env vars live only in the Convex dashboard and
  are worth writing down somewhere.
