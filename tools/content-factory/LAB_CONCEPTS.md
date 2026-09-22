# LAB — three new attention formats (2026-09-03, LOCAL ONLY)

Owner brief: *"I need new concepts, not ladders. Something that steals attention for
the whole runtime and that people feel engaged in. Two or three finished reels so I
can see what we go with. Nothing gets pushed."*

Nothing here is committed, posted, or registered in the shared `src/Root.tsx`. The
lane has its own Remotion root (`src/lab/index.ts`), its own renderer, its own gate.

```
node lab/render.mjs                      # all three → out/<date>/lab/
node lab/render.mjs lab-older            # one
node lab/verify.mjs <date> [slug…]       # re-run the gate alone
```

## Why these three, and why not another ladder

What the research actually measured (`research/ig-competitor-sweep/FACELESS_WINNER_SPEC.md`,
`research/fantasy/RESEARCH_DIGEST.md` §3):

- The winners keep the **structure** — whole game visible at frame 0, a metronomic
  clock, 6–10 beats, 42–73s, a persistent scoreboard, one comment ask — and win or
  lose on the **mechanic**: *"guess the shape / the path"* (infer from an indirect
  trace) beats *"guess the flag / the logo"* (direct recall). A format outlier did
  **75×** its own account's median. Format beats account.
- Our whole retention lane has been one mechanic (a path → a name) worn five ways.
  The audience has learned it; the numbers say it is fading. So the three below keep
  the proven skeleton and each changes **what the viewer is doing** for the runtime.

None of them is a product reel (standalone promo is retired, `docs/DECISIONS.md`
2026-08-14). The brand is the payoff frame, never the subject.

| slug | mechanic | what the viewer is doing for the whole runtime | resolves? | the one ask | length |
|---|---|---|---|---|---|
| `lab-guesswho` | **deduction board** — 9 names, 6 yes/no questions, tiles flip out | deducing; the board shrinks in front of them 9→7→5→4→3→2 | to a **pair** — the sixth flip is withheld | "which one is he?" (one name) | 50.0s |
| `lab-older` | **streak duel** — 10 head-to-heads, who's older, gap shrinks every round | making a binary call every 6s and defending a streak | yes, all ten, with both birth dates | "your streak?" (one number) | 65.0s |
| `lab-xi` | **inference build** — 11 plates fill a pitch, one club connects them all | searching for the connection as the evidence accumulates | yes — the club stamps the pitch | "which name gave it away?" (one name) | 54.0s |

Three different ask shapes on purpose: terminal withhold (pitch.quiz's 232K shape),
score ask (gugum's 193K shape, the best comment rate in that cohort), and a
self-report the reveal cannot answer. If they post, the asks are readable apart.

## The facts are gated, not typed

Every on-screen fact is computed from a source by a script that throws, and the
compositions import only the generated `facts.json`:

- **`lab/guesswho-facts.mjs`** — every YES/NO and every elimination is evaluated
  against `app/convex/data/football_career_paths.json` (club + country predicates
  over the WHOLE path; an unclassified club on any board path throws) and THE
  DRAW's Wikidata-sourced cards (nationality). Asserts the board reduces to exactly
  two before the withheld question and that the withheld question singles out the
  secret. The secret's name is never written into the composition.
- **`lab/older-facts.mjs`** — birth dates are Wikidata P569 at **day precision**,
  resolved once into `lab/older-dob-cache.json` with the QID and a resolvable ref
  per player. Ordering and gap are computed. Asserts the gap shrinks strictly every
  round (17 years → 6 → 6 → 2 → 11 months → 8 → 7 → 3 → 3 weeks → **9 days**).
  `--check` re-asserts offline before every render.
- **`lab/xi-facts.mjs`** — asserts all eleven paths carry the club AND that no
  second club is shared by all eleven, so "one club connects them all" is a true
  sentence. Positions from the DRAW cards / player metadata; the 4-3-3 slot is
  editorial.

No ledger spend: no career path is ever shown, so no `cp-*` id is consumed (the
`chain` precedent).

## Standing laws honoured

- **No crests, no likenesses, brand type only.** Names in Space Grotesk, chrome in
  JetBrains Mono. THE XI draws a pitch, not a badge.
- **Safe zone + centered stage** (CF-SAFEZONE, CF-FIVE's Middle law): every
  composition lives in y 340–1580 inside `SafeArea`. Because this lane runs cream,
  ink AND green grounds, the gate checks the chrome strips for **uniformity**
  (≥99.5% of a strip within ±28 luma of its median) rather than an absolute YMAX.
- **Motion at frame 0, no intro card** (spec #8): the gate diffs frame 0 against
  frame 15 and fails under 0.2% changed pixels.
- **Original audio, no VO, no music baked.** The clock and the stings pace the
  piece (pitch.quiz, the biggest number in the faceless cohort, has no voice).
  A trending sound can go on top in-app. Adding Charlie later is a `reels-vo`-shaped
  job, not a rebuild — but it needs a FAL key, which is not on this machine.
- **Brand bug pinned top-left the whole runtime** (spec #17); the state readout
  (round / survivors / clues) pinned top-right.

## Casting notes

- **Guess Who** — secret Ibrahimović; board Messi · Henry · Ronaldo · Eto'o ·
  Ibrahimović · Beckham · Suárez · Zidane · Fàbregas. Q5 is the surprise beat
  ("PLAYED IN THE USA? — YES") that drops Fàbregas and leaves two men most people
  forgot both went to MLS. Q6 ("PLAYED FOR AC MILAN?") is answered YES on screen
  and NOT applied: Henry never did, so the last cut is reachable knowledge, not a
  coin flip (the ladder law: an unguessable withhold is a dead end).
- **Who's Older** — R7 (Modrić v Ronaldo, Ronaldo older by 7 months) is the round
  the caption bets on; R10 (Haaland v Vinícius, **nine days**) is the payoff and
  is resolved because that number is the whole point.
- **The XI** — Inter, in the order people forget: Bergkamp, Roberto Carlos, Pirlo,
  Seedorf, Coutinho, Onana, Hakimi, Maicon, Sneijder, Ronaldo Nazário, Zanetti.

## Editions

Each format is an edition machine: a new Guess Who is a new `SECRET` + `BOARD` +
`QUESTIONS` (the gate rejects a board that doesn't reduce cleanly); a new Who's
Older is ten pairs (the gate rejects a non-shrinking gap); a new XI is a club and
eleven names (the gate rejects a non-unique connection). Read at n=2–3 against the
560–2.5K band plus comments/1000, per the lane law.
