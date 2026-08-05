# VerveQ Content Factory

Batch-renders short-form videos (TikTok / Instagram Reels / YouTube Shorts)
from `app/convex/data/football_career_paths.json`. One format — **Career
Path Reveal**: the hook ("7 CLUBS. 1 PLAYER.") is readable on frame 0 and the
first club lands at 0.33s (retention lives or dies in the first 3 seconds),
clubs slam in one by one, WHO IS HE?, 3-2-1, reveal, CTA to verveq.com.
1080×1920, ~10–22s depending on club count. No UI, no scheduler, no
auto-posting — a render script.

## Every video is its own edition (`src/variants.ts`)

One format, never one look. Each clip derives its entire appearance and sound
from a single seed — the player's dataset `id` — so it's deterministic (same
id → identical video forever, safe to re-render) yet no two players share a
look. Independent axes combine multiplicatively (765 unique visual
combinations across the current dataset):

- **palette** — which brand accent leads (orange / pink / blue / green / lime)
  and the reveal-card colour. Ground stays cream, ink stays ink — always.
- **background** — a subtle texture on the cream ground (dots / grid / hatch /
  confetti / plain), low-contrast so it never fights the club rows.
- **header** — left-aligned, centered, or an ink sticker-band heading.
- **row style** — card (rounded), slab (sharp, inverted badge), or ticket.
- **motion** — snappy / bouncy / smooth / slam entrance personalities.
- **on-screen copy** — subhead, countdown prompt, comment bait, reveal label,
  and CTA tagline each rotate from a spoiler-free pool (`src/copy.ts`).
- **sound kit** — which SFX set plays (see below).

To vary a video, you don't touch the template — the seed does it. Adding a new
option to any axis (a palette, a background) instantly widens every future
batch. Axes are salted per-name, so adding an axis never reshuffles the looks
players already have.

## One-time setup

```
cd tools/content-factory
npm install
```

The first render downloads a headless Chrome build automatically (~1 min).

## Weekly workflow (~10 minutes, mostly waiting)

```
npm run render -- --count 7 --difficulty easy
```

Videos land in `out/<date>/`, each with a ready-to-paste `<id>.txt` caption
beside it (spoiler-free hook + comment bait + hashtags, rotated per video —
tweak freely, they're starting points; hook/tag pools live in
`captions.mjs`). Each rendered player id is recorded in `ledger.json` and
never picked again — commit the ledger after each batch.
Start with `easy` (recognizable players = mass appeal); mix in `medium` once
the account has an audience. `--dry` previews the picks without rendering,
`--id cp-messi` renders a specific player (filename = answer, mind spoilers
when screen-sharing).

## Daily workflow (~60 seconds)

1. Upload one MP4 to TikTok. Post the **same file** to IG Reels and YouTube
   Shorts.
2. Add a trending sound **in the TikTok app** — never bake music into the
   render (native sounds help distribution and dodge licensing).
3. Caption = paste the `<id>.txt` sitting next to the MP4. Reply to good
   comments — that's the part you're already great at.

## Sound (`sfx/gen.mjs` → `public/sfx/`)

Each render bakes a synced SFX layer: a slam per club, ticks on the 3-2-1, a
riser under the prompt, a stinger on the reveal, a whoosh into the CTA — mixed
low, and varied by the variant's **sound kit** (deep/punchy · bright/clicky ·
soft/woody) so videos also *sound* like their own edition. The sounds are
synthesized from math with a seeded PRNG (`node sfx/gen.mjs`, run automatically
before render and studio), so they're original — nothing sourced, nothing
licensed. The `public/sfx/` WAVs are generated, not committed. **Music is still
never baked in** — you add a trending sound in the app on top of these accents
(see the daily workflow).

### What "deterministic" guarantees, exactly

Each promo's bed is seeded from **its own stable name** — FNV-1a of
`name + "|sfx"` into mulberry32, the same salting the visual variant axes use
(`src/variants.ts`), so adding a promo never reshuffles an existing one's noise.
Seeding happens in the `Mixer` constructor, which is why `name` is its first and
required argument.

The guarantee that follows is **per-promo and entry-point independent**: a bed is
a pure function of its name and its arrangement. `node promo/ladder-audio.mjs`
and `npm run promo` produce byte-identical WAVs, regardless of import order or
which other promos share the process. Calling a noise-using synth before any
`Mixer` exists throws rather than emitting unseeded audio.

