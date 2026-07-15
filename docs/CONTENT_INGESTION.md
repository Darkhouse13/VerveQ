# VerveQ Content Ingestion Engine (CIE) — Architecture Spec

**Status:** Partially shipped — historical design record from 2026-05-25, status
corrected 2026-07-15. The original "Design — not yet implemented / does not
describe shipped code" header is wrong: the engine's output path shipped and is
live. But it did **not** ship as specified — the work-unit, batch-metadata, and
Learn-tier *tables* below were never built, and content ships in-bundle instead.
This doc remains authoritative for the intended architecture and the reasoning;
it is not a description of the current schema. Per-section markers flag which is
which.

**State framing (per working discipline), as of 2026-07-15:**

- Complete in repo: **partially.** 24 CIE content batch modules ship, all marked
  eligible in `app/convex/knowledgeCieScoreBatchRegistry.ts:181`. They are
  consumed by `app/convex/challengeArenaCieContent.ts:153`
  (`buildArenaCieSeedPlan`) and `app/convex/learnQuestionSkillTags.ts:2`
  (Learn tagging). What did *not* ship: the `workUnits` (§3, §10),
  `contentBatchMetadata` (§9, §10), and `learnMeta` (§7) tables do not exist in
  `app/convex/schema.ts`.
- Live in dev backend: yes — batches ship in-bundle (no seeding step for CIE
  content) and are read on the live Arena path via `arenaCieSeedPlan()`
  (`app/convex/challengeArenas.ts:31`).
- Validated on reachable target: batch content flows through the existing
  harness/registry gates. The §10-step-1 planted-error verify-loop validation —
  the premise the whole design rests on — has runner and scorer built but **no
  committed result**; see `docs/CIE_VALIDATION_TASK.md`.
- Blocked externally: no.

**What shipped vs. what is still design:**

| Section | State |
|---|---|
| §4 four stages, §5 provenance, §6 cross-family verify | Shipped as an offline authoring convention; each batch records `authorModel` / `verifierModel` / `verdict` and per-claim provenance in-module. |
| §3 work units, lease/claim mutation | **Still design.** No `workUnits` table; `workUnitId` is carried per batch as a literal with no backing table. |
| §7 Learn-mode `learnMeta` layer | **Still design.** No `learnMeta` table; Learn tagging is derived in `learnQuestionSkillTags.ts`. |
| §9 `contentBatchMetadata` table | **Still design.** Batch metadata ships in-module (e.g. `knowledgeGeographyCieScoreBatchV1Metadata`) rather than in a table. |

**Scope guardrails preserved:** server-authoritative answer checking is untouched
(clients never see `correctAnswer`); the existing QA harness remains the
fail-closed gate; Survival and the curated football-only modes are not in scope;
CIE never targets the live backend (`different-lynx-153` / verveq.com) or the staging backend (`admired-warthog-495`) without the parity approval flow.

---

## 1. What it is, and what it deliberately isn't

The CIE is an **offline, multi-agent content-authoring pipeline** that continuously
fills the question bank from trusted sources, gated by the existing QA harness,
driven by where the bank is thin. It produces committed content batches that the
existing `deploy → seed → verify contentStatus` flow ingests. It does not run at
request time and is never on the player's critical path.

It is distinct from **The Forge**, and the distinction matters: Forge is *humans
submit, community votes*; CIE is *agents source, models cross-verify, harness
gates*. Both feed `quizQuestions`; neither replaces the harness.

**Goals:** grow the bank massively across all subjects and shapes; keep every fact
strictly sourced and verified; be driven by real gaps so tokens go to the long
tail, not redundant easy questions; meet a higher bar for Learn-mode content.

**Non-goals** (each is a way to silently rot quality):

- No scraping prose.
- No LLM-asserted facts without grounding.
- No bypassing the harness.
- No deploying to the live dev backend. CIE output is validated on the branch /
  separate dev deployment per the git strategy.

## 2. Where it sits (nothing downstream changes)

```
[ skill-graph gaps  ]                          existing pipeline, unchanged
[ contentStatus gaps] -> WORK UNITS -> CIE -> batch -> harness -> deploy -> seedContentGaps -> verify contentStatus
                                        ^
                          fetch . author . distractor . verify (multi-agent)
```

CIE *is* the automated author stage. The harness is still the gate; seeding is
still per-deployment; `quizQuestions` is still the runtime answer source of truth;
server authority is untouched.

## 3. Work-unit model — parallel agents fill gaps instead of piling on

> **Still design (2026-07-15).** No `workUnits` table exists in
> `app/convex/schema.ts`; there is no lease/claim mutation. Shipped batches carry
> a `workUnitId` literal in their in-module metadata, so the *concept* survives as
> a labelling convention, but the coordination machinery below was never built.

