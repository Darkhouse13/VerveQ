# CANDIDATE — `lock-eleven`

> **PROVISIONAL. OWNER RATIFICATION REQUIRED before any adapter is written.**

## Axis

**Deduction** — constraint-narrowing to a hidden answer.

## Loop (3 sentences)

A hidden XI has been drawn from a visible pool of ~40 players whose attributes
are all printed on screen, so nothing is hidden except *which eleven*. You
submit probe elevens; each probe returns only counts — how many of your eleven
are in the hidden set, and how many sit in the right slot — and every probe
costs you score. At any point you stop probing and LOCK, and you are scored on
being right and on how few probes it took.

The crucial design property: **the attribute table is fully visible**. You are
never asked to recall who played where. You are asked to run a constraint
search efficiently, which is a structural skill. A player who has never watched
football and knows how to bisect a hypothesis space will beat a lifelong fan
who probes carelessly.

## Heartbeat G2 — **THE LOCK**

*One named moment: the irreversible commit.*

The LOCK button is always live from probe one. Its cost curve is shown as a
falling number beside it — lock now for a big multiplier on an eleven you are
not sure about, or spend one more probe and watch the multiplier drop.

This is the direct structural analogue of DRAW's BANK/PUSH, and that is the
point: it is the *same heartbeat in a different faculty*. In DRAW you are
deciding whether your squad is good enough to survive another fixture. Here you
are deciding whether your belief is confident enough to survive being checked.
Both are "is what I have now worth more than what one more round might give
me," and the app already knows how to make that feel good.

## Content G3 — data needed + source

| Datum | Source | Status in repo |
| --- | --- | --- |
| Player identity + name | Wikidata `qid` | **present** — `app/convex/data/playersSourced.json` (1314 entries) |
| Nation | Wikidata `P54` | **present** (`facts.nation`, sourceQuality green) |
| Position | Wikidata `P413` | **present** (`facts.position`, sourceQuality amber) |
| Debut year / era band | Wikidata `P54`/`P580` | **present** (`facts.debutYear`, green) |
| Clubs | Wikidata `P54` | **present** (`facts.clubs[]`, green) |

**This candidate needs no new content fetch of any kind.** The attribute table
it requires is exactly the table `playersSourced.json` already ships, with the
provenance envelope already attached. It is the cheapest real-content candidate
in the set by a wide margin.

The one caveat worth stating: `position` carries `sourceQuality: "amber"` in
the existing data. Since positions are *printed on screen* rather than asked
about, an amber position is a cosmetic inaccuracy rather than a wrong-answer
bug — the puzzle's truth is the hidden set, not the attribute. That is a
materially softer exposure than a trivia mode would have.

## Uncertainty source

**Incomplete information that shrinks monotonically under your own probing.**
The hidden set is fixed at seed time; all uncertainty is epistemic and every
probe is a real, permanent reduction of it. There is no luck in resolution
whatsoever — two players who probe identically get identical information.

Difficulty is tuned by pool size, by how much attribute structure correlates
with the hidden set, and by the probe-cost curve.

## Session shape

**daily** (primary) — one hidden XI per day, shared seed, probe count is the
leaderboard. **duel** (secondary) — same hidden XI, fewer probes wins.

## Scores — PROVISIONAL

Prior-art score status: **SWEPT 2026-07-26.**

| Criterion | Weight | Raw | Weighted | One-line justification |
| --- | --- | --- | --- | --- |
| Adrenaline | ×3 | 4 | 12 | THE LOCK is an all-or-nothing commitment on a falling multiplier, which is the app's proven tension shape, though the probing between locks is cerebral rather than hot. |
| Shareable artifact | ×3 | 4 | 12 | "Locked in 4 🔒" plus a feedback-count grid is the Wordle-native shape whose shareability is already empirically proven at scale. |
| Daily refresh w/o burn | ×2 | 5 | 10 | The hidden set is a combinatorial choice from the pool, so the puzzle space is effectively infinite even at a fixed pool of 1314 players. |
| Content cost (inv.) | ×2 | 5 | 10 | Requires exactly the sourced attribute table already committed at `app/convex/data/playersSourced.json` — no new fetch, no new source approval. |
| Build cost (inv.) | ×2 | 4 | 8 | Feedback engine is trivial; the real work is a solvability checker and difficulty tuner so a daily is never unfair or degenerate. |
| Prior-art headroom | ×2 | 2 | 4 | Attribute-feedback football deduction is the single most colonised genre found in the sweep — Futboldle, Footle, footbadle, Sportdle, gridsport and FootballGenius all ship it daily — though all guess *one* player rather than a set with counts. |
| Social fit | ×1 | 4 | 4 | Shared seed plus a probe-count leaderboard is directly Wordle-shaped, and the race-to-lock duel is natural. |
| **TOTAL** | | | **60 / 75** | |

## Risk lines

1. **Genre saturation.** The sweep is unambiguous: this is the most crowded
   space in football gaming. The set-with-counts mechanic is genuinely
   different from one-player-with-clue-colours, but the *first impression* will
   read as "another Wordle clone," and first impressions decide installs.
2. **Cerebral, not visceral.** Between locks this is a logic puzzle. It will
   under-index on adrenaline relative to DRAW and will attract a different,
   quieter audience.
3. **Degenerate probes.** Without a solvability checker, some seeds will be
   guessable in two probes and others unsolvable in ten. The build score
   already prices this, but it is the specific thing that would sink a rushed
   version.
