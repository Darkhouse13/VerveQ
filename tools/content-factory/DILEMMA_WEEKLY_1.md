# DILEMMA-WEEKLY — week of Aug 15 (v2, post-sweep) · session 2026-08-14

The standing weekly dilemma ticket, first run under the MONID-SWEEP-2
amendments (`research/ig-fpl-decision-sweep/REPORT.md`). Slot #2 ships
as-built; slots #5/#7/#10 ship on the amended spine built and proven this
session. **Every price cited below is prod `fantasyMarket:getMarket` on
`different-lynx-153`, pulled 2026-08-14, re-verified per render by the gates —
never memory.**

## Slot map

| # | Date | What | State |
|---|---|---|---|
| 2 | Sat 16 | `wknd-dilemma-1` POST-AS-BUILT (paid-vs-organic twin) | READY — caption carries deadline + live CTA; video untouched. Re-run the one command Sat, then post |
| 5 | Tue 19 | v2 edition, GW2 prices | BLOCKED until GW2 opens (see STOP) — spine ready, runbook below |
| 7 | Thu 21 | v2 edition, GW2 prices | same |
| 10 | Sun 24 | v2 edition, GW2 prices | same |

## Slot #2 — post-as-built (Sat 16)

The video is the boosted marquee-trade creative's organic twin and carries
**no new variables**: `Dilemma.tsx`, `dilemma-facts.json`, the `dilemma1/2`
grids, beds and takes are all untouched this session. Only the caption moved
(captions are free, per ticket):

- Lead now carries the deadline: *"pick in the comments before Sunday's
  lock"* — all three named players kick off **Sunday** (Febas v Osasuna Sun
  19:30 UTC; Dolberg + Berghuis v Heerenveen Sun 14:45 UTC, board-verified
  today), so Sunday is when the decision expires. Day words only on
  screen/caption, no clock times.
- The stale *"first kickoff Friday"* line is gone (false by Saturday).

Re-rendered + gated today (`out/2026-08-14/wknd-dilemma-1.mp4` + `.txt`,
ALL CHECKS PASSED, safe-zone worst YMAX 39) — which also proves the frozen v1
path still renders identically under this session's pipeline changes.
**Saturday procedure:** `node weekend/render-dilemma.mjs wknd-dilemma-1`
(re-verifies every price on prod; drift throws), post the fresh render +
caption. **Reports alongside the experiment but does NOT count toward n=3.**

## The amended v2 spine — built and proven

Ticket bullet → implementation (all in this commit):

1. **10–14s**: `dilemmaS` grid = 402f = **13.4s** (task 72 / sideA 72 /
   sideB 72 / count 90 / closer 96). The a/b side reads are gone — at this
   length the cards + subtitles carry the sides; the voice carries question,
   3-2-1, CTA. That is the sweep's own conclusion: our function is
   prompt-bait, so we exit the 12–40s dead zone downward with less chrome,
   not more argument.
2. **Native subtitles mirroring all VO**: word-timed from the ElevenLabs
   timestamps already cached in `vo.json`, chunked at ≤4 words / terminal
   punctuation, Inter white-on-black-stroke, sentence case, bottom band
   reserved below the cards. A chunk bridges within its own cue but never
   across the silence between cues (first cut caught the question chunk
   squatting 5s waiting for the 3-2-1 — fixed at the source).
   Question line renders in the spoken first-person register, sentence case;
   ink/lime brand treatment stays on the cards (sweep spec change #2).
3. **Deadline in the spoken question AND caption lead**: `deadlineDay` /
   `deadlineWord` are facts, and `dilemma-v2-live.mjs` binds them to the
   EARLIEST kickoff among the edition's named players (once the first locks,
   the choice is gone), then asserts the word appears in the on-screen
   question, the caption lead, and — once voiced — the spoken line. Never
   hardcoded: a moved kickoff throws at render.
