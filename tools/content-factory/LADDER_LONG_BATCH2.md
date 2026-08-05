# LADDER-LONG — batch 2 of 2 (2026-08-05)

Four editions rendered, **narrated, complete.** Forty new VO lines generated
against the owner's `FAL_KEY` and cached to `promo/vo-cache-ladderlong/` — the
cache now holds all 88 lines and renders are offline from here.

---

## 1. What changed from batch 1

Batch 1 shipped four editions at a metronomic 7.00s/rung and asked for one thing,
once, at 68s. Batch 2 keeps the format and moves three variables.

**(a) The cadence A/B.** `FACELESS_WINNER_SPEC` measured 5.5–7.02s per question
across four winners — and *both ends of that band are winners*. pitch.quiz holds
7.02s and owns the cohort's biggest view count (232,932); gugum holds a 5.5s modal
beat and owns its best comment rate (0.00271/view). The band cannot tell you where
to live inside it. Batch 2 asks it directly.

**(b) The running scoreboard.** The ten-slot rail was already a scoreboard in spec
#26's sense, but it scores *us* — it fills with the answers the video gives away.
Nothing on screen ever asked the viewer for a number, so the only people who could
answer batch 1's ask were the ones who had already watched 68 seconds. Batch 2 adds
a nine-pip `?/9` strip that states the denominator from frame 0 and fills as rungs
resolve, and a CTA that asks for the number first.

**(c) The follow hook.** One card and one line before the CTA. Positioned as
tomorrow's puzzle, never as a brand ask.

## 2. Casting

Forty fresh S-tier ids, zero collisions with the 92 already in `ledger.json`, all
≤7 clubs, whole paths copied from `football_career_paths.json` (loan spells
flattened to the bare club name, same as batch 1). Tier = difficulty of the
**path**, not obscurity of the **name**.

| # | tier | number-ones | hard-way-up | old-guard | grand-tour |
|---|---|---|---|---|---|
| 1 | EASY | Manuel Neuer | Cole Palmer | Marco van Basten | Vinícius Júnior |
| 2 | EASY | Iker Casillas | Cody Gakpo | Xavi | Rúben Dias |
| 3 | MEDIUM | Donnarumma | Rafael Leão | Alessandro Nesta | Tchouaméni |
| 4 | MEDIUM | David de Gea | John Stones | Lilian Thuram | Matthijs de Ligt |
| 5 | MEDIUM | Hugo Lloris | Harry Maguire | Emmanuel Petit | David Alaba |
| 6 | HARD | Petr Čech | Riyad Mahrez | Miroslav Klose | Mateo Kovačić |
| 7 | HARD | Edwin van der Sar | Victor Osimhen | Gennaro Gattuso | Hakan Çalhanoğlu |
| 8 | HARD | Ederson | Jorginho | Marcel Desailly | Xabi Alonso |
| 9 | IMPOSSIBLE | Fabien Barthez | Viktor Gyökeres | Roberto Baggio | Robert Pirès |
| **10** | **IMPOSSIBLE** | **Peter Schmeichel** | **Jamie Vardy** | **Gianfranco Zola** | **Arjen Robben** |

`number-ones` is ten goalkeepers, which is a genuinely different puzzle: the reader
is looking for a shape, not a position.

Rung 10 obeys the stricter half of the casting law — **obscure head so it isn't
free, famous tail so the answer is reachable**:

- Schmeichel — Gladsaxe-Hero → Hvidovre → Brøndby → Manchester United → Sporting CP → Aston Villa → Manchester City
- Vardy — Stocksbridge Park Steels → FC Halifax Town → Fleetwood Town → Leicester City → Cremonese
- Zola — Nuorese → Torres → Napoli → Parma → Chelsea → Cagliari
- Robben — Groningen → PSV Eindhoven → Chelsea → Real Madrid → Bayern Munich → Groningen

Two casting traps in the dataset were checked and avoided: `cp-marcelo-vieira` is
the same man as batch 1's `cp-marcelo`, and `cp-alisson-becker` duplicates
`cp-alisson`. Neither is spent. Ruud Gullit was dropped from `old-guard` because his
path carries two *consecutive* Sampdoria entries, which reads as a rendering bug on
the card.

## 3. Cadence assignment

**Pace is assigned across eras, not along them.** If both fast editions were the
modern decks, "which pace won" would be unreadable against "which casting won".

| edition | deck | pace | length |
|---|---|---|---|
| `number-ones` | legacy (keepers) | **7.00s** control | 78.00s / 156 beats |
| `hard-way-up` | modern (underdogs) | **7.00s** control | 78.00s / 156 beats |
| `old-guard` | legacy (90s/2000s) | **5.50s** fast | 63.00s / 126 beats |
| `grand-tour` | modern (Europe) | **5.50s** fast | 63.00s / 126 beats |

Both lengths stay inside `RESEARCH_DIGEST` H3's 60–90s band — the point of testing
cadence is that length is held constant, not traded against it.

### What the fast grid gives up, and what it refuses to

