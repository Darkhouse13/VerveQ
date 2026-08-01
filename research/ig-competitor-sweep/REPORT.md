# MONID-SWEEP — IG football-quiz competitor study (2026-08-01)

Pipeline: Monid.ai → Apify hashtag discovery (#footballquiz) → TikHub v1 harvest
(8 accounts × 1 page = 90 reels) → 29 qualifying reels (play_count ≥ 50K) →
frame-0 + thumbnail visual coding → comparison vs @playverveq last 10 posts.
Total API spend: **$0.048** (session budget $2.00).

## Accounts (reels ≥50K in sample)
footextrivia (9), balltalk.insta (7), jackcaulfield__ (4), fcplanetfootball (3),
gugum.trivia (3), elprofessports (1), footballwithspark (1), pitch.quiz (1).

## Pattern table (≥50K competitor reels, n=29 vs our posts, n=10)

| Property | ≥50K reels | Ours | Delta |
|---|---|---|---|
| Frame-0 shows a human (creator face or real footage) | 86% | 0% | **-86pt** |
| Frame-0 = creator face on camera | 76% | 0% | -76pt |
| Withholds the answer (asks, doesn't resolve) | 76% | 20% | **-56pt** |
| Native-IG-style caption text | 48% | 0% | -48pt |
| Duration ≥ 60s (median 78s vs our 17s) | 66% | 0% | -66pt |
| Frame-0 = designed graphics | 14% | 100% | +86pt |
| Real player imagery visible in frame-0 | 3% | 0% | -3pt |
| Original audio (voice) | 97% | 100% | ~0 |

## Hypothesis verdict
**"Vector type on cream loses frame-0 to real player imagery" → REJECTED as stated, but the
underlying instinct is half right.** Real *player* imagery is nearly absent from winners
(1/29 — a fcplanetfootball street interview with player photo cutouts). What actually beats
designed graphics is a **real human face talking to camera**: 25/29 (86%) of ≥50K reels open
on a creator or real person; only 4/29 open on designed graphics (gugum.trivia's flat teal
template ×3, pitch.quiz's badge graphic ×1 — so graphics-only *can* clear 50–230K, but it is
the minority format). The losing property of our posts is not "no player photos"; it is
"no human, no voice-to-camera, resolves too much, too short."

## Secondary reads
- **Duration**: winners median 77.6s (8s–180s); ours median 16.7s. The dominant format is a
  60–180s talking quiz, not a sub-20s motion graphic.
- **Audio**: 28/29 original voice audio; licensed music is irrelevant in this genre.
- **Comments/views**: winners median 0.00053 (driven by guess-in-comments mechanics);
  ours ~0 — our captions rarely give a single obvious thing to answer.
- **Cadence**: high-output accounts post 4–14 reels/week (fcplanetfootball 14/wk,
  gugum 12.7/wk, balltalk 8.6/wk, footex 7.6/wk). Low-cadence accounts still land
  outliers, but the reliable ≥50K accounts are high-cadence.

## Top-5 deltas → candidate spec lines for next batch
1. **Open frame-0 on a human face with voice** (86pt gap) — even a phone-shot host reading
   the quiz beats the cream template for the opening second.
2. **Withhold the answer and demand a comment** (56pt gap) — one question, answer never
   shown on screen; "wrong answers only / name one" mechanics.
3. **Go long: 60–120s multi-question ladders** (66pt gap on ≥60s) — easy→hard ladders
   (10-in-60-seconds) dominate; our 8–25s clips can't accumulate watch time.
4. **Native-IG-style subtitle text** for at least the A/B arm (48pt gap) — half the winners
   use plain white subtitle captions, not brand typography.
5. **Cadence floor ~4 reels/week** — every reliably-winning account posts near-daily;
   treat distribution volume as part of the format.

## Files
- `coded_competitors.json` — 29 coded qualifying reels (metrics + visual codes)
- `coded_ours.json` — our 10 coded posts
- `raw/` — full run JSON per account, discovery run, flattened tables
- `frames/` — 29 thumbnails + 29 first frames, **local-only** (gitignored; one file
  contains real player imagery: `fcplanetfootball_DbQO4uQjJnj_f0.jpg` / `_thumb.jpg`)

## Caveats
- Coding is single-rater from frame-0 + thumbnail; resolve/withhold inferred from captions
  (7/29 marked unknown, honestly).
- Sample = 1 page (latest ~12 reels) per account; survivorship on discovery hashtag.
- gugum.trivia's frame-0s are template intros ("Loading…") — its designed-graphics wins are
  the closest existing proof that a no-face format can clear 50K in this genre.