> **Soundtrack epoch — 2026-08-01.** Before this date the library shared ONE
> module-level `makeRng(1337)` across every synth in the process, so a bed
> depended on how many synth calls had already run. `node promo/x-audio.mjs` and
> `npm run promo` (which imports ~29 audio modules that each build at import
> time) produced *different* beds for the same promo. A clean-clone test caught
> it: identical video frames, different audio.
>
> Re-rendering anything from before 2026-08-01 therefore yields a **different SFX
> bed**. Video is unaffected — frames are byte-identical across the change. The
> batch-1 `ladder-long` MP4s in `out/2026-08-01/` are grandfathered as final
> artifacts and are not re-rendered; see `docs/DECISIONS.md`.

## Rules (deliberate, don't "fix")

- **No club crests/logos** — trademarked. Club names in brand type, always.
- **Baked SFX, never baked music** — synthesized sound effects sync to the
  animation and ship in the MP4; a trending *song* is still added in-app for
  distribution and to dodge licensing.
- **English only** — broadest TikTok football audience.
- **Cream ground, ink, brand accents only** — variants rotate *within* the
  brand, never outside it. Brand tokens live in `src/theme.ts`, mirrored from
  `app/src/index.css`. If the app palette changes, update both.

## Hero brand promos (`npm run promo`)

Scored motion-design ads — NOT daily quiz clips. Twelve of them, one brand
language, deliberately no two alike (same reason the quiz clips vary): different
angle, structure, palette AND tempo each, so a viewer never sees the same video
twice. Every one is readable on frame 0 with motion already underway — the
first batch's retention data (70% gone before 3s on a static open) is the law
here.

| name | id | angle | tempo | ends |
|------|----|-------|-------|------|
| `settle-it` | `BrandPromo` | mode-showcase hype reel | 120 BPM four-on-floor | "Settle it." |
| `versus` | `Versus` | head-to-head taunt (duels/arena) | 90 BPM half-time | "Stop arguing. Settle it." |
| `quiz` | `QuizTease` | play-along quiz tease | 100 BPM ticking-clock | "How good are you really? Find out." |
| `group-chat` | `GroupChat` | the chat argument that never ends | ~138 BPM message-pop | "End the argument." |
| `one-more` | `OneMore` | 1AM "one more game" relatable loop | ~129 BPM layer-per-bar | "It's never just one." |
| `anthem` | `Anthem` | kinetic-typography brand manifesto | 150 BPM word-per-beat | "Talk is cheap." |
| `breaking` | `Breaking` | transfer-news parody (chyron/ticker) | 112.5 BPM newsroom pulse | "Done deal." |
| `wrapped` | `Wrapped` | year-in-review argument stats parody | ~164 BPM pop-major | "Change your stats." |
| `fan-types` | `FanTypes` | 5-types-of-fan taxonomy + roasts | ~106 BPM swagger strut | "Which one are you?" |
| `rematch` | `Rematch` | revenge-arc story told in DAY chips | 100 BPM minor→major build | "Your turn." |
| `remember` | `Remember` | 2006 nostalgia — memory as superpower | 90 BPM warm music-box | "Put it to work." |
| `license` | `License` | bureaucracy parody — fan license | ~95 BPM rubber-stamp march | "Earn yours." |

Batch 2 hooks: `group-chat` opens on a rage-bait hot take in a chat bubble,
`one-more` on a glowing bedside clock and the lie ("YOU SAID ONE GAME."),
`anthem` mid-chant — and `anthem` carries a pattern interrupt: the music cuts
to true silence on a cream frame ("there's a website for this now.").
Batch 3 hijacks formats fans are already wired for: `breaking` opens as a
live news graphic (typewriter headline, LIVE bug, ticker), `wrapped` as a
year-in-review stat card, `fan-types` as a taxonomy — and its CTA literally
instructs the comment section ("Tag the other four.").
Batch 4 is story and identity at a readable pace (~15s, blocks hold 2.5–3.3s):
`rematch` is the set's first narrative (loss → reps → revenge, minor key
lifting to major on the payoff), `remember` its first warmth (nostalgia →
"your memory is an asset"), `license` deadpan bureaucracy (Dave: DENIED —
reason: vibes only).

```
npm run promo                     # render all twelve → out/<date>/verveq-<name>.mp4
npm run promo -- versus           # render one
npm run promo -- rematch remember license   # or any subset
```

