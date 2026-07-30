# Weekend Fantasy — Draft Room Spec (v1.2.1)

Status: **v1.2.1 — LOCKED by owner.** Every ⚑ item is
resolved in the owner ledger at the foot of this document, and every ⚑
statement in the body has been amended to read as ruled; the ⚑ markers
are kept as provenance of what was once open, not as live questions.
Rules recorded under §Explicitly deferred are LOCKED as rules and
scheduled as work — they are deferred, not missing.

## Changelog

- v1.2.1 — **the crew table exists** (FW-4 scoring pipeline, doc-only
  patch). §Explicitly deferred no longer lists the crew table /
  standings as blocked on the scoring pipeline: the pipeline shipped
  and `fantasyScores.getCrewTable` serves cumulative points per member
  with each weekend's result. Only the tie-break ladders remain
  deferred — ties are displayed as ties, and the payload carries
  `tieBreaksApplied: false` so no client can mistake the ordering for
  a settled ladder. No rule changes.
- v1.2.0 — **the spec is reconciled with the engine as built** (owner
  ruling 2026-07-29, ticket FW-3S). No rule changes: a blind
  verification of v1.1.0 against `app/convex/fantasyDraft*` found the
  implementation conformant on every LOCKED value, and this revision
  writes down what that verification proved was live-but-unstated,
  strikes one internal contradiction, and records what is deferred so
  it stops reading as missing. Specifically: §Lifecycle 1 no longer
  says the host sets the pick clock and cap (the LOCKED §Room
  parameters values win, and both are constants); the §Auto-pick ladder
  is restated as the four rungs actually built, with the governing rule
  that the bot never takes a pick a human would be denied until nothing
  else remains, the termination rung blessed, and `providerPlayerId`
  ascending recorded as the final tiebreak; the default sheet is
  documented as applied eagerly at materialization rather than at first
  lock; the finisher ambiguity is resolved in text; the no-fixture,
  started-fixture, all-ready-arm, multi-fixture and player-pool rules
  are written into the body; and the F1/F3 remediations of ticket
  FW-3R (crew squads as draft output only, the self-defending draft
  log, leaver read access, the stuck-room path) are recorded as rules.
  The two ⚑ body statements the header's freeze claim contradicted
  (budget-mode favorite exemption, tie-break ladders) are amended in
  place to match ledger items 8 and 5.
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
| Player pool | all 5 leagues (an ingest property — see note below), unique ownership within room | core |
| Pick clock | chess-clock bank: 30s × 13 = 390s per drafter, spent freely across picks | LOCKED |
| Per-club cap | max 3 per squad, EXCEPT unlimited from the drafter's favorite club | LOCKED |
| Budget | none — scarcity comes from uniqueness, not price | core |

