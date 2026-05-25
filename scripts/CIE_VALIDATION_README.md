# CIE planted-error validation

This validates only the Content Ingestion Engine Verify stage against the fixed
Geography golden set in `scripts/cie-golden-geography.ts`.

## Required credentials

- `OPENAI_API_KEY` for the OpenAI verifier family.
- `ANTHROPIC_API_KEY` for the Anthropic verifier family.

The runner also loads the repository root `.env` if present. It never prints API
keys and stops before running if either family credential is missing.
It also preflights both providers and stops if either family cannot make a tiny
JSON-response call.

## Pinned models

Defaults:

- OpenAI: `gpt-4o-2024-08-06`
- Anthropic: `claude-3-5-sonnet-20241022`

Optional explicit overrides:

- `CIE_OPENAI_MODEL`
- `CIE_ANTHROPIC_MODEL`

Record any override in the report because model identity is part of the
validation evidence.

## Run

```powershell
npx tsx scripts/runCieValidation.ts --k 5 --timeout-ms 60000
```

Use `--skip-preflight` only when intentionally auditing fail-closed behavior for
provider failures; normal validation should keep preflight enabled.

The runner executes both orderings:

- Anthropic-authored candidate verified by OpenAI.
- OpenAI-authored candidate verified by Anthropic.

Raw verifier responses are persisted as JSONL under
`scripts/data/cie-validation/<run-id>/attempts.jsonl`. Generated run data lives
under `scripts/data/`, matching the existing pipeline convention and remaining
out of git.

## Score

```powershell
npx tsx scripts/scoreCieValidation.ts --run-dir scripts/data/cie-validation/<run-id>
```

The scorer writes `summary.json` and `report.md` into the run directory and prints
the GO / NO-GO readout. It counts `disagree` and `flag` as catches. Verifier
errors, timeouts, and missing verdicts block the item but do not inflate catch
rate.
