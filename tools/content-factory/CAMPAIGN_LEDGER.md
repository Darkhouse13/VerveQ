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
| Bio links (4 channels) | Week 0 | **KIT STALE — URLs point at bare `/`**, which `WKND-FUNNEL` (ea66823) measured as a dead end for reel traffic (5 IG visitors, 4 saw the card, 0 tapped; `/` serves the cold-entry taste round, no WEEKEND card). Repoint at `/weekend`, same tags. | `campaign/kits/bio-links-kit.md` | Paste 4 URLs — **as `https://verveq.com/weekend?…`**, not as written |
| Teaser-card recording | Week 0 | **KIT READY** (~20 min) | `campaign/kits/teaser-recording-kit.md` | Record 2 clips → `public/product/weekend-teaser-*.mp4` |
| `ladder-long-five-leagues` (78.0s quiz) | Argue I | **RENDERED, NARRATED, verified** (22/22 VO cues on frame, withhold, batch 1+2 byte-identical) | `out/2026-08-05/verveq-ladder-long-five-leagues.mp4` + caption `.txt` (tagged links inside); see `LADDER_LONG_BATCH2_5.md` | Post — but **repoint the bio links at `/weekend` first**; "link in bio" is the CTA and the kit is stale |
| `ladder-long-one-squad` (78.0s quiz) | Argue I | **RENDERED, NARRATED, verified** (22/22 cues) | `out/2026-08-05/verveq-ladder-long-one-squad.mp4` + caption `.txt` | as above |
| `wknd-bench` | Argue I | queued (next loop) | — | — |
| Dave × WEEKEND film kit (`dave-bench`) | Argue I | queued — prompts + envelope workflow to spec (~45 min owner shoot, Higgsfield credits) | — | Shoot when kit lands (Aug 4–10 calendar slot) |
| `wknd-referee` | Argue II | queued | — | — |
| `wknd-deadseason` | Argue II | queued | — | — |
| `wknd-removed` | Ride-the-season | queued (rotation) | — | — |
| `wknd-draftnight` | Ride-the-season | queued (rotation) | — | — |
| `wknd-count` | Count | blocked by A1 (needs real count ≥ 50; render-time input) | — | Report count when ≥ 50 |
| `wknd-lastcall` | Count | queued (final week) | — | — |
| README refresh (batches 5–6 + weekend lane) | Bookkeeping | queued, its own line per owner | `README.md` | — |
| `wknd-settleit` (80.0s reel, CF-WEEKEND R1) | Post-launch | see `REELS_CFWEEKEND.md` for state | `out/2026-08-12/wknd-settleit.mp4` + caption | Post Aug 13 |
| `wknd-referee` (78.0s reel, CF-WEEKEND R2) | Post-launch | see `REELS_CFWEEKEND.md` | `out/2026-08-12/wknd-referee.mp4` + caption | Post Aug 14 |
| `wknd-squad` (80.0s reel, CF-WEEKEND R3) | Post-launch | see `REELS_CFWEEKEND.md` | `out/2026-08-12/wknd-squad.mp4` + caption | Post Aug 15 |

**CF-WEEKEND (2026-08-12) note:** these three post-launch reels follow the
flop post-mortem law — each reel IS the game (real FT receipts, a real
stat duel, the real board's arithmetic), the product is only the payoff
frame, and every reel withholds its final answer. Facts and the
two-source table live in `REELS_CFWEEKEND.md`. Post-launch captions point
at `/weekend` with tagged links (WKND-FUNNEL ruling); the tease-era assets
above keep their shipped copy.

## Cadence (against real dates; copy never names our date)

- **Jul 29 – Aug 3 (TEASE)**: stinger + manifesto + thread out; owner
  does bio links + teaser recording.
- **Aug 4 – 10 (ARGUE I)**: `wknd-bench` + Dave shoot window, plus the two
  WEEKEND-cast `ladder-long` quizzes (the retention lane pointed at the
  waitlist — the format is already proven, only the casting and the closing
  line are campaign).
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