**Player pool — "all 5 leagues" is an INGEST property, not an engine
one (v1.2.0).** The draft engine applies **no league filter**: the
draftable pool is every active player row, joined with pool metadata
and the target gameweek's fixtures. Which leagues are in the players
table is decided upstream by the FW-2 ingest (`LEAGUE_IDS`), and the
draft board shows whatever ingest put there. This is recorded because
the two readings differ in a way that matters operationally: a
deployment part-way through ingest drafts from a partial pool without
the engine objecting, which is correct behaviour and not a bug to
"fix" by adding a filter.

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
never changeable mid-draft (the arm-time club is snapshotted onto every
seat, and is what both draft-time cap checks and the materialized
squad's cap checks read). The exemption **applies identically in budget
mode** — ledger item 8, LOCKED by owner 2026-07-28; the ⚑ marker below
is provenance, not an open question (v1.2.0: this paragraph previously
read "⚑ (pending owner confirm)", contradicting both the ledger and
this document's own freeze claim).

No position quotas at draft time: all-positions-eligible (LOCKED)
means any 13 players form a legal squad. Position risk is priced by
the mismatch rule, not by draft-time validation. This makes the draft
UI radically simpler than FPL Draft's.

## Lifecycle state machine

Arena-derived, server-clocked throughout:

1. **LOBBY** — host creates room, share code out, drafters join. The
   **creator arms the draft, and only once every seated drafter has
   marked themselves ready** (all-ready arm gate, v1.2.0: previously
   unstated in the body). Arming also requires at least 2 seats. The
   host sets **nothing**: the pick clock and the per-club cap are the
   LOCKED §Room parameters values and are constants, not room options
   (v1.2.0 struck "Host sets pick clock + cap", which contradicted the
   LOCKED table and ledger item 6 — the table wins).
2. **ORDER REVEAL** — server randomizes snake order, revealed as a
   moment (this is a screen people screenshot; give it drama). No bank
   drains here; the clock starts at DRAFTING.
3. **DRAFTING** — snake order (1→N, N→1, repeat) for 13 rounds.
   Server clock per pick; pick broadcast to all seats live. Seats are
   **frozen from the moment the room arms**: nobody joins or leaves the
   seat array again, and each seat's favorite-club snapshot is taken
   here.
4. **TEAM SHEET** — post-draft phase: each drafter arranges their 13
   into formation + XI + 2 finisher slots + position assignments.
   Editable until each player's fixture locks (per-fixture locks,
   LOCKED). Every squad is given the server-side default arrangement
   **eagerly, when the draft completes** — not at first lock (v1.2.0;
   see §Default team sheet rule for the ruling and its reason).
5. **LIVE** — weekend runs; scores accrue provisional.
6. **SETTLED** — Tuesday 23:59 Europe/Paris finality; crew table updates;
   room offers "run it back" → new draft, same crew, next gameweek.

Phases 5 and 6 are **not room statuses** — see §Explicitly deferred.
The room's own machine terminates at COMPLETED (plus ABANDONED for a
lobby that expired or was force-abandoned); LIVE and SETTLED are
carried by the gameweek the room drafted for, and "run it back" is
creating a room for the next gameweek.

## Auto-pick, disconnects

Bank empty ⇒ **auto-pick fires instantly, for every remaining pick of
that seat. No grace.** What it picks is fixed by an ordering and an
eligibility ladder, both below. Deterministic, transparent, argues for
itself.

