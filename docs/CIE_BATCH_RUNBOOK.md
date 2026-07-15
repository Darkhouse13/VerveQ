# CIE Batch Runbook

Single source of truth for the Content Ingestion Engine batch cycle. This **replaces** per-batch hand-generated prompts: derive every prompt from this document plus `subject + N`. The invariant is **cross-family safety**: whoever authors, an independent model from a *different* family verifies. The pairing is not fixed to a vendor — the current pairing is **Claude Code (`anthropic/claude-opus-4-8`) authors; DeepSeek (`deepseek/deepseek-v4-flash`) verifies** (Geography v10, History v7, Science v7; commit `ae874bf`). Earlier batches (Geography v1–v9, History v1–v6, Science v1–v6) ran the reverse: Codex (`openai/gpt-5-codex`) authored and an Anthropic model verified. Read `AUTHOR_MODEL` / `VERIFIER_MODEL` at the top of the batch file for the pairing actually used; §8/§9 below name the roles generically.

Companion policy: `docs/CONTENT_INGESTION.md` (process), `docs/CIE_SOURCING_POLICY.md` (sourcing, GREEN/AMBER §4/§5).

---

## 1. Scope and invariants

- **Branch:** content authoring lands on `master`. The historical `feat/learn-mode` / `feat/v2` bases no longer exist locally or on `origin` — do not look for them, and do not create them to satisfy this runbook. Syncs are deliberate orchestrator work, never an automatic authoring step. Do NOT pull / fetch-and-reset / auto-resync. Confirm local state only (clean tree, HEAD at the current tip).
- **Content:** GREEN / static facts only. AMBER and any new question shape go to the orchestrator and are never authored here.
- **Question shape:** standard MCQ only. (The "ladder" teaching-object tier is a difficulty-ordered container over standard MCQs — not a new shape.)
- **Single shared working copy:** author and verifier operate on the same local repo, so stamps land on top of batches without any remote.
- **Never seed or wire into runtime.** That is a separate ops step owned by the orchestrator.
- **Nothing unverified ships** (Window Guardrail 1): no batch may be seeded, merged toward `master`, or surfaced in any live path until it has passed cross-family verification.

---

## 2. Naming convention (derive everything from `subject + N`)

`<Subject>` PascalCase, `<subject>` lower/snake.

- File: `app/convex/knowledge<Subject>CieScoreBatchV<N>.ts`
- **Questions array: DEFAULT export** — mandatory load interface every batch must expose. Named aliases (e.g. `knowledge<Subject>CieScoreBatchV<N>Questions`) are allowed *in addition*, but the default export must exist and must be the questions array.
- Metadata export: `knowledge<Subject>CieScoreBatchV<N>Metadata`
- Source records export: `wikidataSourceRecords` (object, keyed by ref)
- Batch id: `knowledge_<subject>_cie_score_v<N>`
- Stable IDs / checksums: `knowledge_<subject>_cie_score_v<N>_001 .. _NNN`, sequential

---

## 3. Canonical categories

### Geography (established)
- `capital_cities` — Wikidata `P36`. **EXHAUSTED as of v7. Do not re-mine capitals.**
- `country_facts` — Wikidata structured properties:
  - `P47` shares-border-with (land borders)
  - `P38` currency
  - `P37` official / primary language
  - landlocked-vs-coastal status — author must confirm the exact Wikidata sourcing the first time it is used (e.g. instance-of *landlocked country* / absence of a coastline relation) and report it.

### New subjects
- The **first batch of any new subject runs solo (N=1)**. The author must inspect and confirm/establish that subject's canonical categories and report them before windowed mode resumes for that subject.

### Subject sequencing (roadmap)

Shipped subjects are `geography | history | science` (`CieSubject`, `app/convex/knowledgeCieScoreBatchRegistry.ts:111`). Current state — 24 registered batches, all `shape: "mcq"`:

1. **Geography** — through **v10**. `country_facts` new-property batches. Capitals exhausted at v7.
2. **History** (GREEN) — through **v7**. Dated events, founding / independence years, chronology. Proved the engine generalises across domains.
3. **Science** (GREEN) — through **v7**. Categories established; windows normally.

The registry is the source of truth for what exists; add a new subject to `CieSubject` before authoring it.

---

## 4. GREEN / AMBER classification (fail closed)

**GREEN** = static, settled, non-time-varying, uncontested. Author GREEN only.

**AMBER** — do NOT author here; add to the AMBER backlog for the orchestrator's AMBER validation path. AMBER includes:
- Populations, rankings, superlatives (largest / longest / highest / most), any time-varying figure.
- **In-transition or contested capitals** — a designated-but-not-yet-effective capital, a capital relocation in progress, or competing current values (e.g. Indonesia: Jakarta → Nusantara). When the fact is in flux, do not ship it as settled GREEN. Add to the AMBER backlog (snapshot date + corroboration, possibly taught as "X is relocating its capital"). Consistent with `CIE_SOURCING_POLICY.md` §4/§5.
- Multi-valued / shared-attribute facts whose question direction is collision-unsafe (see §5).

