# CIE Batch Runbook — Shape Expansion (free-text / numeric / ordering)

> **STATUS: SUPERSEDED PROPOSAL — historical. Do not author against this document.**
> *Fenced 2026-07-15.*
>
> This was a proposal whose own freeze gate was "confirm the grader contract on
> `feat/learn-mode`". That branch no longer exists, and the grader shipped on `master` with
> a **materially different contract**. The proposal was never reconciled with it, so every
> `grading` block below is fiction as written.
>
> **The real contract is `app/convex/learnGraders.ts`.** Read it there, not here:
>
> | This doc proposes | What actually shipped (`learnGraders.ts`) |
> | --- | --- |
> | Shapes `free_text`, `numeric`, `ordering` (§2, §3A) | `LearnQuestionType = "mcq" \| "text" \| "numeric" \| "order"` (`:3`) — different names |
> | A `grading: { mode, … }` wrapper object | **No wrapper.** Fields are flat on the question (`LearnGradableQuestion`, `:12–26`) |
> | `acceptedAnswers` + `normalization` block (§3A.1) | `acceptedAnswers` (`:19`), flat; no normalization sub-object |
> | `canonicalValue` / `unit` / `tolerance: {type,value}` (§3A.2) | `numericAnswer` (`:21`), `numericUnit` (`:23`), `acceptedUnits` (`:24`), and a **scalar** `numericTolerance` (`:22`) — no abs/rel discriminator |
> | `items` / `canonicalOrder` / `orderingKey` / `match` (§3A.3) | `correctOrder: string[]` (`:25`) only |
> | "**No fuzzy / edit-distance / substring acceptance**" (§3A.1) | **False — fuzzy shipped.** `learnGraders.ts:1` imports `levenshteinDistance` from `./lib/fuzzy`; `:20` exposes `textEditDistance` |
>
> Kept for the reasoning that is still sound and contract-independent: the GREEN eligibility
> tests, the §5.FT / §5.NUM / §5.ORD ambiguity blocks, the dedup-key generalization (§6), and
> the per-shape N=1 solo proof (§7). Those arguments survive; the field names do not.
>
> Anyone reviving shape authoring: re-derive §3A and §6 from `learnGraders.ts` first, then
> unfence. Cross-family model verify stays mandatory per item — nothing here replaces it.
>
> ---
>
> *Original banner, as written:*
>
> > **Drop-in extension for `docs/CIE_BATCH_RUNBOOK.md`.** Splice the lettered/numbered
> > blocks below into the matching sections of the runbook. Where a block says
> > *replaces*, swap the named text; where it says *add*, append.
> >
> > **STATUS: PROPOSED — do not freeze until both are confirmed on `feat/learn-mode`:**
> > 1. **Grader contract.** The `grading` field names/types below are *proposals*. They
> >    must match what the Learn v2 server-authoritative grader actually consumes. If the
> >    grader doesn't yet support a shape, that shape is not authorable — STOP and escalate.
> > 2. **Provenance schema.** Reconcile field names against `docs/CONTENT_INGESTION.md` §5
> >    (provenance) so shape rows carry the same per-claim provenance as MCQ rows.
> >
> > Until frozen: **no shape authoring volume.** Each shape still solo-proves at N=1 (§7).
> > Cross-family model verify stays mandatory per item — nothing here replaces it.

---

## §1 — amend the shape invariant

**Replaces** the "*Question shape: standard MCQ only*" bullet:

- **Question shape:** limited to the shapes registered in **§3A (Shape registry)**. MCQ is
  the default. `free_text`, `numeric`, and `ordering` are registered shapes — each
  **GREEN-only**, each requiring its own **N=1 solo proof** before it windows (§7). A shape
  **not** in §3A escalates to the orchestrator (§11) and is never authored here. The "ladder"
  tier remains a difficulty-ordered container over registered shapes, not a new shape.

---

## §2 — amend naming for non-MCQ shapes

**Add.** Existing MCQ batches keep their current names (no rename). For new non-MCQ shapes,
insert a `<Shape>` token into every derived name so shapes of the same `subject + N` cannot
collide:

- `<Shape>` ∈ `FreeText` | `Numeric` | `Ordering` (MCQ token omitted for back-compat).
- File: `app/convex/knowledge<Subject><Shape>CieScoreBatchV<N>.ts`
- Batch id: `knowledge_<subject>_<shape>_cie_score_v<N>`
- Stable IDs / checksums: `knowledge_<subject>_<shape>_cie_score_v<N>_001 .. _NNN`
- Unchanged: questions array is the **DEFAULT export**; `...Metadata` export;
  `wikidataSourceRecords` export.

---

## §3A — Shape registry (NEW subsection, after §3)

