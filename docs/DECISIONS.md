# DECISIONS — canonical owner decision log

The single canonical record of **owner decisions**: rulings that bind future
work, and that cannot be recovered by reading the code or the git history.

**Scope.** Owner rulings only. Not a changelog, not a design doc, not a status
report. If a fact is derivable from the code, it does not belong here.

**Pointer convention.** Entries backfilled from decisions already recorded
elsewhere link to the authoritative location; they do **not** copy its text.
Copied text drifts silently from its source. Where an entry says "recorded at
`<path>:<section>`", that location is the wording that governs — this log is the
index, not the original.

**Citation requirement.** A report-back claiming a decision is
"recorded"/"committed"/"landed" **must cite `path:line` or a commit SHA**.
Uncited claims are not accepted and the work is treated as not done. *Origin: the
P0-slice recording was reported done on 2026-07-19 and never landed — it was
still absent from the tree when R0.2 went looking for it on 2026-07-25.*

**Canonical paths.** `verveq-ticket-e1/`, `verveq-ticket-e2/` and
`verveq-ticket-f/` are stale snapshot copies of the tree and contain duplicate
copies of several files cited below. Every pointer here is to the canonical
`app/` path.

**Open questions live elsewhere.** This file is decisions already MADE.
Decisions still waiting on the owner are in
[DECISIONS_NEEDED.md](DECISIONS_NEEDED.md) — 6 open as of 2026-08-13. When one
of those is ruled, the ruling is recorded here and its entry there is closed.

Newest first.

---

## DECISION 2026-08-15 — The crowd number is POST-VOTE only; pre-vote anchoring is banned

**Ticket EYE-TEST-TEN.** The vote surface now shows the voter where the crowd
landed — "68% went with you" / "You're with the 32%" — and that reveal is
shown **only after the tap has landed**. No crowd share, tally, vote count,
lean, or bar may be rendered before the vote, on either card or anywhere on the
ballot screen.

This extends the EYE-TEST-CONTEXT ruling below rather than qualifying it: that
ruling banned evaluative numbers from the card because they re-anchor the vote
to an algorithm, and a crowd percentage in front of the ballot is the same
failure with a louder voice — it re-anchors the vote to other people. **The card
never argues, and neither does the crowd until the voter has spoken.**

Two sub-rulings, same principle:

- **Below a real sample there is no number at all.** Under
  `CROWD_REVEAL_MIN_VOTES` the surface says "you're one of the first on this
  one" rather than a fake-precise percentage off two other people.
- **A didn't-see earns no reveal.** It is not a vote; paying it with a crowd
  number would make not-watching worth farming.