**The ordering (within any rung).** Best available by **price
descending** (v1.1.0; was "highest v5 editorial rating still
available", which no longer exists post-FW-PR1c) — tiebreak **proxy
descending**, then **pool priority topfive > promoted > flagged**, then
**`providerPlayerId` ascending** (v1.2.0). That last tiebreak is not an
editorial preference: the first three do not totally order the pool
(the whole flagged cohort is priced at the 4.0 floor with no proxy),
and auto-pick has to be reproducible — same seed and same pick inputs
must yield an identical draft log. The provider's id is the only key
stable across environments, so it is the one that keeps a replay
byte-identical.

**The eligibility ladder (v1.2.0).** Tried in order; the ordering above
decides within whichever rung serves the pick:

1. cap-legal, and the player's fixture **has not kicked off**
2. cap-legal, and the player has **no fixture this gameweek**
3. cap-legal, and the player's fixture **has already started**
4. any unpicked active player, with the **club cap dropped**

**Governing rule: the bot never takes a pick a human would be denied
until nothing else remains.** Rungs 1 and 2 are picks a drafter could
legally have made themselves. Rung 3 is not — a started player is
refused to humans by the hindsight rule — so auto-pick reaches it only
when every unpicked cap-legal player in the pool is already underway,
which in practice means a room still drafting after the gameweek's last
kickoff. This ordering is the correction of a real defect found by the
v1.1.0 blind verification: "constrained so the remaining sheet stays
completable" had been built as a single relaxation that dropped
has-fixture and not-started together, which let a dear started player
outrank a cheap no-fixture one and made *every* auto-pick a hindsight
pick in the tail of a live gameweek.

**Rung 4 is a termination guarantee only, and is unreachable in
practice.** It exists so the draft finishes on any input rather than
wedging a room, and it is the one rung that may breach the LOCKED
per-club cap. It cannot be reached with a real pool: roughly 96 clubs
at a cap of 3 is ~288 cap-legal slots against 13 picks per seat, so a
rung-4 pick means the pool itself is broken. A room that finishes is
worth more than a cap held perfectly in a state that cannot occur —
but if a rung-4 pick is ever observed in a draft log, treat it as a
data incident, not as a legal squad.

- Disconnection does not pause the draft. Bank drains on the absent
  drafter's turns; reconnect resumes the live seat with whatever
  bank remains. No host-pause at launch (abuse surface; revisit on
  feedback).
- A drafter who never returns gets a fully auto-picked squad and the
  default team sheet — their crew still gets a full opponent, dead
  seats don't corrupt the room.
- Every auto-pick is marked in the draft log (the crew will want to
  litigate "the bot drafted better than you" — let them).

## Fixture eligibility (v1.2.0)

Three rules that were live in the engine from the first build but
stated only in ticket rulings. They govern both drafting and, by the
same hindsight logic, team-sheet edits.

**No-fixture players are draftable.** A player whose club has no
fixture in the target gameweek may be picked by a human, and the board
badges him as such: he is a legal squad member who simply scores
nothing this weekend. Auto-pick prefers **any** no-fixture player over
**any** started one (ladder rungs 2 and 3 above) — a bench week is a
human choice, a hindsight pick is not.

**Started fixtures are never human-pickable (the hindsight rule).** A
player whose own fixture has kicked off cannot be drafted, exactly as
he cannot be swapped into a budget squad. This is what keeps a crew
drafting on Saturday evening from taking the afternoon's hat-trick
scorer. It is a per-player rule, not a per-gameweek one: a room may
legitimately draft a running weekend (see §Room parameters), and
players are excluded pick by pick as their matches begin.

**Multi-fixture gameweeks: the earliest kickoff governs.** Where a club
has more than one fixture in a gameweek, the player's lock and
eligibility both turn on his **earliest** kickoff, at pool load and at
pick time alike. Once that first match starts he is out of the pool
even if a later fixture has yet to be played. Deliberately
conservative, and deliberately the same instant in both places: two
different answers to "when does this player lock" is the shape of bug
that only appears in a congested week.

## Default team sheet rule ⚑

Server assigns 4-4-2, slots filled **by price** (v1.1.0; was "by
editorial rating descending within nominal feed positions"). Crude by
design — arranging your team is the game; the default exists so absence
never breaks the room, not to be good.

**When it is applied: eagerly, at materialization (v1.2.0).** Every
squad gets the default the moment the draft completes and its 13 are
written, not "if it is still unarranged when its first fixture locks".
The drafter can then rearrange freely until each player's fixture locks
— the edit window is unchanged, and nothing about the arrangement they
end up with differs. Eager is the ruling because it is safer for cold
loads: there is no window in which a draft is over but a drafter has no
sheet to render, and no scheduled job standing between them and a
squad. (v1.2.0 amends the previous "at first lock" wording, which
described a lazier design than the one built.)

**`arrangedByUser` is what distinguishes a default sheet from a
deliberate one.** Applying the default eagerly makes the two
byte-identical, so the flag carries the difference: it is `false` at
materialization and flips to `true` on the drafter's first arrangement
edit that actually changes something (a no-op formation call is not an
arrangement). It never flips back — a sheet that has been touched stays
touched even if everything is put back. Without it, "has this drafter
arranged their team?" has no answer at all, which any nudge, recap or
ShareCard copy would need.

**The assignment, in full.** The order matters, and resolves the
finisher ambiguity (v1.2.0):

1. **GK slot** — the cheapest nominal GK among the 13, if one was
   drafted. Position-blind drafting means none may have been; the
   documented fallback is then the **cheapest player of the 13
   overall**, on the reasoning that the GK slot's output is dampened by
   the mismatch rule whoever stands in it, so the default wastes its
   least valuable player there and keeps the expensive picks in slots
   that pay full rate.
2. **Finishers** — the **two lowest-priced of the twelve that remain
   once the GK slot is filled** (v1.2.0). "The two lowest-priced" was
   ambiguous between the 13 and the 12: read against the 13 it can
   demand the keeper be a finisher, which is not a squad. The twelve
   outfield picks is the only coherent reading and the one built.
3. **The outfield XI** — the remaining ten fill DEF×4, MID×4, ATT×2.
   Nominal feed positions are honoured first, most expensive first
   within each role; whoever is left over fills whatever slots remain,
   again most expensive first, DEF before MID before ATT. A squad of 13
   nominal attackers therefore still produces a legal 4-4-2 —
   all-positions-eligible is LOCKED, and position risk is priced by the
   mismatch rule rather than blocked at build.

Every tie anywhere in the above breaks by `providerPlayerId` ascending,
so the default sheet is a pure function of the drafted 13: same players
in, same sheet out, on every deployment.

## Crew squads are draft output only (v1.2.0)

A crew squad is created by **exactly one** thing: the draft that
produced it. Stated as three rules, all LOCKED:

- **No public path creates a crew squad.** The squad-creation mutation
  refuses crew context outright, whatever its arguments.
- **Materialization is the sole creator.** It acts for every seat of a
  completed draft at once — including a leaver's, whose squad persists
  and auto-manages — and is unreachable from a client.
- **An existing crew squad is acceptable only as an exact-match
  retry.** If materialization finds a squad already at a seat's
  (user, gameweek, room) key, it proceeds only when that squad's filled
  slots **are** the drafted 13. Anything else stops and reports.
  Never overwrite, never silently continue.

This is the correction of the most serious defect the v1.1.0 blind
verification found (F1). The creation path had accepted crew context
from any authenticated caller without checking that they were seated in
the room, and materialization skipped any seat that already had a
squad — so a drafter could create an empty 13-slot squad at their own
live room's key, and the draft would then discard their entire drafted
13 into a sheet nothing could ever fill. Silently, with no error, and
with no repair path, because a crew squad's players may never be set by
hand. Hence "acceptable only as an exact-match retry": the skip has to
be able to tell a genuine retry from a squad that is not the draft's
output, and the only honest way to tell is to compare them.

Sheet edits rearrange; they never re-man. A crew squad's 13 players are
the draft's, so the arrangement mutations accept role and XI/finisher
changes but reject any change of player — including emptying a slot,
which would break the 13-players-13-slots bijection.

## Draft log

Full pick-by-pick record persists with the room: pick order, clock
used, auto-picks flagged. This is ShareCard raw material (draft-recap
image) and the argument ledger for the crew chat.

**The log must be self-defending (v1.2.0).** A completed draft
reconstructs from the log's own rows **without the room document and
without any player row** — order, every pick, auto flags and timing.
Two facts are therefore recorded on the log itself rather than joined
out:

- The **seed entry carries the arm-time seat table**: each seat's
  `nameSnapshot` and its `favoriteClubAtArm`. The favorite is the one
  that matters. It is the sole justification for a cap-breaching pick,
  and it lived only on the room doc — so from the log alone nobody
  could audit why a seat legally holds five players from one club. An
  argument ledger that cannot answer the argument is not a ledger.
- **Every pick carries `providerPlayerId`** alongside the internal
  player id. The provider's id is the identifier that survives deletion
  of a player row and is stable across deployments, so it is what makes
  a recorded draft replayable and a recap renderable years later.

Reconstruction is a verified property, not an aspiration: it checks
dense sequence from the seed entry, that the logged snake order is what
the logged seed regenerates, that the seat table covers every seat
exactly once, pick numbering against the snake, exclusivity under both
identifiers, and that per-seat bank arithmetic matches every row.

## Leaver read access (v1.2.0)

Room and draft-log reads gate on **"was seated in this room"**, not on
active crew membership. A drafter who later leaves the crew keeps read
access to the drafts they played: their picks are in the log, their
squad still scores that weekend, and the crew will still argue about
it. Gating on live membership meant leaving erased your own completed
draft from your own view.

Seats freeze at arm, so "was seated" is a permanent and tamper-proof
fact. **Write paths are unchanged** — leaving the crew still ends the
ability to join rooms, ready up, arm a draft, or start a new one. A
crew member who was never seated in a room loses access to it when they
leave, because they were never a party to that draft.

## Stuck rooms and the escape hatch (v1.2.0)

A DRAFTING room cannot abandon itself: banks drain to zero and
auto-picks finish it, which is what makes the terminal state
guaranteed. That guarantee is worth one qualification, because a room
whose recovery keeps failing must not cost a cron slot forever:

- The sweep counts **unproductive re-kicks** on the room. After **3**,
  it stops driving that room and flags it **stuck** (a flag, not a
  status — no client rendering path learns a new state). Any advance
  that actually commits resets the count to zero.
- The count is kept by the sweep, in its own transaction, because a
  failing recovery attempt rolls back its own writes and so can never
  record its own failure. This is the mechanism, and it is recorded
  because the naive alternative — have the failing attempt count
  itself — silently does nothing.
- **The sheet handoff never blocks the draft.** Materialization runs
  after the final pick has committed, so a failure there leaves a
  complete, fully-logged draft rather than rolling the last pick back
  and stalling the room one pick short of done.
- **`forceAbandonRoom` is the operator escape hatch**: internal-only,
  unreachable from any client path, and it **refuses a completed room
  whose squads are already materialized** — those sheets are live
  weekend state, and abandoning the room they came from would strand
  them.

## Tie-breaks (crew table + weekend) ⚑

**Both ladders are RULED, not placeholders** — ledger item 5, LOCKED by
owner 2026-07-28; the ⚑ marker is provenance (v1.2.0: this section
previously ended "All placeholders — pick your ladder", contradicting
both the ledger and this document's freeze claim):

- **Weekend tie:** (1) higher single-player score, (2) fewer
  auto-picks, (3) shared.
- **Crew table tie:** head-to-head weekend wins, then cumulative
  points.

"Fewer auto-picks" is already recordable — every auto-pick is flagged
in the draft log — so the ladder's inputs exist even though its
consumer does not yet. Implementation is deferred, not undecided; see
below.

## Explicitly deferred (owner ruling 2026-07-29)

These are LOCKED as rules and **scheduled as work**. They are recorded
here so a future reader — or a verification pass — reads them as
deferred rather than missing, which is the state they were in when the
v1.1.0 blind verification flagged them:

- **The tie-break ladders above** (weekend wins, then cumulative
  points, then head-to-head). The crew table itself is no longer
  deferred: the scoring execution pipeline shipped (FW-4) and
  `fantasyScores.getCrewTable` serves the standings — cumulative
  points per member, each weekend's result, settled weekends read from
  the stamped totals. What remains deferred is only the ladder that
  would BREAK a tie: the table orders by cumulative points, displays a
  tie as a tie, and returns `tieBreaksApplied: false` in the payload
  so no client can mistake the ordering for a settled ladder. The
  ladder's inputs (auto-pick flags, weekend wins) are all recorded, so
  implementing it is a consumer, not a migration.
- **LIVE and SETTLED as room phases.** §Lifecycle keeps them as the
  cycle's shape, but the room's own status machine terminates at
  COMPLETED and those two phases are carried by the gameweek. Promoting
  them to room statuses is deferred until something needs a room to
  observe finality.
- **A finality-cut consumer in the draft path.** The cut itself is
  LOCKED and implemented, and every gameweek carries its own finality
  instant — derived from the window it belongs to, which is FW-2's
  gameweek constitution to define and not restated here. Nothing in the
  draft path reads it yet, and nothing needs to until the crew table
  above exists.

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

Items 1–8 LOCKED by owner 2026-07-28 (with the v1.0.2/v1.1.0
amendments noted on each); items 9–14 LOCKED by owner 2026-07-29.

1. Founding shape: per-gameweek ephemeral drafts + persistent crew
   meta. LOCKED.
2. Auto-pick: best available by price desc, tiebreak proxy desc, then
   pool priority topfive > promoted > flagged, then providerPlayerId
   asc, under the four-rung eligibility ladder (not-started →
   no-fixture → started → any, with the club cap dropped at the last
   rung only), so the bot never takes a pick a human would be denied
   until nothing else remains. LOCKED (amended v1.1.0, FW-3 ruling R1 2026-07-29, for the
   ordering — was "highest v5 editorial rating available", which
   predates FW-PR1c direct-value pricing; ladder and final tiebreak
   stated v1.2.0, item 9 below).
3. Default team sheet: 4-4-2 assigned by price, GK slot = cheapest
   nominal GK if drafted else cheapest of the 13, the two lowest-priced
   of the remaining twelve as finishers, applied eagerly at
   materialization. LOCKED (amended v1.1.0, FW-3 ruling R6 2026-07-29;
   was rating-descending within nominal feed positions, two
   lowest-rated as finishers; finisher base, fallback and eager timing
   stated v1.2.0, items 10–11 below).
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

Added v1.2.0 (FW-3S, 2026-07-29) — the reconciliation rulings. Nothing
here changes behaviour; each item records a rule that was already live
or resolves a contradiction in this document:

9. Auto-pick eligibility ladder, four rungs in order: cap-legal and
   not started; cap-legal and no fixture; cap-legal and started; any
   unpicked active player with the club cap dropped. Governing rule:
   the bot never takes a pick `makePick` denies a human until nothing
   else remains. The final rung is a **termination guarantee only** and
   unreachable with a real pool (~96 clubs × cap 3 vs 13 picks); a
   rung-4 pick is a data incident. `providerPlayerId` ascending is the
   final deterministic tiebreak within any rung. LOCKED.
10. Default sheet finisher base: the two lowest-priced of the **twelve**
    that remain after the GK slot is filled, not of the 13. GK fallback
    when no keeper was drafted: the cheapest of the 13. LOCKED.
11. Default sheet timing: applied **eagerly at materialization**, not at
    first lock, because eager is safer for cold loads. `arrangedByUser`
    (false at materialization, true on the first real arrangement edit,
    never unset) is the flag distinguishing a default sheet from a
    deliberate one. LOCKED.
12. Fixture eligibility: no-fixture players are human-pickable and
    badged, and auto-pick prefers any no-fixture player over any
    started one; a player whose own fixture has kicked off is never
    human-pickable (hindsight rule); where a club has multiple fixtures
    in a gameweek the **earliest kickoff governs**, at pool load and at
    pick time alike. LOCKED.
13. Arm gate: the creator arms, and only once **every** seated drafter
    is ready (minimum 2 seats). The host configures nothing — pick clock
    and club cap are constants. §Lifecycle 1's "Host sets pick clock +
    cap" is struck. LOCKED.
14. Engine invariants made explicit: crew squads are draft output only
    (no public creator; materialization the sole creator; an existing
    squad acceptable only as an exact-match retry); the draft log must
    reconstruct a completed draft without the room doc or a player row
    (seed entry carries per-seat `favoriteClubAtArm` and
    `nameSnapshot`, picks carry `providerPlayerId`); room and draft-log
    reads gate on "was seated in this room" rather than active
    membership, with write paths unchanged; after 3 unproductive sweep
    re-kicks a room is flagged stuck and the sweep stops driving it,
    with internal-only `forceAbandonRoom` as the escape hatch, refusing
    a completed room whose squads are materialized. LOCKED. "All 5
    leagues" is recorded as an **ingest** property — the draft engine
    applies no league filter. LOCKED.