Each shape lists its item schema (**proposed**, pending grader contract), the
server-authoritative grading rule, GREEN eligibility, and a pointer to its §5 collision block.
Per-claim provenance is unchanged across shapes
(`sourceRef = wikidata:<QID>:<Pxx>:...:snapshot-<date>`; `volatility "static"`;
`verdict "pending"`; `verifierModel "pending_anthropic_verification"`).

### §3A.1 `free_text` (recall)

```ts
// proposed grading block
grading: {
  mode: "free_text",
  acceptedAnswers: string[],   // EXHAUSTIVE: canonical + every valid synonym / alias / spelling
  normalization: {             // fixed + documented; applied identically at author and grade time
    lowercase: true,
    stripDiacritics: <bool>,   // policy-set per subject; state once and hold
    trimEdgePunctuation: true,
    collapseWhitespace: true
  }
}
```

- **Server grade:** accept iff `normalize(submission)` is a member of
  `{ normalize(a) | a ∈ acceptedAnswers }`. Exact set membership after normalization. **No
  fuzzy / edit-distance / substring acceptance.** Empty/whitespace submission → reject.
  Missing or empty `acceptedAnswers` → grading-spec invalid → fail closed (§6).
- **GREEN eligibility:** the prompt must have a **closed, enumerable** answer set at the
  source's granularity. Exclude any prompt whose source admits more than one correct answer you
  cannot fully enumerate.
- **Collision/ambiguity:** §5.FT.

### §3A.2 `numeric`

```ts
// proposed grading block
grading: {
  mode: "numeric",
  canonicalValue: number,                       // single canonical OR exact-by-definition value only
  unit: string,                                 // from the subject's allowed unit set ("" only if dimensionless)
  tolerance: { type: "abs" | "rel", value: number }   // value >= 0
}
```

- **Server grade:** parse submission to value + unit; reject on unit mismatch (no silent unit
  coercion unless an explicit allowed-conversion table is part of the spec). Accept iff
  `|submitted − canonicalValue| <= band`, where `band = (type==="abs" ? value : value*|canonicalValue|)`.
  Exact-by-definition / counted values use `tolerance.value === 0`. Non-numeric submission →
  reject. Negative tolerance or missing unit → grading-spec invalid → fail closed.
- **GREEN eligibility:** value is canonical or exact-by-definition **and static**. Measured,
  estimated, time-varying, or "current" quantities are **AMBER → default-deny** (§4).
  Representational rounding (a constant quoted to *k* decimals) is GREEN only if the tolerance
  documents the rounding **and** the band cannot admit a different true value.
- **Collision/ambiguity:** §5.NUM.

### §3A.3 `ordering`

```ts
// proposed grading block
grading: {
  mode: "ordering",
  items: [{ id: string, label: string }],   // the set to arrange
  canonicalOrder: string[],                  // item ids in the one correct order
  orderingKey: string,                       // source dimension, e.g. "year" | "value"
  match: "exact"                             // full-order exact match; partial credit is a separate, later decision
}
```

- **Server grade:** accept iff the submitted id-permutation `=== canonicalOrder`.
  `canonicalOrder` must be a permutation of `items[].id` (every id exactly once). `match` is
  `"exact"` only for now — no partial credit by default (fail closed).
- **GREEN eligibility:** the full order is unambiguous at the source's granularity — every
  adjacent pair strictly ordered by `orderingKey`, **no ties** at that resolution, no
  contested/competing ordering. This generalizes the which-came-first chronology robustness
  check to any ordering key.
- **Collision/ambiguity:** §5.ORD.

### §3A.4 One-line pointer convention (rule library)

Per-subject category and per-shape rules now live in §3 / §3A / §5. A batch prompt references
them by pointer instead of re-specifying, e.g.:
`Science/constants per §3.S1 (when established), numeric grading per §3A.2, ambiguity per §5.NUM.`

---

## §5 — per-shape collision/ambiguity blocks (add after the per-category list)

These generalize the §5 general rule ("*no distractor may also be a valid answer*") to shapes
that have no distractors.

### §5.FT — free-text completeness (the free-text analogue of distractor-collision)

- **No unlisted correct answer.** The accepted set must contain every form the source treats as
  correct (canonical name, common synonyms, accepted alternate spellings, alias/exonym where the
  source uses it, with/without leading articles). A correct submission that normalizes outside
  the set is a false reject — a collision-class defect.
- **No over-wide accept.** No entry may normalize to also match a *different, wrong* answer to
  the same prompt. If two distinct correct entities normalize to the same string, the prompt is
  ambiguous → exclude.
- **Exclude open/contested answer sets** — anything not exhaustively enumerable from the source.
- **Verifier** independently re-derives the accepted set from the source; agree only if nothing
  correct is missing and nothing listed is wrong.

### §5.NUM — numeric single-value safety