The failure mode of "spin up many agents" is that they all author *capital of
France* and ignore the long tail. The fix is to make agents pull **work units**
rather than free-author.

A work unit is a slot the bank is short on:

```
{ workUnitId, subject/sport, category, shape, difficulty, targetCount, claimedBy?, leaseUntil?, status }
```

Two things generate work units, and this is the key sequencing insight:

- **`contentStatus` gaps (available now):** the existing content-status reporting
  already knows counts per sport/category/difficulty. That alone defines
  score-mode work units. **So CIE can start growing the score-mode bank
  immediately — it does not wait on Learn.**
- **Skill-graph gaps (arrive with Learn):** once the Learn skill graph exists, its
  under-filled nodes (e.g. `geography / capital-vs-largest / hard: needs 12`)
  generate Learn-mode work units.

Agents **claim** a unit with a short lease (so two agents don't author the same
slot), produce candidates, and the lease releases on completion or expiry. Final
dedup is still enforced downstream by `checksum`, so a claim race can never
produce duplicates — claims just save tokens.

## 4. The four stages and the candidate record

A single artifact — the **candidate** — flows through four stages, accreting
fields. Each stage is an agent contract, so stages can be assigned to different
model families.

| Stage | Consumes | Produces | Contract |
|---|---|---|---|
| **Fetch** | a work unit | atomic fact(s) + provenance | Pull facts for the slot from approved structured sources only. Emit each fact with its source and the exact supporting datum. No phrasing yet. |
| **Author** | facts | question stem + correct answer in the unit's shape | Turn facts into a question of the right shape (MCQ / numeric-estimation / which-came-first / etc.). Carry provenance forward. Compute the `checksum`. |
| **Distractor** | authored stem | distractors | Score-mode: plausible, collision-safe wrong options. Learn-mode: misconception-mapped distractors with per-distractor reveals (see §7). |
| **Verify** | full candidate | verdict + verifier metadata | Independent, cross-family check of *every atomic claim* against the cited source (§6). Emit agree / disagree / flag. |

Claim-level verification matters: for a population numeric question the verifier
confirms the number *and* its freshness; for a capital MCQ it confirms the answer
*and* that no distractor is also-correct; for which-came-first it confirms both
dates *and* the ordering.

## 5. Provenance schema (every question carries its receipts)

```
provenance: {
  claims: [
    { claim: "capital_of(Nigeria) = Abuja",
      sourceType: "structured_open",
      sourceRef: "<source id / record>",
      retrievedAt: <timestamp>,
      volatility: "static" | "volatile" }   // populations etc. = volatile
  ],
  authorModel:   "<family/version>",
  verifierModel: "<different family/version>",
  verdict: "agree" | "disagree" | "flagged",
  batchId, workUnitId
}
```

Volatile facts (populations, "current X") carry `retrievedAt` and a `volatility`
flag so the harness can enforce a freshness/staleness policy and re-verification
cadence. This is the shifting-population / renamed-capital class of risk made into
a gate instead of a landmine.

## 6. Cross-family verification — turning multiple agents into error decorrelation

This is the heart of the spec. An agent re-reading its own question and saying
"yep, correct" is not verification — a verifier from the same family will
confidently confirm the same hallucination. So:

- **Author family != verifier family.** Author with one (e.g. Claude), verify with
  another (Codex / GLM / MiniMax). Spend tokens on independence, not volume.
- **Verify against the source, not the self.** The verifier checks claims against
  the cited `sourceRef`, not its own priors.
- **Disagreement fails closed.** Agree -> candidate proceeds to the harness.
  Disagree or flag -> review queue (a third model family as tiebreak, or human),
  never silently shipped.

By analogy to the repo's destructive-action discipline: shipping an unverified
fact into a *learning* product is the harm we fail closed against. Default-deny.

## 7. The two content tiers (an additive schema split, not a forked table)

> **Still design (2026-07-15).** No `learnMeta` table exists in
> `app/convex/schema.ts`. Learn-mode tagging is instead derived in
> `app/convex/learnQuestionSkillTags.ts` from the batches flagged `learnTagged`
> in the registry. The misconception/reveal teaching object below is unbuilt.

`quizQuestions` stays the lean runtime answer source of truth — score-mode and
runtime answer-checking read it, server authority unchanged. Learn-mode's extra
"teaching" data lives in an **additive learning layer keyed by `checksum`**,
following the precedent of the curated approved layers
(`verveGridApprovedIndex` et al.): derive a richer view without bloating the base
row.

- **Score-mode question** (Quiz / Blitz / Daily / Arena): the existing
  `quizQuestions` row — accurate, collision-checked distractors, plus provenance.
  Bar = correct + fair.
- **Learn-mode teaching object** (additive layer over the same row):

