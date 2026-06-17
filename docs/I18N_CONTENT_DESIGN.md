# i18n Content Translation — Design (Phase 4)

Status: **approved** (submit-canonical + per-viewer-locale). Implementation staged P4.1 → P4.4.

This covers translating **question content** (questions, options, explanations, clues, hints,
category labels). UI chrome translation (Phases 1–3) is already shipped on `feat/i18n-rollout`.

## Core principle: display-translate, grade-canonical

Grading is server-authoritative and **string-based**:
`normalizeAnswer(submitted) === normalizeAnswer(question.correctAnswer)`
(`quizSessions.ts:156`, `blitz.ts:169`, `dailyChallenge.ts:667`, `duels.ts:964`,
`challengeArenas.ts:2327`, `liveMatches.ts:686`). The user submits the option **text**, and
options are deterministically ordered by **checksum** (`lib/answerOptions.ts`), identical for
every viewer. Checksum = DJB2 hash of the English question + sorted English options
(`forge.ts:15`) and is the stable identity used by `usedChecksums` / `questionChecksums`.

Therefore:

- **MCQ**: render **translated** options but **submit the canonical English value**. Grading and
  checksums are untouched. Whether an option is a common or proper noun is irrelevant — it is
  never typed.
- **Text-input** (Survival, Who Am I, logo_text): every answer is a **proper noun** (player /
  brand name). Answers and the fuzzy matcher (`lib/fuzzy.ts`) stay **English-canonical**; only the
  surrounding clues / hints / chrome are display-translated.

Net: *translate what is displayed; never touch what is graded.*

## Scope

| Translate (display only) | Keep canonical (never) |
| --- | --- |
| Question text, MCQ options, explanations | `correctAnswer`, `acceptedAliases` (grading) |
| Who Am I clues, Survival hint templates, logo chrome | Player / team / brand / person / place names |
| Category labels | Checksums (English-derived → stable) |

## Data model (additive — `quizQuestions` untouched)

```ts
quizQuestionTranslations: defineTable({
  checksum: v.string(),          // FK → quizQuestions.checksum
  locale: v.string(),            // "fr" | "es"
  question: v.string(),
  options: v.array(v.string()),  // SAME ORDER as canonical quizQuestions.options
  explanation: v.optional(v.string()),
  source: v.union(v.literal("llm"), v.literal("human")),
  reviewed: v.boolean(),
  updatedAt: v.number(),
}).index("by_checksum_locale", ["checksum", "locale"])
```

`options` are stored aligned to the canonical (unordered) `quizQuestions.options`, so a server
helper can reorder them into display order alongside the canonical values. A parallel
`whoAmIClueTranslations` table covers clue prose; Survival hints are templated from metadata and
handled at the UI/template level.

## Serving + the two real changes

1. **`locale` is a serve-query argument** (the client passes `i18n.language`), *not* session-stored —
   duels/arena have two viewers who may differ in language but share the same canonical questions.
   The arg is optional and defaults to English (a no-op).
2. **MCQ serve returns `options` (display) + `optionValues` (canonical, same order)**; the client
   submits `optionValues[selectedIndex]`. Submit/grading mutations are **unchanged**. Missing
   `(checksum, locale)` → English. When no translation exists, `options === optionValues`, so the
   path is a strict no-op.

A shared helper (`convex/lib/contentI18n.ts`) does the ordering + overlay so every mode stays
consistent.

## Rollout, production, QA

- **Incremental + English fallback**: ship the plumbing first with zero translations (no behavior
  change), then backfill. Partial coverage always works.
- **Scale**: ~900 knowledge MCQs + the sports MCQ pool, ≈6 strings each × 2 locales ≈ 10–12k
  strings. Same LLM-draft → native-review pipeline as the UI, batched. New questions enqueue a
  translation on creation (Forge hook).
- **QA**: parity check `translation.options.length === canonical.options.length` (guarantees the
  label↔value mapping); orphan detection (translations whose checksum no longer exists); per-locale
  coverage in `content:qa`. Grading tests are unaffected by construction.

## Decisions

- **Submit-canonical** (approved) — not server-side locale grading.
- A mistranslated proper-noun *option* is only cosmetic (grading uses the canonical value).
- Open (P4.4): translate category labels and player nationalities? Logo/Survival answers stay
  canonical.

## Phased plan

- **P4.1** — schema + serve plumbing + `{options, optionValues}` submit-canonical, shipped en-only.
- **P4.2** — backfill MCQ translations (knowledge → sports) via LLM + review.
- **P4.3** — Who Am I clues + Survival hint templates + logo chrome.
- **P4.4** — categories / nationalities + `content:qa` coverage + orphan/Forge hooks.