## The retention lane (`ladder`, `chain`, `wall`, `ladder-long`)

Four formats that exist because of a measurement, not a brief. Sampling the
football-quiz reels that actually travel, the single-puzzle reveal — one career
path, answered on screen, ~14s, which is what `CareerPathReveal` produces — is a
commodity: the same format from other accounts lands in the tens of thousands of
views regardless of polish or length. The formats that travel share three
properties this lane is built around, and none of them is "shorter":

1. **The whole gauntlet is visible at frame 0**, not one question. A viewer who
   can see there are five rungs (or nine cells) has a reason to still be there
   at 0:06; a viewer shown one puzzle has none once they've solved it.
2. **Escalation is labelled.** `EASY → IMPOSSIBLE` on screen is itself the
   retention promise.
3. **They don't fully resolve.** The last rung is never answered, seven of nine
   cells stay sealed, the fifth slot stays empty. Comments are the ranking
   signal, and the cheapest reason to type is an answer the video withheld.

| CLI name | id | mechanic | length | withheld on purpose |
|---|---|---|---|---|
| `ladder` | `Ladder` | five career paths, easy→impossible, rail fills as you go | 16.0s | rung 5's answer |
| `chain` | `Chain` | relay: "played for both — I'll start, your turn" | 11.0s | slot 5, and Ronaldo |
| `wall` | `Wall` | 3×3 wall of nine paths under a 10s clock | 13.0s | seven of nine answers |
| `ladder-long-*` | `LadderLong-*` | ten paths, easy→impossible, metronomic rungs, narrated | 76.0 / 78.0 / 63.0s | rung 10's answer |

`chain` leaves out the single most famous qualifying player deliberately —
being the one to point out the obvious omission is the most reliable comment
trigger available, and it costs nothing.

Content is sourced from `football_career_paths.json` and pinned in each
`timeline.ts` (ids in comments), so these are the app's facts. When you re-cut
them with new players, add the ids you use to `ledger.json` — otherwise the
quiz lane will later post a single-path video for a player these already spent.

```
npm run promo -- ladder chain wall
```

### `ladder-long` — the lane rebuilt on measured cadence (8 editions, narrated)

`ladder` was built before we had measured anything. Two studies since:

- **`RESEARCH_DIGEST.md` §3/H3** (n=112 reels ≥5k views) — comment rate climbs with
  *length*, peaking at 90–120s. Our whole library sat in the two worst bands. That
  produced `long-chain` (100.0s) as a pure length test.
- **`research/ig-competitor-sweep/FACELESS_WINNER_SPEC.md`** (n=4 faceless winners,
  coded from the video files) — measured the *cadence inside* the winners: 5.5–7.02s
  per question, 6–10 questions, 42–73s total.

Those measure different axes and don't contradict each other. `ladder-long` takes the
length from the first and the cadence from the second: **ten rungs at a metronomic
beat.** Nine resolve on screen; rung 10 never does, and the voice says so out loud.

The tenth slot is the point. Spec #26: a persistent 10-slot scoreboard was the
strongest single differentiator in that cohort — the reels carrying one averaged
0.0020 comment rate vs 0.00088 without, and the best hit 0.00271 at 70s. Ten rungs
is what turns the rail into a scoreboard a viewer counts themselves against.

**Batch 2 (2026-08-05) runs a cadence A/B, and it is the whole reason the grid is
per-edition.** The measured band is 5.5–7.02s per question and both ends of it are
winners, so the band cannot tell you where to live. Batch 2 asks it directly: two
editions at pitch.quiz's 7.00s, two at gugum's 5.50s. Everything else is held
constant, including total length inside H3's 60–90s band. Pace is assigned *across*
eras (one legacy deck and one modern deck in each arm) so "which pace won" can never
be read as "which casting won".

The fast grid takes its 1.50s out of the **guess window**, never out of the answer:
`answerAt` moves up so a resolved answer still holds a full 2.00s, and the 3-2-1
tightens from one tick per two beats to one per beat. That is what keeps the answer
VO slot at 2.00s in both arms, so answer takes are pace-independent.

| | batch 1 | batch 2 @ 7.00s | batch 2 @ 5.50s |
|---|---|---|---|
| length | 76.0s (152 beats) | 78.0s (156 beats) | 63.0s (126 beats) |
| answered rungs | 9 × 7.00s | 9 × 7.00s | 9 × 5.50s |
| withheld rung | 10.00s | 10.00s | 8.50s |
| follow-hook card | — | 2.00s | 2.00s |
| CTA card | 3.00s | 3.00s | 3.00s |
| running score rail | — | yes, `/9` | yes, `/9` |
| editions | `all-timers`, `premier-league`, `modern`, `journeymen` | `number-ones`, `hard-way-up` | `old-guard`, `grand-tour` |

