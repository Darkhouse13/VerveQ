# FW-2b — TheStatsAPI trial probe

| field | value |
| --- | --- |
| date (UTC) | 2026-07-28 |
| provider | TheStatsAPI, `https://api.thestatsapi.com/api` |
| auth | `Authorization: Bearer <key>` (key in gitignored `.env`, never echoed) |
| plan | Growth trial, expires **~2026-08-04** |
| requests spent | **30** (see §7 ledger) |
| Convex writes | **zero** — read-only probe, nothing in `app/` touched |

> **VERDICT: TheStatsAPI is RULED OUT as the FW-2 bootstrap source.**
> Not on price, not on rate limits, and not on data quality in the abstract —
> on two specific findings: the 2026-27 season does not exist in their data
> and cannot be verified before the trial dies (§1), and five SCORING_SPEC
> v0.4.1 terms are unimplementable on their per-match feed (§3).
>
> This report preserves the mapping work for any future re-evaluation. The
> provider is good; it is not good *for this*, *now*.

---

## 1. Coverage verdict — the Phase 1 gate

**2026-27 is absent from all five target leagues.**

| League | `competition_id` | Loaded seasons | Newest | 26/27 |
| --- | --- | --- | --- | --- |
| Premier League | `comp_3039` | 8 (18/19 → 25/26) | 25/26 | **absent** |
| LaLiga | `comp_8814` | 6 (20/21 → 25/26) | 25/26 | **absent** |
| Serie A | `comp_5840` | 6 (20/21 → 25/26) | 25/26 | **absent** |
| Bundesliga | `comp_4643` | 6 (20/21 → 25/26) | 25/26 | **absent** |
| Ligue 1 | `comp_0256` | 6 (20/21 → 25/26) | 25/26 | **absent** |

Note LaLiga is named `LaLiga` (one word); a `search=La Liga` query returns
**zero** results. The `country=Spain` filter finds it. Anyone re-running this
probe will hit the same wall.

### This is a data gap, not a paywall — four independent proofs

1. `/football/matches?competition_id=comp_3039&date_from=2026-08-01&date_to=2027-06-30`
   returns `meta.total = 0`.
2. `/coverage/leagues/comp_3039` enumerates **33** EPL season entities back to
   93/94 and there is **no 26/27 entry at all**. A tier gate would list the
   season as unavailable, not omit it from the enumeration.
3. 25/26 carries `is_current: true` **and** `status: "complete"` (380/380
   finished). The provider has not rolled the season forward.
4. The provider is demonstrably live: **969 scheduled matches** across
   competitions currently in season (Colombian, Chilean, Brazilian, English
   League Two). They appear to load a season when it begins.

**Upgrading to Growth or Scale would not unlock 2026-27 today.**

### The timing fact that closes the question

The trial expires **~2026-08-04**. The 2026-27 top-five seasons kick off
**mid-to-late August 2026**. The trial window shuts *before* the data could
plausibly appear, so **no diligence performed inside the trial can ever verify
2026-27 coverage on this provider.** Paying would be a bet, not a check.

### Per-data-type verdict

| Data type | 2026-27 (what FW-2 needs) | 25/26 (what exists) |
| --- | --- | --- |
| Fixtures | **NO** — season absent | YES, 380/380 EPL |
| Squads | **NO** | YES, 1 call/club |
| Lineups | **NO** | YES, 99.7–100% |
| Player stats | **NO** | YES, 99.7–100% |
| xG | **NO** | YES, 98.7–100% |
| Standings | **NO** | YES |

Quality of what *is* served is excellent. It is simply the wrong season.

---

## 2. FW-1 schema mapping — clean, and better than expected

