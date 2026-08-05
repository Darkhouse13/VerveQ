# CANDIDATE — `daily-legend`

> **PROVISIONAL. OWNER RATIFICATION REQUIRED before any adapter is written.**
> Mandated candidate (owner-specified). Salvaged kernel of the killed full
> career sim — see `KILL_LOG.md` entry 1.

## Axis

**Valuation** — this is the one Valuation slot (DRAW owns the axis; max 1
candidate here).

**How it differs structurally from a draft game.** THE DRAW values *cards you
may acquire* from a fixed offer grid: the scarce thing is roster slots, the
decision is comparative across simultaneous offers, and the run is a sequence
of independent bank/push gambles. `daily-legend` values *irreversible moves
along a single timeline*: there is no offer grid, no roster, and no
simultaneous comparison — the scarce thing is **career-years**, and every
decision is priced against an opportunity cost that only resolves later. You
never pick between six things; you pick between staying and leaving, and the
thing you gave up is never shown to you again.

## Loop (3 sentences)

Each day everyone is handed the same compressed skeleton of one real legend's
career — the real clubs, the real years, the real competitions available in
each of those years — and plays it from debut to retirement in ~12 decision
windows. At each window you commit to STAY or MOVE before that season's
strength roll resolves, accumulating your own trophy cabinet as you go. At
retirement your cabinet is laid beside the legend's actual real-life palmares
and you win, draw, or lose against the man himself.

## Heartbeat G2 — **THE WINDOW**

*One named moment: the summer commit.*

The screen shows your current club, your age band, and the competitions your
club is entered into next season. It shows one to three concrete alternatives
drawn from the legend's real move set plus real clubs of comparable standing
in that year. It does **not** show next season's strength roll.

You commit STAY or MOVE. Then the roll resolves and the season plays out in
one beat.

This is a heartbeat and not merely a menu because it has DRAW's two required
properties: **irreversibility** (there is no back, and a move burns a
career-year of settling-in) and **a live opportunity cost** (peak years are
visibly draining in a fixed counter at the top of the screen). It differs from
BANK/PUSH in its failure mode: BANK/PUSH fails *loudly and immediately* — you
bust. THE WINDOW fails *quietly and late* — you find out at retirement that
you spent your three peak years at a club that never entered the competition
you needed. That is a different adrenaline curve and it is the honest risk of
this design, not a hidden flaw.

**Answer to the brief's conditional: a named heartbeat was designed. No STOP
is reported on G2.**

## Content G3 — data needed + source

**NEVER invent football facts.** Everything below is a lookup, not an
authoring task.

| Datum | Source | Status in repo |
| --- | --- | --- |
| Legend identity | Wikidata `qid` | present pattern — `app/convex/data/playersSourced.json` |
| Club spells with start/end years | Wikidata `P54` + `P580`/`P582` qualifiers | present shape (`facts.clubs[].source.property = "P54"`) |
| Debut year | Wikidata `P54`/`P580` | present (`facts.debutYear`) |
| Nation, position | Wikidata `P54`, `P413` | present |
| **Palmares (the win condition)** | Wikidata `P166` (award received) + `P1346` (winner) | **NOT present — new fetch** |
| Which competitions a club was in, per year | Wikidata competition-participant statements, or official federation/confederation records (approved class: "Standards / governing bodies") | **NOT present — new fetch** |

The last two rows are the real content bill. Both fall inside the approved
source classes of `docs/CIE_SOURCING_POLICY.md` §3 (open structured KB, CC0;
and official federation records) and both are machine-resolvably citable, so
G3 passes on policy grounds. Per-legend provenance must carry the same
`{qid, property, retrievedAt, sourceQuality}` envelope the repo already uses.

**Known G3 soft spot, flagged not hidden:** competition-participation history
per club per year is *thin and uneven on Wikidata* for pre-1990 and for
non-European leagues. Where it is thin, the honest options are (a) restrict the
legend pool to careers where it is dense, or (b) fetch from the federation
directly. Filling the gap by inference is **not** an option — that would be
inventing football facts.

## Uncertainty source

**Hidden season-outcome rolls, conditioned on visible club strength.** You know
the skeleton (which clubs, which years, which competitions). You do not know
whether this particular season the club overperforms or collapses. The roll is
seeded from `(dailySeed, careerIndex, windowIndex)` — following DRAW decision 3,
globally seeded rather than per-user, so leaderboards stay comparable and
"beat my career" challenges are exact.

Secondary uncertainty: your own decline curve. The age at which your peak band
ends is drawn per-run from a visible distribution, so "one more year at the big
club" is a genuine gamble.

## Session shape

**daily** (primary) — one legend per day, shared seed, ~4–6 minutes.
**duel** (secondary) — same legend, two players, margin-vs-palmares decides it.

## Scores — PROVISIONAL

Prior-art score status: **SWEPT 2026-07-26.**

| Criterion | Weight | Raw | Weighted | One-line justification |
| --- | --- | --- | --- | --- |
| Adrenaline | ×3 | 4 | 12 | THE WINDOW commits before resolution and the retirement comparison is a genuine climax, but the failure mode is quiet and late rather than immediate. |
| Shareable artifact | ×3 | 5 | 15 | Your trophy cabinet rendered beside the legend's real one is inherently comparative, instantly legible, and needs no explanation to a non-player. |
| Daily refresh w/o burn | ×2 | 2 | 4 | Burns one legend per day against a pool of maybe a few hundred careers with palmares dense enough to be fair — roughly one year of runway before repeats. |
| Content cost (inv.) | ×2 | 2 | 4 | Two new heavy Wikidata/federation fetches (palmares, per-year competition entry) plus per-legend curation of the skeleton. |
| Build cost (inv.) | ×2 | 1 | 2 | Heaviest candidate in the set: career state machine, decision-window authoring, season sim, and palmares comparison — four subsystems, none of which exist. |
| Prior-art headroom | ×2 | 2 | 4 | Destiny Eleven launched 2026-07-20 and hit 150k players in two days, with onze-de-reve.fr and iOS Footballer Life Simulator alongside it — very thick and hot, though none use a shared daily seed or benchmark against a real legend's actual palmares. |
| Social fit | ×1 | 5 | 5 | Shared seed means everyone played the same career, which is the strongest possible substrate for comparison and for async duels. |
| **TOTAL** | | | **46 / 75** | |

## Risk lines

1. **Prior-art timing.** Destiny Eleven is six days old and viral as of the
   sweep date. Shipping an adjacent career game now invites "clone" framing
   even though the kernel differs. The differentiator (shared seed + beat the
   real palmares) must be legible in the first ten seconds or it will not be
   seen at all.
2. **Identity risk — is this trivia?** A player who knows the legend's real
   career knows which moves were good. That is direct knowledge advantage and
   it cuts against the hard identity rule. Mitigation to test in the harness:
   the hidden strength rolls must carry enough variance that recalling the real
   career is worth materially less than reading the visible competition entries.
   **This candidate is the most likely in the set to fail the recallShare
   check.** It should be adapted early precisely because it might die there.
3. **Content runway.** See the refresh score. A year of runway is a launch, not
   a franchise.
