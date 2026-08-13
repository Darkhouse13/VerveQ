# FW-PR1 — Proxy method (Phase A)

**What the proxy is:** a per-player *ranking signal* in expected v0.5.1 points
per 90 minutes, computed from 2025-26 season aggregates. It is **not** a score
and never will be one — season aggregates cannot reproduce per-match scoring
exactly, and every place they fall short is listed below rather than papered
over.

**Data:** `data/player-aggregates-2025-26.json` (top-five league pages, 284
calls), `data/promoted-backfill-2025-26.json` + `data/team-stats-extra-2025-26.json`
(owner-ruled backfill, 367 calls), `data/team-stats-2025-26.json` (96 clubs).
All raw, with manifests; `data/` stays out of git per repo convention.

## Constants by construction (owner-approved)

`scoring/scoring.ts` keeps its constants module-private and is read-only for
this ticket, so `proxy.ts` never copies a number from it. Instead:

1. **The engine is driven, not imitated.** Each player's season totals are
   scaled to a synthetic 90-minute stat line (`×90/minutes`) and scored by the
   exported v0.5.1 `scorePlayer` in his feed position, starter role, neutral
   context, crowd 0. Whatever the engine says that line is worth per 90 *is*
   the template-and-events part of the proxy.
2. **Context values are recovered by controlled diffs.** A bare 90-minute line
   is scored under contexts differing in exactly one fact; the diff is the
   engine's value for that fact. Neutral base is loss/GA=1 (no result points,
   no clean sheet, concession penalty floor(1/2)=0). Probes recovered, per
   position (GK/DEF/MID/ATT): clean sheet 5/4/1/0, win 1 all, draw 0.5 all,
   concession −1 per 2 conceded for GK and DEF only — exactly the v0.5.1
   values, read out of the engine at run time. A spec change to any of them
   flows into the proxy with zero edits here.

## Approximations (a ranking signal, declared)

1. **Caps bind on per-90 rates, not per-match counts.** A season of 6 saves
   every match and a season alternating 12/0 both average 6; the real engine
   caps the second harder. Aggregates cannot see the difference.
2. **Ramps evaluate at season-average rates** (duel dominance, pass
   completion). A player straddling a ramp floor match-to-match earns ramp
   points the average hides or overstates (Jensen's inequality). Qualifying
   volumes translate per 90: duels ≥ 6 per 90, passes ≥ 40 per 90.
3. **`passes.accuracy` is a percentage in season aggregates** (measured:
   values 76–91 against pass totals in the thousands — Van Dijk 89 on 2,787),
   unlike the per-fixture endpoint where it is an accurate-pass *count*
   (fetch/config.ts probe). Accurate passes are reconstructed per entry as
   `total × accuracy/100`, then summed.
4. **Clean sheets, concessions and team result come from club season figures**
   — the aggregate row's `goals.conceded` is keeper-only, and no result split
   exists (same feed limits as scoring G2). Expectation terms: club rates are
   minutes-weighted across the clubs the player actually played for in
   2025-26 (transfers weighted by where the minutes were). Declared
   assumption: attribution by minutes share, which in per-90 space reduces
   exactly to the club's per-match rates (share = min/clubMin ⇒ attributed
   per-90 = club per-match rate). Relegated 2025-26 clubs were pulled
   separately so no scored minute lacks club figures (verified: 0-minute gap).
5. **Concession penalty is linearized:** E[floor(GA/2)] ≈ GA-rate/2. Slightly
   over-penalizes vs the true floor; identical treatment for every player.
6. **Appearance is +1 flat** on the synthetic match — the engine's P1 line,
   not scaled per 90. Uniform across all players.
7. **Own goals are absent** from season aggregates at any tier; omitted
   (rare, −3, no material rank effect).
8. **Finisher mechanics are out of scope** (decisive-moment multiplier, entry
   filters), as are the mismatch dampener and crowd factor — all context
   mechanics, not player-quality signal. Everyone is proxied as a starter in
   his verdict position.
9. **League rows only** — cups and other competitions are excluded,
   symmetrically for both pools (the top-five pull is league-filtered by the
   endpoint; the backfill is filtered to second-division league ids).
10. **Second yellows and straight reds merge** (`red + yellowred`), both −4 in
    the spec.

## Shrinkage

`weight = min(minutes/900, 1)`; `proxy = weight × raw + (1 − weight) ×
position median of the player's own pool`. Nobody is excluded for low
minutes; a 90-minute wonder is pulled toward mid-position rather than ranked
on one match. 900' ≈ 10 full matches.

## Pools (owner ruling 2026-07-29, modified option C)

