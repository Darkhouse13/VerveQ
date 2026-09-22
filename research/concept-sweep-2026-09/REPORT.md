# CONCEPT-SWEEP — which football formats are winning on IG Reels + TikTok right now (2026-09-22)

Written for the @playverveq / Facebook Page launch on 2026-09-24. The question: which new recurring
concepts should VerveQ test, given the team makes content programmatically (Remotion, no TTS
right now, no presenter, no licensed player photos or club crests).

Earlier studies this one builds on, without repeating them:
[ig-competitor-sweep](../ig-competitor-sweep/REPORT.md) (quiz reels, 08-01) and
[ig-fpl-decision-sweep](../ig-fpl-decision-sweep/REPORT.md) (FPL decision reels, 08-14).

---

## 1. Method and spend

**Pipeline (all through Monid.ai):**

1. **Keyword discovery on IG:** 30 TikHub `v2/search_reels` queries covering guess-the-player,
   career path, who-am-I, higher-or-lower, tier list, build-your-XI, pick-one, this-or-that, emoji
   quiz, guess-the-club, only-real-fans, transfer window, stats, did-you-know, debate, Ballon d'Or,
   memes, rankings, facts, trivia, would-you-rather and edits. Also 10 TikHub
   `v2/fetch_hashtag_posts` (top feed) calls to find carousels.
2. **Keyword discovery on TikTok:** 23 Apify `apidojo/tiktok-scraper` searches (dateRange
   `THIS_MONTH`, sort `MOST_LIKED`, region GB, 20–25 results each) on the same themes, plus
   "imposter", "pyramid quiz", "blind ranking" and "name the players".
3. **Account harvest, so each post can be compared with its own account's median:** 20
   TikTok profiles (~20 latest posts each) and 22 IG reel pages (12 latest reels each, via
   `fetch_user_info_by_username_v2` then `fetch_user_reels`). On top of that, 7 IG
   carousel-heavy accounts via `fetch_user_posts_v2`.
4. **Coding:** 1,500 unique items were pulled (881 TikTok, 619 IG). Formats were coded per
   account, with caption-regex overrides. Production mode (faceless graphic / faceless but
   footage / face on camera) was checked by eye on **56 cover frames** and **11 full videos**
   (16-frame contact sheets). For the imposter, pick-one, 10-question and street-quiz winners,
   the voice question was settled by pulling TikTok auto-captions.
5. **Qualifying post:** football (soccer), posted 2026-08-08 to 2026-09-22, ≥20K views.
   **389 qualifying posts** (257 TikTok, 132 IG), across 571 on-genre in-window posts from coded
   accounts. **Multiple** = views ÷ the median views of that account's harvested posts dated
   ≥ 2026-08-01, using 42 accounts with ≥5 such posts. The table also gives an unbiased
   read: the median multiple and the share of posts ≥2× across **all** of a format's posts on
   harvested accounts, flops included.

