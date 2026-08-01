# CAMPAIGN LEDGER — THE WEEKEND (CT-1)

Campaign: waitlist joins between now and the first full weekend
(Aug 28–30). Arc: **tease → argue → count**. Launch copy is always
"late August", never a day. This file is the single source of truth for
asset state; update it every loop.

## Standing rules (owner-issued, CT-1 + amendments)

- **Shapes, not constants.** Content sells mechanic shapes; sim-tunable
  numbers (multipliers, clamps, clock seconds, cooldowns, thresholds)
  never appear in an asset.
- **A1:** `wknd-count` renders only when the real waitlist count ≥ 50
  (the product's own no-sad-small-numbers floor). Below 50 it waits.
- **A2:** FPL may be named in X copy (ephemeral). Rendered evergreen
  video uses the generic frame ("season-long fantasy"). Owner may veto.
- **A3:** every owner kit carries a time estimate; if an owner-side piece
  slips, the Remotion spine ships without it — cadence never blocks.
- All CT-1 hard rules (no invented football facts, no AI-rendered UI,
  real recordings as only product proof, tagged links everywhere,
  reply-format never plugs, no posting by me — owner ships).

## Assets

| Asset | Phase | State | Files | Owner must do |
|---|---|---|---|---|
| `wknd-stinger` (8.0s ident) | Tease | **RENDERED, frame-0 verified** | `out/2026-07-29/wknd-stinger.mp4` + caption `.txt` (tagged links inside) | Post to TT/IG/YT; attach to X thread post 1 and pin |
| `wknd-manifesto` (18.6s flagship) | Tease | **RENDERED, verified** (frame-0, creed, shapes, silent deadpan, CTA) | `out/2026-07-29/wknd-manifesto.mp4` + caption `.txt` | Post ~2 days after stinger |
| Week-0 X thread (7 posts) | Tease | **READY TO POST** | `campaign/x/week0-thread.md` | Post, pin post 1 |
| Bio links (4 channels) | Week 0 | **KIT READY** (~10 min) | `campaign/kits/bio-links-kit.md` | Paste 4 URLs |
| Teaser-card recording | Week 0 | **KIT READY** (~20 min) | `campaign/kits/teaser-recording-kit.md` | Record 2 clips → `public/product/weekend-teaser-*.mp4` |
| `wknd-bench` | Argue I | queued (next loop) | — | — |
| Dave × WEEKEND film kit (`dave-bench`) | Argue I | queued — prompts + envelope workflow to spec (~45 min owner shoot, Higgsfield credits) | — | Shoot when kit lands (Aug 4–10 calendar slot) |
| `wknd-referee` | Argue II | queued | — | — |
| `wknd-deadseason` | Argue II | queued | — | — |
| `wknd-removed` | Ride-the-season | queued (rotation) | — | — |
| `wknd-draftnight` | Ride-the-season | queued (rotation) | — | — |
| `wknd-count` | Count | blocked by A1 (needs real count ≥ 50; render-time input) | — | Report count when ≥ 50 |
| `wknd-lastcall` | Count | queued (final week) | — | — |
| README refresh (batches 5–6 + weekend lane) | Bookkeeping | queued, its own line per owner | `README.md` | — |

## Cadence (against real dates; copy never names our date)

- **Jul 29 – Aug 3 (TEASE)**: stinger + manifesto + thread out; owner
  does bio links + teaser recording.
- **Aug 4 – 10 (ARGUE I)**: `wknd-bench` + Dave shoot window.
- **Aug 11 – 17 (ARGUE II)**: `wknd-referee`, `wknd-deadseason`.
- **Aug 18 – 23 (RIDE THE SEASON, opens Aug 21–22)**: `wknd-removed`,
  `wknd-draftnight`; count phase if A1 floor passed.
- **Aug 24 – 28 (COUNT/CLOSE)**: `wknd-lastcall`, daily X countdown.

## Infrastructure (this campaign's build)

- `src/weekend/` — campaign compositions (ink ground, lime #c6ff00 lead,
  cream support — the teaser card's world, distinct from the cream quiz
  brand). Registered in `src/Root.tsx` as `WkndStinger`, `WkndManifesto`.
- `weekend.mjs` — campaign renderer (mirrors promo.mjs; separate so the
  campaign can't destabilise the promo lane). `node weekend.mjs [slug…]`.
- `weekend/*-audio.mjs` — soundtracks (audio-lib synthesis, beat-gridded,
  MUST mirror their timeline.ts — re-time one, re-time both).
- `weekend/captions.mjs` — captions with per-channel tagged links
  (`utm_campaign=weekend26`, `utm_source=<channel>`,
  `utm_content=<slug|bio>`).