| FW-1 field | TheStatsAPI source | Verdict |
| --- | --- | --- |
| `providerFixtureId` | `match.id` (`mt_838955396`) | PRESENT — stable string |
| `kickoffAt` | `match.utc_date` — `2026-05-24T15:00:00.000Z` | PRESENT — ISO-8601, explicitly UTC, no timezone ambiguity |
| `status` | `scheduled\|live\|finished\|postponed\|cancelled` | PRESENT — **FW-1's union lacks `cancelled`** |
| `homeClubId` / `awayClubId` | `home_team.id` / `away_team.id` (`tm_`) | PRESENT |
| `homeGoals` / `awayGoals` | `score.home` / `score.away` | PRESENT — satisfies the MatchContext requirement |
| `providerPlayerId` | player `id` (`pl_`) | PRESENT |
| `clubId` (player) | `current_team.id` | PRESENT (+ `jersey_number`) |
| `feedPosition` | `position` — vocabulary **`G` / `D` / `M` / `F`** | PRESENT — maps 1:1 to GK/DEF/MID/ATT |
| squad list | `GET /football/teams/{team_id}/players` | PRESENT — one call per club, ≤100 players (West Ham: 22) |
| gameweek | `match.matchday` | bonus; FW-2 uses its own window constitution regardless |

Position vocabulary measured twice — 40 match rows (`D`15 `G`4 `M`13 `F`8) and
a 22-man squad (`D`6 `G`3 `M`8 `F`5). Four values, no others.

`played` / `started` / `minutes_played` cleanly separate DNP (11 of 40 rows had
`minutes_played: 0`), which is what SCORING_SPEC's `DNP = 0` needs.

**One oddity, unexplained:** player rows carry both `team_id` (the match team)
and `club_team_id`, and they disagree — Callum Wilson playing for West Ham
(`tm_3809`) has `club_team_id: tm_1662`. Loan registration is the obvious
guess. Not investigated; flagged so nobody keys off `club_team_id` assuming it
is the match club.

---

## 3. SCORING_SPEC v0.4.1 mapping — where this provider fails

Measured against `/football/matches/{id}/player-stats`, full field union across
40 rows of fixture `mt_838955396` (West Ham 3-0 Leeds, 2026-05-24).

| SCORING_SPEC stat | TheStatsAPI path | Status |
| --- | --- | --- |
| minutes | `minutes_played` | PRESENT (see note below) |
| goals | `shooting.goals` | PRESENT |
| assists | `passing.assists` | PRESENT |
| shots total / on target | `shooting.total_shots` / `shots_on_target` | PRESENT |
| key passes | `passing.key_passes` | PRESENT |
| accurate + total passes | `passing.accurate_passes` / `total_passes` | PRESENT — both **counts**, so the MID ≥0.88-of-≥40 threshold is computable exactly as on API-Football |
| dribbles completed | `duels.won_contest` | PRESENT — **different name** (take-ons won). No attempted count, which the templates do not need |
| tackles | `defending.tackles` | PRESENT — **AMBIGUOUS**: attempted vs won undetermined. v0.4.1 prices "Tackle (attempted)" |
| interceptions | `defending.interceptions` | PRESENT |
| **blocks (defensive)** | — | **ABSENT** |
| clearances | `defending.clearances` | **PRESENT — API-Football has no such field** |
| duels won | `duels.duel_won` | PRESENT |
| duels contested | `duel_won + duel_lost` | **DERIVED** — no direct field |
| fouls committed / drawn | `general.fouls` / `was_fouled` | PRESENT |
| yellow / red cards | `general.yellow_cards` / `red_cards` | PRESENT — no 2nd-yellow split (harmless; spec prices both −4) |
| saves | `goalkeeping.saves` | PRESENT |
| goals conceded | — | ABSENT from player line — **NON-ISSUE**: v0.4.1 already mandates deriving concessions and clean sheets from fixture score via MatchContext (the G0 finding), so we never wanted the player-line value |
| **penalties saved** | — | **ABSENT** |
| **penalties missed** | — | **ABSENT** |
| **penalties won** | — | **ABSENT per-match** (season aggregate only) |
| **penalties conceded** | — | **ABSENT per-match** (season aggregate only) |
| **own goals** | — | **ABSENT and undetectable** — see below |
| substitute entry minute | timeline `minute` + `extra_time` | PRESENT — see §4 |

### The blocks finding

