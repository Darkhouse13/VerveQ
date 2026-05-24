# Content QA Baseline

Baseline date: 2026-05-24

This is the pre-expansion baseline that upcoming 5x content batches will be measured against. It was generated offline from bundled seed modules only; no backend calls, network requests, or seeding were performed.

Scope:
- `challengeArenaGeneralKnowledgeQuestions` from `app/convex/challengeArenaContent.ts`.
- `knowledgeQuestions` rows with `category: "which_came_first"` from `app/convex/knowledgeQuestions.ts`.
- `challengeArenaCapitalCityQuestions` from `app/convex/challengeArenaContent.ts`.
- `challengeArenaEnterpriseLogoQuestions` from `app/convex/challengeArenaContent.ts`.
- No bundled offline `football_quiz` row source was found; football quiz rows remain database/runtime content outside this baseline adapter.

Overall: 889 rows, 0 ERROR findings, 134 WARN findings.

Content edits: none. No ERROR findings remain in this baseline.

## Per-Category Rollup

| Category | Rows | Severity | Structural | Distractor Match | Exact Duplicate | Near Duplicate | Answer Overuse | Distractor Quality |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `astronomy` | 12 | 0 ERROR / 3 WARN | 0 | 0 | 0 | 1 | 0 | 2 |
| `biology` | 13 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `capital_cities` | 195 | 0 ERROR / 26 WARN | 0 | 0 | 0 | 25 | 0 | 1 |
| `chemistry` | 7 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `common_knowledge` | 25 | 0 ERROR / 1 WARN | 0 | 0 | 0 | 0 | 0 | 1 |
| `culture` | 8 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `discoveries` | 27 | 0 ERROR / 8 WARN | 0 | 0 | 0 | 0 | 0 | 8 |
| `earth_science` | 8 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `enterprise_logos` | 144 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `fun_facts` | 20 | 0 ERROR / 4 WARN | 0 | 0 | 0 | 0 | 0 | 4 |
| `geography` | 14 | 0 ERROR / 2 WARN | 0 | 0 | 0 | 2 | 0 | 0 |
| `history` | 24 | 0 ERROR / 5 WARN | 0 | 0 | 0 | 1 | 0 | 4 |
| `human_knowledge` | 24 | 0 ERROR / 3 WARN | 0 | 0 | 0 | 0 | 0 | 3 |
| `inventions` | 24 | 0 ERROR / 2 WARN | 0 | 0 | 0 | 0 | 0 | 2 |
| `language` | 8 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `laws_of_universe` | 25 | 0 ERROR / 1 WARN | 0 | 0 | 0 | 0 | 0 | 1 |
| `literature_arts` | 15 | 0 ERROR / 3 WARN | 0 | 0 | 0 | 0 | 0 | 3 |
| `mathematics` | 8 | 0 ERROR / 2 WARN | 0 | 0 | 0 | 0 | 0 | 2 |
| `philosophy` | 9 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `physics` | 9 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `science` | 20 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `which_came_first` | 250 | 0 ERROR / 74 WARN | 0 | 0 | 0 | 0 | 24 | 50 |

## Error Findings

- None.

## Warning Summary

WARN findings are review prompts only. No warning was edited by this baseline run.

- `astronomy`: NEAR_DUPLICATE: 1, DISTRACTOR_QUALITY: 2
- `capital_cities`: NEAR_DUPLICATE: 25, DISTRACTOR_QUALITY: 1
- `common_knowledge`: DISTRACTOR_QUALITY: 1
- `discoveries`: DISTRACTOR_QUALITY: 8
- `fun_facts`: DISTRACTOR_QUALITY: 4
- `geography`: NEAR_DUPLICATE: 2
- `history`: NEAR_DUPLICATE: 1, DISTRACTOR_QUALITY: 4
- `human_knowledge`: DISTRACTOR_QUALITY: 3
- `inventions`: DISTRACTOR_QUALITY: 2
- `laws_of_universe`: DISTRACTOR_QUALITY: 1
- `literature_arts`: DISTRACTOR_QUALITY: 3
- `mathematics`: DISTRACTOR_QUALITY: 2
- `which_came_first`: ANSWER_OVERUSE: 24, DISTRACTOR_QUALITY: 50

## Source Pools

- `astronomy`: 12 rows from `challengeArenaGeneralKnowledgeQuestions`
- `biology`: 13 rows from `challengeArenaGeneralKnowledgeQuestions`
- `capital_cities`: 195 rows from `challengeArenaCapitalCityQuestions`
- `chemistry`: 7 rows from `challengeArenaGeneralKnowledgeQuestions`
- `common_knowledge`: 25 rows from `challengeArenaGeneralKnowledgeQuestions`
- `culture`: 8 rows from `challengeArenaGeneralKnowledgeQuestions`
- `discoveries`: 27 rows from `challengeArenaGeneralKnowledgeQuestions`
- `earth_science`: 8 rows from `challengeArenaGeneralKnowledgeQuestions`
- `enterprise_logos`: 144 rows from `challengeArenaEnterpriseLogoQuestions`
- `fun_facts`: 20 rows from `challengeArenaGeneralKnowledgeQuestions`
- `geography`: 14 rows from `challengeArenaGeneralKnowledgeQuestions`
- `history`: 24 rows from `challengeArenaGeneralKnowledgeQuestions`
- `human_knowledge`: 24 rows from `challengeArenaGeneralKnowledgeQuestions`
- `inventions`: 24 rows from `challengeArenaGeneralKnowledgeQuestions`
- `language`: 8 rows from `challengeArenaGeneralKnowledgeQuestions`
- `laws_of_universe`: 25 rows from `challengeArenaGeneralKnowledgeQuestions`
- `literature_arts`: 15 rows from `challengeArenaGeneralKnowledgeQuestions`
- `mathematics`: 8 rows from `challengeArenaGeneralKnowledgeQuestions`
- `philosophy`: 9 rows from `challengeArenaGeneralKnowledgeQuestions`
- `physics`: 9 rows from `challengeArenaGeneralKnowledgeQuestions`
- `science`: 20 rows from `challengeArenaGeneralKnowledgeQuestions`
- `which_came_first`: 250 rows from `knowledgeQuestions.which_came_first`

## Notes

- This baseline records harness findings; it does not certify factual correctness.
- ERROR findings in existing bundled content should be fixed only when the correct fix is unambiguous and factually certain. Anything else stays flagged for human review.
- The content QA harness rules were reused as-is for this run.