**When in doubt: AMBER.**

---

## 5. Collision safety (per category)

General rule: no distractor may also be a valid answer to the question as posed.

- **Borders (`P47`):** no distractor is a real land neighbour of the subject. Exclude quadripoints and sea-only adjacencies as land borders (e.g. Kazungula; Bahrain–Qatar).
- **Capitals (`P36`):** exhausted; n/a.
- **Currency (`P38`):** author the **"currency OF {country}"** direction only, and only for **single-currency** countries. Do NOT author the reverse ("which country uses {currency}") for shared currencies — euro, CFA franc, USD, East Caribbean dollar, etc. have many correct answers. Exclude multi-currency countries. No distractor currency may also be legal tender in the subject country.
- **Official / primary language (`P37`):** author **"official language OF {country}"** only. No distractor language may also be official in that country. Do NOT author reverse questions for widespread languages (English, French, Spanish, Arabic, Portuguese) — many correct answers. Eligibility (the verifier-confirmed distinction):
  - **EXCLUDE** countries with genuine **national co-official** languages — two or more languages official at the national level (e.g. Kyrgyzstan [Kyrgyz + Russian], Belgium, Switzerland, Canada). These are not single-official and must not be authored as GREEN; route them to the excluded/AMBER backlog.
  - **ACCEPTABLE:** countries with one unambiguous **primary** national official language plus regional / national-minority languages (e.g. Poland, Sweden) — author the primary and tag provenance honestly to that primary.
  - **When in doubt, exclude (default-deny).**
- **Landlocked vs coastal:** construct options so that **exactly one** option matches the asked type (one landlocked among coastal distractors, or one coastal among landlocked distractors). Static; GREEN.

---

## 6. Per-batch automated gates (every batch, immediately, no exceptions)

1. `npm run content:qa -- ./convex/knowledge<Subject>CieScoreBatchV<N>.ts` (run from `app/`) — must return **0 findings**. The batch path is **required**; a bare `npm run content:qa` throws `Missing batch path` (`app/scripts/contentQaCli.ts:183`). The `--` is what forwards the path to the CLI rather than to npm. See `docs/CONTENT_QA.md`.
2. **Dedup** — 0 checksum collisions, 0 normalized prompt+answer duplicates against **all committed rows** (all prior CIE batches + bundled content), and 0 within-batch duplicates.
3. `npm run build` — must pass (keeps the shared branch green).
4. **Staging** — stage ONLY the batch file by explicit path. Never `git add -A` / `git commit -am`.
5. No seeding, no runtime wiring.

---

## 7. Verification window (cross-family)

- A batch must be **committed before the next author step** (dedup depends only on committed rows).
- Cross-family verification runs in **windows of up to N batches** (current **N = 3**).
- **Guardrail 1 — nothing unverified ships:** unverified batches stay branch-internal; never seeded, merged toward `master`, or surfaced live. Zero user exposure.
- **Guardrail 2 — bounded window:** at most N unverified batches at any time. Clear the window (verify all) before authoring beyond it. No unbounded backlog.
- **Guardrail 3 — flag rate governs N:** baseline N = 3. N may rise to 5 after **two consecutive fully-clean windows**. **Any** disagree/flag → drop N back toward 1, investigate and fix, then resume windowed mode.
- **New subject:** first batch runs solo (N = 1) until canonical categories are confirmed.

---

## 8. AUTHOR template

Derive names from `subject + N` (§2). Fill `<AUTHOR_FAMILY>` / `<VERIFIER_FAMILY>` from the current pairing (§0 header) — they must differ. Then:

