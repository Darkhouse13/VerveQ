# Content QA Baseline

Baseline date: 2026-05-24

This is the pre-expansion baseline that upcoming 5x content batches will be measured against. It was generated offline from bundled seed modules only; no backend calls, network requests, or seeding were performed.

Scope:
- `challengeArenaGeneralKnowledgeQuestions` from `app/convex/challengeArenaContent.ts`.
- `knowledgeQuestions` rows with `category: "which_came_first"` from `app/convex/knowledgeQuestions.ts`.
- `challengeArenaCapitalCityQuestions` from `app/convex/challengeArenaContent.ts`.
- `challengeArenaEnterpriseLogoQuestions` from `app/convex/challengeArenaContent.ts`.
- No bundled offline `football_quiz` row source was found; football quiz rows remain database/runtime content outside this baseline adapter.

Overall: 889 rows, 42 ERROR findings, 134 WARN findings.

Content edits: none. All ERROR findings in this baseline are `DISTRACTOR_MATCHES_CORRECT` fuzzy collisions in existing rows; replacing distractors would require content judgement, so they are reported for human review.

## Per-Category Rollup

| Category | Rows | Severity | Structural | Distractor Match | Exact Duplicate | Near Duplicate | Answer Overuse | Distractor Quality |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `astronomy` | 12 | 0 ERROR / 3 WARN | 0 | 0 | 0 | 1 | 0 | 2 |
| `biology` | 13 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `capital_cities` | 195 | 0 ERROR / 26 WARN | 0 | 0 | 0 | 25 | 0 | 1 |
| `chemistry` | 7 | 3 ERROR / 0 WARN | 0 | 3 | 0 | 0 | 0 | 0 |
| `common_knowledge` | 25 | 18 ERROR / 1 WARN | 0 | 18 | 0 | 0 | 0 | 1 |
| `culture` | 8 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `discoveries` | 27 | 0 ERROR / 8 WARN | 0 | 0 | 0 | 0 | 0 | 8 |
| `earth_science` | 8 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `enterprise_logos` | 144 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `fun_facts` | 20 | 0 ERROR / 4 WARN | 0 | 0 | 0 | 0 | 0 | 4 |
| `geography` | 14 | 0 ERROR / 2 WARN | 0 | 0 | 0 | 2 | 0 | 0 |
| `history` | 24 | 2 ERROR / 5 WARN | 0 | 2 | 0 | 1 | 0 | 4 |
| `human_knowledge` | 24 | 3 ERROR / 3 WARN | 0 | 3 | 0 | 0 | 0 | 3 |
| `inventions` | 24 | 0 ERROR / 2 WARN | 0 | 0 | 0 | 0 | 0 | 2 |
| `language` | 8 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `laws_of_universe` | 25 | 0 ERROR / 1 WARN | 0 | 0 | 0 | 0 | 0 | 1 |
| `literature_arts` | 15 | 0 ERROR / 3 WARN | 0 | 0 | 0 | 0 | 0 | 3 |
| `mathematics` | 8 | 8 ERROR / 2 WARN | 0 | 8 | 0 | 0 | 0 | 2 |
| `philosophy` | 9 | 0 ERROR / 0 WARN | 0 | 0 | 0 | 0 | 0 | 0 |
| `physics` | 9 | 3 ERROR / 0 WARN | 0 | 3 | 0 | 0 | 0 | 0 |
| `science` | 20 | 3 ERROR / 0 WARN | 0 | 3 | 0 | 0 | 0 | 0 |
| `which_came_first` | 250 | 2 ERROR / 74 WARN | 0 | 2 | 0 | 0 | 24 | 50 |

## Error Findings

