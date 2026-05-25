# CIE planted-error validation

This validates only the Content Ingestion Engine Verify stage against the fixed
Geography golden set in `scripts/cie-golden-geography.ts`.

## Required credentials

- `OPENAI_API_KEY` for the OpenAI verifier family.
- `ANTHROPIC_API_KEY` for the Anthropic verifier family.
- `ZHIPUAI_API_KEY` for the GLM/Zhipu verifier family.
  `ZHIPU_API_KEY` and `ZAI_API_KEY` are accepted aliases.
- `MINIMAX_API_KEY` for the MiniMax verifier family.

The runner also loads the repository root `.env` if present. It never prints API
keys and stops before running if a selected family credential is missing. It also
preflights both selected providers and stops if either family cannot make a tiny
JSON-response call.

## Pinned models

Defaults:

- OpenAI: `gpt-4o-2024-08-06`
- Anthropic: `claude-3-5-sonnet-20241022`
- GLM/Zhipu: `glm-5.1`
- MiniMax: `MiniMax-M2.7`

Optional explicit overrides:

- `CIE_OPENAI_MODEL`
- `CIE_ANTHROPIC_MODEL`
- `CIE_GLM_MODEL`
- `CIE_MINIMAX_MODEL`

Record any override in the report because model identity is part of the
validation evidence.

## Run

```powershell
npx tsx scripts/runCieValidation.ts --k 5 --timeout-ms 60000
```

Select any two distinct supported families with `--families`:

```powershell
npx tsx scripts/runCieValidation.ts --families "glm,minimax" --k 5 --timeout-ms 60000
```

Equivalent environment-variable selection:

```powershell
$env:CIE_FAMILIES = "glm,minimax"
npx tsx scripts/runCieValidation.ts --k 5 --timeout-ms 60000
```

You can also select by role with `--author-family` and `--verifier-family`; the
runner still executes both orderings for the selected pair.

Use `--skip-preflight` only when intentionally auditing fail-closed behavior for
provider failures; normal validation should keep preflight enabled.

By default, the runner executes the historical OpenAI/Anthropic pair. For any
selected pair, the runner executes both orderings. For example, `glm,minimax`
runs:

- GLM-authored candidate verified by MiniMax.
- MiniMax-authored candidate verified by GLM.

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