```
Work on branch master (local-only; do NOT pull/fetch/resync). Confirm the branch and that HEAD is at the current local tip.
PRECONDITION: git status clean of unrelated changes. If unrelated modified/untracked files appear, STOP and report; do not touch them.
CONTEXT: Content Ingestion Engine authoring (runbook docs/CIE_BATCH_RUNBOOK.md). You author; an independent model from a DIFFERENT family (<VERIFIER_FAMILY>) verifies in the window. This is batch knowledge_<subject>_cie_score_v<N>. The "ladder" tier is NOT a new shape — author standard MCQ rows only.
READ: docs/CIE_SOURCING_POLICY.md, docs/CONTENT_INGESTION.md, docs/CIE_BATCH_RUNBOOK.md (§3 categories, §4 GREEN/AMBER, §5 collision, §6 gates).
TASK — author batch v<N>:
- Subject <SUBJECT>: GREEN/static facts ONLY (runbook §4). No AMBER, no new shape; if scope should expand, STOP and flag.
- ~50 NEW questions in the EXISTING canonical categories only (runbook §3), same row shape, checksum convention (stable IDs knowledge_<subject>_cie_score_v<N>_001..), provenance schema as prior batches: per-row provenance.claims[*].sourceRef = wikidata:<QID>:<Pxx>:...:snapshot-<date>; volatility "static"; verdict "pending"; verifierModel "pending_anthropic_verification" — EXACT literal, do not reword: it is the unverified sentinel the seed gates compare against by string equality (challengeArenaCieContent.ts:85 hasCrossFamilyVerifier, seedLearnContent.ts:148/165). Despite the name it is family-neutral and means "not yet verified" whoever the verifier is; the verifier overwrites it at stamp time. Include the wikidataSourceRecords export; expose the questions array as the DEFAULT export.
- Apply the per-category collision rules in runbook §5 exactly (esp. currency/language direction + single-value restriction; landlocked exactly-one-of-type).
- For any NEW property/category first used in this subject, confirm and report its exact Wikidata sourcing.
- File app/convex/knowledge<Subject>CieScoreBatchV<N>.ts; metadata export knowledge<Subject>CieScoreBatchV<N>Metadata; same directory/shape as prior batches.
- Dedup: 0 checksum collisions, 0 normalized prompt+answer dupes vs ALL committed rows incl. all prior batches, 0 within-batch dupes. Report the prior-row total compared against.
- EXHAUSTION GUARD: if you cannot reach ~50 clean GREEN existing-shape items, STOP and report how many clean items you could author. Do not pad, duplicate, loosen, or reach into AMBER.
- From app/: run npm run content:qa -- ./convex/knowledge<Subject>CieScoreBatchV<N>.ts (0 findings; the path arg after -- is REQUIRED — a bare npm run content:qa throws "Missing batch path") and npm run build (must pass). Commit as its own artifact, staging ONLY this file by path (git add app/convex/knowledge<Subject>CieScoreBatchV<N>.ts) — never git add -A. Do NOT seed or wire into runtime.
REPORT BACK (terse, runbook §10).
```

---

## 9. VERIFY template — verify a window of up to N batches

Run this as the verifier model, which MUST be from a different family than the batch's `AUTHOR_MODEL` (§0 header). For EACH batch v\<k\> in the window, derive names from `subject + k`, then:

```
Work on branch master (local-only; do NOT pull/fetch/resync). Confirm the branch.
ROLE: independently VERIFY batch knowledge_<subject>_cie_score_v<k> — cross-family safety. You must be from a different model family than the batch's AUTHOR_MODEL constant; check it at the top of the file and STOP if it matches your own family. Do not assume the author's structure, answers, distractors, or sourceRefs are correct.
Load + interface audit (tsx is resolved on demand via npx — it is not a declared dependency in app/package.json, so the first run may fetch it):
  cd app
  npx tsx -e "import('./convex/knowledge<Subject>CieScoreBatchV<k>.ts').then((m)=>{const arr=m.default??m.knowledge<Subject>CieScoreBatchV<k>Questions;const src=m.wikidataSourceRecords;console.log(JSON.stringify({exportKeys:Object.keys(m),hasDefaultExport:m.default!==undefined,count:arr?arr.length:null,metadata:m.knowledge<Subject>CieScoreBatchV<k>Metadata,sourceRecordsType:Array.isArray(src)?'array':typeof src,sourceRecordsCount:src?(Array.isArray(src)?src.length:Object.keys(src).length):0,batch:arr},null,2));});"
(0) STRUCTURAL CHECK: questions array MUST be the default export; wikidataSourceRecords present. If the default export is missing/renamed, that is a STRUCTURAL FLAG — do NOT stamp; leave for the author to conform.
Then per question emit agree | disagree | flag:
  (1) correctAnswer correct AND the only correct option;
  (2) distractor collision — no distractor also satisfies the question (apply runbook §5 per category: borders / currency / language / landlocked directions);
  (3) provenance match — resolve subject QID + cited property against object QID; sourceRef genuinely expresses the claim;
  and confirm volatility static / GREEN (no AMBER, no in-transition capitals per runbook §4).
STAMP ONLY IF structural interface matches AND zero disagree/flag. Stamp provenance ONLY (verifierModel = your actual model id, replacing the "pending_anthropic_verification" sentinel — the seed gates treat any other non-empty value as cross-family verified, so never stamp a model from the author's family; per-item + metadata verdicts); do not alter content/options/correctAnswer/category/sourceRef. Commit staging ONLY this file by path. Fail-closed: any flag → do not stamp, leave for author.
```

Stamp clean batches; hold flagged ones. A flag in the window triggers Guardrail 3 (drop N).

---

## 10. Terse report formats

Prose only when something is flagged.

**Author report (per batch):**
`batch id | file | count | categories (+split) | content:qa | dedup (collisions / dupes / prior-rows) | build`

**Verify report (per window):** for each batch —
`batch id | agree/disagree/flag | flagged IDs + one-line reason | stamp commit`

---

## 11. Escalate to the orchestrator (never handled in the batch thread)

- AMBER content and the AMBER validation path.
- New question shapes.
- New-subject scope decisions; new category/property classification (GREEN-ness + collision direction) before solo authoring.
- Seeding / merge toward master / go-live / feature-flag flips.
- Skill-graph / mastery-progression wiring.
