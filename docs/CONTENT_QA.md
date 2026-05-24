# Content QA Harness

The content QA harness is an offline gate for candidate challenge-arena question
batches before any seeding step runs. It validates rows in the canonical seed
shape used by `app/convex/challengeArenaContent.ts` and returns a structured
report that seeders and CI can consume.

Run it from `app/`:

```sh
npm run content:qa -- ./path/to/batch.json
npm run content:qa -- ./path/to/batch.ts --existing-checksums ./checksums.json
```

The TS batch may export the array as `default`, `questions`, `batch`, or
`contentQuestions`. Existing checksum files may be JSON/TS arrays of strings,
arrays of rows with `checksum`, or newline-delimited text.

## Pipeline

1. Source or generate candidate rows.
2. Fact-verify the content outside the harness.
3. Run `npm run content:qa -- <batch>`.
4. Deduplicate or revise rows based on ERROR findings and review WARN findings.
5. Human spot-review heuristic warnings and factual claims.
6. Seed only after the harness exits cleanly.
7. Verify runtime inventory with `challengeArenas.contentStatus`.

The harness is deterministic and does not require network access. Local
`imageUrl` values are resolved against `app/public` by default; remote HTTP(S)
URLs are treated as present but are not fetched.

## Finding Codes

All findings include `{ code, severity, questionRef, field, detail }`.

| Code | Severity | Meaning |
| --- | --- | --- |
| `STRUCTURAL_INVALID` | ERROR | Missing or malformed required fields; invalid difficulty or kind; wrong option count (`mcq` = 4, `which_came_first` = 2, `logo_text` = 0); blank or duplicate options; MCQ/binary answer missing from options; malformed aliases; missing or unresolved image refs for image questions. |
| `DISTRACTOR_MATCHES_CORRECT` | ERROR | A distractor equals or fuzzy-matches the accepted answer set. Logo text uses the same shared alias matcher as runtime arena answer submission. |
| `EXACT_DUPLICATE` | ERROR | Duplicate checksum in the batch, checksum collision with a provided existing checksum list, or identical normalized effective prompt plus answer in the batch. |
| `NEAR_DUPLICATE` | WARN | Effective prompt similarity is above the configured threshold. The harness flags the pair for review and does not auto-drop either row. |
| `ANSWER_OVERUSE` | WARN | The same normalized correct answer appears more than the configured limit within one category in the batch. |
| `DISTRACTOR_QUALITY` | WARN | Review-only heuristics found a tell: correct answer is much longer than distractors, options mix numeric/date-like values with text labels, or an option looks like filler. |

## Gate Behavior

The CLI prints the structured report as JSON and a one-line summary. It exits
non-zero when any ERROR finding exists, so CI and seeders fail closed.

WARN findings do not fail the process. They are review prompts only. The harness
does not certify factual correctness, semantic distractor quality, or current
real-world truth; those remain part of the fact-verification and human
spot-review stages.
