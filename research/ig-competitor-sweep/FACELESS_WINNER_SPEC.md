# FACELESS-CODE — deep coding of the no-face quiz winners (2026-08-01)

Follow-up to [MONID-SWEEP](REPORT.md), which found that 86% of ≥50K football-quiz reels open on a
human face — but that **4 of 29 cleared 50K with designed graphics only** (gugum.trivia ×3,
pitch.quiz ×1). This ticket re-pulled those two accounts and coded the faceless winners from the
**actual video files**, not thumbnails.

Pipeline: TikHub v1 `fetch_user_info_by_username_v2` → `fetch_user_reels` (latest page each) →
21 reels → **4 qualifying at ≥50K** → full-resolution `video_versions` download → ffmpeg frame
sampling (0/3/10/25s + 50%/90%, a 0.2s-step hook strip, and a 1-frame-per-1.5s full-length
contact-sheet watch) + PCM envelope, band-energy and cross-correlation audio analysis.
**API spend: $0.006** — 4 billed runs × $0.0015, confirmed per-run from `monid runs list`
(2 × `fetch_user_info_by_username_v2`, 2 × `fetch_user_reels`; all `COMPLETED`, no 4xx/5xx,
no retries). Session cap $2.00; wallet reads $4.11 before and after — the spend is below the
displayed cent.

Both accounts are live and public. 4 qualifying reels ≥ the 3-reel floor, so no STOP.

---

## Per-reel coding table

| | **pitch.quiz** `DarQc7xqfO0` | **gugum.trivia** `DbVz61pqM76` | **gugum.trivia** `DbYCstGqZf9` | **gugum.trivia** `DbdyQacKNeF` |
|---|---|---|---|---|
| **Views / likes / comments** | 232,932 / 7,936 / 206 | 193,529 / 5,813 / 524 | 81,223 / 1,426 / 99 | 68,843 / 2,259 / 148 |
| **Comment rate** | 0.00088 | **0.00271** | 0.00122 | 0.00215 |
| **Posted / duration** | 07-12 / 42.2s | 07-28 / 70.4s | 07-29 / 69.6s | 07-31 / 73.1s |
| **Format** | transfer-path | country-by-shape | country-by-shape (“Medium”) | player→national team |
| **Question count** | **6** | **10** | **10** | **10** |
| **Seconds per question** | **7.02s, metronomic** (silence gaps at 5.85/12.87/19.89/26.90/33.93/40.94 → deltas 7.017–7.023) | 5.5s modal, 6.3s mean | 5.5s modal, 6.2s mean | 5.5s modal, 6.2s mean |
| **Measured reveal times** | 6, 12, 19, 27, 33 (Q6 none) | 11.6 17.1 22.4 31.6 37.8 43.5 49.2 55.0 60.6 68.6 | 11.6 17.1 22.6 31.5 37.1 42.6 48.2 53.8 59.2 67.2 | 14.8 20.2 26.1 35.1 40.6 46.1 51.9 57.4 62.9 71.0 |
| **Rhythm irregularity** | none — perfectly even | stretched beat **9.2s at Q4** and **8.0s before Q10** | 8.9s at Q4, 8.0s before Q10 | 9.0s at Q4, 8.1s before Q10 |
| **Escalation labelling** | no counter. Escalates by **path length** (3 clubs Q1–Q3 → 4 clubs Q4–Q6) and by **colour state** — blue/purple for Q1–Q5, **yellow/orange for Q6**, logo recoloured to match | numeric badge `00`→`01…10` top-left + a 10-slot answer sheet that fills | same | same, plus **fame escalation**: opens Šeško/Pulisic/Isak, closes Messi (Q9) → Ronaldo (Q10) |
| **Per-question beats** | ~4s question card → ~1s blank wipe → ~2s answer card | silhouette held ~4s → fills with the country's flag → name written into the answer sheet | same | player photo held ~4s → swaps to national flag → name into answer sheet |
| **VO present** | **No** | Yes | Yes | Yes |
| **Read style** | n/a | **TTS/machine-assembled** | **TTS/machine-assembled** | TTS/machine-assembled |
| **VO evidence** | no subtitle pixels anywhere; median PCM −62.3 dB (silent most of the time); onsets metronomic at 0.20/0.40s, not speech-rate; sub-200 Hz at −65.9 dB rules out both music bed and voice fundamental | first **11.75s bit-identical** to `DbYCstGqZf9`, plus 13.4–17.2s identical — **22% of the track verbatim**; envelope r = **+1.000** | (same pair) | different per-series asset — r = **+0.203** vs the shape episodes |
| **VO pacing role** | none — the clock paces | reads setup, counts questions in (“First…”, “the last one”), names each answer, delivers the comment CTA | same | same (“First…”, “three”, “Eighth”) |
| **Subtitles** | none | word-by-word karaoke captions, white bold + dark outline, **scale-pop on emphasis** | same | same |
| **Text style** | designed; bold condensed caps (Montserrat/Poppins ExtraBold family) | designed chrome (rounded bold italic, Baloo-ish) + **native-IG-style subtitles** | same | same; title adds two-colour emphasis (white + yellow key noun) |
| **Background** | cyan→purple gradient, faint football/`?` doodles | **flat single-colour dark teal** | flat dark teal | flat dark teal |
| **Answers/options render** | no options. Answer = background-removed **player cutout** + name in black caps on a **white rounded pill** | no options. Answer = **flag fills the silhouette** + name into a numbered white chip | same | no options. Answer = national flag card + name chip |
| **Answers resolved on screen** | **5 of 6** | **10 of 10** | 10 of 10 | 10 of 10 |
| **Withheld** | **Q6 only** — the final, hardest (4-club path ending Real Madrid 2026) | none | none | none |
| **CTA mechanic** | **the withheld question *is* the CTA** — when Q6's timer empties, a full-screen card reads “LEAVE YOUR ANSWER IN THE COMMENTS”, held ~1.3s over silence | **score-based** — spoken ask at ~63–65s (“…don't forget to tell… comment…”) + caption “If you get 10/10 you're true Map Master” | score-based (“Can you get 10 out of 10?”) | score-based (“Can you get 10 out of 10?”) |
| **Hook 0.0–1.0s** | **cold open** — Q1 fully legible at frame 0 (both crest rows, both years, brand bug, full timer). No intro card | **teaser montage** — a new flag-filled map every ~0.2s (Portugal .2, Australia .4, UK .6, Italy .8, Turkey 1.0) ≈ 5 cuts/sec | same device | **spoiler montage** — labelled subjects/flags every ~0.2s (Mbappé .2, Senegal .4, Slovenia .6, Safonov .8, Luis Díaz 1.0) |
| **Motion underway at t=0?** | **Yes** — timer measurably drains: full at 0.0s → ~85% at 0.4s → ~68% at 1.0s | **Yes** — 5 cuts inside the first second; first VO word by 0.6s | Yes | Yes |
| **Audio bed** | original audio. **Percussive tick/countdown + one reveal sting per question**; true digital silence between questions. Stereo (side −34.9 dB) | original audio. **Voice-dominant, no music bed** — speech band −21.6 dB > low −24.5 > high −30.7; 33 sub-−35 dB phrase gaps. **Pure mono** (side −70.4 dB) | same (31 gaps, side −70.0 dB) | same (29 gaps, side −74.6 dB) |
| **Trending audio?** | No — `original_sounds`, `music_info: null`, `is_trending_in_clips: false` | No — same | No — same | No — same |
| **Loop back to start?** | **No** — ends on the yellow CTA card, opens on a blue question card | **No** — ends on the completed board (10 chips filled, counter `10`), opens on the empty board. Chrome is continuous, game state snaps | No | No |