`defending` is exactly `{tackles, interceptions, clearances}`. The only
`blocked` field anywhere is `shooting.blocked_shots`, and it is **offensive**:
Callum Wilson — a forward with 3 shots — carries `blocked_shots: 1`, i.e. one
of *his* shots was blocked. It does not count blocks *made*.

So relative to API-Football this is a **straight trade**: we gain `clearances`
(which SCORING_SPEC §3 states as fact the feed does not carry) and lose
defensive `blocks` (which v0.4.1 prices for DEF at +0.5, cap +2). Either
provider forces a spec amendment to the DEF template; neither supplies both.

### The penalty and own-goal finding — the disqualifying one

Across **five fixtures and 428 timeline events including 25 goals**, the
complete event-type vocabulary is:

```
foul 105 · corner_kick 55 · shot_blocked 53 · shot_off_target 49
substitution 36 · shot_on_target 33 · goal 25 · yellow_card 19
offside 17 · period_end 15 · period_start 10 · added_time 10 · var 1
```

**No penalty type. No own-goal type.** Goal events reconcile exactly against
final scores in all five fixtures (3-0→3, 4-2→6, 3-3→6, 3-2→5, 3-2→5), which
proves penalties and own goals are folded into undifferentiated `goal` events
rather than being absent from the timeline.

Consequences for v0.4.1:

- **Own goal (−3) is not merely missing, it is wrong.** An own goal arrives as
  a plain `goal`. Scored naively the player collects **+5 to +8** instead of
  **−3** — a 8-to-11-point error in the wrong direction, silently.
- **Penalty missed (−3), won (+2), conceded (−2), saved (+6)** are all
  unimplementable per-match. `penalty_won` / `penalty_conceded` /
  `penalty_goals` exist **only as season aggregates**
  (`/football/players/{id}/stats`), and `penalty_saved` / `penalty_missed` do
  not exist at any granularity.
- Penalty *scored* is fine — v0.4.1 prices a goal as a goal.

That is **five priced terms lost and one actively mis-scored**. API-Football
supplies all of them (`penalty.saved/missed/won/commited` plus the `Own Goal`
event detail). This alone would rule the provider out even if the season
problem did not exist.

---

## 4. Substitution direction — measured, and a genuine trap

`REQUIRED_EVENT_FIELDS` exists because reading API-Football's substitution
direction backwards "would silently invert every finisher score." TheStatsAPI
uses a **different convention again**, and its own documentation gets it wrong.

**Probe:** Callum Wilson has a `substitution` timeline event at minute 46 and
**scores at 90+4**. He cannot have gone off at 46 and scored at 94.

### Measured semantics — fixture `mt_838955396`, 7/7 substitutions consistent

**Timeline** (`/matches/{id}/timeline`):

```json
{"minute":46,"extra_time":0,"type":"substitution",
 "team":{...},"player":{"id":"pl_6164200","name":"Callum Wilson"}}
```

- `player` is the player coming **ON**. (Opposite of API-Football, where
  `player` is going off and `assist` is coming on.)
- `minute` + `extra_time` is the **entry minute** — what §Finishers needs.
- **Only one player is named.** The outgoing player is *not* in the event, so
  the timeline alone cannot reconstruct who left the pitch.

**Player-stats** (`general.player_subbed_on` / `player_subbed_off`) name the
**counterparty**, and are **inverted relative to what the names suggest**:

| Row | `started` | `player_subbed_on` | `player_subbed_off` | Reality |
| --- | --- | --- | --- | --- |
| Pablo Felipe | `true` | `pl_6164200` (Wilson) | `null` | went **OFF** at 45 |
| Callum Wilson | `false` | `null` | `pl_01735499` (Felipe) | came **ON** at 46 |

So: **a populated `player_subbed_off` means this player came ON**; a populated
`player_subbed_on` means this player went OFF. Never both, never self. All 14
involved rows follow this, 7 pairs, no exceptions.

**The published docs example is wrong** — it shows Mohamed Salah with *both*
fields populated and `player_subbed_off` pointing at Salah himself. No real row
does that. Do not implement from the docs example.