Recorded in code at `app/convex/lib/fantasyCrowd.ts`
(`consensusRevealOf` docblock — the reveal's one derivation) and
`app/src/lib/weekendVoteCard.ts` (`revealTone`); the post-vote read order is
`app/convex/fantasyCrowdVoting.ts` (`castVoteFor`, where the tally is read
*after* the write so the voter counts inside his own crowd).

---

## DECISION 2026-08-14 — The eye-test vote card carries facts only, never an evaluative number

**Ticket EYE-TEST-CONTEXT.** The vote card gained the memory's address — club,
opponent, venue, league, kickoff day, scoreline oriented to the player's side,
minutes played, factual event icons (goals, assists, a red card) — and is
excluded, by this ruling, from ever carrying anything evaluative: **no fantasy
points, no ratings, no xG or derived metrics, no ownership.** The eye test
measures the crowd's eye, and any evaluative number on the card re-anchors the
vote to an algorithm. Yellow cards are also excluded, as noise rather than
principle. The card locates the memory; it never argues.

Recorded in code at `app/convex/lib/fantasyCrowd.ts` (`ServeCardContext`
docblock — the served payload's one context shape) and
`app/src/lib/weekendVoteCard.ts` (header); the payload assembly is
`app/convex/fantasyCrowdVoting.ts` (`ServedPlayer`). Kin to the FW-SCOUT
product law ("stats, never a recommendation" —
`app/convex/fantasyPlayerCard.ts` header): same principle, applied to the
voting surface, where the stakes are higher because the card sits directly
under the ballot.

---

## DECISION 2026-08-14 — Native subtitles: one factory-wide treatment, the DILEMMA one

**Backfilled from DILEMMA-B1, where it was resolved but recorded only in
component comments (`src/weekend/reels/DilemmaV2.tsx`) — which is how
LADDER-LONG-B3's first cut shipped a divergent version and had to be redone
the same day.** Recorded here so the next lane inherits it instead of
reinventing it.

Every narrated format that burns subtitles (MONID-SWEEP-2: 89% of niche
winners carry them) uses **one treatment**:

- **Chunks shown whole** — a word-timed chunk lands as one readable block,
  never accumulating word-by-word. Chunks break on terminal punctuation
  (`.!?,`) or at **4 words**, the auto-caption cadence.
- **Bottom-centered inside `SafeArea`** (`bottom: 0` of the safe region, so
  the block's baseline sits at the top of the platform caption strip) —
  where every platform burns its own captions, on every scene of the piece.
  One overlay for the whole reel, driven by absolute frame; a chunk bridges
  to the next chunk of its own cue but never across inter-cue silence
  (8-frame release when the voice stops).
- **Style**: sentence case, `FONTS.body`, weight 700, **46px**, white,
  four-corner 3px black stroke + `0 6px 0 #000`, `maxWidth 880`. Deliberately
  NOT brand type — the one standing exemption from the cream/ink/brand-type
  law, exactly as wide as the sweep finding.
- If a lane has UI where the band lands, **the UI moves, not the caption**
  (ladder-long's batch-3 score rail lifted 14px; posted batches keep their
  shipped geometry).

Word timings come from the VO manifest (ElevenLabs character timestamps), so
the subtitle text is by construction the TTS input — no transcript drift, and
a withheld rung can never leak through a caption because it has no take.

## DECISION 2026-08-14 — `chain-long` is KILLED; the experiment lane's slot passes to `the-dilemma`

**Ruled in the DILEMMA-B1 ticket.** `chain-long` ran as the experiment lane's
first occupant (CHAIN-LONG-B1, 2026-08-10) and has now reported at **n=2**:
**514 and 286 views** (figures as stated in the owner ticket). Both sit under
the **560 floor** of the 560–2.5K ladder band that the 2026-08-10 lane law set
as the keep/kill test, so the lane law applies as written: **killed, not
iterated.**

**Sources stay.** `tools/content-factory/src/promo/chainlong/` and its two
editions in `EDITIONS` are not deleted — the posted cuts must keep
reproducing, the same grandfathering principle as `GRID_5_5` in the entry
below. The format is **closed to new editions without a new owner ticket**.

The freed slot goes to the lane's second occupant, **`the-dilemma`**
(DILEMMA-B1, 2026-08-14) — one real draft decision per edition, no resolution,
judged on the same 560–2.5K band at n=2–3 **plus comments/1000 as a
co-primary**, because this format's job is votes rather than watch time. Sources
at `tools/content-factory/src/weekend/reels/Dilemma.tsx`; format doc at
`tools/content-factory/DILEMMA.md`.

## DECISION 2026-08-14 — Standalone product/promo reels are RETIRED, permanently

**Ruled in the DILEMMA-B1 ticket.** A reel whose *subject* is the product has
now returned a sub-300 result **five consecutive times** — THE GRIND, ONE
SQUAD, 2431 PTS, 36-games and Olise, spanning a **35–289** band (figures as
stated in the owner ticket). Five is past the point where the next one is worth
the slot.

**The standalone promo lane is closed permanently. Product marketing ships only
inside participation formats** — the pieces where the viewer is playing, arguing
or voting, and the product is the payoff frame rather than the subject. This is
the post-flop ruling already written into
`tools/content-factory/src/weekend/reels/timeline.ts` ("anything that looks like
an ad dies; native trivia first, product as the payoff frame, never the
subject"), now promoted from a per-reel note to a standing lane rule.

**No future session revives the promo lane out of hope.** Reviving it takes a
new owner ticket that says so explicitly; a run of good results in other lanes
is not a reason, and neither is a new idea for an ad.

Not affected: paid placements, which are a different instrument with a
different register and their own gate — `wknd-42h` (CF-42H) is a conversion
asset bought in front of cold traffic, not an organic slot competing on reach.

---

## DECISION 2026-08-10 — 7.00s is the standing pace; the 5.50s arm is retired

**Ruled in the CHAIN-LONG-B1 ticket.** The batch-2 cadence A/B has reported:
the two 7.00s control editions took **2.5K and 1.5K**; the two 5.50s editions
took **1.6K and 563** (figures as stated in the owner ticket). The measured
5.5–7.02s winner band contains both paces, but this account's audience lives at
the slow end of it.

**7.00s per rung/slot is the standing pace for every future gauntlet-lane
cut.** No new edition renders on the 5.50s grid without a new owner ticket.
`GRID_5_5` stays in `tools/content-factory/src/promo/ladderlong/timeline.ts` —
`old-guard` and `grand-tour` are posted and their sources must keep reproducing
what went out — but it is closed to new editions.

## DECISION 2026-08-10 — The experiment lane: ladder banks its slots; one slot a week runs one new format

**Ruled in the CHAIN-LONG-B1 ticket.** The weekly slate is now structured:

- **`ladder-long` is the banker** at ~4 slots/week, on the standing 7.00s pace.
- **1 slot/week is the experiment lane**: it runs exactly **one** new format at
  a time, judged against the ladder band — **560–2.5K**, the spread of the four
  batch-2 editions above — at **n=2–3 editions**, then **kept or killed**. Two
  new formats never run in the same week; a result that can't be attributed is
  not a result.

First occupant: `chain-long` (CHAIN-LONG-B1, 2026-08-10) — the relay mechanic
wearing the ladder-long winner spec. Sources at
`tools/content-factory/src/promo/chainlong/`.

---

## DECISION 2026-08-05 — Geometry baselines must be checked for cross-viewport invariance before being declared canonical

**Ruled during HF-3B.** A measured layout value is only a *baseline* if it holds
across viewports. Otherwise it is an artifact of the viewport it was measured
at, and pinning to it freezes a bug.

HF-3 censused the v2 home cards at 1600×1200 and reported e.g. "Duels/Arena/Quiz
207×130". HF-3B then set those as the canonical sizes to preserve. They were not
sizes the cards had — they were what `grid-rows-[1.5fr_0.9fr]` yields from an
800px frame. The same tile measured **207×51 at 1280×657**: the fr rows crushed
it as readily as they ballooned it. The acceptance criterion built on that
premise ("dimensions pixel-identical to the capped census, all viewports") was
unsatisfiable by construction, because the census held two different heights for
one card.

**The rule:** before calling a measured value canonical, measure it at ≥2
viewport heights and confirm it does not move. If it moves, it is frame-derived
and the correct target is the content-true value, not any single observation.

Applied consequence: the v2 shell now sizes cards from content, so a taller
screen shows MORE cards, never bigger ones — and `xl:max-h-[50rem]`
(`378c561`, 2026-06-11), which existed only to stop frame-derived cards
ballooning, was removed as no longer load-bearing.

---

## DECISION 2026-08-01 — Content-factory sources track in the main repo

**Supersedes the 2026-07-29 local-only ruling** recorded in commit `4378216`
("chore: untrack tools/content-factory — local-only lane, never pushed"), which
removed the 14 tracked skeleton files from the index and excluded the directory
in `.gitignore`.

The ruling now is: **factory sources track in the main repo; generated output
stays ignored.** Generated means the three trees excluded by
`tools/content-factory/.gitignore` — `out/`, `public/sfx/`, `public/promo/` —
all re-derived by `sfx/gen.mjs` and `promo/*-audio.mjs` before every render.
Everything else tracks, including the committed source assets the render depends
on and cannot reproduce: `public/dave/*` (AI source footage — checked in so a
batch never depends on a re-roll), `public/product/*` (screen recordings) and
the VO caches `promo/vo-cache/` + `promo/vo-cache-ladderlong/` (so a clone with
no `FAL_KEY` still renders the narrated pieces).

**Why the reversal was forced.** Under the local-only rule the entire promo,
Dave and retention lanes lived only in a working tree. Commit `24884db`
("chore(content-factory): track the promo + dave lanes", 2026-07-26) had already
tried to fix exactly this — it added 143 files — but it lived on branch
`content/batch-next-stier-casting`, which was reset back to master on 2026-07-27
00:17, orphaning it. The work survived only as a dangling object and would have
been pruned by `gc` around 2026-08-10. It is now preserved on `rescue-batch-next`
(at `24884db`) and `content/batch-next-stier-casting` (restored to its true tip
`ede1233`).

That branch was **not** merged into master: `git merge-tree` showed 10 conflicts
(one content, nine modify/delete) whose default resolution would have reverted
`ledger.json` from 92 spent ids to 45 — freeing 40 ids for the quiz lane to
re-post — and un-registered `LadderLong` from `Root.tsx`. Master's working tree
already held the newest content of every one of those files, so the sources were
added directly on master instead. The orphaned history is preserved on the two
branches above rather than merged.

## DECISION 2026-08-01 — SFX seed epoch accepted; batch-1 MP4s grandfathered

`tools/content-factory/promo/audio-lib.mjs` shared **one** module-level
`makeRng(1337)` across every synth in the process, so a promo's noise depended on
how many synth calls had already run. `node promo/x-audio.mjs` and
`npm run promo` — which imports ~29 audio modules that each build their
arrangement at import time — produced **different beds for the same promo**. The
clean-clone test in LADDER-LONG-TRACK-3 caught it: byte-identical video frames,
different audio.

Fixed by seeding per promo from its stable name (FNV-1a of `name + "|sfx"`, the
same salting as the visual variant axes), in the `Mixer` constructor so there is
no separate step to forget.

**The ruling is that the resulting epoch is accepted.** Every promo's SFX bed
changes at this commit. Video is unaffected — frames are byte-identical across
the change; only the noise component of the audio moves.

**Batch-1 `ladder-long` MP4s are grandfathered as final artifacts.** The four
files in `tools/content-factory/out/2026-08-01/` were rendered before the seed
change, verified (21/21 VO cues on frame, all sampled frames matching a clean
clone), and are the ones that ship. They are **not** re-rendered to pick up the
new bed. Anything re-rendered from here — including a re-cut of those four —
carries the new bed, and that is expected, not a regression.

## DECISION 2026-08-01 — No trending sound on narrated formats

The daily-workflow instruction in `tools/content-factory/README.md` — upload the
MP4, then add a trending sound in-app — **does not apply to any format carrying a
voiceover**, currently `semi-final` and the four `ladder-long` editions.

Two reasons, one measured and one structural. Measured: all four faceless winners
coded in `research/ig-competitor-sweep/FACELESS_WINNER_SPEC.md` (§ spec #11) ran
original audio with `music_info: null` and `is_trending_in_clips: false` — a
trending sound is not what carried them. Structural: `ladder-long` is paced *by*
the voice (the count-in, the 3-2-1, the spoken withhold), so a song over the top
fights the thing the format is built on.

Silent formats keep the trending-sound step; it still helps distribution there.

---

## DECISION 2026-07-29 — Draft-room auto-pick and default sheet are price-based

The FW-3 owner rulings R1 and R6 (2026-07-29) **supersede** DRAFT_ROOM_SPEC
ledger items 2 and 3 as locked 2026-07-28: auto-pick and the default team sheet
run on the FW-PR1c/FW-PR2 **price surface** (price desc → proxy desc → pool
priority topfive > promoted > flagged; default sheet 4-4-2 by price, two
lowest-priced as finishers), not on the "v5 editorial rating", which no longer
exists anywhere on the players table after the direct-value pricing pass.

Confirmed by owner at the FW-3 STOP report, 2026-07-29 — the conflict was
surfaced rather than resolved silently, per the ticket contract.

Recorded at `research/fantasy/specs/DRAFT_ROOM_SPEC.md` v1.1.0 (changelog entry
and amended ledger items 2–3) — that wording governs.

---

## DECISION 2026-07-25 — Mode candidate gating is two-stage

Candidate game modes are gated in two stages, not one.

**Paper round** — a candidate is judged on:

- **G2** — named heartbeat.
- **G3** — sourceable content.
- Weighted rubric score.

**Adapter stage** — **G1** (zero-knowledge sim test, `recallShare`) applies here
and only here. A paper survivor must still clear G1 before prototyping.

This ordering is **intentional, not a contradiction**: G1 requires an adapter,
and adapters are only written for paper survivors. A candidate therefore passes
G2/G3/rubric first and meets G1 second.

**`recallShare` threshold: not set.** It is an owner decision, to be made after
the calibration pair results are in, and recorded in this entry when set.

Harness that produces `recallShare`: `research/modes/` (standalone; ships
nothing to users). Calibration pair results are in `research/modes/reports/`.

---

## DECISION (backfill) — P0-slice acceptance criterion, owner-signed

The P0-slice acceptance criterion is:

- **per-slice ≥ 98.5%** (≤ 3 dead at N = 200), **AND**
- **pooled P0-set ≥ 99.4%**, **AND**
- **≤ 1 slice at the 98.5% floor.**

**Supersession — ruled 2026-07-25 (R0.3).** This criterion **supersedes the
P0-set Tier-2 pooled figure** for card-set acceptance. The pooled figure was
amended **99.5% → 99.4%** by owner sign-off (E5 arc, 2026-07-19); the per-slice
floor (98.5% at N = 200) and the concentration cap (≤ 1 slice at floor) were
added at the same time. **c13-2** and **c13-3** were re-scored **PASS** under the
amended criterion from existing logs.

**P0-config and P0-runtime are untouched by this ruling:**

- **P0-config (Tier 1)** — pooled full-clear ≥ 97% across the 10-set rotation;
  per-set P0 is a report-only diagnostic. Recorded at
  [`app/src/lib/drawEngine/DECISIONS.md`](../app/src/lib/drawEngine/DECISIONS.md)
  § "Ticket 0.4 … the STOP-4 ruling", summarised in
  [`app/scripts/drawSim/README.md`](../app/scripts/drawSim/README.md).
- **P0-runtime (CONTRACT INVARIANT)** — production serving must pass
  `detectDeadBoard`; the player-facing dead-board rate is 0% by construction, not
  a statistical promise. Recorded at
  [`app/src/lib/drawEngine/types.ts`](../app/src/lib/drawEngine/types.ts) docblock
  and the same DECISIONS.md section.

The superseded Tier-2 text at
[`app/src/lib/drawEngine/DECISIONS.md`](../app/src/lib/drawEngine/DECISIONS.md)
§ "Ticket 0.4 … the STOP-4 ruling" is left in place with an appended amendment
note pointing here — the original ruling is not rewritten.

> ⚠️ **This entry remains the criterion's only recorded home in the repo.** The
> supersession is now ruled, but the underlying figures still have no upstream
> pointer. The R0.2 template expected a pointer to "the accept-protocol docs". No
> such document exists, and a search of the repo found no trace of these figures:
> not `98.5`, not `99.4`, not `N=200`, and no "slice" acceptance vocabulary
> anywhere. The numbers above are transcribed from the owner-signed ticket, which
> is why they are recorded rather than reconstructed — but nothing in the tree
> corroborates them, and the c13-2 / c13-3 PASS re-scores are likewise uncited.
> See the citation requirement in the header.

---

## DECISION (backfill) — THE DRAW engine freeze + STOP-3 ruling (Ticket 0.3)

Recorded in full at
[`app/src/lib/drawEngine/DECISIONS.md`](../app/src/lib/drawEngine/DECISIONS.md):

| Element | Authoritative location |
| --- | --- |
| STOP-3 ruling — emergent near-miss clustering under rational play accepted as a genre property; guard is mechanism invariants, not a rate band | § "Ticket 0.3 (owner-ordered, 2026-07-16): P2 amendment — the STOP-3 ruling" |
| First-playtest primary question on record — *"do busts feel fair?"* | same section, final bullet |
| Empirical support for the ruling (C2 near-miss attribution) | § "Ticket 0.4 … the STOP-4 ruling", closing paragraph |
| Engine freeze — additive knobs only by owner ticket, sim-gated | § "Acceptance outcome (Ticket 0.4) — PASS 10/10; CONTRACT v1.0 frozen" |

Freeze also asserted in-code at
[`app/src/lib/drawEngine/types.ts`](../app/src/lib/drawEngine/types.ts) (header
docblock) and restated in
[`app/scripts/drawSim/README.md`](../app/scripts/drawSim/README.md); the STOP-3
ruling is cross-referenced from
[`app/scripts/drawSim/metrics.ts`](../app/scripts/drawSim/metrics.ts).

**Contract version — ruled 2026-07-25 (R0.3).** The engine contract is **v1.0**,
as the tree and the `draw-engine-v1.0` tag state. The "v1.1" label was
chat-handoff drift with no amendment content anywhere in the repo; there is
nothing to re-issue.

---

## Open items

Carried here so they are not lost between tickets. These are questions for the
owner, not decisions.

1. **`recallShare` threshold.** Unset pending calibration-pair review; record it
   in the 2026-07-25 entry above once decided.

### Closed

- ~~**CONTRACT version.**~~ Ruled 2026-07-25 (R0.3): contract is v1.0; "v1.1" was
  labeling drift with no amendment content. See the engine freeze entry above.
- ~~**P0-slice vs P0-set.**~~ Ruled 2026-07-25 (R0.3): P0-slice supersedes the
  P0-set Tier-2 pooled figure. See the P0-slice entry above.