**Spend (summed from each run's `cost.value`; provider errors are not billed):**

| Endpoint | Runs | Cost |
|---|---|---|
| Apify `apidojo/tiktok-scraper` (search + profiles, $0.00045/result) | 43 | $0.4275 |
| TikHub IG `v2/search_reels` | 30 | $0.0900 |
| TikHub IG `v1/fetch_user_info_by_username_v2` | 36 (3 unbilled) | $0.0495 |
| Apify `instagram-hashtag-scraper` (1 test; it returned "recent" posts, not "top") | 1 | $0.0456 |
| TikHub IG `v1/fetch_user_reels` | 24 | $0.0360 |
| TikHub IG `v2/fetch_hashtag_posts` | 10 | $0.0300 |
| TikHub IG `v1/fetch_user_posts_v2` | 8 | $0.0120 |
| **Total** | **152** | **$0.6906** of the $1.50 cap |

---

## 2. Formats ranked by evidence strength

Column definitions:

- **nQ:** the number of qualifying posts (≥20K views).
- **Accts:** how many distinct accounts those posts come from.
- **Med views:** median views across the nQ posts.
- **Med ×:** the median multiple across the nQ posts. This is **biased upward**, because the
  posts were selected for having ≥20K views.
- **All-posts × / ≥2×:** the median multiple across every in-window post of that format on
  harvested accounts, and the share of those posts at ≥2× the account median. This is the honest
  hit-rate. **n** is that post count.
- **c/1k:** comments per 1,000 views, median across the nQ posts.
- **Dur:** median duration in seconds.
- **Producible:** whether VerveQ can make the format faceless, silent or music-only, and without
  player photos or crests. Rated **Yes / Adapt / No**; this rating is my judgement.

| # | Format | nQ | Accts | Med views | Med × (nQ) | All-posts × / ≥2× (n) | c/1k | Dur | Producible? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Faceless 10-question ladder** ("only real fans can name all 10") | 11 | 5 | 220K | 10.3 | **3.52 / 69%** (16) | 0.88 | 96s | **Adapt.** Winners use TTS voice and logos. A text-only version is untested at this scale. |
| 2 | **Imposter / odd-one-out ladder** ("which of these NEVER / HAS played for X", Easy→Impossible) | 14 | 2 | 106K | 6.0 | 1.87 / 44% (25) | 0.80 | 64s | **Adapt.** Winners use player photos, TTS and share-sheet bait (see caveats). A name-card version is buildable. |
| 3 | **Street / ball-knowledge quiz with people** (pyramid quiz, "only 10% can name…") | 54 | 9 | 151K | 3.4 | 1.69 / 41% (73) | 0.45 | 61s | **No.** Needs faces. |
| 4 | **Career path / career route** (guess from clubs, or map-route reveal) | 19 | 6 | 105K | 3.4 | 1.27 / 39% (23) | 0.64 | 62s | **Yes.** flippo.football is music-only and faceless. Crests and cutouts must be replaced with type. |
| 5 | **Data race / history timeline** ("every La Liga winner since 1929", value race) | 13 | 2 | 219K | 2.2 | 1.16 / 47% (15) | 0.10 | 31s | **Yes.** Motion graphics plus music. Crests must become club colour bars. |
| 6 | **Pause / screenshot game** ("Stop him, take a screenshot", "FIND RONALDO", match the eyes) | 24 | 3 | 60K | 2.3 | 1.27 / 30% (43) | 0.81 | 11s | **Adapt.** Winners use player cutouts or AI likenesses. A text-card version is buildable. |
| 7 | Pick one / keep-cut / "one will knock you out" | 15 | 5 | 176K | 11.7 | 1.20 / 48% (27) | 1.45 | 72s | **No** as proven: a presenter plus share-sheet bait. |
| 8 | Hot take / creator opinion | 30 | 13 | 137K | 3.6 | 1.17 / 41% (32) | 0.82 | 58s | No. Needs a face. |
| 9 | Ranked footage edit ("Top 14 strikers right now", Ballon d'Or top 6) | 38 | 13 | 344K | 1.9 | 1.02 / 32% (38) | 1.19 | 62s | **No.** Built on match footage. The **ranking idea** transfers (see #12). |
| 10 | **Stat claim / receipts** ("X has outscored A, B and C combined", stats tables) | 39 | 6 | 100K | 1.5 | 1.09 / 25% (64) | **1.39** | 83s | **Yes as a card or carousel.** Winners are mostly face plus greenscreen stat. sportvia02's faceless table hit 9.5× once. |
| 11 | Explainer / "what's the difference" (illustrated) | 10 | 2 | 60K | 3.5 | 1.09 / 43% (14) | 0.16 | 39s | Adapt. Probably needs VO (not verified). |
| 12 | Static tier list (8s still with music, "comment your top 3") | 5 | 1 | 88K | 2.6 | 1.62 / 43% (7) | **1.39** | 8s | **Yes.** Cheapest format in the sample. |
| 13 | **XI debate / combined XI** ("Man City vs Man Utd combined XI", "doesn't make the XI") | 10 | 6 | 65K | 1.1 | 1.04 / 33% (12) | **1.90** (max **21.9**) | 58s | **Adapt.** Every example is face-led. The pitch-graphic version maps onto THE WEEKEND UI. |
| 14 | Vox-pop debate question (one question to the street) | 17 | 1 | 44K | 1.2 | 0.96 / 12% (25) | 1.62 | 18s | No. |
| 15 | Panel game show (imposter/charades with creators) | 14 | 2 | 132K | 1.8 | 1.80 / 46% (13) | 0.28 | 140s | No. |
| 16 | Transfer-window recap animation (AI-animated or illustrated) | 7 | 2 | 4.17M | n/a | n/a | 0.09 | 111s | No. Player likenesses, big brands. |

**Absent in the last 30–45 days:** higher-or-lower, emoji quizzes, blind rankings and soccer
tier-list videos. Their searches surfaced nothing on-genre above ~300K; NFL/fantasy and
FC27-ratings content filled those result pages instead. "Build your XI with a budget" only
appears as creator-vs-creator (adricontreras4, 2.06M, face) or as a paid app ad
(freddy_oliphant `#ad`, 922K).

**Carousels / stills (IG likes vs the account's median likes, n=7 accounts, likes are often
hidden):** stat-table carousels land 2–4× the account median:

- 44teams "UNBEATEN AND WINLESS" carousel: 4,853 likes, 3.3× (14.3K followers, 09-14).
- fullstatsofficial "Liverpool could have won almost every PL title" carousel: 21,879 likes, 4.0×
  (13.2K followers, 09-12).
- transfermarkt_official "Unbeaten clubs in the top 5 leagues": 26,282 likes, 2.4× (10.4M
  followers, 09-21).

The outlier is footbolics' "WHAT IF Ronaldo + Messi at Inter Miami?" hypothetical: 25,591 likes and
1,284 comments, 40× (81K followers, 09-21). Carousel evidence is thin; treat it as directional.

---

## 3. The top 8 producible formats: evidence, why they work, and a VerveQ spec

Every spec below assumes the house constraints: **no voice, music or SFX bed only; no player
photos or crests; club names in club-colour type, flags, numbers and designed graphics**. The
specs are my judgement, built from the patterns observed.

### 3.1 Career Path: "Guess him from his clubs" (Easy → Impossible)
**Evidence**
- pitch.quiz, IG (3.9K followers), 08-02: 457,149 views, **32×**, 25s. Hook "GUESS THE FOOTBALL
  PLAYERS BY THEIR TRANSFER". Faceless: crest rows plus years, a draining timer, no voice (see the
  08-01 study). The same template's 07-12 cut reached 1.25M, 88×.
- realthinker615, TT (48.7K), 09-21: 54,688 views, **36×**, 17s, **8.25 comments/1k** plus 8
  saves/1k. Hook "Which player has this career path". A crest chain `Real Madrid › Dortmund › Inter
  › PSG` sits over a greenscreen face, and the answer is withheld.
- fcquizapp, TT, 08-25: 42.8K views, 8.3s. "WHO AM I? … by their career path". Two rows labelled
  EASY and HARD. This is **a quiz app marketing itself with this exact format**.
- Face versions: jakelyonsgeo "Can I name the footballer from their transfer history?" 658K
  (3.8×, 175s, 8.6 shares/1k) and the.90th.minute45 "can you get 3/3?" 676K.

**Why it works:** the question is legible in frame 0. The club chain *is* the hook and needs no
narrator. Difficulty labels create a "how far can I get" ladder. Withholding the last answer turns
it into comments ("drop your answer").

**Spec (reel, 30–40s, 6 players):**
1. 0.0s: cold open on Q1, already legible. Title strip "GUESS HIM FROM HIS CLUBS". Label **EASY**.
2. Timer bar drains from frame 0.
3. Each question: 4–5 club pills (club name in club colours plus season years), chained with ›.
   Hold 4s, then the answer name drops in for 1.5s, then a 0.5s wipe. That is ~6s per question,
   close to pitch.quiz's metronomic 7.0s.
4. Questions 1–2 EASY, 3–4 HARD, 5 IMPOSSIBLE (a 5–6-club journeyman).
5. Question 6 is **never answered**. It ends on a full-screen card: "IMPOSSIBLE — answer in the
   comments."
6. Tick SFX per second and a sting per reveal.

**Caption:** "Easy → Impossible. How far did you get? 👇 Q6 answer in the comments (no Googling)"
plus the link line "Play Career Path daily on verveq.com".

**Tie-in:** this *is* Career Path. Pull from the same player/club data the mode uses, and use the
withheld player as tomorrow's teaser.

### 3.2 Career route reveal ("X's career", a map flight path)
**Evidence**
- flippo.football, TT (37.5K), all music-only with no captions track (verified: song metadata,
  `subtitleInformation` empty):
  - "Lamine Yamal's Career" 509,245 views, **24.7×**, 60s, 2.3 saves/1k (09-09).
  - "Ferran Torres Career" 430,572, **20.9×** (08-27).
  - "Lionel Messi's Career" 221,245, **10.7×** (09-06).
- Across all 20 flippo posts: median 22,121, and 6/20 ≥2×.
- Structure (16-frame sheet): the club crest appears, then a plane flies a dashed route on a
  scrolling map with a km counter, then the next club. A player cutout sits bottom-left the whole
  time.

**Why it works:** it is passive and hypnotic, ending in a satisfying "where he's been" payoff. The
distance counter is a built-in progress bar. Famous-name titles win (Yamal, Messi); obscure names
flop (Hugo Bolin 3.7K, Carlos Espí 17.8K).

**Spec (reel, 45–60s, music only):**
1. Title "LAMINE YAMAL'S CAREER" (text only, no cutout; use a flag and shirt-number badge instead).
2. Stylised map (own vector basemap). Each club is a labelled pin: club name plus years plus
   apps/goals from the VerveQ data.
3. A plane on a dashed route, with a km counter accumulating.
4. End card: "TOTAL: 3 clubs · 14,166 km". The CTA is "Who should we fly next? 👇".

**Caption:** "{Player}'s career in 60 seconds ✈️ Guess where he goes next? · Career Path game: link
in bio". Use famous names only; the casting rule from the CF-WEEKEND ruling applies.

**Tie-in:** Career Path answer-reveal content, and a natural "yesterday's answer" post.

### 3.3 Imposter ladder: "Which one has NEVER played for {club}?"
**Evidence**
- goalflash0, TT (15.8K; median of 20 posts 10,794):
  - 1,031,507 views **95.6×** (08-28).
  - 896,740 **83×** (09-02).
  - 362,945 **33.6×**, 6,306 shares (09-19).
  - Across its 20 latest posts: 8/20 ≥2×.
- quizfoot03, TT (12.8K), a French clone of the same template: "Lequel de ces joueurs est un
  imposteur ?" 384,552, **178×** (09-20).
- Structure (sheet plus auto-captions): a 2×2 grid of 4 player portraits in the club's kit over a
  stadium. A header scoreboard "Easy 1./2. · Medium 1. · Hard 1./2. · Impossible 1." fills in
  answers as the video goes. 6 rounds in ~64s, a green/yellow countdown bar, the answer spotlight
  enlarges one portrait.
- **Carried by TTS voice** ("Which of these players has never played for Juventus? Show me your
  intelligence…") and by a **share-sheet trick** mid-video (see caveats).

**Why it works:** "one of these is wrong" is instant to parse, with the difficulty ladder and a
running scoreboard. Club-fan identity is baked in ("every Liverpool fan should know this").

**Spec (reel, 45–55s, silent/music):**
1. 0.0s: "SPOT THE IMPOSTER" plus round 1 already on screen.
2. The 2×2 grid uses **name cards, not photos**: name, flag, position, a club-colour card edge.
   The question strip reads "3 of them played for CHELSEA. Who didn't?"
3. The 5s bar drains, the imposter card flips red with "NEVER PLAYED HERE", and his real club
   stamps on.
4. Header ladder EASY ×2 → MEDIUM ×1 → HARD ×2 → IMPOSSIBLE ×1. The last one is **withheld** with
   "Answer in the comments".
5. Text does the job the VO did in the originals: big question strip, 2-line max.

**Caption:** "5 rounds, 1 imposter each. Impossible round answer 👇 (be honest if you Googled)".
**Do not** copy the share-sheet trick.

**Tie-in:** the daily quiz, with club filters for club-fan targeting.

### 3.4 Stop-and-screenshot game
**Evidence**
- timesposts1, IG (3.8K; median 27.8K):
  - "Stop Him 🎯, Take Screenshot 📸 Everyone wants the first one…" 3,082,139 views, **111×**
    (08-30, 10.0s).
  - Follow-ups at 130K (4.7×) and 100K (3.6×).
  - The latest posts are fading (313 and 3,407 views on 09-21/22), which suggests the concept
    fatigues fast on a single account.
- khaziromar42, TT (1.4K): "FIND RONALDO" 269,780, **34×**, 19s, **5.1 saves/1k**. Plus 143K
  (18×) and 96.6K (12×). Near-silent (auto-captions only "Find Ronaldo").
- mazen.aivisuals, IG (18.3K): "Match Cucurella's eyes" 2.43M **56×** and "Dembélé hairstyle
  challenge" 5.42M **125×**. #pausegame, licensed music, 10–16s.

**Why it works:** 10–19s with a built-in reason to replay (to hit the frame you want). It runs
without sound. The comment mechanic is "What did you get?", and every viewer has a different
answer to post.

**Spec (reel, 10s loop, music only). VerveQ version, my design:**
- "SCREENSHOT = YOUR STRIKER THIS WEEKEND".
- 12 player name cards (name, club, WEEKEND price) cycle at ~6–8 per second, with a centre
  highlight and a stop icon.
- The last frame loops cleanly into the first.
- Caption: "Pause it. That's your captain for THE WEEKEND. What did you land? 👇 Build the rest
  free: verveq.com/weekend".
- Alternative, if there is no gameweek this weekend (see caveats): "Find the one who NEVER won the
  league" as a 5×5 grid of names with a 10s bar; the answer is circled at the end.

**Tie-in:** THE WEEKEND (prices from the prod board, per the prod-convex-public-query rule).

### 3.5 Data race / "every winner since…"
**Evidence**
- teamballvs, IG (35.1K; median 440K):
  - "Most Ballon d'Or Wins by Club" 2,023,724 views, **7.8×**, 51s (08-29).
  - "Every Ligue 1 & Division 1 Champion Since 1932" 1,160,365, **4.5×** (09-12).
  - Earlier "Every La Liga Winner Since 1929" 15.9M (08-01, pre-window).
- hai08a, TT (7.0K): "Most Valuable Football Players 2004–2026" Part 1 295,946 **18×**, Part 2
  203,170 **12×**. 185–240s bar-chart race, music only.
- Low comments (0.1–0.25/1k) but big reach. This is a *view* format, not a *comment* format.
- Structure (sheet): a neon line-race where each club is a coloured ribbon, the year ticks along
  the top, the cumulative title counter sits at the ribbon head, and the lead changes are the
  drama.

**Spec (reel, 40–50s, music only):**
1. "MOST BALLON D'OR WINNERS BY CLUB · 1956→2025".
2. Ribbons in club colours, labelled by club **name** (no crests). The year ticker shows the
   winner's name on each title.
3. Build to the current leader with a 2s freeze on the final table.
4. CTA "Who wins in October? 👇".

**Caption peg:** the 2026 Ballon d'Or gala is about a month out. sportytv (09-22) says "One month
until the Ballon d'Or gala", and ballondorofficial is posting one nominee a day: its Kvaratskhelia
post had 446,908 views and **14,085 comments**.

**Tie-in:** quiz-fact bank. Evergreen, and each league's version doubles as a "guess who leads by
1990" quiz later.

### 3.6 Faceless 10-question ladder ("Only REAL fans can name all 10")
**Evidence**
- yoluoschallenge, IG (16.7K): "⚽ Only REAL Football Fans Can Guess Them ALL!" 508,766 views,
  **164×**, 112s, 2.6 comments/1k (09-08). "Only REAL Madrid Fans…" 81.7K (26×).
- answerdydo4567, TT (28K): "🔥 Guess the Football Club! Can You Get All 10 Right?" 357,131,
  **187×**, 74s, 3.8 comments/1k (09-13). A 1–10 answer sheet fills as it goes, using TTS plus a
  mid-video phone-spying scare that points at the share sheet.
- As a group: **69% of faceless-ladder posts on harvested accounts hit ≥2×**, the best hit-rate in
  the sample. The earlier FACELESS_WINNER_SPEC already specifies this format (cold open, 6–10
  questions, metronomic 5.5–7s beats, numbered answer sheet).

**VerveQ delta (my judgement):**
- Clubs have to be identified by clue, not crest, e.g. "nickname + stadium + founded" or "3
  famous academy graduates".
- Title "ONLY REAL FANS GET 10/10", with the answer sheet on the left.
- 75–90s, music plus tick. The last answer is withheld.

**Tie-in:** the daily quiz.

### 3.7 Stat receipt card / carousel
**Evidence**
- wolusfcb, TT (280K; median 213K):
  - "RAPHINHA HAS OUTSCORED MBAPPE, VINI AND JUDE BELLINGHAM COMBINED 🤯" 813,483 views, **3.8×**,
    **34,716 shares**, 5.8K saves. The on-screen strip says "SHARE THIS TO A REAL MADRID FAN". This
    is an overt, honest share CTA.
  - "GABRIEL JESUS HAS MORE GOALS THAN YAN DIOMANDE ALREADY" 709,481, 3.3×, 31,900 shares.
- sportvia02, IG (4.8K; median 667): faceless "Ballon d'Or nominees — stats last season (ranked)"
  table 6,324, 9.5×. Its "Most decorated players in UCL history" table reached 928K (08-14).
- The carousel lane: fullstatsofficial 4.0× and 44teams 3.3× on league-table stat carousels
  (section 2).
- Comments are the highest of any big-sample format (1.39/1k), with 6.6 saves/1k (TikTok).

**Why it works:** a single claim that sounds wrong ("more than A+B+C combined"), proven by a
number, aimed at a rival fanbase ("send this to a Madrid fan").

**Spec (carousel, 3 slides, plus an optional 8s still-reel of slide 1):**
1. Slide 1: the claim in huge type ("RAPHINHA 12 · MBAPPÉ + VINI + BELLINGHAM 11"), a source line
   and the date.
2. Slide 2: the receipts table (G, A, minutes, per-90).
3. Slide 3: "Who's the most underrated attacker in Europe right now? 👇" plus a THE WEEKEND price
   tag for each player.

**Caption:** lead with the claim, then "Send this to a {rival} fan 😭". Stats must come from
VerveQ's own season-stats table, with the source named on the card.

**Tie-in:** THE WEEKEND (the price plus the form stat is the decision receipt).

### 3.8 Comment-your-pick graphic: combined XI / tier list
**Evidence**
- The comment champions of the whole sweep:
  - planetfutebol, TT: "Man City vs Man Utd combined XI 👀" 174,833 views (4.0×) with **14.6
    comments/1k**.
  - Its IG twin fcplanetfootball: **21.9 comments/1k**.
  - harrikanot, IG: "Current Arsenal XI vs All Time La Liga XI · Rate his ball knowledge 1-10":
    10.6 and 12.7 comments/1k.
  - All three are face-led.
- ball.otaku, IG (765K): **static 8.0s** tier-list graphic ("Ranking the most complete full-backs
  of modern football", tiers COMPLETE PACKAGE / ELITE BOTH WAYS / GAME CHANGER / ONE SIDE ONLY,
  "Comment your top three") 133,013 views, 4.0×, 1.45 comments/1k. Its siblings: 111,601 (3.4×)
  and 87,592 (2.6×).

**Spec (8–10s still-reel, music only):**
- **Either** a pitch graphic "ARSENAL vs CHELSEA — COMBINED XI" with each position showing two
  names and one highlighted as our pick, and one slot deliberately contentious and left blank
  ("You pick the 11th 👇").
- **Or** a 4-tier board, text-only, "Rank the best No.9s in Europe right now". Four tiers, 12
  names, one name deliberately "misplaced".

**Caption:** "Wrong? Fix it in the comments 👇". Reuse the WEEKEND pitch/formation components, so
the tie-in is the THE WEEKEND formation UI and the build-your-XI mechanic.

---

## 4. Recommendation: 5 tests for 2026-09-22 20:30 → 2026-09-23 20:30 (UK)

Order and slotting are my judgement. The logic: open with the brand-core concept, spread formats
of different lengths across the day, and leave the strongest-but-riskiest adaptation (the
imposter, whose winners lean on voice) for the prime evening slot.

| Slot (UK) | Concept | Unit | Why here |
|---|---|---|---|
| **Tue 22 Sep 20:30** | **3.1 Career Path "Guess him from his clubs" (Easy→Impossible, Q6 withheld)** | Reel ~35s | The format with the clearest link to VerveQ's product, producible silent. Evening is peak scroll. The withheld answer seeds comments overnight. |
| **Wed 23 Sep 08:30** | **3.7 Stat receipt carousel** (3 slides, rival-fan share line) | Carousel | Commute swipe. The only still/carousel test. The metric it's built for is sends and saves. |
| **Wed 23 Sep 12:30** | **3.4 Stop-and-screenshot** (WEEKEND captain version, or "find the one who never won the league" if no gameweek) | Reel 10s loop | Lunch-break short-attention slot. Tests replay-driven distribution. |
| **Wed 23 Sep 17:30** | **3.5 Data race: Most Ballon d'Or winners by club** | Reel ~45s | Passive view format with a live news peg (gala about a month out). |
| **Wed 23 Sep 20:30** | **3.3 Imposter ladder** (name cards, last round withheld) | Reel ~50s | Highest proven multiple among faceless *quiz* formats. Riskiest adaptation (no voice, no photos), so it gets the strongest slot. |

**Next up for the 20:30 rotation over the following week:** 3.2 career route reveal (the most
faithful copy of a verified music-only winner), 3.8 combined-XI / tier board (comment champion),
and 3.6 the 10-question ladder.

### How to read 1.5 days of data (be honest about how weak it is)

- **n = 1 per concept on an account with ~0 followers.** Every post is shown to a small
  non-follower seed audience, and whether it gets a second push is close to a coin flip at this
  stage. Differences smaller than ~2× between two posts are noise. **Do not kill a concept on its
  first post.**
- **Primary metric: (shares/sends + saves) per 1,000 reach.** These are rate metrics, so they
  hold up better than raw views while reach is tiny. Reference points from this sweep: organic
  shares 0.5–1.5/1k and saves ~2–3/1k are typical for quiz formats (TikTok medians). Share rates
  above ~10/1k in the sample were driven by share-sheet bait, so they are **not** a bar to chase.
- **Secondary: hold.** Use the IG Insights reel skip rate / average watch time as a % of
  duration, and the FB Page's 3-second views ÷ impressions. For the 10s loop, average watch time
  over 100% (replays) is the signal.
- **Mechanism check: comments per 1,000 views** on the withhold formats (3.1, 3.3, 3.8). The
  earlier sweeps calibrated ~0.6–0.9/1k as typical and **≥1.5/1k as elite**. Combined-XI posts in
  this sweep reached 14–22/1k, but that is an outlier ceiling.
- **Read each post at 24h and again at 72h.** The 72h read is the one that counts.
- **Decision rule (proposed):** over the next 7–10 days, run each surviving concept **3 times**
  in the 20:30 slot on rotation. Keep the concepts whose **median of 3** beats the account's
  running median on sends+saves per 1k reach and on hold. Drop any that sit in the bottom third
  on both after 3 runs. Views are only a tie-breaker.

---

## 5. Caveats

- **Share-sheet bait contaminates the share numbers of the top faceless quiz winners.** TikTok
  auto-captions show:
  - goalflash0 and quizfoot03 (imposter): "…kiss the third person that appears when you click
    share and then WhatsApp".
  - robgoal (pick-one): "Who is the second person that appears when you click share, then more?"
  - answerdydo4567 (10-ladder): "your phone is probably being spied on… tap the arrow at the very
    bottom".

  These drive 10–27 shares/1k (e.g. robgoal 26.8/1k, goalflash0 17.4/1k). They are
  manipulative, and I recommend VerveQ never copies them. Their share rates are not benchmarks.
- **Voice:** the imposter and 10-question winners carry TTS or voice. The music-only faceless
  winners verified here are flippo.football (music track, no speech captions), khaziromar42 (two
  spoken words) and mazen.aivisuals (licensed music). hai08a (bar race) had no speech-caption track
  on TikTok. timesposts1, teamballvs and ball.otaku are "original audio" on IG, and I could not
  verify whether that audio has voice. A silent imposter or ladder is therefore a **new variant,
  not a proven one**.
- **Imagery:** almost every faceless winner uses player cutouts, photos, crests or AI likenesses
  (mazen.aivisuals, khaziromar42's caricatures). The specs swap in type, flags and club colours.
  Nothing in the data shows how much reach that costs.
- **Small-account multiples inflate.** An account median of 667 (sportvia02) or 1.4K
  (khaziromar42) turns one decent post into 34–1,391×. Read the all-posts hit-rate column
  alongside the multiples. Two formats (imposter, data race) rest on 2 accounts each; the tier
  list rests on 1.
- **Coding is single-rater and mostly account-level** (caption regex for overrides). 56 covers and
  11 videos were checked by eye; the remaining qualifying posts inherit their account's production
  code. Cross-posted IG/TT twins (planetfutebol/fcplanetfootball, goalfanzone) count once per
  platform.
- **Sample skew:** keyword search plus "most liked this month" favours what already went viral.
  TikTok search ran with region GB but returned French, Portuguese and Vietnamese-subtitled
  content. IG search returns ~6 reels per query. The IG hashtag "top" feeds returned undated,
  mostly all-time posts, so they were used only to find carousel accounts.
- **Timing:** there is no evidence here on posting times; the slot choices are judgement.
  transfermarkt_official (09-22) says "The international break is here". **Check whether THE
  WEEKEND has a gameweek this weekend** before posting the captain version of 3.4; use the "never
  won the league" grid if it doesn't.
- **Stats accuracy:** stat claims (3.7) and data races (3.5) must come from VerveQ's own tables or
  a named source, because a wrong receipt kills the format's credibility. Nothing in this report
  verifies any stat quoted from competitor captions.

## Files

- `raw/`: every Monid run as returned (152 runs; `tt_*` = TikTok search/profiles,
  `igs_*` = IG reel search and hashtag feeds, `lookup_*` / `reels_*` / `posts_*` = IG accounts).
- `coded_posts.json` / `coded_posts.csv`: 389 qualifying posts with format, production mode,
  account median, multiple, and comments/shares/saves per 1k. The JSON also holds all 571
  in-window on-genre posts and the 42 account medians.
- `carousels_coded.json`: IG carousel/still posts with like multiples.
- `frames/` (56 covers) and `videos/` (11 MP4s): **local-only** via this folder's `.gitignore`.
  They contain real player imagery and creator faces.
