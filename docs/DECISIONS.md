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

Newest first.

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
