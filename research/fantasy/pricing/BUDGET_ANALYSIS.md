# FW-PR2 — Budget analysis (owner decision artifact)

_Generated 2026-07-29T16:38:49.513Z from `price-final.json` (draft commit `e2a5430`, 25 owner overrides applied). Method: `pricing/budget-analysis.ts`._

**This document does not recommend a budget.** It reports what squads cost at
the prices now seeded, so the number can be chosen against evidence. Setting it
means replacing `PLACEHOLDER_PENDING_PRICING_PASS` in
`app/convex/lib/fantasyConstants.ts`; BUDGET_MODE open item 1 stays open until
that happens.

## What counts as legal here

A squad is 13 players: an XI shaped **GK 1 / DEF 3–5 / MID 2–5 / ATT 1–3**
plus **2 finishers of any position**, with at most **3 players from one club**
(`FORMATION_BOUNDS`, `PER_CLUB_CAP`). Every squad below was checked against
that definition before it was printed.

One deliberate difference from FW-1, stated because it moves numbers. FW-1 does
**not** constrain which position a player may fill: `feedPosition` is "an
editorial/UI hint, never a build-time constraint" (schema.ts) and both modes
lock all-positions-eligible, so the formation bounds govern **slot roles**, not
players. This analysis matches each player to a slot of his own position, which
is **stricter** — so every squad here is FW-1-legal by construction, while some
FW-1-legal squads cost more than anything below.

It bites at exactly one end. Under FW-1's own reading the dearest legal 13 is
simply the 13 most expensive players the club cap allows — **146.0**, shaped
0 GK / 0 DEF / 9 MID / 4 ATT, because no keeper and no back three are required. That is **8.0 above**
the position-matched max-stars below, and it is the true ceiling a budget has to
survive if the build screen enforces nothing about position. It does not move
the floor: the cheapest legal squad is 52.0 either way, since the floor is
crowded in every position. The position-matched figures are the ones the rest of
this document uses, because the scoring spec's position-mismatch dampener is
what makes a keeper-less XI a bad squad rather than an illegal one — but if the
budget is meant to be the only thing standing between a user and that 146.0
squad, it is the number to price against.

**Favorite-club exemption.** The cap is uncapped for the user's favorite club
(DRAFT_ROOM §Favorite-club exemption, ledger item 8, extended to budget mode).
That relaxation can only bind where a squad wants a 4th player from one club,
which is rarer than it sounds — it is measured against max-stars below.

## Cheapest legal squad

**52.0** — 13 players at the 4.0 floor. The floor is
crowded (1279 players, 44.2% of the universe), so no club-cap or
position pressure applies at the bottom: a legal 13 at the floor exists in every
formation. Any budget at or above 52.0 is buildable; below it, nothing is.

## Random legal squads (10,000, seeded)

| Statistic | Cost |
| --- | --- |
| minimum sampled | 53.0 |
| 25th percentile | **61.5** |
| 50th percentile (median) | **64.5** |
| 75th percentile | **67.5** |
| mean | 64.7 |
| maximum sampled | 86.0 |

**Method, exactly.** PRNG mulberry32 seeded `20260729`; re-running
`budget-analysis.ts` reproduces these figures to the digit. Each draw: pick one
of the 8 legal XI shapes uniformly; give each of the 2 finishers a position
drawn uniformly from the four; then draw that many distinct players uniformly
from each position's pool. A draw that would put a 4th player at one club is
discarded whole and redrawn — 10,008 draws produced 10,000 squads
(99.9% accepted). Percentiles are nearest-rank, so each is a cost some
sampled squad actually had.

**Read this as a floor-weighted null model, not as user behaviour.** Uniform
sampling over players is not uniform over squads a person would build: 44% of the
universe sits at 4.0, so a random squad is mostly floor players and the
percentiles land far below every archetype. A budget set at the median here
would price out every shape in the next section.

## Archetype builds

### (a) max-stars — **138.0**

_Definition: the most expensive legal squad — no restriction._ Formation 3-4-3 (+2 finishers). Clubs: Barcelona 3, Arsenal 2, Bayern München 2, Paris Saint Germain 2, Real Madrid 2, Inter 1, Manchester United 1.

