# LADDER-LONG — batch 1 of 2 (2026-08-01)

Four editions rendered, **narrated, complete.** VO generated against the owner's
`FAL_KEY` and cached to `promo/vo-cache-ladderlong/` — renders are offline from
here.

Local-only, like the rest of `tools/content-factory/` (gitignored at repo
`.gitignore:287`). Nothing here is committed.

---

## 1. The conflict that was raised, and how it resolved

The brief's "five questions across 60–90s" forces **12–18s per rung**.
`FACELESS_WINNER_SPEC` measured **5.5–7.02s** per question across 4/4 winners
(pitch.quiz holds 7.02s with ≤8ms drift over six questions). That is a genuine
contradiction, so it was raised rather than silently resolved either way.

It turned out to be narrower than it first looked, because the two studies we
hold measure **different axes** and do not disagree:

| | measures | says |
|---|---|---|
| `RESEARCH_DIGEST` §3/H3 (n=112) | total **length** | comment rate climbs with length; 60–90s = 0.57/1k, 90–120s = 1.04/1k |
| `FACELESS_WINNER_SPEC` (n=4) | **cadence inside** the video | 5.5–7.02s/question, 6–10 questions, 42–73s |

The winners in the second study sit at 42–73s — i.e. **inside H3's 60–90s
band**. Their comment rates (0.88 / 1.22 / 2.15 / **2.71** per 1k) beat that
band's 0.57 median and reach the 90–120s band's rate *at 70s*. So length and
cadence were never the trade-off the brief assumed.

**Owner ruling: 10 rungs at ~7s.** That obeys the measured cadence, lands in the
60–90s band, and unlocks the 10-slot scoreboard (spec #26 — the single strongest
differentiator in that cohort).

Final grid: **9 × 7.00s answered + 1 × 10.00s withheld + 3.00s CTA = 76.00s**
(152 beats @ 120 BPM). Rung 10 runs 1s long on purpose: it carries a spoken
sentence where an answered rung carries only a name.

## 2. Casting table

All forty are S-tier names (casting law). Tier = difficulty of the **path**, not
obscurity of the name. Capped at 7 clubs so a whole path always fits the card —
a *selection* constraint, never a licence to truncate. Zero collisions with the
existing ledger.

| # | tier | all-timers | premier-league | modern | journeymen |
|---|---|---|---|---|---|
| 1 | EASY | Pelé | Declan Rice | Florian Wirtz | Sergio Busquets |
| 2 | EASY | Steven Gerrard | Alexander-Arnold | Lautaro Martínez | Thomas Müller |
| 3 | MEDIUM | Gerard Piqué | Thibaut Courtois | Julián Álvarez | Schweinsteiger |
| 4 | MEDIUM | Toni Kroos | Son Heung-min | Achraf Hakimi | Raphaël Varane |
| 5 | MEDIUM | Marcelo | Frank Lampard | Ousmane Dembélé | Paulo Dybala |
| 6 | HARD | Andriy Shevchenko | N'Golo Kanté | Luis Díaz | Antoine Griezmann |
| 7 | HARD | Mohamed Salah | Kevin De Bruyne | Bruno Fernandes | David Silva |
| 8 | HARD | Andrea Pirlo | Nemanja Vidić | Alexander Isak | Harry Kane |
| 9 | IMPOSSIBLE | Pavel Nedvěd | Emile Heskey | Sadio Mané | Jan Vertonghen |
| **10** | **IMPOSSIBLE** | **Luka Modrić** | **Javier Mascherano** | **Ivan Rakitić** | **Juan Román Riquelme** |

Rung 10 obeys the stricter half of the law — **obscure head so it isn't free, famous
tail so the answer is reachable**. An unguessable withhold is a dead end, not a hook
(the Sušić failure).

