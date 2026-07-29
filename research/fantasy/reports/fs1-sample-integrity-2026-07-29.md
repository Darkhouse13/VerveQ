# FS-1 — sample integrity pass

Season 2024. 20 sampled rounds across 5 leagues.

## 1. File census

  fixtures enumerated by discovery : 192
  fixtures/players files on disk   : 192  (100.0%)
  fixtures/events  files on disk   : 192  (100.0%)
  player-fixture rows loaded       : 8110

## 2. Fixture completeness

  status FT  : 192
  fixtures per sampled round: 9, 10 (20 rounds)

## 3. REQUIRED_STATS coverage across the full sample
  n = 8110 player-fixture rows. "present" = the feed sent a non-null value.
  A null is NOT a zero on the wire; the harness converts it to 0 only because
  the probe measured that null means "did not record this". Both are shown.

  minutes                    games.minutes             73.5% non-null   <-- >10% null
  goals                      goals.total                6.1% non-null   <-- >10% null
  assists                    goals.assists             73.5% non-null   <-- >10% null
  shots (total)              shots.total               26.6% non-null   <-- >10% null
  shots on target            shots.on                  15.4% non-null   <-- >10% null
  key passes                 passes.key                27.6% non-null   <-- >10% null
  pass accuracy              passes.accuracy           71.8% non-null   <-- >10% null
  dribbles completed         dribbles.success          23.0% non-null   <-- >10% null
  tackles won                tackles.total             39.3% non-null   <-- >10% null
  interceptions              tackles.interceptions     25.5% non-null   <-- >10% null
  clearances/blocks          tackles.blocks            12.0% non-null   <-- >10% null
  duels won                  duels.won                 61.0% non-null   <-- >10% null
  duels contested            duels.total               67.3% non-null   <-- >10% null
  fouls committed            fouls.committed           36.5% non-null   <-- >10% null
  fouls drawn                fouls.drawn               33.3% non-null   <-- >10% null
  yellow cards               cards.yellow             100.0% non-null
  red cards                  cards.red                100.0% non-null
  saves                      goals.saves                4.4% non-null   <-- >10% null
  goals conceded             goals.conceded           100.0% non-null
  penalties saved            penalty.saved              4.8% non-null   <-- >10% null
  penalties missed           penalty.missed           100.0% non-null
  penalties won              penalty.won                0.5% non-null   <-- >10% null
  penalties conceded         penalty.commited           0.7% non-null   <-- >10% null
  own goals                  —                        not on this endpoint (events feed supplies it)
  substitute entry minute    —                        not on this endpoint (events feed supplies it)

  Reading note: a low non-null rate here is NOT a broken pull. The feed omits a
  stat for a player who did not record it — a striker with no tackles has
  tackles.total null, not 0. The structural question (does the field EXIST) was
  settled by the probe; this table measures how often it carries a value.

## 4. Structural absences (declared before the pull, re-confirmed here)

  pass accuracy
    MEASURED (probe, fixture 1208070): this is a COUNT of accurate passes, not a percentage — accuracy <= passes.total in 40/40 rows and accuracy/total lands in 76-95%. The MID ">=88% with >=40 passes" threshold therefore needs accuracy/total normalisation, which is a scoring/ concern for v0.3, not a fetch/ one.

  tackles won
    CONFIRMED GAP (probe): the tackles object is {total, blocks, interceptions}. There is no won/lost split at any tier. The spec prices "tackle won"; the feed can only supply tackles attempted. Never proxied — awaiting SCORING_SPEC v0.3.

  clearances/blocks
    CONFIRMED GAP (probe): blocks only. There is no clearances field anywhere in the player statistics object. The spec prices "clearance/block" as one bucket; the feed supplies half of it. Never proxied — awaiting SCORING_SPEC v0.3.

  red cards
    No second-yellow vs straight-red split. Harmless: the spec prices both at -4.

  own goals
    Not carried by fixtures/players; sourced from fixtures/events (type "Goal", detail "Own Goal"). Stage E covers it.

  substitute entry minute
    Not carried by fixtures/players (games.substitute is a boolean, games.minutes a total). Sourced from fixtures/events (type "subst"). Required by SCORING_SPEC §Finishers and the post-75′ x1.25 multiplier. Stage E covers it.

## 5. Events feed

  3209 events across 192 fixtures.

    780  Card | Yellow Card
    507  Goal | Normal Goal
    384  subst | Substitution 1
    382  subst | Substitution 2
    372  subst | Substitution 3
    339  subst | Substitution 4
    249  subst | Substitution 5
     47  Goal | Penalty
     38  Card | Red Card
     26  Var | Goal cancelled
     19  Var | Penalty cancelled
     19  Var | Penalty confirmed
     18  Goal | Own Goal
     10  Goal | Missed Penalty
      8  subst | Substitution 6
      7  Var | Card upgrade
      3  Var | Goal confirmed
      1  Var | Red card cancelled

  event minute                   present on 3209/3209 (100.0%)
  event stoppage minute          present on 3209/3209 (100.0%)
  event type                     present on 3209/3209 (100.0%)
  event detail                   present on 3209/3209 (100.0%)
  event player                   present on 3209/3209 (100.0%)
  event assist / sub-in player   present on 3209/3209 (100.0%)

  NOTE — no "Second Yellow card" detail exists anywhere in the sample. Reds are
  a single undifferentiated category, exactly as SCORING_SPEC v0.4.1 assumes
  when it prices both at -4. The assumption is now measured, not inherited.

  NOTE — there is no event detail for a SAVED penalty. `penalty.saved` exists on
  the stat line but carries no clock, so a GK finisher's penalty save cannot be
  placed after the 75th minute. This is a feed limit, reported not worked around.

## 6. Cross-feed reconciliation — goals

  The two feeds are independent. If summed stat-line goals disagree with the
  fixture score, one of them is wrong and the sim would silently inherit it.
  THE STAT LINE WINS in the harness; disagreements are reported here, never patched.

  stat line vs fixture score : 192/192 agree (100.0%)

  events feed vs fixture score: 192/192 agree (100.0%)

## 7. Cross-feed reconciliation — substitutions

  subst events                       : 1734
  ...carrying an incoming player id  : 1734 (100.0%)
  rows flagged games.substitute=true : 3886
  ...with an entry minute resolvable : 1734 (44.6%)

  The gap is unused substitutes: games.substitute=true means "was on the bench",
  not "came on". A bench player who never entered has no subst event and
  correctly resolves to a null entry minute — SCORING_SPEC §Finishers scores
  an unused finisher as 0, so this is the intended path, not a coverage hole.

## 8. Position coverage

  MID   :  2905 (35.8%)
  DEF   :  2563 (31.6%)
  ATT   :  1726 (21.3%)
  GK    :   916 (11.3%)

  Every row carries a nominal position. The verdict-position input to
  SCORING_SPEC §Position mismatch is fully populated.

## 9. Minutes

  rows with minutes > 0 : 5958 (73.5%)
  rows with minutes = 0 : 2152 (unused bench — expected)
  rows with minutes >= 60: 3906 (48.2%) — the clean-sheet / concession qualifier
  max minutes observed  : 90

## Verdict inputs

  This pass makes no PASS/FAIL judgment — it reports figures. The numbers a
  reader needs: 192/192 player files, 192/192 event files,
  8110 player-fixture rows, stat-line/score agreement 100.0%,
  events/score agreement 100.0%.
