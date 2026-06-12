# Learn reveal layers — cross-family review brief (Codex)

Status: **reviewed/complete (Codex round 2)**.
(Authored by Anthropic family — inverse of the usual CIE direction, so the
cross-family roles flip: Codex verifies.)

## Review log

**Round 1 (2026-06-12, Codex):** 100 checksums reviewed; 0 disagree, 22 flags, plus
validator-soundness findings. All addressed:

- History 001–004 (flag): Julian full dates in distractor reveals lacked the
  "(Julian calendar)" note → `yearDistractor` now appends `julianNote()`.
- History 032 (flag): India anchor fact was used in copy but missing from emitted
  provenance → `buildYearReveal` now cites the anchor claim.
- Science 019–035 (flag): `whyChosen` asserted periodic-table proximity not backed
  by cited facts → replaced with claim-free "from the question's own option set".
- Validator (history years): fact not bound to the checksum's answer — now requires
  the question's own claims to contain `<prefix>(<name>) = <year>` AND
  `<prefix>(<name>) != <distractorYear>` for each distractor (batch vocabulary:
  `point_in_time_year` / `inception_year`).
- Validator (history chronology): text↔fact pairing unbound — now requires each
  option's fact claim in the question's claims, each `"<optionText> (<year>)"`
  pairing in the batch explanation, and the `chronology_<direction>(...) = <answer>`
  claim to match.
- Validator (history anchor): anchor claim now emitted in provenance (record-level
  validation retained; an anchor is intentionally from a different question, so it
  cannot appear in this question's claims).
- Validator (science): `String()` coercion removed — exact representation match
  against the batch's string-typed values; `contrast` hooks now FAIL if the subject's
  cross-property record exists (necessity enforced); every subject/distractor fact
  must string-match a claim in the question's own claims
  (`chemical_element_symbol(...)` / `atomic_number(...)` / `si_unit_symbol(...)`).

Re-check scope for round 2: the deltas above only (git diff of the two reveal files);
verdict flips and `VERIFIER_MODEL` update happen on round-2 confirmation.

**Round 2 (2026-06-12, Codex):** Deltas re-confirmed. Previously flagged checksums
now agree; hardened validators reject the round-1 attack cases. `VERIFIER_MODEL`
flipped to `openai/gpt-5-codex`.

## Scope

Two Claude-authored Learn-mode reveal layers over already-verified score-mode batches:

| File | Source batch | Entries |
|---|---|---|
| `app/convex/learnHistoryDatesRevealsV1.ts` | `knowledge_history_cie_score_v1` (verdict agree) | 50 |
| `app/convex/learnScienceRecallRevealsV1.ts` | `knowledge_science_cie_score_v1` (verdict agree) | 50 |

Supporting wiring (review for soundness, not content): subject/node additions in
`learnSkillGraph.ts`, category taggers in `learnQuestionSkillTags.ts`, balanced
ladder selection in `learnLadderBuilder.ts` (`selectBalancedRungs`).

## The claimed invariant — attack it

Both layers claim **derived-only**: every factual token in reveal copy (years, full
dates, symbols, atomic numbers, unit classes) is restated from in-batch facts that
already passed cross-family verification; the layers add NO new claims. A module-load
validator enforces it mechanically (sourceRef must exist in the batch's
`wikidataSourceRecords` with identical values; distractor/answer text must match the
question's own options; fail-closed: failing entries are dropped from the export).

ROLE: independently VERIFY, do not assume the author's structure or the validator's
correctness. Specifically:

1. **Fact rows**: every re-declared `dateFact(...)` / `element(...)` / `siUnit(...)`
   row matches the source batch's declarations (name, QID, property, value, date,
   precision, calendar) — diff them against the batch file, not the validator.
2. **Validator soundness**: can a wrong fact pass? (e.g. value coercion, missing
   record treated as pass, options-set comparison gaps, anchor facts skipped).
3. **Template correctness**: direction words are arithmetic ("too early/late",
   "came earlier/later", earliest/latest) — check sign errors; timeline orderings
   ascend; "N years" gaps correct; Julian/precision annotations match the fact.
4. **Non-tautology**: each `correctReveal` teaches something beyond the bare answer
   (full date, anchor, cross property, or contrast facts) and never merely restates
   the batch `explanation`.
5. **Prose-only fields**: `displayName` articles, `misconception`, `whyChosen` and
   connective phrasing must not smuggle in factual claims (e.g. periodic-table
   layout, causal history) beyond the cited facts.
6. **Hook variants** (science): `hook: "contrast"` entries exist precisely because
   the subject lacks the cross-property batch record — confirm each `"cross"` entry's
   record really exists and each `"contrast"` choice was necessary.

## Recording verdicts

Report per-checksum: `agree` / `disagree` / `flag` with a one-line reason for any
non-agree. On completion, update each file's `VERIFIER_MODEL` to the reviewing model
id and note the review in this doc. Any `disagree` row must be fixed or removed
(fail-closed) before the layer ships further.

## Gates

- `cd app && npm run test` — includes `learnSubjectsContentWiring.test.ts`
  (validators ok at 50/50, ladder mix 3/3/2, tag consistency).
- `npm run build` must pass.
- Do not seed or deploy as part of the review.