| Pos | Player | Club | Price | Slot |
| --- | --- | --- | --- | --- |
| GK | David Raya | Arsenal | 6.0 | XI |
| DEF | F. Dimarco | Inter | 9.0 | XI |
| DEF | Nuno Mendes | Paris Saint Germain | 9.0 | XI |
| DEF | Gabriel Magalhães | Arsenal | 8.5 | XI |
| MID | M. Olise | Bayern München | 13.0 | XI |
| MID | Fermín | Barcelona | 11.0 | XI |
| MID | J. Bellingham | Real Madrid | 11.0 | XI |
| MID | Pedri | Barcelona | 11.0 | XI |
| MID | Bruno Fernandes | Manchester United | 10.5 | finisher |
| ATT | Lamine Yamal | Barcelona | 13.0 | XI |
| ATT | H. Kane | Bayern München | 12.5 | XI |
| ATT | Kylian Mbappé | Real Madrid | 12.0 | XI |
| ATT | O. Dembélé | Paris Saint Germain | 11.5 | finisher |

### (b) two-elite core + value fill — **97.0**

_Definition: exactly 2 players priced ≥ 10.0, the other 11 from the value band 5.0–6.5; maximised._ Formation 3-4-3 (+2 finishers). Clubs: Udinese 2, VfB Stuttgart 2, Villarreal 2, Arsenal 1, Barcelona 1, Bayern München 1, Manchester City 1, Napoli 1, Paris Saint Germain 1, Tottenham 1.

| Pos | Player | Club | Price | Slot |
| --- | --- | --- | --- | --- |
| GK | David Raya | Arsenal | 6.0 | XI |
| DEF | Amir Rrahmani | Napoli | 6.5 | XI |
| DEF | Beraldo | Paris Saint Germain | 6.5 | XI |
| DEF | C. Romero | Tottenham | 6.5 | XI |
| DEF | M. Guéhi | Manchester City | 6.5 | finisher |
| MID | M. Olise | Bayern München | 13.0 | XI |
| MID | José María Andrés Baixauli | VfB Stuttgart | 6.5 | XI |
| MID | P. Gueye | Villarreal | 6.5 | XI |
| MID | Rui Modesto | Udinese | 6.5 | XI |
| MID | T. Buchanan | Villarreal | 6.5 | finisher |
| ATT | Lamine Yamal | Barcelona | 13.0 | XI |
| ATT | K. Davis | Udinese | 6.5 | XI |
| ATT | Tiago Tomás | VfB Stuttgart | 6.5 | XI |

### (c) three-elite core + floor fill — **78.5**

_Definition: exactly 3 players priced ≥ 10.0, the other 10 at the 4.0 floor; maximised._ Formation 3-4-3 (+2 finishers). Clubs: Villarreal 3, Bayern München 2, Werder Bremen 2, Barcelona 1, Sunderland 1, Toulouse 1, Udinese 1, Union Berlin 1, VfB Stuttgart 1.

| Pos | Player | Club | Price | Slot |
| --- | --- | --- | --- | --- |
| GK | K. Hein | Werder Bremen | 4.0 | XI |
| DEF | M. Friedl | Werder Bremen | 4.0 | XI |
| DEF | Pau Navarro | Villarreal | 4.0 | XI |
| DEF | Renato Veiga | Villarreal | 4.0 | XI |
| DEF | Willy Kambwala Ndengushi | Villarreal | 4.0 | finisher |
| MID | M. Olise | Bayern München | 13.0 | XI |
| MID | A. Vossah | Toulouse | 4.0 | XI |
| MID | H. Diarra | Sunderland | 4.0 | XI |
| MID | J. Haberer | Union Berlin | 4.0 | XI |
| MID | J. Karlström | Udinese | 4.0 | finisher |
| ATT | Lamine Yamal | Barcelona | 13.0 | XI |
| ATT | H. Kane | Bayern München | 12.5 | XI |
| ATT | B. Bouanani | VfB Stuttgart | 4.0 | XI |

### (d) balanced, nobody above 9.0 — **113.5**

_Definition: the most expensive legal squad in which no player is priced above 9.0._ Formation 3-5-2 (+2 finishers). Clubs: Paris Saint Germain 3, Arsenal 2, Eintracht Frankfurt 1, FSV Mainz 05 1, Inter 1, Lens 1, Lyon 1, Manchester City 1, RB Leipzig 1, Real Betis 1.

