# Content-integrity cleanup — audit trail (2026-06-13)

Post-hoc records of the knowledge-pool duplicate purge: **11 exact-duplicate rows removed +
one history stem neutralized**, applied live to prod in commit `ca70949` (rollback artifact:
`deleted-rows-rollback-2026-06-13.json`, also committed in `90fdaa6`).

These are the exact live exports/QA that ran against prod — do not regenerate or normalize:
- `live-*.json` — full live-pool exports (knowledge = 2038 rows, merged/export = 3089).
- `qa-bundled-pool-after-fix.json` + `qa-bundled-report-after-fix.txt` — post-fix QA proving
  `"ok": true` / ERROR=0 (`.txt` because the report dump isn't valid standalone JSON).
