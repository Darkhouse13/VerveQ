# CANDIDATE — `congestion`

> **PROVISIONAL. OWNER RATIFICATION REQUIRED before any adapter is written.**

## Axis

**Allocation** — scarcity under a cap. The scarce resource is **minutes**.

Distinct from `tiebreak`, the other Allocation candidate: `tiebreak` allocates
against an opponent in one simultaneous shot with no state, while `congestion`
allocates against a schedule over time with carry-over state (fatigue), so the
cost of spending is felt three fixtures later rather than immediately.

## Loop (3 sentences)

You inherit a squad of eighteen with visible stamina pools and a compressed
fourteen-fixture run spanning a league, a cup, and a European tie. Before each
fixture you pick eleven, and every minute played drains a pool that refills
slowly, so a player used on Wednesday is worse on Saturday. You are chasing
three separate objectives at once — league position, cup progress, European
survival — with one squad that cannot serve all three.

Nothing here requires knowing a real player. Ratings and stamina are printed on
the card; the skill is scheduling under a renewable-resource constraint, which
is a structural problem a logistics-minded newcomer solves better than a
knowledgeable fan playing on vibes.

## Heartbeat G2 — **THE ROTATION CALL**

*One named moment: the cup tie before the derby.*

Fixture 9 is a winnable cup tie. Fixture 10, four days later, is the league
match that decides your season. Your six best players are all amber on stamina
and the screen shows both fixtures side by side with their objective weights.

You commit an eleven for the cup tie knowing you cannot un-spend those minutes.
Rest them and you likely exit the cup; play them and you walk into the derby
with a drained spine.

It is a genuine heartbeat — irreversible, under uncertainty, with a visible
opportunity cost — and it is the single most authentically football decision in
the entire candidate set. Its weakness relative to BANK/PUSH is that the
consequence arrives *four days of game time later*, so the moment of commitment
and the moment of pain are separated by other decisions that muddy the
attribution. You rarely get the clean "that call cost me" that DRAW's bust
delivers instantly.

## Content G3 — data needed + source

| Datum | Source | Status |
| --- | --- | --- |
| Squad of 18 with ratings + stamina | **synthetic**, generated from seed | precedent: DRAW decision 9 (`app/src/lib/drawEngine/DECISIONS.md`) |
| Fixture schedule shape (congestion pattern) | **synthetic**, generated from seed | n/a |
| Optional real club/competition names for flavour | existing curated `sportsTeams` layer | present in repo |
| Fatigue / recovery model | **authored constants**, tuned in the sim harness | n/a |

**No football facts are asserted.** The game claims that *this synthetic player*
has *this stamina*, which is a claim about its own simulation. If real club
names are used as flavour, they are identification only, matching the existing
repo precedent for brand marks noted in `docs/CIE_SOURCING_POLICY.md` §2.

G3 passes cleanly and cheaply. The content bill is a generator, not a fetch.

## Uncertainty source

**Hidden match variance conditioned on visible fitness.** You know each
player's stamina and rating; you do not know how the fixture resolves. A
drained eleven usually loses but sometimes does not, so rotation is a
probability judgment rather than an arithmetic one.

Secondary uncertainty: **injuries**, drawn with probability rising as stamina
falls. This is what makes over-playing a spine genuinely dangerous rather than
merely suboptimal, and it is the mechanism that gives THE ROTATION CALL teeth.

Seeded globally from `(dailySeed, fixtureIndex)` per DRAW decision 3.

## Session shape

**daily** (nominal) — one compressed season per day, shared seed. In practice
fourteen fixtures with an eleven-man selection each is a **long** session,
which is the candidate's central structural problem and is reflected in the
scores below.

## Scores — PROVISIONAL

Prior-art score status: **SWEPT 2026-07-26.**

| Criterion | Weight | Raw | Weighted | One-line justification |
| --- | --- | --- | --- | --- |
| Adrenaline | ×3 | 2 | 6 | THE ROTATION CALL is a real decision but its consequence lands days of game time later, so the session is a slow burn of accumulating regret rather than a spike. |
| Shareable artifact | ×3 | 2 | 6 | The natural output is a final league table and three objective outcomes — dense, requires reading, and does not compress into anything glanceable. |
| Daily refresh w/o burn | ×2 | 5 | 10 | Squads and schedules are generated from seed, so there is no finite pool to exhaust. |
| Content cost (inv.) | ×2 | 4 | 8 | A generator plus a tuned fatigue model, with no external fetch — cheap, though the model still needs real tuning work in the harness. |
| Build cost (inv.) | ×2 | 2 | 4 | A season simulator, fatigue and injury systems, three parallel objective tracks, and a fixture-list UI dense enough to plan against — several subsystems, none existing. |
| Prior-art headroom | ×2 | 4 | 8 | Rotation and fatigue are core to Football Manager and Top Eleven, but those are long-form management products and the sweep surfaced no daily shared-seed rotation puzzle at all. |
| Social fit | ×1 | 2 | 2 | Same-seed season comparison works, but a session this long is a poor fit for the async duel cadence the platform is built around. |
| **TOTAL** | | | **44 / 75** | |

## Risk lines

1. **Session length is the whole problem.** Fourteen fixtures × an eleven-man
   selection is a twenty-minute session competing against a platform of
   three-minute ones. Compressing to six fixtures would fix the cadence and
   would also gut the fatigue mechanic, which needs time to bite. This tension
   may not be resolvable.
2. **Selection UI is heavier than the game.** Picking eleven from eighteen,
   fourteen times, is a lot of tapping for one decision's worth of thought.
3. **Manager-sim shadow.** Players who have played Football Manager will judge
   the fatigue model against a twenty-year-old benchmark and find it shallow.