- One **canonical or exact-by-definition** value only. No ranges, no "approximately", no
  measured/time-varying quantities (those are AMBER, §4).
- The tolerance band must **admit no wrong value and exclude no right one** — it may absorb only
  legitimate representational rounding, never the gap to a plausible alternative figure.
- Unit explicit and from the subject's allowed set; where more than one common unit exists, the
  prompt fixes the unit.
- **Verifier** confirms the value is definitional/static against the source and that the band
  cannot reach a different true value.

### §5.ORD — ordering unambiguity (generalized chronology check)

- The order must be **strict and total** at the source's granularity: every adjacent pair
  strictly separated on `orderingKey`; no two items tie at that resolution. If the source's
  granularity can produce a tie (e.g. two events in the same year when the key is `"year"`),
  refine the key or exclude the item.
- No contested/competing ordering across approved sources.
- **Verifier** confirms each adjacent pair against the source and that the granularity admits no
  tie.

---

## §6 — harness (`content:qa`) checks per shape (add)

Deterministic, run **before** the model verify (cheap gate first). The model cross-family verify
remains mandatory per item and is never replaced. All existing §6 gates still apply unchanged
(content:qa 0 findings, dedup, build, stage-by-path, no seeding).

- **Grading-spec validity (all shapes):** `grading.mode` present and matches the file's shape;
  spec well-formed per §3A; grader-consumable; the answer / accepted set / canonical value /
  canonical order is **not** exposed on any client-reachable surface (server-authoritative).
- **`free_text`:** `acceptedAnswers` non-empty; canonical form present; all entries distinct
  after normalization; normalization is idempotent (`normalize(normalize(x)) === normalize(x)`);
  flag any prompt the corpus/source marks as multi-answer.
- **`numeric`:** `tolerance.value >= 0`; exact-by-definition rows have `tolerance.value === 0`;
  unit present (or explicitly dimensionless); flag any band wide enough to admit a second known
  value when a sibling value exists in the corpus.
- **`ordering`:** `canonicalOrder` is a permutation of `items[].id` (each id exactly once);
  `>= 2` items; `orderingKey` present; no duplicate `orderingKey` values at the stated
  granularity when the source datum is carried.

### §6 — dedup extension (canonical corpus → every shape/subject)

- The dedup key generalizes from *normalized prompt + answer* to
  **normalized prompt + shape + grading-signature**, where grading-signature is:
  - `free_text` → sorted normalized `acceptedAnswers`
  - `numeric` → `canonicalValue` + `unit`
  - `ordering` → `canonicalOrder`
- So the same underlying fact asked as MCQ vs free-text vs numeric still dedups, and two numeric
  prompts for the same value+unit collide.
- Dedup runs against **all committed rows across all shapes and subjects** (`knowledgeQuestions`
  included), not just same-shape rows.

---

## §7 — solo proof per new shape (add)

- A **new shape resets confidence exactly like a new subject** (Guardrail 3): the first batch of
  any shape in any subject runs **solo (N=1)** and is fully cross-family verified before that
  shape windows.
- A shape proven in one subject does **not** pre-clear it in another subject whose collision
  surface differs — the orchestrator decides at the taxonomy gate.
- **Recommended first `free_text` proof:** a solo batch over already-verified Geography GREEN
  facts (e.g. capital-of as recall), to isolate *shape* risk from *fact* risk.

---

## §8 / §9 — template deltas (shape-aware)

**§8 AUTHOR — add line:**

```
SHAPE: <shape> per runbook §3A; author the grading spec for EVERY row (§3A.<n>); collision/
ambiguity per §5.<FT|NUM|ORD>. Do not emit any row whose grading spec the §6 harness would
reject. If this is a NEW shape (or a known shape's first use in this subject), the batch is
SOLO (N=1) — author one batch only and stop for verification.
```

**§9 VERIFY — add per-item check (4) and extend the structural check:**

```
STRUCTURAL CHECK also requires grading.mode to match the file's shape.
(4) GRADING-SPEC CHECK: independently re-derive the spec from the source —
    accepted set (free_text) / canonical value + unit + band (numeric) / canonical order
    (ordering). Confirm it grades EVERY correct form and rejects EVERY wrong one
    (§5.<FT|NUM|ORD>), and confirm it is server-authoritative (no client-reachable answer
    leakage). Any gap → flag, do not stamp.
```

---

## §10 — report deltas (add)

- **Author report** appends: `shape | grading-spec harness (pass/fail)`
- **Verify report** appends: per-item grading-spec `agree/flag`

---

## §11 — unchanged

Shapes beyond the §3A registry still escalate to the orchestrator. New-subject scope, new
category/property GREEN-ness and collision direction, AMBER content + the AMBER validation path,
seeding/merge/go-live, and skill-graph wiring remain orchestrator-owned.