Tiers are 2 EASY / 3 MEDIUM / 3 HARD / 2 IMPOSSIBLE in every edition, and rung 10 is
never drawn, never spoken, and named only by its club path in the caption.

**Batch 1 is frozen.** Those four are already posted, so their sources have to keep
rendering exactly what went out: they stay at 76.0s with no score rail, no follow card
and their original closing copy. Everything batch 2 adds is gated on the edition's
`batch` field, not bolted onto the component for everyone. `batch` and `grid` are
orthogonal — `grid` is the cadence under test, `batch` is the surface.

**The two batch-2 surfaces**, both aimed at the same hole. Batch 1's only ask arrived
at 68s, so the only people who could answer it were the ones who had already watched
68 seconds:

- **the running score rail** — nine pips (not ten; rung 10 is withheld and so is not
  something a viewer can have scored), filling as rungs resolve, under a `?/9` that
  states the denominator from frame 0. It makes the piece askable at every exit point:
  "6/9" is typeable by someone about to scroll at rung 6.
- **the follow hook** — one card and one line before the CTA, positioning tomorrow's
  puzzle rather than the brand. It is the only beat in the piece that resolves upward.

```
npm run promo -- ladder-long-all-timers        # one edition
npm run promo -- ladder-long-old-guard ladder-long-grand-tour
```

**Casting is a production step, not a lookup.** All forty paths are S-tier names
(casting law, `ladder/timeline.ts`), capped at 7 clubs so a whole path always fits the
card — that is a *selection* constraint and never a licence to truncate a longer path.
Rung 10 obeys the stricter half of the law: an obscure head so it isn't free, a famous
tail so the answer is reachable. An unguessable withhold is a dead end, not a hook.

**The grid leads the voice** — the inverse of `semi-final`. There the timeline was
built backwards from the narrator's measured delivery; here the cadence is the finding
being tested, so the grid is fixed and the copy is written to fit it.
`promo/ladderlong-vo.mjs` measures every generated line against its slot budget and
**throws** if one overruns. If a line doesn't fit, shorten the line.