---

## Faceless winner spec — properties shared by ≥75% of these reels

Stated as buildable rules. `4/4` or `3/4` marks how many of the four winners carry the property.
**Read the caveat section first: n = 4.**

### Structure
1. **Ship a multi-question ladder, never a single question.** 6–10 questions in one reel. `4/4`
2. **Run a fixed, metronomic per-question clock and don't deviate.** pitch.quiz holds 7.02s across six questions with ≤8 ms drift; gugum holds a 5.5s modal beat. Machine-exact cadence is the norm, not a stylistic choice. `4/4`
3. **Budget ~4s of question and ~2s of answer, with a ~1s wipe between.** `4/4`
4. **Go long: 42–73s.** Every winner clears 42s; three clear 69s. `4/4`
5. **Put a visibly depleting timer on every question.** `4/4`
6. **Label the escalation.** Either a numeric counter (`01…10`) or an unmistakable state change on the final question. `4/4`
7. **Stretch two beats in a 10-question ladder** — ~9s at Q4 and ~8s before Q10 — to carry a mid-roll line and the CTA. `3/4` (all three gugum reels; pitch.quiz is too short to need it)

### Hook (0.0–1.0s)
8. **Motion must already be underway at frame 0. No intro card, no title beat, no build-in.** Either the clock is visibly draining by 0.4s or you cut 5 times inside the first second. `4/4`
9. **Frame 0 must state the size of the game** — a full question with a running timer, or an empty 10-slot answer sheet that promises ten. `4/4`
10. **Front-load the good stuff.** gugum spends its first second flashing the answers themselves. `3/4`

### Voice and audio
11. **Original audio only. No trending sound, no licensed music.** All four: `audio_type: original_sounds`, `music_info: null`, `is_trending_in_clips: false`. `4/4`
12. **A face is not required, but a *pacing device* is.** Either a VO that counts you through, or a percussive countdown bed that does the same job wordlessly. Nothing is silent and unpaced. `4/4`
13. **If you use VO, template it.** The winners' VO is machine-assembled: a fixed carrier read per series with only the answer names swapped — 22% of one gugum track is bit-identical to its sibling. Do not re-record per episode. `3/4`
14. **If you use VO, subtitle it word-by-word** with native-IG-style white bold captions and a scale-pop on the emphasised word. `3/4`
15. **Mono VO, no music underneath.** `3/4`

