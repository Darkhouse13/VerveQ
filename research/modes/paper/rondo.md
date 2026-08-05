# CANDIDATE — `rondo`

> **PROVISIONAL. OWNER RATIFICATION REQUIRED before any adapter is written.**

## Axis

**Tactical reading** — spatial judgment, no names required.

This is the tactical candidate that clears G3. Its sibling `freeze-frame.md`
attempts the same axis with real match data and is **GATE-FAIL (G3)**. That
pairing is itself the finding: under the repo's current sourcing policy, the
only tactical mode that can be built today is the one that asserts no football
facts at all.

## Loop (3 sentences)

A pitch fragment renders as moving dots — your side, their side, the ball, no
names, no numbers, no kits — and freezes at the instant you receive it. Three
or four candidate actions are drawn on the pitch as arrows, and you have a
visibly shrinking window to pick one. The chosen action plays forward under a
deterministic physics-and-pressure model, either surviving into the next
fragment or losing possession, and a run is a chain of these until you lose it.

Skill is reading space, pressure and passing lanes under time pressure. There
is no football knowledge to have — nobody in the simulation is anyone.

## Heartbeat G2 — **THE FREEZE**

*One named moment: the shrinking window on the ball.*

The instant the ball reaches your dot, everything stops except a ring closing
around your player. Arrows are live. When the ring closes, the safest available
option is taken *for* you — so hesitating is not neutral, it is a decision to
play it safe, and the safe option is worth measurably less.

The tension is structurally distinct from BANK/PUSH: DRAW's clock is untimed
and deliberative, while THE FREEZE is a real-time squeeze. That makes it the
best contrast partner to the flagship in the whole set — different faculty,
different tempo — and also the riskiest on accessibility, since real-time
pressure excludes some players that a turn-based daily does not.

## Content G3 — data needed + source

**No football facts are needed, asserted, or used. G3 passes vacuously.**

The mode requires:

| Datum | Source |
| --- | --- |
| Pitch geometry, player positions, velocities | **procedurally generated** from the daily seed |
| Pressure/interception model | **authored model constants**, tuned in the sim harness |
| "Correct" action valuation | **the model's own forward simulation**, not a claim about real football |

This is the same posture as DRAW decision 9 (synthetic-only card contents) and
it is what makes the candidate cheap. Critically, the game never says *this is
what a real player should do* — it says *this is what happens in this
simulation*, which is a claim it can fully back.

**The honest cost of that.** Because the answer model is authored rather than
observed, its credibility is entirely on us. A tactically literate player who
disagrees with the model has no source to be corrected by, and "the game is
wrong about football" is an unanswerable complaint when there is no external
truth. Tuning the model until its judgments are *defensible* is the real work
here, and it is priced in the build score below rather than waved past.

## Uncertainty source

**Hidden opponent reactions.** Defender dots have reaction policies that are
not shown and that resolve after you commit. You can read positions and
velocities — you cannot read intent. Seeded from `(dailySeed, fragmentIndex)`
globally, per DRAW decision 3, so a fragment plays identically for everyone.

Secondary uncertainty: execution noise on the chosen action, scaled by how
tight the option was — a difficult pass is not guaranteed.

## Session shape

**endless** (primary) — chain fragments until possession is lost, score is
chain length and action quality. **daily** (secondary) — a fixed five-fragment
shared-seed sequence for the leaderboard.

## Scores — PROVISIONAL

Prior-art score status: **SWEPT 2026-07-26.**

| Criterion | Weight | Raw | Weighted | One-line justification |
| --- | --- | --- | --- | --- |
| Adrenaline | ×3 | 3 | 9 | The closing ring is a genuine real-time squeeze and the only twitch tension in the set, but each individual call is shallow and the spike does not compound across a run. |
| Shareable artifact | ×3 | 3 | 9 | A traced decision path over a pitch is visually distinctive and screenshot-friendly, but it resists compression into the postable text/emoji form that travels furthest. |
| Daily refresh w/o burn | ×2 | 5 | 10 | Fragments are generated from seed, so there is no content pool to exhaust ever. |
| Content cost (inv.) | ×2 | 5 | 10 | Zero football facts and therefore zero fetch, zero source approval, zero provenance surface. |
| Build cost (inv.) | ×2 | 3 | 6 | Pitch rendering and motion are routine, but the defensible action-valuation model is genuine new work with no existing repo precedent to lean on. |
| Prior-art headroom | ×2 | 5 | 10 | The sweep found this space occupied only by academic work (pass-selection MPNN models, freeze-frame shot game theory) and B2B coaching tools like DrawTactics — no consumer daily tactical-decision puzzle surfaced. |
| Social fit | ×1 | 3 | 3 | Shared-seed leaderboards work cleanly and a same-fragment duel is natural, but there is no interaction between opponents. |
| **TOTAL** | | | **57 / 75** | |

## Risk lines

1. **Authored truth.** See G3. The model is the referee and the model is ours.
   This is the deepest risk in the candidate and it does not go away with
   tuning — it only gets smaller.
2. **Real-time excludes.** A shrinking window is hostile to players on poor
   connections, on small screens, and with motor or attention differences. The
   rest of the platform is turn-based and forgiving. A no-timer variant should
   be specced before this is ratified.
3. **"Where are the players?"** A football audience arriving at nameless dots
   may bounce before understanding that anonymity is the point. This is the
   same identity/appeal tension as `tiebreak`, one notch less severe because at
   least the pitch is legible.
