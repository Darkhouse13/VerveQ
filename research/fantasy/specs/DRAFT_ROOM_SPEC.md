# Weekend Fantasy — Draft Room Spec (v1.1.0)

Status: **v1.1.0 — LOCKED by owner.** Every ⚑ item is
resolved in the owner ledger at the foot of this document; the ⚑
markers are kept as provenance of what was once open, not as live
questions.

## Changelog

- v1.1.0 — **auto-pick and the default team sheet are price-based**
  (owner ruling, FW-3 STOP report 2026-07-29). The FW-3 owner rulings
  R1 and R6 (2026-07-29) supersede ledger items 2 and 3 as locked on
  2026-07-28: "highest v5 editorial rating" predates the FW-PR1c
  direct-value pricing pass, after which no v5 editorial rating exists
  on the players table — `pricing/price-final.json` (price, proxy,
  pool) is the value surface that shipped. Auto-pick is best available
  by **price desc**, tiebreak **proxy desc**, then **pool priority
  topfive > promoted > flagged**, constrained so the remaining sheet
  stays completable; the default sheet is 4-4-2 assigned **by price**,
  finishers the **two lowest-priced**. §Auto-pick, §Default team sheet
  and ledger items 2–3 are amended in place; no other rule changes.
- v1.0.2 — the favorite-change cooldown is **28 calendar days**,
  measured as a timestamp, not 4 gameweeks (owner STOP-F ruling,
  re-issued at the FW-2-RUN closeout 2026-07-29 after the original
  ruling was lost). The gameweek count and the day count are not
  interchangeable: FW-2-RUN's gameweek constitution admits midweek
  windows, and the bootstrapped 2026-2027 season has 13 midweek
  gameweeks in 49, so "4 gameweeks" can span anywhere from ~2 to ~4
  calendar weeks depending on where in the calendar it starts. Days
  are what the anti-gaming rule actually meant. Ledger item 7 and the
  §Favorite-club exemption paragraph are amended to match; no other
  rule changes.
- v1.0 — header/status corrected to match the owner decision ledger
  (FW-1 Phase 0, STOP-1 ruling 2026-07-28): the repo file was a stale
  download of a pre-lock revision, and its header contradicted its own
  ledger. Rules and ledger unchanged. Separately, per the FW-1 STOP-5
  ruling, the finality cut is restated as **Tuesday 23:59
  Europe/Paris** wall clock — "CET" was imprecise, and a fixed UTC+1
  would drift an hour against users' local Tuesday for most of a
  season (CEST).
- v0.3 — crew size settled at 2–8 hard cap (owner reversal after cost
  review); chess clock + favorite-club exemption stand.

## Founding shape ⚑

**Draft rooms are per-gameweek, not per-season.** Friends draft
Thursday/Friday, the weekend resolves it, the room's board is settled
Tuesday night (finality cut, LOCKED), and next weekend is a fresh
draft. This is the founding phrase taken literally — you draft a team
for *the* European football weekend, not for a season.

What this buys, all for free:
- No waivers, no free agency, no trades, no keeper rules — the entire
  season-long-draft admin layer that makes Fantrax feel like a second
  job simply doesn't exist.
- An abandoned room costs nothing; a missed weekend costs one weekend.
- Injuries and transfers never rot a roster — every weekend is a
  clean slate.
- It's THE DRAW's cycle shape applied to real fixtures.

Season-long draft leagues are explicitly out of scope at launch.

**The retention meta ⚑:** a room persists as a *crew*. Same code,
same people, every weekend is one "matchday" in a running crew table
(weekend wins, cumulative points, head-to-head record). Season-long
competition emerges from weekly drafts without season-long roster
burden. This is the private-league product.

## Room parameters

| Parameter | Value | Status |
|---|---|---|
| Crew size | 2 minimum, 8 maximum (hard cap) | LOCKED |
| Join | share-code, Arena pattern | inherited |
| Rounds | 13 (XI + 2 finishers, LOCKED squad shape) | locked shape |
| Player pool | all 5 leagues, unique ownership within room | core |
| Pick clock | chess-clock bank: 30s × 13 = 390s per drafter, spent freely across picks | LOCKED |
| Per-club cap | max 3 per squad, EXCEPT unlimited from the drafter's favorite club | LOCKED |
| Budget | none — scarcity comes from uniqueness, not price | core |

**Chess-clock rules:** bank drains only on your turn. Bank at zero ⇒
every remaining pick is an instant auto-pick. Disconnection doesn't
pause anything — your bank drains on your turns until you return or
empty. Time management is a drafted skill: snap the obvious rounds,
hoard for the scarcity rounds. Total draft time is bounded at ~6.5
min × crew size, worst case.