- Modrić — Dinamo Zagreb → Zrinjski Mostar → Inter Zaprešić → Dinamo Zagreb → Tottenham → Real Madrid → AC Milan
- Mascherano — River Plate → Corinthians → West Ham → Liverpool → Barcelona → Hebei China Fortune → Estudiantes
- Rakitić — Basel → Schalke 04 → Sevilla → Barcelona → Sevilla → Al-Shabab → Hajduk Split
- Riquelme — Boca Juniors → Barcelona → Villarreal → Boca Juniors → Argentinos Juniors

## 3. VO script

**Voice `Charlie`** (owner pick) — brisk quiz-host, matching the register the spec
measured in the winners (3.40–3.61 syllable onsets/sec). Deliberately not the
semi-final's `Daniel`, whose measured **2.39 words/sec** would blow every slot.

**The carrier is shared across all four editions**, exactly as the winners' is
(spec #13 — 22% of one competitor's track is bit-identical between episodes).
**13 shared lines + 4×9 answers = 48 lines for four videos**, instead of 84.

Shared carrier:

| key | slot | line |
|---|---|---|
| `open` | 5.00s | "Ten career paths. They get harder. How far do you get?" |
| `n2`–`n8` | 2.50s | "Number two." … "Number eight." (`n5` = "Halfway. Number five.") |
| `n9` | 2.50s | "Number nine. Last answer." |
| `n10` | 2.50s | "Number ten. The impossible one." |
| `withhold` | 5.00s | "This one I'm not telling you. Comments, or nowhere." |
| `cta` | 3.00s | "So how far did you actually get?" |

There is no `n1` — `open` *is* rung 1's count-in, because there is no intro card
to say it over (spec #8: no intro beat, ever).

Answer lines (spoken form ≠ on-screen form — the card stamps `SALAH`, the voice
says "Mo Salah"):

- **all-timers** — Pelé. / Gerrard. / Piqué. / Toni Kroos. / Marcelo. / Shevchenko. / Mo Salah. / Pirlo. / Pavel Nedvěd.
- **premier-league** — Declan Rice. / Trent Alexander-Arnold. / Courtois. / Son. / Frank Lampard. / Kanté. / De Bruyne. / Vidić. / Emile Heskey.
- **modern** — Wirtz. / Lautaro. / Julián Álvarez. / Hakimi. / Dembélé. / Luis Díaz. / Bruno Fernandes. / Isak. / Sadio Mané.
- **journeymen** — Busquets. / Thomas Müller. / Schweinsteiger. / Varane. / Dybala. / Griezmann. / David Silva. / Harry Kane. / Vertonghen.

Rung 10's name is **never generated** in any edition.

**The grid leads the voice** — the inverse of `semi-final`, where the timeline was
built backwards from measured delivery. Here the cadence *is* the finding under
test, so the grid is fixed and copy is written to fit. Generation measures every
line against its slot and **throws** on overrun.

That check earned its keep. Three lines were cut at the projection stage
(`open`, `n9`, `withhold`), and on the real take the throw caught two more:

| line | measured | slot | fix |
|---|---|---|---|
| `n10` "Number ten. The impossible one." | 2.56s | 2.50s | → "Number ten. Good luck." (1.84s). The tier pill already says IMPOSSIBLE, so the voice spends its beat on stakes instead of repeating the card. |
| `all-timers-a2` "Gerrard." | **2.32s** | 2.00s | → "Steven Gerrard." (1.36s). Charlie draws a lone surname out; the full name reads *faster* and matches the rest of the edition. |

Two regenerated lines, everything else served from cache. Final: **48/48 fit, zero
overruns.**

Charlie measured **1.72 words/sec** across 59.2s of speech — *slower* than
Daniel's 2.39, which is a per-line artefact, not register: most lines here are
one to three words, where onset and release dominate. The lesson is that a
word-rate projection is not a substitute for measuring the take, which is why
the check runs on generated audio rather than on the script.

## 4. Withheld elements

- **Rung 10's answer** — never drawn on the card, never written into the rail,
  never spoken, absent from every caption. Verified by grep across all four
  captions: zero hits for Modrić / Mascherano / Rakitić / Riquelme.
- The rail slot stays `?????` through the closing card. The SFX bed gives rung 10
  a riser and an impact but **no ding** — every answered rung resolves a step
  higher, and the absence of that resolution is audible.
- Captions print the withheld **club path verbatim** so the question is
  answerable, and stack both comment engines: the terminal withhold (spec #23a,
  pitch.quiz's mechanic, 232,932 views) and the score ask (spec #23b/#24,
  gugum's, best comment rate in the cohort).

## 4b. VO placement, verified

"The level went up" is not proof the voice landed where it should. Each render's
audio was differenced against its own pure SFX bed (`public/promo/ladderlong-<slug>.wav`)
at 100ms resolution; energy present in the render but absent from the bed is the
voice, and it must appear at each of the 21 cue frames.

**21/21 cues carry voice energy, on frame**, for every edition — `open` at 0.00s,
each count-in at its rung boundary, each answer at +5.00s into its rung,
`withhold` at 68.00s, `cta` at 73.00s.

## 5. Ledger + render paths

**40 ids spent**, `ledger.json` 52 → 92, all dated `2026-08-01`, zero collisions.
Ids are parsed out of `timeline.ts` so the ledger cannot drift from what rendered.

```
out/2026-08-01/verveq-ladder-long-all-timers.mp4       76.05s  5.80 MB  (+ .txt)
out/2026-08-01/verveq-ladder-long-premier-league.mp4   76.05s  6.00 MB  (+ .txt)
out/2026-08-01/verveq-ladder-long-modern.mp4           76.05s  5.84 MB  (+ .txt)
out/2026-08-01/verveq-ladder-long-journeymen.mp4       76.05s  5.92 MB  (+ .txt)
```

All 1080×1920, 30fps, AAC. SFX bed mean −28.5 to −29.2 dB, peak −5.7 to −6.0 dB.

## 6. VO state — done, cached, offline from here

48 lines generated against ElevenLabs v3 (`Charlie`) via fal.ai and cached to
`promo/vo-cache-ladderlong/` + mirrored to `public/promo/vo-ll/`. **A fresh clone
with no API key now renders all four editions with voice**, same as the
semi-final.

Regenerating is a deliberate act:

```
FAL_KEY=… node promo/ladderlong-vo.mjs --force
```

Changing the `VOICE` string re-voices the whole batch. Changing a single line's
text regenerates only that line — the manifest keys on the text, so the other 47
are served from cache at no cost.

The silent-render path still exists (a clone with neither key nor cache renders
SFX-only behind a loud warning) — that is a proofing affordance, not the shipping
state. These four have voice.

## 7. Two divergences NOT resolved silently

**(a) No player imagery — standing rule held, at a measured cost.**
Spec #20 found 4/4 winners use real subject imagery at the reveal (player
cutouts, crests, flags). The standing rule ("no real players/likenesses, no
crests") holds per the brief, so answers land as brand-type on a lime chip
instead. This is the one spec property this batch deliberately does not carry.
The compensating move is spec #19 (high-contrast label on a chip), which we do
carry. Flagging it so the A/B is read knowing it.

**(b) Do NOT add a trending sound in-app to these four.**
The README's daily workflow says to add one. That is right for silent quiz
clips and wrong here: spec #11 found 4/4 winners on original audio with no
trending sound (`music_info: null`, `is_trending_in_clips: false`), and a song
over a VO fights the voice this format is paced by. Post these with their own
audio.

## 8. Batch 2

Four more editions after the first performance read, per the brief. The casting
pool is deep — 184 unspent `easy`-difficulty paths remained before this batch
took 40, plus 22 S-tier names in the `medium` band. Adding an edition is a table
entry in `src/promo/ladderlong/timeline.ts` and nine answer lines in
`promo/ladderlong-vo.mjs`; the shared carrier is already generated and does not
need re-voicing.
