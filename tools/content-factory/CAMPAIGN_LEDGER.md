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
| `wknd-settleit` (80.0s reel, CF-WEEKEND R1 **v2**) | Post-launch | RENDERED + VERIFIED (see `REELS_CFWEEKEND.md`) | `out/2026-08-13/wknd-settleit.mp4` + caption | Post Aug 13 |
| `wknd-referee` (78.0s reel, CF-WEEKEND R2 **v2**) | Post-launch | RENDERED + VERIFIED | `out/2026-08-13/wknd-referee.mp4` + caption | Post Aug 14 |
| `wknd-squad` (80.0s reel, CF-WEEKEND R3 **v2**) | Post-launch | RENDERED + VERIFIED | `out/2026-08-13/wknd-squad.mp4` + caption | Post Aug 15 |
| `wknd-dilemma-1` (20.0s, DILEMMA-B1 ed. 1) | Post-launch / experiment lane | **RENDERED + VERIFIED** (see `DILEMMA.md`) | `out/2026-08-14/wknd-dilemma-1.mp4` + caption | Re-run `node weekend/render-dilemma.mjs` then post |
| `wknd-dilemma-2` (20.0s, DILEMMA-B1 ed. 2) | Post-launch / experiment lane | **RENDERED + VERIFIED** | `out/2026-08-14/wknd-dilemma-2.mp4` + caption | Post on a separate day from ed. 1 — two editions on one day contaminates the read |

**CF-SAFEZONE (2026-08-13):** all three v2 reels re-rendered inside the
platform safe zone (top 220 / bottom 320 / sides 60) — `SAFE` +
`<SafeArea>` in `src/promo/kit.tsx` are now the STANDING DEFAULT for
every future format, and `verify-reels.mjs` asserts the zone on rendered
frames. Grandfathered older MP4s untouched.

**CF-WEEKEND note (v2, 2026-08-13):** v1 was rejected on casting (owner:
unknown Eredivisie/LP names carry no relatability) and its renders are
deleted. v2 recasts everything around superstars — Yamal/Mbappé chat
argument, THE BOARD vs YOUR EYES price checks (Olise 13.0 > Mbappé 12.0
on frame 0), the four-star 91.0 build — with the live board's own prices
as the receipts. Each reel is still the game, product still only the
payoff frame, every final answer still withheld. Facts + verification:
`REELS_CFWEEKEND.md`. Captions point at `/weekend`, tagged.

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

## DILEMMA-B1 (2026-08-14) — `the-dilemma`, the experiment lane's new occupant

Two rulings landed first, both in
[`docs/DECISIONS.md`](../../docs/DECISIONS.md): **`chain-long` is KILLED** (514
and 286 at n=2, both under the 560 floor — sources stay so the posted cuts
reproduce, format closed to new editions) and **standalone product/promo reels
are RETIRED permanently** (fifth consecutive sub-300; product marketing ships
only inside participation formats from here, and paid placements like
`wknd-42h` are unaffected — different instrument, different gate).

The freed slot runs `the-dilemma`: 20.0s, one real draft decision per edition,
**no resolution**, built to collect votes. Frame 0 is the task already in motion
— question, both option cards, draining clock, no countdown card and no black
frame. Facts + gates: `DILEMMA.md`. **Judged on the 560–2.5K band at n=2–3 AND
on comments/1000 as a co-primary** — a 700-view edition at 5/1000 comments is a
keep signal, so report both.

Every price is the live prod board's, re-verified per render by
`weekend/dilemma-live.mjs` (drift throws). **No ledger spend** — no career paths
are shown, so no ids are consumed and `ledger.json` is untouched (chain
precedent). Captions lead with the vote ask, then the live-now urgency, then one
tagged `/weekend` CTA.

**The ticket's Yamal-shaped marquee trade was not buildable and was recast** —
the 12.0+ names have no GW1 fixture, and budget mode *server-rejects* a
fixtureless pick, so offering one under a "no right answer" banner would have
been worse than a wrong price. Reasoning + citations in `DILEMMA.md`.

**Heads-up, unrelated to this ticket — `wknd-42h` is currently UN-RENDERABLE.**
FW-REPRICE-2 (`14bbd3a`, 2026-08-14) landed after its fact base was cut and
moved **9 of its 13 squad prices**: Perišić 7.5→7.0, Inácio 7.5→7.0, Kiwior
7.5→7.0, Itakura 7.0→5.5, Moutinho 7.0→6.5, Pavlidis 7.5→7.0, Vargas 6.5→7.0,
Brereton 4.5→6.0, Marcos Alonso 4.0→6.5 (verified: `node weekend/boost-live.mjs`
throws on all nine). The gate is working exactly as designed — it refuses to
render stale rather than shipping a wrong price — but the reel cannot go out
until `boost-facts.json` is re-cut to a 13 that still sums to exactly 91.0, and
its Telstar–Sparta countdown dies at Fri 18:00 UTC. **Owner call: re-cut or let
this one go.**

## CF-42H (2026-08-13) — `wknd-42h`, the paid-boost conversion reel

First PAID asset in the lane — conversion register, not engagement bait:
no withheld answer, no comment ask, one CTA twice. 32.0s: live countdown
to the real first kickoff (Telstar–Sparta, Fri 18:00 UTC) → six real GW1
fixture cards ("the big leagues are asleep" — checked by league id, still
gated per render) → the product pitch filling with 13 real board-priced
shirts to exactly 91.0 (Yamal 13.0 squeeze vs 3×4.5) → three rule stamps →
verveq.com/weekend. Facts + gates: `REEL_42H.md`. Countdown + spoken hours
are LIVE — **re-render via `node weekend/render-42h.mjs` right before
posting** (the one command; it re-verifies every fact on prod and throws
on drift). New standing gate: `verify-reels.mjs` motion gate (0.75s
samples, every consecutive pair ≥0.2% px changed) for motion-gated reels.
Caption stays clean; the tagged link is the boost DESTINATION URL
(`utm_source=ig&utm_medium=boost&utm_campaign=weekend26&utm_content=wknd-42h`).