**Fallback derivation:** `entry_minute ≈ 90 − minutes_played`, verified on
Daniel James (timeline 70, minutes 20) and Wilfried Gnonto (timeline 69,
minutes 21). Wilson is off by one (timeline 46, minutes 45), so
`minutes_played` looks nominal and stoppage-exclusive. **Prefer the timeline
minute; treat `minutes_played` as approximate.**

---

## 5. xG — recorded, not used

Richer than API-Football, which FS-1 skipped entirely for coverage reasons.

| Granularity | Source | Fields |
| --- | --- | --- |
| Player-match | `/matches/{id}/player-stats` | `expected_goals`, `np_expected_goals`, `expected_assists` |
| Shot | `/matches/{id}/shotmap` | per-shot xG + pitch coordinates, `sh_` ids |
| Match | `/matches/{id}` | `xg_available: true` |

Season coverage 98.7–100% across all five leagues for 25/26. SCORING_SPEC
§Design principles item 3 explicitly declines xG dependency ("coverage is
inconsistent at this price tier") — that judgement was made about
API-Football and does **not** hold here. Recorded for any future spec revision.

---

## 6. ID-namespace analysis

`fantasyFixtures.providerFixtureId` and `fantasyPlayers.providerPlayerId` were
built for API-Football's **integer** ids. TheStatsAPI uses **prefixed strings**
(`mt_`, `pl_`, `tm_`, `comp_`, `sn_`). FW-1 stores both as `v.string()`, so
there is no type-level obstacle — the problem is that an id is meaningless
without knowing which provider minted it.

| Option | Description | Trade-offs |
| --- | --- | --- |
| **(a)** Provider discriminator / prefixed ids now | Add `provider: "apifootball" \| "thestatsapi"` to fixtures and players, or namespace the id strings | Cheap while tables are empty (they are). But it is schema complexity bought for a provider we are ruling out — carrying cost with no benefit unless we genuinely go multi-provider |
| **(b)** Bootstrap from TheStatsAPI, re-key later via name+club+date | Ingest 25/26 now, match to API-Football later | **Rejected outright.** It re-keys the *wrong season* — 2026-27 does not exist here, so there is nothing to bootstrap. Even setting that aside, re-keying 96 squads by name+club+date is roughly 95–98% confident at best: diacritics, transliterations ("Valentín Castellanos"), loan registrations (the `club_team_id` oddity in §2), and same-name players guarantee a manual reconciliation tail. Silent mis-keying of ~2–5% of a 13-slot squad game is not an acceptable failure mode |
| **(c)** Trial for evaluation only; bootstrap waits for API-Football Pro | Keep FW-1's ids meaning API-Football, discard TheStatsAPI after this report | Zero schema change. Zero re-keying. Preserves FS-1's entire scoring engine, already built and tested against API-Football's exact field shapes. Cost: dependent on API-Football Pro actually serving season 2026 — unverified at time of writing |

### RECOMMENDATION: (c) — **ACCEPTED by owner 2026-07-28**

The ID question mostly **dissolves** once §1 and §3 land. Option (b) presumes a
2026-27 bootstrap from this provider, which is impossible. Option (a) pays
permanent schema complexity to keep open a door that §3 has already shut — five
lost scoring terms and mis-scored own goals are not a "later integration
detail", they are a scoring-fidelity failure.

Under (c), `providerFixtureId` / `providerPlayerId` keep meaning exactly what
FW-1's comments say. If we ever *do* go multi-provider, (a) is still available
and no cheaper then than now, because both tables are still empty.

**The one open risk (c) carries:** we have never verified that API-Football
**Pro** serves `season=2026`. Their free tier refuses with an explicit served
window ("try from 2022 to 2024"), so the check is a single request on the
upgraded key — which is exactly what FW-2b ruling 2 makes the first action on
the new key.

---

## 7. Request ledger and cost projection

### Spent on this probe — 30 requests

| Phase | Calls | n |
| --- | --- | --- |
| 0 docs | WebFetch + curl on `www.` docs host, `/health` (unauthenticated) | **0** |
| 1 competition IDs | 5 `search`, 1 `country=Spain` | 6 |
| 1 season gate | 5 `/competitions/{id}/seasons` | 5 |
| 1 gate proof | `/coverage/leagues/comp_3039`, future-date matches, provider-wide scheduled | 3 |
| 1 coverage detail | 4 `/coverage/leagues/{id}` | 4 |
| 2 fixture probe | matches list ×2, timeline ×5, player-stats, lineups | 9 |
| 2 squads / season stats | `/teams/{id}/players`, `/players/{id}/stats` ×2 (one 400) | 3 |
| | **total** | **30** |

0.06% of a 50,000 pool. Rate limiting was never approached.

### What a real production year would cost here

| Workload | Calls |
| --- | --- |
| Fixture bootstrap, 1,752 fixtures @ `per_page=100` | ~20 |
| Squad bootstrap, 96 clubs @ 1 call each | 96 |
| **one-time bootstrap** | **~120** |
| `syncFixtures`, 5 leagues, 30-min cadence on fixture days + hourly otherwise | ~5,700 / month |
| Post-match pulls (player-stats + timeline), 1,752 fixtures/season | ~290 / month |
| **steady state** | **~6,000 / month** |

**Quota is not a differentiator.** ~6k/month fits inside every tier of both
providers. The decision rests entirely on season coverage and scoring fidelity.

### Pricing — the brief did not match reality

The FW-2b brief described a "$50/mo Growth, 50k requests/month" plan. Published
pricing is **Starter $50 / 100k / 120 rpm**, **Growth $129 / 500k / 300 rpm**,
**Scale $379 / 5M / 1000 rpm**. Measured trial headers report
`x-ratelimit-limit: 30` on a one-minute window (reset landed on a round
minute) — matching **no** documented tier, so trial keys appear throttled below
the tier they preview. **No monthly-pool header exists at all**, so the 50k
figure is unverifiable from the API.

| | TheStatsAPI | API-Football Pro |
| --- | --- | --- |
| Price | $50–129 / month | **$19 / month** |
| Quota | 100k–500k / month | 7,500 / **day** ≈ 225k / month |
| Serves 2026-27 | **No** | unverified — the one open question |
| SCORING_SPEC coverage | 5 terms lost, own goals mis-scored | complete (FS-1 proven) |
| Engine reuse | adapter rewrite + re-key | **none needed** |

---

## 8. Trial clock

Trial expires **~2026-08-04** (~7 days from this probe).

Because the recommendation is (c), **nothing needs to be pulled before expiry.**
An archival snapshot would only matter under option (b), which is rejected —
and it would snapshot 25/26, a season we have no product use for. The 30
responses already cached under `research/fantasy/data/thestatsapi/` are enough
to reproduce every finding in this report without the key.

Per FW-2b ruling 3, the trial lapses without conversion, which retires the key.
No rotation action required.

---

## 9. What FW-2 inherits

1. **TheStatsAPI is ruled out** as the FW-2 bootstrap source. Reasons in §1
   and §3, in that order of decisiveness.
2. **Option (c) adopted:** `providerFixtureId` / `providerPlayerId` continue to
   mean API-Football. No schema change, no discriminator field.
3. **First action on the API-Football Pro key is the season gate** — prove
   `season=2026` is served for league 39, or capture the exact refusal body.
4. **FW-1 schema gap, unrelated to provider choice:** `fantasyFixtures.status`
   has no `cancelled` member. Both providers emit it. Worth adding in FW-2.
5. **Two SCORING_SPEC observations, parked for a future amendment:**
   - the DEF template's `Block` term is unavailable on TheStatsAPI and the
     `clearances` gap noted in §3 of the spec is an API-Football limit, not a
     football-data limit — if we ever change provider, that template moves;
   - the spec's stated reason for declining xG ("coverage is inconsistent at
     this price tier") is provider-specific and does not generalise.