**The VO carrier is shared across all four editions**, exactly as the winners' is
(spec #13 — 22% of one competitor's track is bit-identical between episodes). `open`,
`n2`…`n10`, `withhold` and `cta` are generated once; only the nine answer names differ
per edition. 13 shared + 4×9 = 48 lines for four videos instead of 84, and the batch
sounds like one series because it is one take.

Voice is **`Charlie`** — brisk quiz-host, picked against the register the spec measured
(gugum runs 3.40–3.61 syllable onsets/sec). Deliberately *not* `Daniel`, whose measured
2.39 words/sec across the semi-final would blow every slot.

```
node promo/ladderlong-vo.mjs --plan             # slot budgets, generates nothing
FAL_KEY=… node promo/ladderlong-vo.mjs          # generate + cache (once)
FAL_KEY=… node promo/ladderlong-vo.mjs --force  # re-voice everything
```

Slot budgets are **derived from the grid**, not written down, and a line that plays in
both arms is held to the tighter of the two. That is why `--plan` exists: it prints
what every line has to hit, and which paces speak it, before a credit is spent. At
5.50s the count-in window drops from 2.50s to 2.00s, which exactly one carrier line
could not hold — `n5` ("Halfway. Number five.", measured 2.24s) — so the fast arm says
`n5f` ("Halfway. Five.") instead. The other eight count-ins were already under 2.00s
and are shared by both paces unchanged.

Missing lines degrade **per line**, not all-or-nothing: a clone with no key still
renders, with whatever the cache holds, behind a warning that names every silent line.
That exists so the visual grid can be proofed before spending a credit. **A proof must
never be posted**: the pacing is the voice.

`promo/ladderlong-grid.mjs` *parses* both grids and the whole edition table out of
`timeline.ts`, and `ladderlong-audio.mjs` / `ladderlong-vo.mjs` / `promo.mjs` all read
it from there. Nothing about this format is hand-mirrored any more — with two grids
and a per-edition length there were three copies of the same numbers, and a drift here
is inaudible until a voice line lands on top of a countdown.

### `semi-final` — the dated one-off (and the only narrated promo)

Everything above is evergreen. `semi-final` is not: it was cut for **England v
Argentina, 15 July 2026**, to post an hour before an 8pm BST kickoff, and it
dies the moment that whistle goes. It's kept as the worked example of a
matchday piece — copy the shape, not the facts.

The hook is a fact, not a boast: **Lionel Messi has never played against
England.** The only fixture between them in his whole career was 12 Nov 2005,
and he was suspended for it — serving a ban for a red card he earned seconds
into his debut, a ban that covered friendlies only and landed on precisely that
one match. Everything in the 33.5s serves that sentence.

It breaks two rules in this README on purpose, and only because it's a one-off:

- **It has a human voice.** ElevenLabs v3 (`Daniel`) via fal.ai. Every other
  promo is synthesis; a narrated line can't be. So the VO is generated **once**
  and committed to `promo/vo-cache/` — renders copy from the cache and never
  touch the network, so a fresh clone with **no API key still renders it**.
  Regenerating is deliberate: `FAL_KEY=… node promo/semifinal-vo.mjs --force`.
  Re-voice the whole thing by changing one string (`VOICE`) and re-running.
- **The timeline is built backwards.** Everywhere else the grid comes first and
  the copy fits it. Here each scene's length is the narrator's *measured*
  delivery quantised up to the beat, and the cards land on the exact frames the
  words are spoken — the API returns per-character timestamps, which
  `src/promo/semifinal/vo.ts` turns into frames. The 7,550 counter spins up on
  "seven… thousand… five hundred… and fifty" and lands on the last syllable;
  the three history cards land on "hand", "red", "revenge". The music reads the
  same `vo.json`, so its accents hit those words too. Change a line, re-run the
  VO script, read the printed durations, re-quantise `timeline.ts`.
- **Say the quiet part.** The first cut said "never played England" *and* "sent
  off seconds into his debut" without naming the debut's opponent — which reads
  as a flat contradiction, and invites the obvious rebuttal: he played three
  qualifiers between the red card and the England friendly, so why hadn't he
  served it? Both holes close by naming **Hungary** and stating the rule (the
  ban only counted in friendlies). A "did you know" video invites scrutiny, so
  it has to survive the reply guy — and the mechanism turned out to be the best
  beat in the piece anyway. It cost the Bellingham beat, which moved to the
  caption.

Music is still synthesised and still beat-gridded (`promo/semifinal-audio.mjs`)
— AI music can't be frame-locked, and that sync is the whole point. It ducks
under the voice live (`VO_WINDOWS` → a frame→volume function in `SemiFinal.tsx`).

Two conventions worth stealing for the next matchday cut:

- **No crests, still obviously the fixture.** Crests are trademarked and always
  will be, so the nations ride on brand tokens: England `red`, Argentina `blue`.
  The one split ground in the piece is the fixture itself.
- **Fact-check before you render.** The first cut of this said "21 years" —
  which is what FIFA and half the press were saying, and it's wrong. It's 20
  years 8 months (7,550 days); "21" is calendar subtraction. The colours of the
  three history years track *who actually won* (Argentina, Argentina, England),
  and disputed minutes (Beckham's red is 47' or 48' depending who you ask) are
  simply not on screen. Numbers get screenshot. See the notes in
  `promo/semifinal-vo.mjs` — don't "tidy" them.

Each rides a musical grid so every slam, whoosh and stinger lands on a beat —
that sync is the difference between motion design and a slideshow. Copy is
pulled from the app's real landing/mode strings so the marketing stays true.

**Baked soundtracks** are on purpose here (these are the ads, not daily clips):
original, seeded, license-clean synthesis — you can still mute the original and
drop a trending sound on top in-app. `promo/audio-lib.mjs` holds the shared
synths (kick/sub/bass/pluck/hat/clap/riser/stinger/tick/ding/buzz + a frame→
sample `Mixer`); each promo's `*-audio.mjs` arranges its own track into
`public/promo/<name>.wav`.

Structure lives under `src/promo/`: `kit.tsx` (fonts, brand tokens, shared
motion primitives — `Slam`, `Pop`, `Pill`, `Ground`, `Stripes`, `shake`) is
shared by all of them. Each promo is a folder (`versus/`, `quiztease/`,
`groupchat/`, `onemore/`, `anthem/`, `breaking/`, `wrapped/`, `fantypes/`,
`rematch/`, `remember/`, `license/`) or the root files (`timeline.ts` +
`scenes.tsx` + `BrandPromo.tsx`) with its own scene components +
`timeline.ts`.
To retune a scene, edit its component; to re-time, edit that promo's
`timeline.ts` AND the mirror in its `*-audio.mjs`.

## The Dave Tapes (`npm run dave`) — the live-action lane

Everything above this line is **drawn**: Remotion is the artist, and a promo can
be rebuilt from nothing, forever, byte-identical. These four are **shot**:
Higgsfield (Seedance 2.0) is the camera and Remotion is only the cutting room.

That split is the whole design, and it is not "we got access to an AI tool".
Each side does the one job the other cannot:

| | good at | hopeless at |
|---|---|---|
| **Seedance** | a human face being caught; 16mm grain; a rainy bus stop | the cream/ink lockup, frame-exact type, the same logo twice |
| **Remotion** | the lockup, the beat grid, type that never drifts | a face |

So the format is fixed and it opens with one hard cut:

```
[ AI footage — the hook, the joke, the face ]
   →  [ VERDICT — the ruling, alone on cream ]
   →  [ THE DEMO — one round of the app, played on screen ]
   →  [ TURN + LOCKUP — now it's about you ]
```

No dissolve between the two worlds, ever. **The cut is the punchline**: reality
is where Dave lives, the cream world is where the verdict arrives. It also means
the footage never has to carry brand consistency and the cream act never has to
carry the hook — motion design lost that argument in batch 1's retention data.

The cream act grew from one 3-second card to a ~17.5s three-scene act in batch
2 of this lane, and the reason is a cold-viewer note: the films were landing as
comedy and losing the room at the exact moment the logo appeared, because
nothing on screen ever said what VerveQ *is*. The demo answers that the only
way that doesn't feel like an ad break — a real Daily Quiz round, played out:
question in, options up, 3-2-1 countdown the viewer answers in their head,
reveal. Dave's pick is tagged on the board mid-countdown (`"THE SPECIMEN"`,
`"DAVE, UNDER OATH"`…) and is wrong, so the film's subject walks into the
product shot and loses there too. The turn ("SO WOULD YOU.") moved to *after*
the round on purpose: it's commentary when you've just watched, and a verdict
when you've just played. Films now land ~23–26s — semi-final territory, earned
the same way: more said, not slower saying.

**The demo questions are load-bearing facts.** Same law as the semi-final:
numbers get screenshot, so every question must survive the reply guy. All four
were verified against sources on 2026-07-16 (Messi still 8 Ballons d'Or after
Dembélé took 2025; Brazil out of the 2026 World Cup at the R16, so "5" cannot
change with the July 19 final). Swap a question in `films.ts` and you
re-verify it — "probably right" is not a standard this brand screenshots at.

### Why Dave

He is not a new character. He has been in this repo since batch 2, in **fifteen
promos**: the take ("He's not even top 10 all time. Sorry."), the group chat on
day 6 of crisis, the man with zero evidence, 2/10 in `horror`, the one you lose
to in `rematch`, and the fan licence DENIED — reason: vibes only. In every one
of them he is a name in a vector box, because until now nothing here could shoot
a face. This batch is a casting call six batches overdue: **same man, four
genres, one joke — Dave does not know football as well as Dave thinks.**

| name | genre hijacked | verdict → turn |
|------|----------------|----------------|
| `polygraph` | clinical lie-detector procedural | DAVE FAILED. → SO WOULD YOU. |
| `support-group` | church-hall support group | STILL NOT SORRY. → SETTLE IT PROPERLY. |
| `nature` | wildlife documentary | ZERO EVIDENCE. → SOUND FAMILIAR? |
| `warning` | 1978 public information film | VIBES ONLY. → EARN YOURS. |

**Canon is load-bearing** — a film may dramatise the take / the 2/10 / the
DENIED ruling / the total absence of evidence. A film may not contradict them.

### Rules this lane adds

- **No real players, ever — in any lane.** The no-crests rule already existed;
  this is its live-action extension and it matters far more now the pixels are
  photoreal. Higgsfield rejects a named footballer outright (`ip_detected`), but
  that is not why the rule exists: this brand does not put words in a real
  person's mouth. Everyone on screen is a **fan**. The joke is always aimed at
  the man who *talks* about football, never at anyone who plays it — which is
  also the funnier target.
- **Casting is fixed.** `public/dave/dave-ref.png` is Dave, and every clip
  passes it to Seedance as an image reference so the same man walks through all
  four films and every future batch. Re-cast him and the archive stops being
  about one person.
- **The clips are committed source footage, not build output.** ~45 credits and
  a different take every roll — `public/dave/*.mp4` is checked in for the same
  reason the semi-final VO is: the batch must not depend on a re-roll.
- **Title cards, not subtitles.** See below. This is a correctness rule.

### The envelope — copy follows the measured voice

Seedance sets its own comic timing, and it is not a TikTok timing. You cannot
caption a wish, so you measure the fact:

```
node dave.mjs --envelope polygraph     # peak amplitude per 100ms
```

Find the speech, put those **source seconds** in `cues` in `src/dave/films.ts`;
the segment map re-times them onto the finished cut. Same discipline the
semi-final promo established — copy follows the measured voice, never the other
way round. **Re-roll a clip and you must re-measure.**

**Read the levels, not just the gaps** — the envelope tells you *who* is talking
as well as when, and this is the one mistake in the lane that has already shipped
and been caught by a viewer. In `support-group` a loud close-mic burst at 0.05s
got skimmed as room tone and trimmed off, and Dave's line ("My name's Dave.")
went onto the *room's* reply — so a dozen people said "Hi, Dave" over a card
that said something else. The rule that falls out of it:

- **loud + close-mic = the person in front of the camera.** A group at the back
  of a church hall is quiet even when it's a dozen of them.
- **a unison chorus is one swell**, up and down. A sentence has syllables.
- **a loud burst at the head is probably your subject's first line**, not noise.
  Do not trim it off without checking.
- if two readings fit, crop the mouth out of a frame and look —
  `npx remotion ffmpeg -ss 0.2 -i clip.mp4 -frames:v 1 -vf "crop=460:400:130:280" m.png`.
  One command, and it's decisive.

The envelope is also how the edit gets made. `polygraph` came back with a 2.2s
near-silent open (against a law that says the first 3 seconds decide
everything), and `support-group` with 3.4 seconds of nobody speaking in the
middle and a dead tail. So `segments` in `films.ts` keeps slices and throws the
rest away — a jump cut inside handheld documentary footage is invisible, it's
the native grammar of the form; three seconds of a man saying nothing is not.

**Why title cards and not subtitles:** you can measure exactly *when* Seedance
speaks, but not *what words it chose* without listening. A subtitle claims to be
a transcript. A title card claims to be emphasis — so if the delivery drifts
from the script, the film still reads. A wrong subtitle just reads as broken.
It's also what this library already speaks: twenty promos of kinetic type, zero
subtitles.

### Workflow

```
npm run dave                    # every film that has footage in public/dave/
npm run dave -- polygraph       # one
```

Out to `out/<date>/dave-<name>.mp4` with its caption `.txt` beside it, same as
every other lane. The captions have one job the promo captions don't: **cast the
viewer's mate as Dave.** Every one ends on a tag prompt aimed at a person, not
an opinion — "tag the Dave in your group chat" is an easier action than "what do
you think?", and a tag drags a new viewer in with it.

**Watch each one with sound before posting.** The dialogue was generated, not
recorded. That check is the price of the camera.

Adding a fifth film is a clip plus a row in `FILMS[]` — there is no fifth
folder. Unlike the promo lane (where each piece is a bespoke build), here the
shape *is* the format; what varies is what got pointed at Dave.

**Sound:** the clip's own generated audio is the soundtrack while Dave is on
screen — nothing plays under the footage, that law didn't move. From the cut
onward the promo lane's synthesis takes over (`promo/dave-audio.mjs`, generated
into gitignored `public/promo/`, auto-run by `npm run dave`): impact on the
verdict, ticks on the countdown, the buzz Dave has earned, a stinger on the
lockup — one arrangement, pitched per film to its accent. Seventeen silent
seconds is not deadpan, it's dead. Its grid MUST mirror `ACT2` in
`src/dave/films.ts` — re-time one, re-time both. Music is still never baked in
(same rule as everywhere): add a trending sound in-app.

## Preview / iterate on the template

```
npm run studio
```

opens Remotion Studio (dev preview with a timeline scrubber). The composition
props panel lets you paste any dataset entry to see how it lays out.

Remotion licensing: free for companies up to 3 people — fits VerveQ today;
revisit if the team grows.
