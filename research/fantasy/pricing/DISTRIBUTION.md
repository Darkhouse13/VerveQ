# FW-PR1 — Proxy distribution and draft prices

_Generated 2026-07-29T15:37:22.617Z from proxy-scores.json (SCORING_SPEC v0.5.1 proxy — a RANKING signal, not scores; method and declared approximations in PROXY_METHOD.md)._

Deciles of shrunk proxy per 90, by position. d10 = 10th percentile (weak end), d90 = 90th (strong end). Under direct value pricing (FW-PR1c) price = clamp+round of proxy, so the decile tables read straight onto the price histograms that follow (ceilings MID 13.0 / ATT 12.5 / DEF 9.0 / GK 6.0, common 4.0 floor).

## Top-five pool (1903) — priced by the direct formula

| Pos | n | min | d10 | d20 | d30 | d40 | median | d60 | d70 | d80 | d90 | max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GK | 143 | 2.26 | 2.96 | 3.18 | 3.37 | 3.56 | 3.65 | 3.75 | 3.87 | 4.29 | 4.60 | 5.75 |
| DEF | 644 | 1.71 | 3.34 | 3.71 | 3.97 | 4.20 | 4.35 | 4.56 | 4.90 | 5.24 | 5.82 | 9.09 |
| MID | 607 | 3.27 | 4.80 | 5.29 | 5.69 | 5.93 | 6.05 | 6.37 | 6.77 | 7.30 | 7.88 | 13.33 |
| ATT | 509 | 1.98 | 3.88 | 4.23 | 4.58 | 4.77 | 4.88 | 5.18 | 5.52 | 6.11 | 6.79 | 12.27 |

## Promoted cohort (257) — COHORT-INTERNAL scale, not comparable to the table above

| Pos | n | min | d10 | d20 | d30 | d40 | median | d60 | d70 | d80 | d90 | max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GK | 16 | 3.34 | 3.91 | 3.94 | 4.01 | 4.17 | 4.26 | 4.34 | 4.37 | 4.61 | 4.75 | 5.42 |
| DEF | 92 | 2.77 | 3.75 | 4.41 | 4.72 | 5.07 | 5.25 | 5.44 | 5.83 | 6.01 | 6.47 | 7.40 |
| MID | 86 | 3.82 | 5.36 | 5.63 | 5.94 | 6.24 | 6.29 | 6.50 | 6.71 | 7.46 | 7.92 | 9.14 |
| ATT | 63 | 3.60 | 4.59 | 4.93 | 5.22 | 5.87 | 6.00 | 6.14 | 6.45 | 6.80 | 7.67 | 9.36 |

Flagged (no proxy, 4.0 floor): 735. Universe total 2895.

# Draft price histograms (all pools; from price-draft.json)

## GK

| Price | topfive | promoted | flagged | total |
| --- | --- | --- | --- | --- |
| 6.0 | 1 | 5 | 0 | 6 |
| 5.5 | 2 | 3 | 0 | 5 |
| 5.0 | 7 | 3 | 0 | 10 |
| 4.5 | 19 | 3 | 0 | 22 |
| 4.0 | 114 | 2 | 182 | 298 |

## DEF

| Price | topfive | promoted | flagged | total |
| --- | --- | --- | --- | --- |
| 9.0 | 2 | 0 | 0 | 2 |
| 8.5 | 1 | 0 | 0 | 1 |
| 8.0 | 1 | 0 | 0 | 1 |
| 7.5 | 3 | 0 | 0 | 3 |
| 7.0 | 9 | 0 | 0 | 9 |
| 6.5 | 17 | 10 | 0 | 27 |
| 6.0 | 38 | 18 | 0 | 56 |
| 5.5 | 57 | 18 | 0 | 75 |
| 5.0 | 89 | 18 | 0 | 107 |
| 4.5 | 153 | 18 | 0 | 171 |
| 4.0 | 274 | 10 | 195 | 479 |

## MID

| Price | topfive | promoted | flagged | total |
| --- | --- | --- | --- | --- |
| 13.0 | 1 | 0 | 0 | 1 |
| 12.5 | 0 | 0 | 0 | 0 |
| 12.0 | 0 | 0 | 0 | 0 |
| 11.5 | 0 | 0 | 0 | 0 |
| 11.0 | 5 | 0 | 0 | 5 |
| 10.5 | 2 | 0 | 0 | 2 |
| 10.0 | 6 | 0 | 0 | 6 |
| 9.5 | 6 | 0 | 0 | 6 |
| 9.0 | 11 | 0 | 0 | 11 |
| 8.5 | 16 | 0 | 0 | 16 |
| 8.0 | 24 | 0 | 0 | 24 |
| 7.5 | 57 | 0 | 0 | 57 |
| 7.0 | 56 | 0 | 0 | 56 |
| 6.5 | 76 | 9 | 0 | 85 |
| 6.0 | 152 | 17 | 0 | 169 |
| 5.5 | 76 | 17 | 0 | 93 |
| 5.0 | 60 | 17 | 0 | 77 |
| 4.5 | 36 | 17 | 0 | 53 |
| 4.0 | 23 | 9 | 219 | 251 |

## ATT

| Price | topfive | promoted | flagged | total |
| --- | --- | --- | --- | --- |
| 12.5 | 1 | 0 | 0 | 1 |
| 12.0 | 2 | 0 | 0 | 2 |
| 11.5 | 0 | 0 | 0 | 0 |
| 11.0 | 1 | 0 | 0 | 1 |
| 10.5 | 0 | 0 | 0 | 0 |
| 10.0 | 1 | 0 | 0 | 1 |
| 9.5 | 1 | 0 | 0 | 1 |
| 9.0 | 2 | 0 | 0 | 2 |
| 8.5 | 7 | 0 | 0 | 7 |
| 8.0 | 7 | 0 | 0 | 7 |
| 7.5 | 15 | 0 | 0 | 15 |
| 7.0 | 16 | 0 | 0 | 16 |
| 6.5 | 35 | 7 | 0 | 42 |
| 6.0 | 42 | 12 | 0 | 54 |
| 5.5 | 60 | 12 | 0 | 72 |
| 5.0 | 124 | 13 | 0 | 137 |
| 4.5 | 92 | 12 | 0 | 104 |
| 4.0 | 103 | 7 | 139 | 249 |
