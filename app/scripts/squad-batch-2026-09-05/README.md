# Manual squad batch, 2026-09-05 (end of summer window)

API-Football account suspended, so this batch replaced the FW-T1 transfer sweep
and the FW-AVAIL injury sweep with free sources:

- ESPN keyless rosters (`site.api.espn.com/.../teams/{id}/roster`) for all 156 covered clubs
- Transfermarkt quick search as the independent confirmation of every move/departure/arrival
- Transfermarkt league injury + suspension lists for gameweek-4 flags

Flow: `match.py` (diff ours vs ESPN, per club) -> `tm_batch.py` (TM search, cached)
-> `resolve.py` (both sources must agree) -> `build_events.py` -> `apply_events.py`
(drives `fantasyTransfers:startSweep/applyTransferChunk/finishSweep` on prod via
`npx convex run --prod`) -> `flags.py --apply` (drives `fantasyAvailability:applyLeagueAvailability`).

Sweep row: x57axaks5chgtxz4pwgmfmn8nh8dtc4m. Counts: 254 incoming_known, 538 outgoing,
531 incoming_new (providerPlayerId `tm:<transfermarkt id>`, price 4.0, pool flagged).
Every event key starts with `manual:2026-09-05:` in fantasyTransferEvents.
Scripts carry the session scratchpad path; they are kept for reference, not as a tool.