```
learnMeta[checksum]: {
  skillNodes: [...], difficultySlot,
  distractors: [
    { text, misconception: "famous city = capital",
      whyChosen: "Sydney is Australia's most famous city",
      reveal: "Not Sydney — Canberra was purpose-built in 1913 ..." }
  ],
  correctReveal: "Canberra — purpose-built as a neutral compromise ..."
}
```

On the Learn track the Distractor agent isn't just writing wrong options, it's
authoring the *misconception model and the per-distractor reveal*. That metadata
powers the wrong-choice-specific reveals in the Phase-0 ladder (pick Sydney, get
the Sydney correction).

## 8. Harness extension (fail-closed, additive to existing gates)

Existing gates stay (structural, dedup, distractor-collision, fairness). New gates:

- **Provenance-resolvable:** every claim resolves to a source; no orphan facts.
- **Author/verifier agreement:** disagree or flagged = blocked.
- **Volatile-fact freshness:** stale volatile claims = blocked until re-verified.
- **Learn-mode completeness (Learn batches only):** every distractor has a
  misconception tag *and* a reveal; `skillNodes` exist in the graph;
  `difficultySlot` matches the work unit; the graph stays acyclic.

A blocked candidate is dropped or queued — never force-shipped.

## 9. Output, batching, seeding

> **Partially shipped (2026-07-15).** The committed-batch-artifact idea shipped:
> 24 batch modules live in `app/convex/`, each with an in-module metadata export.
> The `contentBatchMetadata` *table* was never built, and CIE content is not
> seeded — it ships in-bundle and is read directly on the Arena path
> (`app/convex/challengeArenas.ts:31`), so the `seedContentGaps` route below
> describes an intent that the implementation sidestepped.

- Passing candidates are written as a **committed batch artifact** (the audit
  trail travels with code, like the curated approved layers; seeds are
  per-deployment and don't travel, so the *artifact* does and the *seed* runs per
  target).
- A lightweight `contentBatchMetadata` table (mirroring `curatedSeedMetadata`)
  records batch version, hash, counts, and where it's been seeded.
- Ingest via the existing `seedContentGaps` / idempotent upsert by `checksum`.
  **Bounded batches** to stay under Convex transaction limits (the same constraint
  the crons already respect).
- Validated on the branch / separate dev deployment. The live dev backend is not a
  CIE target.

## 10. Workstream slicing (parallelizable)

- **Codex (backend):** `workUnits` + `contentBatchMetadata` tables and indexes; the
  lease/claim mutation; provenance fields on the candidate/batch artifact;
  idempotent batch-seed integration; the learning-layer table keyed by `checksum`;
  the `contentStatus` -> work-unit generator (score-mode, buildable now).
- **Harness owner:** the four new gates in §8, fail-closed, with deterministic test
  seams.
- **Agent runners (live in `scripts/`, offline):** the four stage contracts (§4) as
  normalized, model-agnostic interfaces so any family can fill any stage; the
  cross-family pairing/decorrelation logic; the disagreement -> review queue. This
  is where Claude / Codex / GLM / MiniMax get wired in.
- **Sourcing policy doc:** the approved structured-source list *per discipline*
  (the long pole for accuracy and IP cleanliness — decide this early).

**Sequence, riskiest-first:**

1. Prove the cross-family verify loop catches a *deliberately planted* wrong fact
   on a small score-mode slot end-to-end. That's the whole bet.
2. Stand up work units from `contentStatus` and grow one score-mode subject's bank
   for real.
3. Layer the Learn-mode teaching-object tier once the skill graph exists.
4. Scale breadth across disciplines.

## 11. Open questions / risks

- **Source selection per discipline** is the real accuracy lever and the thing most
  likely to bite. Structured facts (capitals, dates, magnitudes) are clean; softer
  subjects (arts interpretation, nuanced history) have no single authoritative
  source and may not be CIE-suitable at all. Be willing to say *some subjects
  aren't ingestible this way.*
- **Volatile facts** need an owner for the freshness cadence, or the bank slowly
  goes stale-and-wrong.
- **Learn-tier authoring cost** is real — misconception models + per-distractor
  reveals are the priciest content you'll make; the graph-gap driver keeps it
  targeted.
- **Disagreement-queue volume:** a high cross-family disagreement rate is a quality
  signal (bad source or weak family), not just a chore.
- **Runner location** (`scripts/`) and the live app path (`app/`) must both
  be confirmed before Codex writes anything.

---

## Related docs

- `docs/NEW_GAME_MODES.md` — curated approved-layer precedent this design reuses.
- `docs/CHALLENGE_ARENA.md` — `quizQuestions` content sourcing + `contentStatus`.
- Learn-mode vision / Phase-0 ladder spec — consumer of the Learn-mode tier.