4. **One receipt row per card, BOTH sides, board-derivable only**: the gate
   RECOMPUTES each receipt from the live board — kinds `clubDearest`
   (uniquely the club's highest-priced pickable player) and `costMoreCount`
   (exactly N pickable players cost more). An unknown kind or a drifted claim
   throws: **an uncitable receipt cannot render**, which is the ticket's STOP
   made structural. `lastGwPoints` is permitted from Thu 21 but deliberately
   NOT implemented until prod exposes a settlement query — proposing it today
   throws.
5. **Withhold law**: untouched — same neutral card component, `task`/`count`
   render both sides neutral, the closer marks neither, no verdict in VO,
   caption, card or file. No winner state exists in `DilemmaV2.tsx`.
6. **Same-price A-vs-B**: the proof edition runs it; the three live editions
   are cast to it (below).

### Proof of the spine — `wknd-dilemma-smoke` (NOT FOR POSTING)

No FAL key is reachable this session, so no new VO line could be voiced. The
spine was therefore proven on a casting whose takes are already cached WITH
word timestamps: **Aubameyang (Deportivo, ATT, 8.0, v Elche MON) vs Budimir
(Osasuna, ATT, 8.0, at Celta Vigo SUN)** — live-verified on the GW1 board
today. Receipts, both gated true at render: *DEPORTIVO'S DEAREST PLAYER*
(next-dearest 6.5) / *OSASUNA'S DEAREST PLAYER* (next-dearest 7.5). Deadline
= SUN (Budimir's kickoff), carried in the on-screen question.

Rendered + full delivery gate: `out/2026-08-14/wknd-dilemma-smoke.mp4` —
13.46s container, 3/3 cues on frame, no dead air, safe zone worst YMAX 39,
frame-0 luma sane. Stills eyeballed: receipts on both cards, subtitles on all
three cues, count numeral on the card gap, closer complete by f385.

The one proof compromise, on the record: the smoke's spoken question reuses
the cached v1 take under `d2-q` ("Two strikers at eight flat for one slot."),
which predates the first-person-deadline register — so the gate's
spoken-deadline check is relaxed for `proof: true` editions only, and the
gate + caption + slug all shout NOT FOR POSTING. Proof editions are excluded
from no-arg verify/render runs; they render only when named.

## STOP — slots #5/#7/#10 cannot be cast this session

**The GW2 board does not exist on prod yet.** `fantasyMarket:getMarket` and
`getOpenGameweek` serve only the open gameweek; today that is GW1 (fixtures
Aug 14–17, `finalityAt` **2026-08-18 21:59 UTC**). GW2 prices, fixtures and
locks are unqueryable until GW1 reaches finality — so naming players for the
Tue/Thu/Sun editions today would mean inventing prices, which is the ticket's
first STOP (*unverifiable price*). The session therefore ships the amended
spine + gates + runbook, and each edition is cast **on its day** against the
then-live board. This is also just the format's law: prices are pulled fresh
from prod per edition.

### Day-of runbook (Tue 19 / Thu 21 / Sun 24 — ~30 min each)

1. Confirm the board turned: `node weekend/dilemma-v2-live.mjs` must report
   the new GW (or query getMarket; expect GW2 from Wed Aug 19 00:00-ish,
   after finality Tue 21:59 UTC). If GW1 is still open on Tue morning, STOP
   and flag the owner — the Tue slot slips rather than ships stale.
2. Cast the slate's shape as a **same-price A-vs-B** from the live board
   (slate themes — Tue: keeper premium, GK vs outfielder at the same price;
   Thu: deadline-eve contested mid-price pair; Sun: captain call,
   premium vs premium). It must be genuinely contested — opposed on real
   axes the board gives (venue, lock day, position, club) — or STOP (ticket:
   *no genuinely contested pair*).
3. `dilemma-v2-facts.json`: bump `gw`, add the edition row (copy the smoke's
   shape, `proof` absent, own id d3/d4/d5). Receipts from the implemented
   kinds; from Thu 21, `lastGwPoints` is allowed ONLY if prod exposes a
   settlement query — implement the kind against the real query first, else
   stick to price receipts.
4. `grid.json`: copy the `dilemmaS` block verbatim as `dilemma3` etc., swap
   the q cue key to `d3-q`. `weekend.mjs` ASSETS + `verify-reels.mjs`
   REELS/DENSEST (+180 into sideB) + `captions.mjs` get their one-line rows —
   caption = vote ask + deadline lead (the smoke caption is the template,
   minus the banner).
5. `reels-vo.mjs` LINES: the question, first-person, carrying the deadline
   word, ≤ ~3.4s by the estimator (commas cost 0.9s — prefer one terminal
   boundary). Voicing needs `FAL_KEY` (session-log paste; the 2026-08-10 key
   was live as of 2026-08-14).
6. `FAL_KEY=… node weekend/render-dilemma.mjs wknd-dilemma-N` — one command:
   prod re-verify → VO fit → render → delivery gate. Eyeball the stills
   (receipts both cards, no stale subtitle, count on the gap). Post; re-run
   if the board repriced between render and post.

## READ — keep/kill at n=3 (by Sun 24 post + a read Mon 25)

- n counts the **three AMENDED editions only** (Tue 19, Thu 21, Sun 24).
  Sat 16's as-built post reports alongside — it is the paid-vs-organic twin
  read, not an experiment point.
- Views: against the **560–2.5K** ladder band.
- Comments/1000 **co-primary**, calibrated by the sweep: the niche's
  best-ever ask-bait runs ~1.8/1000 while its median is 0.32 — so
  **≥1.5/1000 is elite**, 5/1000 extraordinary. Do not kill the format for
  missing a bar the whole niche misses; do kill it if it misses the view band
  AND sits at niche-median comment rates at n=3.
- If killed, wall-long enters the experiment lane (slate §1).

## Spend

VO $0.00 (all takes cached; smoke reuses `d2-q`/`dl-hold`/`dl-cta`). No
ledger spend — no career paths shown, `ledger.json` untouched.
