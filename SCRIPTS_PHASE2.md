# PHASE 2 — THREE SCRIPT CANDIDATES

Built on `RESEARCH_DIGEST.md` (2026-07-25). Each script names the hypothesis it tests.
Together they form a deliberate test matrix rather than three guesses.

| # | working title | hypothesis | length | what it isolates |
|---|---|---|---|---|
| 1 | **PICK A SIDE** | **H1** — unanswerable beats answerable (3.4×) | 15.0s | question *type*, length held ≈ CHAIN |
| 2 | **THE LONG CHAIN** | **H3** — comment rate peaks at 90–120s | 100.0s | *length*, mechanism held = CHAIN |
| 3 | **THE ANSWER ISN'T IN THIS VIDEO** | **H2** — showing the answer kills the comment section | 35.0s | *withholding*, taken to its limit |

Script 1 changes one variable against our winner. Script 2 changes the other. Read
together they tell us which of CHAIN's two properties actually earned the 7 comments —
which §3/H3 of the digest flagged as unresolved.

All at 1080×1920, 30fps, 120 BPM (15 frames per beat) — the house grid.

---

## Green — a rule that became grammar

Brief says green only in payoff frames. Applied literally across these three, green
stops being a colour constraint and becomes the brand's **resolution signal**:

- Script 1 — green on the verdict card only.
- Script 2 — green on each of the five answers. **Slot 6 never turns green.** The
  absence of the colour is how the viewer knows it's unresolved. No text needed.
- Script 3 — **green never appears at all** until the app frame. Nothing in the video
  resolves; the product is the only place resolution exists.

⚠️ **Conflict to fix before render:** `src/theme.ts` maps `DIFFICULTY_STYLE.easy` →
`COLORS.green`. Any difficulty chip rendering EASY in a non-payoff frame breaks the rule
silently. Recommend forcing difficulty chips to yellow/red in these three, or suppressing
the chip entirely.

`green = hsl(152 100% 41%)`. Everything else: cream ground `hsl(30 100% 97%)`, ink
`hsl(0 0% 7%)`, red `hsl(1 100% 60%)` for the second club plate.

---

## Fact-check log — every claim that enters a frame

Standing rule: no source → cut. Rarity claims → two sources.