- `chemistry` DISTRACTOR_MATCHES_CORRECT knowledge_v1_163 field=options[1]: Distractor "0" matches the accepted answer set for "7".
- `chemistry` DISTRACTOR_MATCHES_CORRECT knowledge_v1_163 field=options[2]: Distractor "1" matches the accepted answer set for "7".
- `chemistry` DISTRACTOR_MATCHES_CORRECT knowledge_v1_215 field=options[2]: Distractor "Photon" matches the accepted answer set for "Proton".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_004 field=options[1]: Distractor "5" matches the accepted answer set for "7".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_004 field=options[2]: Distractor "6" matches the accepted answer set for "7".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_004 field=options[3]: Distractor "8" matches the accepted answer set for "7".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_017 field=options[0]: Distractor "2" matches the accepted answer set for "3".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_017 field=options[1]: Distractor "4" matches the accepted answer set for "3".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_017 field=options[3]: Distractor "5" matches the accepted answer set for "3".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_063 field=options[0]: Distractor "5" matches the accepted answer set for "6".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_063 field=options[1]: Distractor "7" matches the accepted answer set for "6".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_063 field=options[3]: Distractor "8" matches the accepted answer set for "6".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_070 field=options[0]: Distractor "30" matches the accepted answer set for "60".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_070 field=options[1]: Distractor "90" matches the accepted answer set for "60".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_081 field=options[0]: Distractor "10 degrees Celsius" matches the accepted answer set for "0 degrees Celsius".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_081 field=options[2]: Distractor "32 degrees Celsius" matches the accepted answer set for "0 degrees Celsius".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_081 field=options[3]: Distractor "100 degrees Celsius" matches the accepted answer set for "0 degrees Celsius".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_148 field=options[0]: Distractor "C" matches the accepted answer set for "L".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_148 field=options[1]: Distractor "X" matches the accepted answer set for "L".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_148 field=options[2]: Distractor "V" matches the accepted answer set for "L".
- `common_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_255 field=options[1]: Distractor "10°C" matches the accepted answer set for "0°C".
- `history` DISTRACTOR_MATCHES_CORRECT knowledge_v1_077 field=options[0]: Distractor "Iberian Peninsula" matches the accepted answer set for "Italian Peninsula".
- `history` DISTRACTOR_MATCHES_CORRECT knowledge_v1_077 field=options[2]: Distractor "Balkan Peninsula" matches the accepted answer set for "Italian Peninsula".
- `human_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_117 field=options[0]: Distractor "Vitamin C" matches the accepted answer set for "Vitamin D".
- `human_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_117 field=options[3]: Distractor "Vitamin K" matches the accepted answer set for "Vitamin D".
- `human_knowledge` DISTRACTOR_MATCHES_CORRECT knowledge_v1_271 field=options[3]: Distractor "B negative" matches the accepted answer set for "O negative".
- `mathematics` DISTRACTOR_MATCHES_CORRECT knowledge_v1_171 field=options[1]: Distractor "90 degrees" matches the accepted answer set for "180 degrees".
- `mathematics` DISTRACTOR_MATCHES_CORRECT knowledge_v1_171 field=options[2]: Distractor "270 degrees" matches the accepted answer set for "180 degrees".
- `mathematics` DISTRACTOR_MATCHES_CORRECT knowledge_v1_171 field=options[3]: Distractor "360 degrees" matches the accepted answer set for "180 degrees".
- `mathematics` DISTRACTOR_MATCHES_CORRECT knowledge_v1_208 field=options[0]: Distractor "x" matches the accepted answer set for "2x".
- `mathematics` DISTRACTOR_MATCHES_CORRECT knowledge_v1_208 field=options[3]: Distractor "2" matches the accepted answer set for "2x".
- `mathematics` DISTRACTOR_MATCHES_CORRECT knowledge_v1_216 field=options[2]: Distractor "100" matches the accepted answer set for "101".
- `mathematics` DISTRACTOR_MATCHES_CORRECT knowledge_v1_216 field=options[3]: Distractor "111" matches the accepted answer set for "101".
- `mathematics` DISTRACTOR_MATCHES_CORRECT knowledge_v1_225 field=options[3]: Distractor "2" matches the accepted answer set for "e".
- `physics` DISTRACTOR_MATCHES_CORRECT knowledge_v1_195 field=options[0]: Distractor "30,000 kilometers per second" matches the accepted answer set for "300,000 kilometers per second".
- `physics` DISTRACTOR_MATCHES_CORRECT knowledge_v1_195 field=options[2]: Distractor "3,000 kilometers per second" matches the accepted answer set for "300,000 kilometers per second".
- `physics` DISTRACTOR_MATCHES_CORRECT knowledge_v1_195 field=options[3]: Distractor "300 kilometers per second" matches the accepted answer set for "300,000 kilometers per second".
- `science` DISTRACTOR_MATCHES_CORRECT knowledge_v1_007 field=options[0]: Distractor "10°C" matches the accepted answer set for "0°C".
- `science` DISTRACTOR_MATCHES_CORRECT knowledge_v1_075 field=options[0]: Distractor "0" matches the accepted answer set for "7".
- `science` DISTRACTOR_MATCHES_CORRECT knowledge_v1_075 field=options[1]: Distractor "5" matches the accepted answer set for "7".
- `which_came_first` DISTRACTOR_MATCHES_CORRECT knowledge_came_first_v1_031 field=options[1]: Distractor "The invention of the QR code" matches the accepted answer set for "The invention of the barcode".
- `which_came_first` DISTRACTOR_MATCHES_CORRECT knowledge_came_first_v1_034 field=options[0]: Distractor "The Tang dynasty in China" matches the accepted answer set for "The Han dynasty in China".

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