### Text and design
16. **Designed template, zero human presence.** No presenter, no face, no hands, no voice-to-camera. `4/4`
17. **Keep one brand bug pinned top-centre for the entire runtime.** `4/4`
18. **Never show multiple-choice options.** The viewer answers from knowledge, not from a menu. `4/4`
19. **Render the answer as a high-contrast label on a white rounded pill/chip** against real imagery of the subject (player cutout, flag fill). `4/4`
20. **Use real subject imagery at the reveal** — club crests, flags, agency player photos. The prior sweep's “winners don't use player imagery” read does **not** hold inside the faceless cohort. `4/4`
21. **A flat single-colour field beats a busy one** — gugum's flat teal carries the two biggest gugum numbers. `3/4`

### Resolution and CTA
22. **Resolve most answers on screen.** This is the sharpest correction to the earlier sweep: faceless winners are **not** withholding formats. 35 of 36 questions across these four reels resolve. `4/4`
23. **Give exactly one comment ask, near the end, and make it answerable in one word.** Two working shapes: **(a) terminal withhold** — resolve everything except the last question, then hard-cut to a full-screen “leave your answer in the comments” exactly as the clock empties (pitch.quiz, 232K); **(b) score ask** — resolve everything, then ask for the score, spoken *and* in the caption (gugum, 193K/81K/69K). `4/4`
24. **Put the scoring bar in the caption** (“Can you get 10/10?”, “you're a true Map Master”). `3/4`
25. **Don't bother engineering a loop.** None of the four loops; all end on a terminal state (CTA card or completed board). Keeping the template *chrome* identical end-to-start is enough. `4/4`

### The one property to copy first
26. **A persistent running scoreboard is the strongest single differentiator inside the cohort.** The three reels carrying a visible 10-slot answer sheet that fills as you play average a **0.0020 comment rate** against pitch.quiz's 0.00088 — and gugum's 193K reel hits **0.00271, 3.1× pitch.quiz**, despite fewer views. The sheet gives the viewer a number to type. `3/4`

---

## Secondary reads

- **Format beats account.** Both winners are format outliers on their own pages. pitch.quiz's transfer-path reel did **232,932** against a median of **3,087** across the seven reels of its staple “nation + club + jersey” format — **75×**. gugum's country-by-shape (n=3, median 81,223) beats its own country-by-flag (n=4, median 18,214), capital-city (5,789) and brand-logo (1,601). Picking the right game matters more than production polish.
- **Cadence is not the lever here.** gugum posts 12.0 reels/week, pitch.quiz 2.6 — and pitch.quiz still owns the single biggest number in the cohort off one idea. The earlier sweep's “cadence floor ~4/week” holds for *reliability*, not for outliers.
- **“Guess the shape/badge/path” outperforms “guess the flag/logo.”** The winning mechanics ask you to *infer* an entity from an indirect trace (a silhouette, a transfer sequence). The losing ones ask for direct recall of a symbol you either know or don't.
- **Duration is a floor, not a target.** 42s and 73s both cleared 200K/190K. What travels is questions-per-reel, not minutes.
- **The 232K reel's escalation is a colour change, not a number.** Worth A/B-ing against the numeric counter — it costs nothing and reads instantly.

## Caveats

- **n = 4.** “≥75%” means 3 or 4 of 4, and 3 of those 4 are one account running one template — so gugum's template choices are structurally over-weighted. Treat `4/4` rules as reasonably safe and `3/4` rules as hypotheses worth an A/B, not settled findings. Widening to more faceless accounts would firm this up considerably.
- One page (latest ~12 reels) per account; survivorship applies.
- No local speech-to-text was available, so the VO wording is read off the on-screen subtitle band and is **partial** — enough to establish the CTA and the counting-in role, not a full transcript. The TTS/assembly finding does not depend on the wording: it rests on bit-identical PCM between episodes.
- Frame-diff reveal times are ±0.13s (8 fps sampling).
- Coding is single-rater, but every structural timing above is measured programmatically rather than eyeballed.

## Files

- `coded_faceless.json` — full coding of all 4 reels + format context
- `raw/faceless_reels_{gugum.trivia,pitch.quiz}.json` — raw reel pages
- `raw/lookup_{gugum.trivia,pitch.quiz}.json` — account lookups (both public, alive)
- `raw/faceless_page_flat.json` — flattened 21-reel table with format labels
- `videos/` — 4 full videos, **local-only** (gitignored)
- `frames/faceless/` — key frames, hook strips, loop strips, contact sheets, VO subtitle strips, **local-only** (gitignored)