Membership is decided by DATA, not club list, and the three pools partition
the 2,895-player universe exactly (asserted at run time — this replaces the
original 90% join gate, which assumed a same-season universe):

| Pool | Definition | Count |
| --- | --- | --- |
| `topfive` | > 0 minutes in leagues 39/140/135/78/61 in 2025-26 | 1,903 |
| `promoted` | no top-five minutes, at one of the 13 promoted clubs, > 0 second-division minutes (leagues 40/141/136/79/62) | 257 |
| flagged | everyone else — no usable 2025-26 league minutes | 735 |

**The promoted pool is COHORT-INTERNAL signal only.** Second-division points
per 90 are not comparable to top-five points per 90, and no cross-league
discount factor exists or may be invented (ruling). Promoted players are
ranked strictly against each other; their shrinkage median is their own
pool's.

**Pricing rule for the promoted cohort (ruling, Phase C):** priced within a
**4.0–6.5 band**, ordered by cohort-internal proxy rank. Any exception above
6.5 is an owner-named editorial override in Phase B, never automatic.

**Flagged players** carry no proxy and default to the **4.0 floor**. They are
listed in FLAGS.md grouped by club for the owner's editorial pass.

## Anchor design → direct value pricing (owner rulings FW-PR1b, FW-PR1c)

FW-PR1b first replaced uniform anchor points with per-position points
(ceilings from proxy maxima rounded to the 0.5 scale: MID 13.0 / ATT 12.5 /
DEF 9.0 / GK 6.0, the GK grid compressed to 5 anchors over its 2.26–5.75
band). FW-PR1c then **retired quantile-anchor slotting entirely**: slotting
by evenly spaced rank quantiles ties price to *rank*, not to *expected
points*, so wherever the proxy distribution is non-uniform the two decouple —
measured at the MID 11.5 anchor slot, which carried a 7.41 proxy against a
13.33 position maximum because the elite tail is thin. Direct mapping keeps
the FW-PR1b ceilings and makes price a function of the proxy itself:

```
price = roundHalfUpTo0.5( clamp(proxy, 4.0, ceiling[pos]) )
ceilings: MID 13.0 / ATT 12.5 / DEF 9.0 / GK 6.0
```

Applied per pool: **topfive** by the formula above; **promoted** by the
4.0–6.5 band ordered by cohort-internal per-position rank
(`price = min(6.5 − 0.5 × round(5 × (rank−1)/(N−1)), ceiling[pos])` — the
ceiling term binds only for GK, whose 6.0 ceiling sits below the band top);
**flagged** at the 4.0 floor. Full list: `price-draft.json`, asserted for
partition coverage, scale/range, and price-monotonicity in proxy within
every pool+position.

**Phase C is superseded accordingly:** with no anchors there is no
interpolation step. Remaining Phase C work is seeding the prices plus
applying `overrides.json` last (unchanged contract — overrides always win).

## Owner price overrides (Phase B mechanism)

`pricing/overrides.json` — committed, initially empty. Phase B rulings attach
per-name prices there; **Phase C must apply it last**, after interpolation,
so an override always wins. Shape:

```json
{
  "version": 1,
  "overrides": {
    "<apiFootballId>": { "price": 7.0, "reason": "owner ruling text", "date": "YYYY-MM-DD" }
  }
}
```

Any flagged or promoted player (or anyone else) may appear here; prices must
sit on the 4.0–13.0 half-point scale. proxy.ts and the artifacts do not read
it — it is a Phase C input.

## Phase C — done (FW-PR2, 2026-07-29)

25 Phase B rulings landed in `overrides.json` (ids resolved from
`price-draft.json` by exact name+club; each entry carries the name and club it
was resolved against, and `price-final.ts` re-checks them). `price-final.ts`
applies the file last and writes `price-final.json` — 2,895 rows, partition
unchanged, exactly 25 rows differing from the draft and that set identical to
the override set.

**What an override is exempt from (owner ruling FW-PR2).** An override binds
only to the global 4.0–13.0 half-step scale. Post-override output is exempt
from the per-position ceilings and from monotonicity in proxy — Lamine Yamal is
priced 13.0 against an ATT ceiling of 12.5 and that is intended. Both gates
still run in `price-draft.ts` against the pre-override draft, unchanged, which
is the only place they describe a rule rather than contradict one.