**Favorite-club exemption:** each user logs ONE favorite club at
profile level. The 3-per-club cap doesn't apply to it (a fan may
draft their whole back line). Anti-gaming: favorite changes take
effect **28 days after the change** (v1.0.2; was "a 4-gameweek
cooldown ⚑ (constant is placeholder)"), and
the favorite in force when the room arms is the one that counts —
never changeable mid-draft. Exemption applies identically in budget
mode ⚑ (pending owner confirm).

No position quotas at draft time: all-positions-eligible (LOCKED)
means any 13 players form a legal squad. Position risk is priced by
the mismatch rule, not by draft-time validation. This makes the draft
UI radically simpler than FPL Draft's.

## Lifecycle state machine

Arena-derived, server-clocked throughout:

1. **LOBBY** — host creates room, share code out, drafters join.
   Host sets pick clock + cap, then arms the draft.
2. **ORDER REVEAL** — server randomizes snake order, revealed as a
   moment (this is a screen people screenshot; give it drama).
3. **DRAFTING** — snake order (1→N, N→1, repeat) for 13 rounds.
   Server clock per pick; pick broadcast to all seats live.
4. **TEAM SHEET** — post-draft phase: each drafter arranges their 13
   into formation + XI + 2 finisher slots + position assignments.
   Editable until each player's fixture locks (per-fixture locks,
   LOCKED). Unarranged squads get a server-side default arrangement
   at first lock ⚑ (rule below).
5. **LIVE** — weekend runs; scores accrue provisional.
6. **SETTLED** — Tuesday 23:59 Europe/Paris finality; crew table updates;
   room offers "run it back" → new draft, same crew, next gameweek.

## Auto-pick, disconnects

- Bank empty ⇒ **auto-pick fires: best available by price descending**
  (v1.1.0; was "highest v5 editorial rating still available", which no
  longer exists post-FW-PR1c) — tiebreak proxy descending, then pool
  priority topfive > promoted > flagged, constrained so the remaining
  sheet stays completable (club cap). Deterministic, transparent,
  argues for itself; instantly, for every remaining pick. ⚑ (was open;
  ruled, then re-ruled v1.1.0)
- Disconnection does not pause the draft. Bank drains on the absent
  drafter's turns; reconnect resumes the live seat with whatever
  bank remains. No host-pause at launch (abuse surface; revisit on
  feedback).
- A drafter who never returns gets a fully auto-picked squad and the
  default team sheet — their crew still gets a full opponent, dead
  seats don't corrupt the room.
- Every auto-pick is marked in the draft log (the crew will want to
  litigate "the bot drafted better than you" — let them).

## Default team sheet rule ⚑

If a squad is unarranged when its first fixture locks: server assigns
4-4-2, slots filled **by price** (v1.1.0; was "by editorial rating
descending within nominal feed positions") — the GK slot takes the
cheapest nominal GK if one was drafted, else a documented best-fit
fallback — with the **two lowest-priced** as finishers (was "two
lowest-rated"). Crude by design — arranging your team is the game;
the default exists so absence never breaks the room, not to be good.

## Draft log

Full pick-by-pick record persists with the room: pick order, clock
used, auto-picks flagged. This is ShareCard raw material (draft-recap
image) and the argument ledger for the crew chat.

## Tie-breaks (crew table + weekend) ⚑

Weekend tie: (1) higher single-player score, (2) fewer auto-picks,
(3) shared. Crew table tie: head-to-head weekend wins, then
cumulative points. All placeholders — pick your ladder.

## Arena reuse map (for the eventual build ticket)

- Lobby / share-code join / seat management → direct reuse pattern
- Server-clocked countdown state machine → same shape, new states
  (ORDER REVEAL, DRAFTING turn cycle, TEAM SHEET window)
- Live broadcast of opponent actions → same channel pattern, payload
  is picks instead of answers
- New, no precedent: snake-turn scheduler, auto-pick service, TEAM
  SHEET editor, crew persistence across gameweeks

## Out of scope at launch

- Season-long draft leagues (waivers etc.)
- Public/matchmade draft rooms (crews are invite-only)
- Trades within a weekend
- Host-pause / clock extensions
- Spectator seats

## ⚑ Decisions this draft forces (owner ledger)

All LOCKED by owner 2026-07-28:
1. Founding shape: per-gameweek ephemeral drafts + persistent crew
   meta. LOCKED.
2. Auto-pick: best available by price desc, tiebreak proxy desc, then
   pool priority topfive > promoted > flagged, constrained so the
   remaining sheet stays completable. LOCKED (amended v1.1.0, FW-3
   ruling R1 2026-07-29; was "highest v5 editorial rating available",
   which predates FW-PR1c direct-value pricing).
3. Default team sheet: 4-4-2 assigned by price, GK slot = cheapest
   nominal GK if drafted else documented best-fit, two lowest-priced
   as finishers. LOCKED (amended v1.1.0, FW-3 ruling R6 2026-07-29;
   was rating-descending within nominal feed positions, two
   lowest-rated as finishers).
4. No host-pause at launch. LOCKED.
5. Tie-breaks — weekend: highest single-player score, then fewest
   auto-picks, then shared. Crew table: head-to-head weekend wins,
   then cumulative points. LOCKED.
6. Crew 2–8 hard cap; chess-clock 30s × 13 = 390s bank; club cap 3
   with favorite-club exemption. LOCKED.
7. Favorite-change cooldown: **28 calendar days**, measured from the
   instant of the change as a timestamp. LOCKED (STOP-F; amended from
   "4 gameweeks" in v1.0.2).
8. Favorite exemption applies in budget mode too. LOCKED.