| Pos | Player | Club | Price | Slot |
| --- | --- | --- | --- | --- |
| GK | David Raya | Arsenal | 6.0 | XI |
| DEF | F. Dimarco | Inter | 9.0 | XI |
| DEF | Nuno Mendes | Paris Saint Germain | 9.0 | XI |
| DEF | Gabriel Magalhães | Arsenal | 8.5 | XI |
| MID | C. Uzun | Eintracht Frankfurt | 9.0 | XI |
| MID | Fabián Ruiz | Paris Saint Germain | 9.0 | XI |
| MID | M. Sangaré | Lens | 9.0 | XI |
| MID | N. Amiri | FSV Mainz 05 | 9.0 | XI |
| MID | P. Šulc | Lyon | 9.0 | XI |
| MID | Pablo Fornals | Real Betis | 9.0 | finisher |
| MID | W. Zaïre-Emery | Paris Saint Germain | 9.0 | finisher |
| ATT | J. Doku | Manchester City | 9.0 | XI |
| ATT | Y. Diomande | RB Leipzig | 9.0 | XI |

### Max-stars under the favorite-club exemption

**The exemption does not raise max-stars at all.** Every one of the 96 clubs was
re-solved with its cap lifted (up to 6 players from it); the best result any of
them produced is 138.0, identical to the capped figure. Barcelona is the only club at the cap in that squad, and a 4th player from there cannot be added without dropping
one of the squad's position minima — the GK and the 3 DEF are what bind at the
top of the market, not the club cap.

That is a statement about **max-stars only**. The exemption still matters to a
user who wants four players from one club at any other price level, and it still
has to be honoured by the rules engine; it just does not move the ceiling a
budget has to be set against.

## Candidate budget caps

Each cap is annotated with the archetypes it permits **at full strength** — that
is, caps at or above the archetype's own cost above. A cap below an archetype's
cost still admits weaker squads of the same shape (a two-elite core with cheaper
elites, say); what it forbids is the strongest version of it.

| Cap | Permits at full strength | Count |
| --- | --- | --- |
| 77.5 | none at full strength | 0 of 4 |
| 80.0 | (c) | 1 of 4 |
| 82.5 | (c) | 1 of 4 |
| 85.0 | (c) | 1 of 4 |
| 87.5 | (c) | 1 of 4 |
| 90.0 | (c) | 1 of 4 |
| 92.5 | (c) | 1 of 4 |
| 95.0 | (c) | 1 of 4 |
| 97.5 | (b), (c) | 2 of 4 |
| 100.0 | (b), (c) | 2 of 4 |
| 102.5 | (b), (c) | 2 of 4 |
| 105.0 | (b), (c) | 2 of 4 |
| 107.5 | (b), (c) | 2 of 4 |
| 110.0 | (b), (c) | 2 of 4 |
| 112.5 | (b), (c) | 2 of 4 |
| 115.0 | (b), (c), (d) | 3 of 4 |
| 117.5 | (b), (c), (d) | 3 of 4 |
| 120.0 | (b), (c), (d) | 3 of 4 |
| 122.5 | (b), (c), (d) | 3 of 4 |
| 125.0 | (b), (c), (d) | 3 of 4 |
| 127.5 | (b), (c), (d) | 3 of 4 |
| 130.0 | (b), (c), (d) | 3 of 4 |
| 132.5 | (b), (c), (d) | 3 of 4 |
| 135.0 | (b), (c), (d) | 3 of 4 |
| 137.5 | (b), (c), (d) | 3 of 4 |
| 140.0 | (a), (b), (c), (d) | 4 of 4 |

Archetype costs for reference: a 138.0 · b 97.0 · c 78.5 · d 113.5. The cheapest legal squad is 52.0, and the current
placeholder in code is 100.0.

## Price distribution (all 2,895 players)

| Price | Players |
| --- | --- |
| 13.0 | 2 |
| 12.5 | 1 |
| 12.0 | 1 |
| 11.5 | 1 |
| 11.0 | 3 |
| 10.5 | 2 |
| 10.0 | 8 |
| 9.5 | 8 |
| 9.0 | 15 |
| 8.5 | 24 |
| 8.0 | 35 |
| 7.5 | 76 |
| 7.0 | 79 |
| 6.5 | 152 |
| 6.0 | 285 |
| 5.5 | 246 |
| 5.0 | 331 |
| 4.5 | 347 |
| 4.0 | 1279 |