Prices are seeded to DEV (`admired-warthog-495`) by
`app/convex/fantasyIngest.applyPrices`, driven by
`app/scripts/seedFantasyPrices.ts`; a patch of one field, never a table
replace, because `fantasySquadSlots.playerId` references these rows. Verified
by re-export against the pre-seed snapshot: 2,895 non-null prices matching the
file, zero diffs in any other field. Costing the result for the budget decision
is `pricing/BUDGET_ANALYSIS.md`; the budget number itself remains open
(BUDGET_MODE open item 1).

---

# FW-REPRICE — availability (2026-08-13)

Everything above describes how a player's points-per-90 is estimated, and
that part is unchanged: the engine is still driven rather than imitated, the
expectation terms still come from club figures weighted by where the minutes
were, and every approximation listed under "Approximations" still holds.

What changed is what happens to that number afterwards.

## The defect

Price was `roundHalfUp(clamp(proxy, 4.0, ceiling))` for the top five and a
rank-quantile band for each cohort, where `proxy` was the SHRUNKEN per-90.
Two faults compounded:

1. **Nothing asked whether the player plays.** Points per minute is a rate.
   A backup's rate is measured on the few minutes he got and says nothing
   at all about how few they were.
2. **Shrinkage pushed the wrong way.** `w = min(minutes/900, 1)` pulled
   low-minute players TOWARD the position median, so the less a player
   played the more he was priced like a median player of his position.

Measured result, the case the mission names: FC Porto carried four keepers at
6.0 — Diogo Costa (2,907') indistinguishable from Andorinha (18') — because
the rank-quantile mapping put the top half of a 30-keeper cohort above the 6.0
GK ceiling and the clamp flattened 15 of the 30 onto it.

## The signal

```
signal = per90 × availability
```

**Shrinkage is retired.** It existed so that a 90-minute wonder would not be
ranked on one match; availability does that job correctly and without lying —
90 minutes is an availability of 0.026, so his signal is 2.6% of his rate
rather than 97% of the median. Nobody is excluded; one formula prices everyone.

### availability (`pricing/lib/availability.ts`)

```
availability = min(minutes / (league season matches × 90), 1)
```

minutes-weighted across the (club, league) pairs he actually played in.

**Minutes only.** It is the sole availability fact the feed gives us. No
injury narratives, no expected-return dates, nothing invented. A player who
did not play is priced as a player who did not play, whatever the reason.

