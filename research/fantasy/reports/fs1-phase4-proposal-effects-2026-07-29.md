# Measured effect of each Phase 4 proposal

Sample: 5958 played rows. Positive point mass at spec v0.4.1: 31113.6

## P1 — 60+ minute appearance point 2 -> 1

  now : 3906 rows x 2 = 7812; 1-59 min 2052 x 1 = 2052
  participation share now  : 31.70%
  after: 60+ becomes 3906 x 1 = 3906
  participation share after: 21.90%   (positive mass 27207.6)

## P2 — win/draw 2/1 -> 1/0.5

  now : win 1464 x 2 = 2928, draw 1061 x 1 = 1061
  team-result share now  : 12.82%
  team-result share after: 6.85%   (positive mass 29119.1)

## P3 — cap values that would produce a 10-20% bind rate

  Percentiles of the RAW (pre-cap) value for each capped term, over rows that
  carry it. A cap set at the Nth percentile binds on (100-N)% of those rows.

  term                spec cap   p80    p85    p90    p95    max
  gk.saves                4      2    2.5      3    3.5    5.5
  def.tackles             3    1.2    1.2    1.6      2    3.6
  def.interceptions       3    1.2    1.2    1.8    1.8    4.8
  def.blocks              2      1      1      1    1.5    2.5
  mid.defensive           4      2      2    2.5      3    5.5
  mid.keyPasses           4    1.6    2.4    2.4    3.2    5.6
  mid.dribbles            2      1      1    1.5      2      4
  att.shotsOn             2      1      1      1    1.5    2.5
  att.keyPasses           4    1.6    1.6    2.4    2.4    5.6
  att.dribbles            3      1      1    1.5    1.5    3.5

## P5 — MID_DEFENSIVE rate 0.5 -> 0.7 (cap unchanged at 4)

  spec (0.5, cap 4)      destroyer mean 6.298 median 5.5 | creator mean 9.498 | gap 3.200 (33.69% below) | all-MID mean 7.092 | cap binds 8/1275 = 0.63%
  proposed (0.7, cap 4)  destroyer mean 7.117 median 6.5 | creator mean 9.896 | gap 2.778 (28.08% below) | all-MID mean 7.527 | cap binds 104/1275 = 8.16%
  alt (0.7, cap 3)       destroyer mean 6.696 median 6 | creator mean 9.803 | gap 3.107 (31.70% below) | all-MID mean 7.421 | cap binds 219/1275 = 17.18%

## P8 — ATT_SHOT_ON 0.5 -> 0.7 (cap 2 -> 2.8)

  spec (0.5, cap 2)        ATT mean 4.156 median 2.8
  proposed (0.7, cap 2.8)  ATT mean 4.264 median 2.8

## P4 — replacing the two cliffs with ramps

  DEF duels: +2 x clamp((rate-0.50)/0.20)    rows changed 374 (gain 133, lose 241), mean change -0.100, max gain 0.909, max loss -1
  MID passes: +2 x clamp((comp-0.84)/0.08)   rows changed 264 (gain 119, lose 145), mean change -0.067, max gain 0.978, max loss -1

  A ramp moves points to players just below the old line and away from those
  just above it. The counts above are how many rows each way.
