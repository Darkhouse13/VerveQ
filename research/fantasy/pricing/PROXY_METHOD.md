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