**On the ruling's position-awareness.** The ruling reads "a GK's availability
= his share of his club's GK minutes; outfield = minutes relative to a full
season (~3,420'), capped at 1". Those converge on one formula, and saying so
is more honest than two code paths computing the same number: a club plays
exactly one keeper at a time, so its season GK minutes ARE `matches × 90`, and
`matches × 90` is equally the most minutes one outfielder could take. Measured
cross-check over the 152 clubs we hold both figures for — summed club GK
minutes ÷ (matches × 90): median 1.000, p90 1.003. It fails LOW for 52 clubs
(min 0.033) only because our universe is the current squad list and does not
contain every keeper who played last season, which is exactly why the
denominator is `matches × 90` and not the summed figure: dividing by an
incomplete sum would report a keeper who played half his club's matches as
100% available.

**Why the league's modal season length, not the club's own `played`.** The
ruling's `~3,420'` is the 38-match case and only four of our twelve leagues
play 38; holding a Bundesliga player (34) to a 3,420' bar would price him as
10% less available than an identical Premier League player, and the
Championship's 46 cuts the other way. The club's own count is unusable raw on
measured evidence: five clubs report 1–3 matches in a top-five or Primeira
season (Red Star 1, Rodez 2, Paderborn 2, Torreense 2, Saint-Étienne 3), which
would make a single appearance read as 100% availability, and play-offs inflate
others past the round count (Championship 46 but 48 and 49 appear; Segunda 42
but 44 and 46). The modal value across a league's clubs IS the round count, is
robust to both, and is asserted into 30–48 before use. Resolved: 39→38, 40→46,
61→34, 62→34, 78→34, 79→34, 88→34, 94→34, 135→38, 136→38, 140→38, 141→42,
identically in both seasons.

## Season selection

Last completed season is 2025-26, read in the player's own pricing league set.

| 2025-26 minutes | 2024-25 minutes (same league set) | Priced from |
| --- | --- | --- |
| ≥ 900' | — | 2025-26 |
| < 900' | ≥ 1,800' | 2024-25 per-90 × **0.85**, availability = mean of the two seasons |
| < 900' | < 1,800' | 2025-26 if he has any minutes; else 4.0 floor, flagged |

- **900'** is the mission's "under ~900'" thinness bar (10 full matches), the
  same number the retired shrinkage used.
- **1,800'** is "a real body of work" — 20 full matches. Deliberately a higher
  bar than the thinness one: it is the restrictive reading, so fewer players
  are lifted off a low price by a two-year-old season.
- **0.85** is the mission's "stated discount". A year-old per-90 describes a
  player a year older who has not played since; it is not worth quite what a
  current one is. Applied uniformly.
- **The availability MEAN** is what keeps the rule honest in the direction the
  ruling demands: a returning starter (0.05 then 0.90) carries 0.475 — well
  below his healthy 0.90, well above a career backup's 0.15. He prices below
  his healthy self and above the backup, which is the test the ruling sets.

The prior season is read in the SAME league set as the pool, never across one.
The cross-league ban is locked, so a Championship 2024-25 cannot price a
Premier League squad player; he stays flagged, exactly as a relegated-in
player already does. **Known limit:** the 2024-25 pull covers the twelve
pricing leagues, so a player who spent that season outside them has no prior
season and is treated as thin. Stated, not papered over.

Data: `pricing/pull-prior-season.ts`, 853 calls (plus 246 burned by a first run
that aborted on a too-tight page cap; both ledgered in the manifest), against
the mission's 1,500 STOP. Per-player pulls were impossible — 2,621 players
qualify as candidates — so the pull is per-league pages, which costs more rows
and far fewer calls.

## Mapping: spread by signal

```
top   = min(pool band top, position ceiling)
sMax  = the highest signal in that pool+position
price = roundTo0.5( 4.0 + (top − 4.0) × clamp(signal / sMax, 0, 1) )
flagged: 4.0
```

Owner ruling R3 says in terms: "if more than ~3 players per position share a
cohort ceiling, the rank mapping is too compressed; spread by signal, ceiling
reserved for the top." So rank-quantile slotting is gone from the cohorts —
**and the top five's direct-value clamp goes with it.** MEASURED: clamping the
new signal directly puts 587 of 644 top-five defenders, 461 of 607 midfielders
and 132 of 143 keepers on the 4.0 floor, because multiplying every rate by a
median availability of 0.43 drops the whole distribution below the floor. That
is the identical flattening R3 forbids, aimed at the floor instead of the
ceiling, and it would make the mission's own goal unreachable: a club's starter
cannot outprice his backups when both sit at 4.0.

Normalising each pool+position by its own maximum keeps every locked
constraint — ceilings MID 13.0 / ATT 12.5 / DEF 9.0 / GK 6.0, cohort bands
4.0–7.5 and promoted 4.0–6.5, half-point steps, the 4.0 floor, cohort
separation — while making price a monotone function of the signal and giving
each ceiling only to the players at the top of it.

`overrides.json` still applies LAST and still wins, unchanged contract. The
25 Phase B rulings are carried verbatim.

## Gates (`pricing/lib/gates.ts`)

Run by `reprice.ts` over the generated prices AND by both seed scripts over
the prices read back out of each deployment — a file being self-consistent is
not evidence that the deployment is.

**R2, within-club sanity.** For every club and position, the player with the
most 2025-26 minutes must price ≥ every teammate. Three boundaries are
documented rather than assumed, each found by running it:

1. *The comparison is within a POOL.* A promoted club's squad holds both
   promoted-cohort players (4.0–6.5, off second-division minutes) and players
   who spent 2025-26 in the top five (4.0–13.0). Ordering those against each
   other is exactly the cross-league comparison the lock forbids — 5 of the 12
   first-run inversions were this and nothing else, every one at a promoted
   club. Cross-pool pairs are counted and reported, never asserted.
2. *The subject is a CLEAR starter.* Where the most-played player at a club and
   position played under 900', that club has no clear starter there and there
   is no starter-versus-backup ordering to assert. Reported as
   `noClearStarter`. It cannot excuse the case the mission names — Costa
   played 2,907'.
3. *The margin is 5%.* Below that the proxy cannot tell two players apart —
   see the declared approximation error above — so an inversion inside it is
   noise and a violation; above it the teammate is genuinely better per minute
   and the ruling's own escape hatch applies. The surviving same-pool
   inversions sit at +8.3% to +10.5% per-90.

An inversion involving an OVERRIDDEN row is reported and does not stop the
pipeline: overrides win over the formula by locked contract, and a gate that
blocked one would be asserting the owner may not overrule it.

**R3, ceiling scarcity.** No more than 5 players at the top price of any
pool+position. 5 rather than R3's "~3" for an arithmetic reason: prices round
to the half point, so everyone within a quarter-point of the top shares it, and
in the narrow promoted band (4.0–6.5) a quarter point is 10% of the whole band
— four players land there with no compression at all. Every count is reported,
not just the failures.
