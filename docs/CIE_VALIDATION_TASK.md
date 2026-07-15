# VerveQ CIE — Planted-Error Validation Task

**Status:** Deliverables built; execution unproven — historical task brief from
2026-05-25, status corrected 2026-07-15. The original "not yet run" header is
half-stale: all four §10 deliverables now exist in `scripts/`, but nothing in the
repo evidences that the run was ever *executed*. The brief is kept as written for
the method, the corruption taxonomy, and the locked §9 thresholds. Companion to
`docs/CONTENT_INGESTION.md` (§6 cross-family verification, §10 step 1).

**State framing (per working discipline), as of 2026-07-15:**

- Complete in repo: yes. Golden set `scripts/cie-golden-geography.ts` (30 labelled
  items, 15 clean / 15 corrupted); verify runner `scripts/runCieValidation.ts`;
  scorer `scripts/scoreCieValidation.ts`; `scripts/CIE_VALIDATION_README.md`. The
  runner supports four model families — OpenAI / Anthropic / GLM / MiniMax
  (`scripts/runCieValidation.ts:26`) — exceeding the §5 ">=2" bar, with
  author-family != verifier-family enforced.
- Live in dev backend: no — offline by design, unchanged.
- Validated on reachable target: **unproven, and deliberately left flagged.** The
  runner's output root (`scripts/data/cie-validation/`, per
  `scripts/scoreCieValidation.ts:15`) is absent from the repo and no §10 go/no-go
  readout is committed. Having the runner is not having the result: the §9
  decision should be treated as still open until a readout lands.
- Blocked externally: no.

**Scope guardrails preserved:** offline only; no Convex, no seeding, no runtime;
no impact on `master` or branch runtime; server authority untouched. The only
output is a report and a go/no-go decision.

---

## 1. Goal — the one premise this gates

Before building any of the engine, prove the §6 cross-family verify loop reliably
catches a *deliberately planted* wrong fact and fails closed — without flooding
false positives on correct items. This isolates the single unproven premise of
the whole CIE. If it fails, the engine's verification approach must be reshaped
(see §9) before any plumbing is built.

## 2. Scope and boundary

- In scope: the **Verify** stage (`CONTENT_INGESTION.md` §4) in isolation, run
  against a fixed hand-built set.
- Out of scope (deliberately): Fetch, Author, Distractor, work-units, seeding,
  runtime. Riskiest-first — this tests only the part we can't yet trust.
- Subject: Geography only, reusing the Phase-0 ladder facts.
- Location: offline, in `scripts/`.

## 3. The golden set

A fixed, hand-built set of ~30 items with known ground truth. Each item:

```
{ stem, shape, correctAnswer, distractors,
  provenance: { claims: [{ claim, sourceType, sourceRef }], ... },
  label: "clean" | "corrupted",
  corruptionType?: 1..5 }
```

Roughly half clean controls, half corrupted. Ground truth and the corruption
label are known to the scorer but never shown to the verifier.

## 4. Corruption types (each tests a different failure surface)

1. **Wrong answer** — e.g. capital of Nigeria = Lagos.
2. **Also-correct distractor** — a "wrong" option that is actually true (semantic
   collision, beyond string-level distractor-collision).
3. **Stale/wrong volatile number** — a population off by a wide margin.
4. **Subtle plausible error** — a date wrong by just enough to flip a
   which-came-first ordering. The hardest case; the one most likely to slip.
5. **Provenance mismatch** — fact stated correctly, but the cited `sourceRef` does
   not actually support it. Tests that the verifier checks against the source, not
   its own confidence.

## 5. The verify runner

Implement only the Verify stage, wired to **>=2 model families**, with
author-family != verifier-family. For each item the verifier checks **every atomic
claim** against the cited `sourceRef` and emits `agree | disagree | flag`. Run
both family orderings to check symmetry. Persist raw verifier outputs for audit.

## 6. Determinism (adapted — models aren't deterministic, everything around them is)

Fix the golden set, the prompts, and the scoring; pin model versions; run K trials
per item (e.g. K=5). Report the catch-rate **distribution and worst-case floor**,
not a single pass. The floor across trials is the signal we trust.

## 7. Metrics

- Catch rate (recall) on corrupted items, broken out **per corruption type**.
- False-positive rate on clean controls.
- **Fail-open count** — any corrupted item that passed. The number that matters
  most.

## 8. Fail-closed assertions

- `disagree` / `flag` -> candidate blocked (never "shipped" in the mock output).
- Verifier error / timeout / missing verdict -> blocked, not passed. No verdict
  must never mean "ship it."

## 9. Go / no-go criteria (thresholds locked)

**GO** if, across K trials:

- catch rate >= **95%** on corruption types 1-3 (wrong answer, also-correct
  distractor, stale number),
- false-positive <= **5%** on clean controls,
- **zero** fail-opens on verifier error,
- and types 4-5 clear a bar the orchestrator is comfortable trusting.

**If types 4 (subtle ordering/date) or 5 (provenance) slip:** that is the finding,
not a failure. It means model judgment alone is insufficient for those classes,
and the engine must add a **deterministic structured-source assertion check**
(compare the claim to the source datum programmatically) rather than relying on
model verification. Cheaper to learn this on 30 questions than 30,000.

## 10. Deliverables

- the golden-set file (with ground truth, citations, corruption labels),
- the verify-runner wired to >=2 model families,
- the scoring/report script,
- a written go/no-go readout.

Roughly a day of agent work, not a week.

---

## Related docs

- `docs/CONTENT_INGESTION.md` — §6 (cross-family verification) and §10 step 1.
- `docs/CIE_SOURCING_POLICY.md` — the source classes / citability the golden set's
  provenance follows.
