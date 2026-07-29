# FS-1 Phase 1 — schema probe findings

| field | value |
| --- | --- |
| date (UTC) | 2026-07-27 |
| endpoint set | `/leagues`, `/fixtures/rounds`, `/fixtures`, `/fixtures/players`, `/fixtures/events` |
| plan tier | **Free** — 100 requests/day, measured from `x-ratelimit-requests-limit` |
| season window served | **2022–2024**, stated by the provider on refusal |
| season resolved | **2024** (newest completed season this plan will serve) |
| probe fixture | Premier League 2024, Regular Season - 5, #1208070 — West Ham v Chelsea (FT) |
| requests spent | 5 of 5 planned, all cached and counting toward the full pull |

Numbers only. Every recommendation below is a PROPOSAL for the owner's v0.3;
nothing here has been applied, and `SCORING_SPEC.md` is untouched.

## 1. The plan tier, not the coverage flags, decides the season

`/leagues?id=39` advertises `coverage.fixtures.statistics_players = true` for
**twelve** completed seasons (2014–2025). The key actually serves **three**
(2022–2024). The first request for 2025 was refused with:

```
{"plan":"Free plans do not have access to this season, try from 2022 to 2024."}
```

The fetcher now treats that refusal as authoritative and re-selects downward, so
season choice is measured rather than trusted. Cost: one wasted request, once.

**2024 is the newest completed season available**, and it satisfies the ticket's
"most recent completed season available on the free tier". No STOP fires here.

## 2. Nulls mean zero, not missing — proven, not assumed

The naive reading of the player statistics object is alarming: `goals.total` is
null for 38 of 40 rows, `saves` for 38, `tackles.total` for 22. Read as missing
data, almost every stat would breach the ticket's >10% STOP threshold.

It is not missing data. Cross-reconciling `fixtures/players` against
`fixtures/events` for the same fixture:

| check | events feed | player stats | agree? |
| --- | --- | --- | --- |
| goals | 3 (Jackson ×2, Palmer) | Jackson 2, Palmer 1; sum = 3 | yes |
| assists | Sancho, Caicedo, Jackson | exactly those three have `goals.assists > 0` | yes |

If null meant "unknown", 30 players' goal counts would be unrecoverable and the
totals could not reconcile with an independently-sourced event feed. They do.
**`null` is the provider's encoding of zero.**

### Corrected coverage — 32 players who appeared, probe fixture

Restricting to rows with `minutes > 0` (the other 8 are unused substitutes, whose
nulls correctly mean "did not play"):

| field | schema-absent | null (= 0) | numeric |
| --- | --- | --- | --- |
| `games.minutes` | 0 | 0 | 32 |
| `goals.total` | 0 | 30 | 2 |
| `goals.assists` | 0 | 0 | 32 |
| `shots.total` | 0 | 19 | 13 |
| `shots.on` | 0 | 22 | 10 |
| `passes.key` | 0 | 15 | 17 |
| `passes.total` | 0 | 0 | 32 |
| `passes.accuracy` | 0 | 0 | 32 |
| `dribbles.success` | 0 | 24 | 8 |
| `tackles.total` | 0 | 14 | 18 |
| `tackles.interceptions` | 0 | 20 | 12 |
| `tackles.blocks` | 0 | 27 | 5 |
| `duels.won` | 0 | 6 | 26 |
| `duels.total` | 0 | 1 | 31 |
| `fouls.committed` | 0 | 13 | 19 |
| `fouls.drawn` | 0 | 19 | 13 |
| `cards.yellow` / `cards.red` | 0 | 0 | 32 |
| `goals.saves` | 0 | 30 | 2 |
| `goals.conceded` | 0 | 0 | 32 |
| `penalty.won` / `penalty.commited` | 0 | 32 | 0 |
| `penalty.missed` | 0 | 0 | 32 |
| `penalty.saved` | 0 | 30 | 2 |

**Zero fields are structurally absent.** No item-3 stat fails the >10%-missing
STOP on grounds of missingness. `penalty.won` and `penalty.commited` are null for
all 32 rows because no penalty occurred in this fixture — the full-sample pass
will confirm they populate when one does.

This is one fixture. The binding coverage measurement runs over all 192 after the
pull; this is the schema-level answer only.

## 3. Three semantic mismatches between the spec and the feed

These are the real findings. None is a missing-data problem; each is the feed
carrying something adjacent to what v0.2 prices.

### 3.1 `tackles won` does not exist — CONFIRMED GAP

The tackles object is exactly `{total, blocks, interceptions}`. There is no
won/lost split at any tier. v0.2 DEF prices **"Tackle won: +0.6 (cap +3)"** and
MID prices **"Tackle won or interception: +0.6 (combined cap +4)"**; the feed can
only supply tackles *attempted*.

Not proxied. Awaiting v0.3.

### 3.2 `clearances` does not exist — CONFIRMED GAP

There is no clearances field in the player statistics object. v0.2 DEF prices
**"Clearance/block: +0.25 (cap +2)"** as one bucket; the feed supplies only
`tackles.blocks`, which in this fixture is non-zero for 5 of 32 players. A
clearance-less version of that bucket is a materially different stat — CBs clear
far more often than they block.

Not proxied. Awaiting v0.3.