Going 210f → 165f has to come out of something. It comes out of the **guess
window**, never the answer:

| | 7.00s | 5.50s |
|---|---|---|
| first club lands | 0.27s | 0.20s |
| last club lands (7-club path) | 2.27s | 1.60s |
| guess window opens | 2.33s | 1.73s |
| 3-2-1 | 2.50 / 3.50 / 4.50s | 2.00 / 2.50 / 3.00s |
| answer stamps | 5.00s | 3.50s |
| **answer holds** | **2.00s** | **2.00s** |

The answer hold is fixed at 2.00s in both arms (spec #3), which is what keeps the
answer VO slot pace-independent — 36 answer takes serve either grid unchanged. The
countdown tightening from one tick per two beats to one per beat is not decoration;
it is the honest signal that the window is half as long.

**Known risk of the fast arm, stated up front:** a 7-club path at 5.50s is fully on
screen for 1.9s before the answer lands. That is the thinnest moment in the format
and it is exactly what the A/B is measuring. If the fast arm loses, this is the
first place to look.

## 4. The two new surfaces

**The score rail** sits under the answer rail, on screen from frame 0, never moves.
Nine pips, not ten — rung 10 is withheld, so it is not something a viewer can have
scored, and `/9` has to match what the voice asks for at the close. A pip fills, with
a pop, as its rung resolves.

**The follow-hook card** is 2.00s of lime between the withheld rung and the CTA:
NEW GAUNTLET / DAILY, over "FOLLOW FOR TOMORROW'S TEN". It carries the only beat in
the piece that resolves *upward* — rung 10 deliberately leaves its riser hanging, and
the follow card lands a clean fifth above the closing stinger so "there's another one
tomorrow" sounds like an answer rather than another question.

**The CTA now asks for two things, cheap one first.** `?/9` in lime at 168pt, AND
NUMBER 10 under it, BOTH IN THE COMMENTS under that. The score catches everyone who
played any of it; the name catches only the ones who lasted. Both are one word to
type, which is spec #23's actual requirement — the constraint was never "one ask", it
was "answerable in one word".

## 5. Batch 1 is frozen, deliberately

Those four editions are already posted. Their sources have to keep rendering what
went out, so they stay at 76.00s with no score rail, no follow card and their
original closing copy.

The mechanism is two orthogonal fields on `Edition`: **`grid`** is the cadence under
test, **`batch`** is the surface. The follow card is a `batch` property, not a `grid`
one — otherwise batch 1 would have inherited 60 frames it never shipped with.

Verified, not asserted. `ladder-long-all-timers` was re-rendered from this branch:

- all four batch-1 editions still resolve to **2280f**;
- the **whole decoded video stream is bit-identical** to the shipped 2026-08-01 cut
  (`md5 596d90cc…` both sides, 2280 frames);
- the batch-1 SFX beds produced by the **old** generator (`git show HEAD:…`) and the
  **new** one are **byte-identical WAVs**, all four;
- the caption files are identical.

### One thing that was already broken before this ticket

The re-rendered batch-1 **audio** does *not* match the shipped 2026-08-01 MP4 — 45% of
samples differ, up to 12331/32767. That is **not** caused by batch 2, and the checks
above pin it down: the beds are byte-identical old-generator-vs-new, and two
consecutive renders on this machine are byte-identical MP4s, so the renderer is
deterministic and my change is neutral.

The cause is `bec8ab1` *"seed the SFX PRNG per promo — entry-point independent beds"*,
committed **2026-08-01 22:29** — three and a half hours *after* the batch-1 MP4s were
rendered at 19:02. Every bed in the library changed under that fix, so batch 1's
posted cuts stopped being reproducible from `HEAD` on 2026-08-01 and have been
non-reproducible ever since.

Nothing here needs fixing for batch 2 — the posted files are fine and the sources are
correct. It is recorded because "re-render batch 1 and you get what was posted" is
now false for the audio, and someone will eventually rely on it. If exact
reproduction of the posted cuts ever matters, the pre-`bec8ab1` `audio-lib.mjs` is
the thing to restore, not anything in this batch.

Three VO keys are batch-scoped for the same freezing reason — `open`→`open2`,
`cta`→`cta2`, and `follow` — so batch 1 keeps its own take rather than inheriting
batch 2's rewrites.

## 6. One source of truth for the grid

Every other promo in this lane hand-copies its grid constants into the audio script
under a "MUST match timeline.ts" comment. That was survivable with one grid. With
two grids, a per-edition length and a per-edition VO budget, the same numbers were
about to exist in three places — and a drift here is **inaudible until a voice line
lands on top of a countdown**.

`promo/ladderlong-grid.mjs` now parses both grids and the whole edition table
(slug, batch, grid, per-rung club counts) straight out of `timeline.ts`.
`ladderlong-audio.mjs`, `ladderlong-vo.mjs` and `promo.mjs` all read it from there.
The parser is strict and throws on anything it doesn't recognise: a silent mis-parse
would hand back a plausible-looking grid, which is worse than none.

Two new guards came with it:

- **`checkCoverage()`** — fails before the first credit is spent if the scripted
  lines and the editions table disagree in either direction. A line nothing schedules
  is a credit spent on audio that never plays; a cue nothing scripts is a rung that
  goes out mute.
- **`--plan`** — prints every line's derived slot budget and which paces speak it,
  generating nothing.

## 7. VO state — done, cached, offline from here

Slot budgets are now *derived* from the grid rather than written down, and a line
spoken by both arms is held to the tighter of the two:

| slot | 7.00s | 5.50s | bound by |
|---|---|---|---|
| `open` | 5.00s | **3.50s** | the first answer |
| `count` | 2.50s | **2.00s** | that rung's first tick |
| `answer` | 2.00s | 2.00s | end of rung (equal by construction) |
| `withhold` | 5.00s | 5.00s | end of rung 10 |
| `follow` / `cta` | 2.00s / 3.00s | 2.00s / 3.00s | card length |

**All 48 cached batch-1 takes were re-checked against the tightened fast-arm budgets
and all 48 still fit — zero re-voicing, no re-billing.** The one carrier line the
5.50s grid could not hold is `n5` ("Halfway. Number five.", measured 2.24s against a
2.00s window), so the fast arm says `n5f` ("Halfway. Five.") instead. The halfway
marker is a retention beat and worth keeping; "Number" is the part that can go.

**40 lines generated** — 36 answers + `open2` + `n5f` + `follow` + `cta2` — with the
48 existing lines served from cache and not re-billed. Final: **88/88 fit, zero
overruns.**

The fit check threw twice on the real take, and both throws were right. Note *which*
lines: the prediction going in was that the short lone surnames would drag, as
`"Gerrard."` did in batch 1. **Every one of the 36 answer names fit first time**
(0.56s–1.68s against a 2.00s slot; the shortest was `"Mahrez."`). What overran was
the opposite — the two longest new sentences:

| line | measured | slot | fix |
|---|---|---|---|
| `open2` "Ten career paths. They get harder. Keep score." | 3.76s | 3.50s | → "Ten career paths. Keep score." (2.64s) |
| `cta2` "Your score out of nine? And number ten?" | 3.20s | 3.00s | → "Your score? And number ten?" (2.72s) |

Both cuts removed a clause the **card was already showing while the line played** —
the header reads "10 CAREER PATHS. THEY GET WORSE." in 88pt, and the CTA shows
"? / 9" in 168pt lime. That is batch 1's `n10` lesson again ("the tier pill already
says IMPOSSIBLE, so the voice spends its beat on stakes instead of repeating the
card"), and it is worth stating as a rule: **when a line overruns, the first thing to
cut is whatever the screen is already saying.** Both asks and the score seed survive
intact; only the duplication went.

Note also that the binding constraint on both was the **5.50s arm** — at 7.00s alone
each would have fit. The A/B tightened the copy for the control arm too, which is a
real cost of sharing one carrier and worth knowing before the next cadence test.

## 8. Renders

```
out/2026-08-05/verveq-ladder-long-number-ones.mp4   78.06s  5.77 MB  (+ .txt)
out/2026-08-05/verveq-ladder-long-hard-way-up.mp4   78.06s  5.79 MB  (+ .txt)
out/2026-08-05/verveq-ladder-long-old-guard.mp4     63.06s  4.72 MB  (+ .txt)
out/2026-08-05/verveq-ladder-long-grand-tour.mp4    63.06s  4.99 MB  (+ .txt)
```

All 1080×1920, 30fps, h264 + AAC.

### VO placement, verified

"The voice is in there" is not proof it landed where it should. Each render's audio
was differenced against its own pure SFX bed (`public/promo/ladderlong-<slug>.wav`) at
100ms resolution: the bed is scaled by the least-squares gain that best explains the
render, and whatever energy is left over is the voice.

**22/22 cues carry voice energy on frame, in all four editions** — `open2` at 0.00s,
each count-in on its rung boundary, each answer at `answerAt`, `withhold`, `follow`
and `cta2` on their cards. The weakest margin across all 88 cues was **31× the
baseline**, so nothing is marginal. The 5.50s arm's cues are as clean as the 7.00s
arm's, which is the specific thing that could have gone wrong when the grid moved.

### The withhold, verified

Rung-10 answers appear in **zero** captions, **zero** filenames, **zero** VO lines
(the ANSWERS arrays are nine long by construction), and never on the rail — which
holds `?????` through the follow card and the CTA.

## 9. What did NOT change

Both batch-1 divergences still stand and still deserve flagging:

- **No player imagery.** Spec #20 found 4/4 winners use real subject imagery at the
  reveal. The standing rule (no likenesses, no crests) holds, so answers land as
  brand-type on a lime chip. Read the A/B knowing it.
- **No trending sound.** Spec #11 found 4/4 winners on original audio, and a song
  over a VO fights the voice this format is paced by. Post these with their own audio,
  ignoring the README's daily workflow step.
