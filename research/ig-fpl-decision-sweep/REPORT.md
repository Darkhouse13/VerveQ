# MONID-SWEEP-2 — IG FPL / fantasy-decision content study (2026-08-14)

Pipeline: Monid.ai → TikHub **v2 search_reels is BACK UP** (keyword discovery
worked; "fpl", "fpl captain", "fpl tips") + Apify hashtag scraper (#fpl,
#fpltips) → 8 on-genre accounts → TikHub v1 lookup + reels harvest (94 reels)
→ **35 unique qualifying reels at the standard ≥30K bar** (no drop to 20K
needed; one fpl_harry×ffscout collab deduped) → frame-0/mid/late + thumbnail
coding. Total API spend: **$0.0399** (budget $2.00; largest single call $0.00345).

## Accounts (qualifying reels in latest-page sample)

letstalkfpl (82K fol · 9), fpl_harry (77K · 10), fplgraduates (26K · 4),
fpltom_ (18K · 4), tomhfootball (4.3K · 4), ffscout_ (46K · 3), fplfran
(2.5K · 1), fplmatters (585 · 0 — kept in harvest, nothing ≥30K).
Excluded at discovery: meme-only accounts (fplmemes__, lucafpl), Arabic-market
fantasy (3b3al72, master_fpl), and the CS:GO "FPL" (FACEIT Pro League) traps.

## Pattern table (≥30K FPL decision reels, n=35, vs the-dilemma spec)

| Property | ≥30K reels | the-dilemma | Delta |
|---|---|---|---|
| RESOLVES (creator gives verdict/team) | 91% (32/35) | withhold | **inverted** |
| Withholds / asks the audience | 9% (3/35 — all short native prompt-bait) | 100% | — |
| Duration median | 66s (mean 73s) | 20s | −46s |
| Duration ≥40s | 89% (31/35) | no | — |
| Duration ≤12s (the prompt-bait cluster) | 11% (4/35) | no | — |
| Face on frame-0 | 83% (29/35) | 0% | −83pt |
| Frame-0 = full-screen designed graphics | 17% (6/35) | 100% | +83pt |
| Subtitle-style captions on screen | 89% (31/35) | none | −89pt |
| Original voice audio | 100% | VO (Charlie) | ~0 |
| Deadline/GW-pegged caption | 29% (10/35) | partial (lock days on cards only) | — |
| Comments/1000 median | 0.32 | co-primary target 5/1000 | see verdict |
| Same-price A-vs-B shape appears | 5/35 (14%), up to 103K views | both editions | **validated** |

## Explicit verdicts

**(a) Resolve vs withhold.** This niche's view-winners RESOLVE: 32/35 give the
verdict, the team, or the ranked list — the "argued opinion" is the product.
**Pure withhold is absent from the ≥30K set.** The only ask-the-audience
winners are fplgraduates' 7–11s native-text prompts, and they are the niche's
comment champions: 1.08–1.84 comments/1000 vs the 0.32 median (verdict formats
run 0.15–0.5). So: withhold is NOT the niche's proven view-driver, but it IS
its proven comment-driver — and comments/1000 is the-dilemma's co-primary.
**Keep the WITHHOLD LAW for editions 2–5** (it is the format's identity and the
only shape whose success metric we actually privilege), but read views against
the fact that no withhold reel clears 30K here in the designed register — the
560–2.5K band is realistic, a 30K+ outlier is not the base case.
**Calibration warning:** the lane law calls 5/1000 a keep signal; the niche's
best-ever ask-bait runs ~1.8/1000. Treat **≥1.5/1000 as elite**, 5/1000 as
extraordinary — don't kill the format for missing a bar the whole niche misses.

**(b) Winning duration.** Bimodal, and 20s is in the dead zone: 40–130s argued
analysis (89% of winners, median 66s) or ≤12s native prompt-bait (11%).
Nothing between 12s and 40s qualifies in this sample. The 20s cut is closer to
the prompt-bait cluster in function (one decision, comment CTA) — which argues
for LESS chrome and a faster read, not for growing toward analysis length.

**(c) Deadline-pegging.** Moderate, not universal: 29% of captions peg a GW or
deadline; season-start draft content is implicitly GW1-pegged, but evergreen
debates (player X vs Y, "underpriced") win too. ffscout renders the literal
"Gameweek 1 deadline" screen; nobody runs a live countdown. Our live-board
prices + per-player lock days are already ahead of the niche here — the gap is
that our caption lead doesn't say when the decision expires.

**(d) Top-3 spec changes for dilemma editions 2–5:**

1. **Put the deadline in the question, not just the card corner.** Rephrase
   each edition's question to carry the clock ("… BEFORE SUNDAY'S LOCK") and
   lead the caption with the same line. Costs nothing against the withhold and
   neutrality laws; converts our genuinely-live prices (which no competitor
   has) into the urgency the niche only gestures at. (29% peg it in captions;
   none can peg it to a real per-player lock.)
2. **Recast the question in the native first-person register + add subtitle
   captions for the VO.** 89% of winners carry subtitle-style text; the
   comment-champion shorts are plain native text in spoken voice ("We've all
   got that one player…"), not ALL-CAPS brand type. Keep the ink/lime world for
   the cards; make the question line read like speech and mirror the VO as
   subtitles. This is the cheapest move toward the only cluster that shares
   our mechanic.
3. **Give each card one receipt-stat row beyond price.** Every winning A-vs-B
   (Gibbs-White 8.0 vs Mbeumo 8.0 — our edition-2 shape exactly, 40K views;
   Gabriel 8.0 vs Mbeumo 8.0, 39K; Brobbey vs Solanke 6.0) argues with
   receipts: ownership %, fixture run, returns. Our cards carry price/position/
   opponent/venue/day only. One more board-derived row per side (e.g. "picked
   in X% of squads" once prod exposes it, or last-GW points from settlement
   data after GW1) deepens the argument without resolving it — both sides get
   a receipt, neither gets a verdict.

## Same-price A-vs-B: the shape is validated

The niche independently runs our exact NEUTRALITY-LAW shape — same-price,
same-position head-to-heads — 5 times in this sample (up to 103K views). The
difference is they resolve and spend 60–130s arguing. We are not inventing an
alien format; we are running the niche's proven debate shape with the verdict
withheld and 1/4 the runtime.

## Our side (delta base)

Both editions RENDERED + VERIFIED, **not yet posted — no live metrics, so the
delta table compares format properties only** (`coded_ours.json`). The "boosted
dilemma organic twin" read must wait for the post; nothing to code on
performance yet.

## Files

- `coded_competitors.json` — 35 coded qualifying reels (metrics + visual codes)
- `coded_ours.json` — the-dilemma format properties (no live metrics yet)
- `raw/` — discovery runs, lookups, reels pages, `qualifying.json`
- `frames/`, `videos/`, `sheets/` — **local-only** (gitignored; real player
  imagery and creator faces throughout)

## Caveats

- Single-rater coding from frame-0/mid/late + thumbnail + caption; resolve
  coding is high-confidence for squad reveals/rank-lists, inferred for debates.
- Sample = latest ~12 reels/account (survivorship + season-start skew: GW1
  draft content is over-represented this week).
- Discovery = 3 search keywords + 2 hashtags; 6 of 8 accounts are UK/EN FPL —
  the Arabic-market fantasy scene clears 200K+ and went uncoded.
- fplmatters qualified on discovery (264K outlier) but its latest page had
  nothing ≥30K — the outlier predates the page window.