### 3.3 `passes.accuracy` is a COUNT, not a percentage — CONFIRMED

| player | `passes.total` | `passes.accuracy` | ratio |
| --- | --- | --- | --- |
| Max Kilman | 71 | 66 | 93.0% |
| Konstantinos Mavropanos | 62 | 56 | 90.3% |
| Levi Colwill | 62 | 55 | 88.7% |
| Moisés Caicedo | 54 | 47 | 87.0% |
| Lucas Paquetá | 42 | 32 | 76.2% |
| Robert Sánchez (GK) | 35 | 27 | 77.1% |

`accuracy <= total` in **40 of 40** rows, and `accuracy / total` lands in
76–95% — exactly the realistic Premier League completion band. Under the
percentage reading, any player with fewer passes than their percentage would
produce an impossible row; none does.

The v0.2 MID bonus **"Pass accuracy ≥ 88% with ≥ 40 passes: +2"** is therefore
computable, but only as `passes.accuracy / passes.total`. Per owner ruling 5 the
raw values are persisted as returned and the normalisation belongs in `scoring/`
under v0.3.

Note the consequence for spec tension #1: of the six players above with ≥40
passes, three sit within 2 points of the 88% threshold (88.7%, 87.0%, 88.9%
elsewhere in the sample). The step function looks live, not theoretical — Phase 4
will quantify it properly.

## 4. `fixtures/events` closes both §Finishers gaps — with one trap

Own goals and substitution minutes are both present, as expected. Every one of
the six required event fields was populated on 20/20 events.

**The trap, and it is a silent one.** On a `subst` event, `player` is the player
going **OFF** and `assist` is the player coming **ON**. Measured across all 10
substitutions in the probe fixture:

| | `player` field | `assist` field |
| --- | --- | --- |
| `substitute` flag | `false` in 10/10 | `true` in 10/10 |
| `minutes` | exactly `time.elapsed` in 10/10 | `(90 − time.elapsed) + stoppage` in 10/10 |

e.g. the 38′ substitution: `player` = Guido Rodríguez (`substitute=false`,
`minutes=38`), `assist` = Tomáš Souček (`substitute=true`, `minutes=52`).

So a finisher's entry minute is `time.elapsed` of the `subst` event whose
**`assist.id`** is that player. Reading `player.id` instead would invert every
finisher in the sample, and it would not look wrong — it would just quietly
score the wrong half of every substitution. Recorded in
`REQUIRED_EVENT_FIELDS` so the scoring engine cannot pick it up backwards.

§Finishers and the post-75′ ×1.25 multiplier are fully exercisable on real data.

## 5. Proposals for SCORING_SPEC v0.3 — owner decides

Evidence-backed, not applied. The owner amends the spec; this harness never does.

1. **`tackles won` → `tackles attempted`.** The only faithful option. Changes what
   the +0.6 buys: attempted tackles include unsuccessful ones, so the DEF and MID
   defensive buckets inflate relative to intent. Recommend re-pricing at the same
   time; Phase 3 can measure the inflation factor and propose a number, but only
   once v0.3 tells it which stat to use.
2. **`clearance/block` → `block` only, or drop the bucket.** At +0.25 with a +2
   cap it is the smallest DEF term, and blocks alone were non-zero for 5/32
   players here. Dropping it costs little legibility; keeping it as blocks-only
   quietly halves a bucket the spec named for two things. Owner's call.
3. **State the pass-accuracy unit explicitly in v0.3** as
   `passes.accuracy / passes.total`, with the `≥ 40 passes` qualifier applying to
   `passes.total`. The spec currently reads as though the feed hands over a
   percentage; it does not.
4. **No change needed** for goals, assists, minutes, shots, key passes, dribbles,
   duels, fouls, cards, saves, goals conceded, penalties, or own goals. All
   present and unambiguous.

## 6. Round lists contain non-gameweek rounds (found during day 1)

Bundesliga and Ligue 1 both report **35** rounds for 2024, not the 34 an
18-team league plays:

```
Regular Season - 1 ... Regular Season - 34 | Relegation Round
```

"Relegation Round" is a two-leg playoff — 2 fixtures, not a gameweek. Because
gameweeks are selected at fractions of the round count, an inflated denominator
can push a selection onto it, and Stage C's completeness check would **not**
catch the problem: those fixtures are legitimately `FT`.

This pull's selections (5, 14, 23, 32 for both leagues) all landed inside the
regular season, so **the sample is unaffected**. The guard was added anyway —
`regularSeasonRounds` filters the list before selection, falling back to the full
list if no round matches so a differently-named competition degrades to the old
behaviour rather than to an empty set. Selections already committed to state are
not recomputed, so the running pull was not disturbed.

## 7. Fetch status

Free tier confirmed at 100/day, so owner ruling 4 resolves to the **FREE TIER**
branch. With Stage E added the pull is **414 requests over 5 days**:

| day | requests | covers |
| --- | --- | --- |
| 1 | 100 | A, B, C, start of D |
| 2 | 100 | D |
| 3 | 100 | D, start of E |
| 4 | 100 | E |
| 5 | 14 | E |

5 requests are already spent and cached. Data collection is independent of the
formula (owner ruling 2), so the pull can start before v0.3 lands.