| claim | status | source |
|---|---|---|
| Beckham, Van Nistelrooy, Heinze, Di María all played Real Madrid **and** Man Utd | ✅ 2 sources | [FBref](https://fbref.com/en/friv/players-who-played-for-multiple-clubs-countries.fcgi?level=franch&t1=154064&t2=159928&t3=--&t4=--), [United In Focus](https://www.unitedinfocus.com/news/beckham-ronaldo-casemiro-every-player-to-play-for-both-manchester-united-and-real-madrid/) |
| ~12 players qualify for that pair (so "one we missed" stays answerable) | ✅ 2 sources | same two |
| Sol Campbell, Tottenham → Arsenal, free transfer, 3 Jul 2001 | ✅ | [Sports Mole](https://www.sportsmole.co.uk/football/arsenal/transfer-talk/feature/on-this-day-sol-campbell-completes-move-to-arsenal-from-tottenham_453799.html), [FourFourTwo](https://www.fourfourtwo.com/features/sol-campbell-arsenal-tottenham-greatest-premier-league-transfer-ever) |
| Luís Figo, Barcelona → Real Madrid, 2000, world-record fee | ✅ | [Yahoo Sports](https://uk.sports.yahoo.com/news/day-2000-luis-figo-swaps-050000197.html) |
| Clarence Seedorf played Inter **and** AC Milan | ✅ | [Goal](https://www.goal.com/en-us/lists/zlatan-ibrahimovic-andrea-pirlo-derby-della-madonnina-divide-players-played-for-ac-milan-and-inter/blt67ae3f915574498c), [FBref](https://fbref.com/en/friv/players-who-played-for-multiple-clubs-countries.fcgi?level=franch&t1=172965&t2=173603&t3=--&t4=--) |
| Fernando Torres: Atlético → Liverpool → Chelsea → AC Milan → Atlético | ✅ | [Simple Wikipedia](https://simple.wikipedia.org/wiki/Fernando_Torres), [Sportskeeda](https://www.sportskeeda.com/player/fernando-torres) |
| Michael Owen: Liverpool → Real Madrid → Newcastle → Man Utd → Stoke | ✅ | [Wikipedia](https://en.wikipedia.org/wiki/Michael_Owen), [National Football Museum](https://nationalfootballmuseum.com/halloffame/michael-owen/) |
| Owen won the 2001 Ballon d'Or | ✅ | same two |
| 14 players have played for both Manchester clubs (Script 2 slot 6 is answerable) | ✅ 2 sources | [FBref](https://fbref.com/en/friv/players-who-played-for-multiple-clubs-countries.fcgi?level=franch&t1=170087&t2=154064&t3=--&t4=--), [Goal](https://www.goal.com/en-us/lists/carlos-tevez-andy-cole-players-who-played-for-both-manchester-united-manchester-city/bltefb03e9df0062762) |

**CUT for lack of source:** R9 Ronaldo in the Inter + AC Milan slot. He is widely
believed to have played for both, but my search did not return a source confirming the
Milan spell, so he does not enter a frame. **Seedorf replaces him** — explicitly sourced.
Do not "fix" this by putting Ronaldo back without pulling a source first.

**No copyrighted footage or music.** No club crests (trademarked) — club names in brand
type only, per the house rule. Sound is the existing synthesised SFX kit; a trending
sound is added in-app, never baked.

---

# SCRIPT 1 — "PICK A SIDE"
### Tests H1 — unanswerable beats answerable (1.05 vs 0.31 cmt/1k, 3.4×)

**15.0s · 450 frames · 30 beats**

### Why this shape

A deliberate A/B against CHAIN. Same board format, same length band, same two-door bait,
**same four players** — the only thing that changes is that the question stops having a
right answer. If Script 1 out-comments CHAIN, H1 is real on our own account. If it
doesn't, H1 doesn't transfer from `fanfrenzyhub_` to us, and we've learned that cheaply.

Because it's a controlled test, **no b-roll hook** — adding a human open would change two
variables and ruin the read. The board is the hook, which CHAIN already proved works.

### Beat-by-beat

| frame | time | on screen | notes |
|--:|--:|---|---|
| 0 | 0.0s | `FOUR MEN PLAYED FOR` / `REAL MADRID` + `MANCHESTER UNITED` plates / all four names **already up** | Full ballot at frame 0. Unlike CHAIN, names do **not** stamp in — the viewer needs every option before they can pick. |
| 0–90 | 0.0–3.0s | board holds, 2% breathing pulse | |
| 90 | 3.0s | `ONLY ONE OF THEM IS STILL CLAIMED BY BOTH SETS OF FANS.` | The turn. Knowledge → allegiance. |
| 180 | 6.0s | **verdict card**, ink sticker, rotate −1°: `WE SAY: BECKHAM.` | **Only green frame.** Confident, declarative, contrarian. |
| 270 | 9.0s | `MADRID SAY HE WAS THEIRS.` / `UNITED SAY HE WAS THEIRS.` / `PICK A SIDE.` | |
| 345 | 11.5s | **product frame** — champion + final standings, held | real recording, 1.5s |
| 390 | 13.0s | `ONE SQUARE OF TODAY'S VERVEGRID · VERVEQ.COM` | |
| 450 | 15.0s | loop seam — names clear from f420 so the loop reads as a new round | same trick as CHAIN |

### Product frames

`v24044gl0000d920237og65o68uo37lg.mp4`, **src 7.25–8.33s** — champion reveal + final
standings. Taken from the verified `edl_arena.json` range map, TRUE COLOR, no grade.

🚫 **Do not** pull frames from `product-arena-gameplay.mp4` for this or any script below.
That file contains the "2024-25 PL title → Man City" question, which is a wrong answer
(Liverpool won it). The `v24044…` source is UI chrome only — mode picker, lobby,
standings — and contains no question text at all, so it is safe by construction.

### Caption

> Four men played for Real Madrid **and** Manchester United. Only one of them is still
> claimed by both sets of fans.
>
> We said Beckham. Madrid fans will disagree. United fans will disagree harder.
>
> Pick a side 👇 — and if you think we picked the wrong man, say who.
>
> Settle it properly — free, no sign-up: verveq.com
>
> #football #realmadrid #manchesterunited #footballdebate #footballtiktok

**Comment bait (two doors, per CHAIN):** (a) pick a side — one word, zero knowledge
required; (b) tell us we're wrong — the H1 engine, because there is no fact that can
close it. **CTA:** verveq.com, placed *after* the bait.

---

# SCRIPT 2 — "THE LONG CHAIN"
### Tests H3 — comment rate peaks at 90–120s (1.04 vs 0.07/1k at 0–15s)

**100.0s · 3000 frames · 200 beats**

### Why this shape

Our entire library lives in the 0–15s band, the worst in the sweep for comments. This
holds CHAIN's mechanism *exactly* — a chain of club pairs, answers withheld at the end —
and moves only the length into the 90–120s band where `fanfrenzyhub_` earns 1.04/1k.

Six pairs escalating in difficulty. **Five resolve. The sixth never does.**

### Beat-by-beat

**Cold open — 0.0–10.0s**

| frame | time | on screen | notes |
|--:|--:|---|---|
| 0 | 0.0s | b-roll `hook-locked-row-a.mp4` (src_in 0.20, native push-in) **with pair-1 plate already overlaid** | Human face for the scroll-stop, but the premise is legible at frame 0 anyway — the plate rides on top of the b-roll. Warm cinematic grade on the b-roll only. |
| 60 | 2.0s | hard cut to cream. `SIX PAIRS.` / `WE ANSWER FIVE.` | The cut is the punchline — no dissolve between shot and drawn worlds, per house rule. |
| 180 | 6.0s | `THE LAST ONE IS YOURS.` | Contract stated up front. |

**Pairs — 10.0–88.0s, 13.0s each (390 frames)**

Each pair runs the same internal grid:

| offset | on screen |
|--:|---|
| +0.0s | two club plates slam in (white plate + red plate, ±1.2° rotation) |
| +1.5s | open slot, blinking caret (15f period), 3-2-1 tick counter |
| +7.5s | **answer stamps in — GREEN** |
| +9.0s | one sourced micro-fact line |
| +13.0s | clearing sweep to next pair |

| # | start | pair | answer (green) | micro-fact line |
|--:|--:|---|---|---|
| 1 | 10.0s | `REAL MADRID` + `MANCHESTER UNITED` | **BECKHAM** | `ROUGHLY 12 MEN QUALIFY. HE'S THE EASY ONE.` |
| 2 | 23.0s | `TOTTENHAM` + `ARSENAL` | **SOL CAMPBELL** | `LEFT ON A FREE. 2001. NEVER FORGIVEN.` |
| 3 | 36.0s | `BARCELONA` + `REAL MADRID` | **LUÍS FIGO** | `WORLD RECORD FEE. 2000.` |
| 4 | 49.0s | `INTER` + `AC MILAN` | **CLARENCE SEEDORF** | `WON THE CHAMPIONS LEAGUE AT BOTH ENDS OF MILAN.` |
| 5 | 62.0s | `LIVERPOOL` + `CHELSEA` | **FERNANDO TORRES** | `BRITISH RECORD FEE AT THE TIME.` |
| 6 | 75.0s | `MANCHESTER UNITED` + `MANCHESTER CITY` | **— never revealed —** | `NO. WE'RE NOT ANSWERING THIS ONE.` |

Pair 6 runs the identical grid **except** the answer never stamps and the frame never
turns green. Caret keeps blinking to the end. 14 players genuinely qualify (fact-check
log), so the bait has deep fuel — Tevez is the obvious one and the pedants have Andy Cole
and Peter Schmeichel behind him.

**Close — 88.0–100.0s**

| frame | time | on screen |
|--:|--:|---|
| 2640 | 88.0s | **product frame** — mode picker → lobby, real recording |
| 2790 | 93.0s | `WE SETTLE THESE PROPERLY.` |
| 2880 | 96.0s | `VERVEQ.COM` |
| 3000 | 100.0s | loop seam — caret still blinking on slot 6 |

### Product frames

From `v24044gl0000d920237og65o68uo37lg.mp4`, via `edl_arena.json`:
- **src 0.75–2.05s** — mode list slides in and settles
- **src 5.65–6.65s** — lobby / arena code appears

Both are UI chrome, no question text. TRUE COLOR, no grade.

### Caption

> Six club pairs. Name a player who played for both.
>
> We answered five. We are not answering the sixth, and we're not going to.
> Manchester United **and** Manchester City — fourteen men have done it. Name one.
>
> First correct answer in the comments wins the argument 👇 Wrong answers will be
> corrected by strangers, which is the point.
>
> Free, no sign-up: verveq.com
>
> #football #footballquiz #premierleague #manchesterderby #footballtiktok

**Comment bait:** answer slot 6 (one surname, trivially cheap) — plus the sweep's real
engine, *other commenters correcting each other*. Naming the count ("fourteen") licenses
a long tail of replies instead of one right answer ending it.

### ⚠️ Production decision to surface

Every 90–120s reel in the sweep that earned a high comment rate carries a **human voice**
(`fanfrenzyhub_` is commentary-led throughout). 100 seconds of silent board is a real
risk, and it is not what the data actually endorses — the data endorses 90–120s *of
something people listen to*. Options, your call:

- **(a)** Ship silent, treat it as a pure length test. Cleanest read on H3, highest risk.
- **(b)** Add VO. Precedent exists — the semi-final promo used ElevenLabs v3 (`Daniel`)
  via fal.ai with the take **cached and committed** so a fresh clone renders with no API
  key. Same discipline applies: measure the delivery, then quantise the timeline to it.
- **(c)** Cut to ~60s and accept the 0.57/1k band instead of 1.04.

I'd take **(b)** — it tests H3 as the data actually describes it. But it adds a VO
generation step and locks the timeline to a measured voice, so it's a schedule call, not
a creative one.

---

# SCRIPT 3 — "THE ANSWER ISN'T IN THIS VIDEO"
### Tests H2 — showing the answer kills the comment section (footylinksapp: 0 comments / 9 reels)

**35.0s · 1050 frames · 70 beats**

### Why this shape

The nearest competitor to VerveQ, `footylinksapp`, promises in its own caption *"can you
find the connection **before the answer appears**?"* — and has taken **zero comments
across all nine reels we pulled**. They hand the answer over for free. There is then no
reason to type.

This script is the exact inverse, stated out loud as brand voice. The puzzle is real, the
answer exists, and **the video refuses to give it up**. Green never appears until the app
frame — the product is the only place resolution lives.

Puzzle: Michael Owen's career path. Fully sourced, and he is one of the genuine "we
missed him" answers to CHAIN's Real Madrid + Man United board — a quiet callback for
anyone who saw it.

### Beat-by-beat

| frame | time | on screen | notes |
|--:|--:|---|---|
| 0 | 0.0s | `FIVE CLUBS. ONE MAN.` / `LIVERPOOL` **already up** | Frame-0 legibility. An empty list communicates nothing — the first club is there before the scroll decision. |
| 90 | 3.0s | `REAL MADRID` stamps in | |
| 180 | 6.0s | `NEWCASTLE` | |
| 270 | 9.0s | `MANCHESTER UNITED` | The pair that makes United fans stop |
| 360 | 12.0s | `STOKE CITY` | The deflation beat — full path now visible |
| 450 | 15.0s | `HE WON A BALLON D'OR.` | Sourced. Reframes the whole path. |
| 540 | 18.0s | `WHO IS HE?` — caret blinking | |
| 630 | 21.0s | **`WE'RE NOT TELLING YOU.`** ink sticker, rotate −1° | The thesis. Contrarian, declarative. Still no green. |
| 720 | 24.0s | `EVERY OTHER ACCOUNT WOULD HAVE SHOWN YOU BY NOW.` | Positioning without naming anyone |
| 810 | 27.0s | **product frame** — real recording, **first green in the video** | resolution lives in the app |
| 930 | 31.0s | `THE ANSWER IS IN THE APP.` / `VERVEQ.COM` | |
| 1050 | 35.0s | loop seam — clubs clear from f1020, caret still blinking | |

### Product frames

⚠️ **Gap — needs a decision.** There is no Career Path screen recording in
`restored/Downloads/editing/`. The library has arena, blitz, compete-page, and stills for
quiz / ranks / survival / vervegrid / profile — **nothing showing Career Path mode**, which
is the mode this script is about. Generative AI cannot render app UI, so this cannot be
faked. Options:

- **(a) Preferred — shoot ~6s of Career Path on device.** One capture, correct mode, and
  it unblocks every future career-path reel. Small ask, best result.
- **(b) Ship with `v24044…` src 7.25–8.33s** (champion + final standings). Real UI, on
  brand, shows the "real scoreboard" promise — but it's the wrong mode for the puzzle
  we just posed, and an attentive viewer will notice.

I'd take (a). It's one recording and this is the mode we're advertising.

### Caption

> Liverpool. Real Madrid. Newcastle. Manchester United. Stoke.
> One man. One Ballon d'Or.
>
> We're not telling you who it is. Every other account would have shown you by now —
> that's exactly why nobody argues in their comments.
>
> Name him 👇 No cheating. We'll know.
>
> The answer's in the app — free, no sign-up: verveq.com
>
> #football #footballquiz #careerpath #guesstheplayer #footballtiktok

**Comment bait:** the answer is genuinely withheld, and the refusal is stated as
attitude rather than as a tease — which converts the withholding from a gimmick into
brand voice. **CTA:** the app is positioned as the only place the answer exists.

---

---

## AS BUILT — 2026-07-25

All three rendered to `tools/content-factory/out/2026-07-25/`, each with its caption
`.txt` beside it. `npm run promo -- pick-a-side long-chain not-telling` rebuilds them.
Typecheck clean; soundtracks are seamless loops generated from math, no music baked in.

| file | length | composition |
|---|--:|---|
| `verveq-pick-a-side.mp4` | 15.06s | `PickASide` |
| `verveq-long-chain.mp4` | 100.05s | `LongChain` |
| `verveq-not-telling.mp4` | 35.05s | `NotTelling` |

Two things changed from the beat sheets above during the build, both after looking at
rendered frames:

1. **Script 2 gained a persistent progress rail** (all six pairs, always on screen,
   filling in green as they resolve). The pair blocks as specced left the bottom half of
   a 1080×1920 frame empty, which reads as thin at 11s and would read as *dead* at 100s.
   The rail also does real work for the hypothesis: row 06 is dashed and reads `NEVER`
   from the first frame, so the viewer sees that one pair will never be answered without
   the caption having to tell them. It's the same show-the-whole-gauntlet law
   `ladder/timeline.ts` is built on.
2. **Script 1's end card moved from the bottom of the frame to the top.** At the bottom
   it cropped the final-standings table it was meant to be selling, and it sat in the
   ~250px Instagram covers with its own caption/audio chrome in feed.

Two things from the beat sheets did **not** change and still need your call: Script 2 is
**silent** (the VO decision, option (b), is still open) and Script 3's product frame is
still the **arena scoreboard standing in for a Career Path capture** that doesn't exist.
Both are one-line swaps — `PROD_SRC`/`PROD_HOLD` in `nottelling/timeline.ts`.

---

## How to read the results

Judge all three on **comments per 1,000 views**, not views (H4 — `jeremylynchfootball`
took 1,346,219 views and 14 comments). Baseline to beat is CHAIN's reported **4.00/1k**,
with the caveat from the digest that 7 comments is a small number to build a rate on.

- Script 1 beats CHAIN → **H1 transfers to us**; make allegiance the house question type.
- Script 2 beats CHAIN → **length was the constraint**, and our whole 11–16s library is
  leaving comments on the table.
- Script 3 beats CHAIN → **withholding is the active ingredient**, and it should be
  policy rather than a format.
- None beat CHAIN → the 7 comments were noise. Re-run CHAIN itself before concluding
  anything, because at n=7 that is genuinely possible.

Post them on separate days, same time of day. Two on one day contaminates the read.
