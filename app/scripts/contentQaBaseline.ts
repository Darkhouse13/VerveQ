import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  challengeArenaCapitalCityQuestions,
  challengeArenaEnterpriseLogoQuestions,
  challengeArenaGeneralKnowledgeQuestions,
  type ChallengeArenaQuestionSeed,
} from "../convex/challengeArenaContent";
import { knowledgeQuestions } from "../convex/knowledgeQuestions";
import {
  validateContentBatch,
  type ContentQaFinding,
  type ContentQaFindingCode,
  type ContentQaReport,
  type ContentQuestionSeed,
  type ImageReference,
} from "../convex/lib/contentQa";

const FINDING_CODES: ContentQaFindingCode[] = [
  "STRUCTURAL_INVALID",
  "DISTRACTOR_MATCHES_CORRECT",
  "EXACT_DUPLICATE",
  "NEAR_DUPLICATE",
  "ANSWER_OVERUSE",
  "DISTRACTOR_QUALITY",
];

type BaselineRow = ContentQuestionSeed & {
  sourcePool: string;
};

type CategoryBaseline = {
  category: string;
  sourcePools: string[];
  rows: BaselineRow[];
  report: ContentQaReport;
};

function repoRoot() {
  return path.resolve(process.cwd(), "..");
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function imageReferenceExists(ref: ImageReference) {
  if (ref.field === "imageId") return ref.value.trim().length > 0;
  if (/^https?:\/\//i.test(ref.value)) return true;

  const publicRoot = path.resolve(process.cwd(), "public");
  const candidate = ref.value.startsWith("/")
    ? path.join(publicRoot, ref.value.slice(1))
    : path.resolve(publicRoot, ref.value);
  return existsSync(candidate);
}

function asBaselineRows(
  rows: ChallengeArenaQuestionSeed[],
  sourcePool: string,
): BaselineRow[] {
  return rows.map((row) => ({ ...row, sourcePool }));
}

function bundledRows(): BaselineRow[] {
  const whichCameFirst = knowledgeQuestions.filter(
    (question) => question.category === "which_came_first",
  );

  return [
    ...asBaselineRows(
      challengeArenaGeneralKnowledgeQuestions,
      "challengeArenaGeneralKnowledgeQuestions",
    ),
    ...asBaselineRows(
      whichCameFirst,
      "knowledgeQuestions.which_came_first",
    ),
    ...asBaselineRows(
      challengeArenaCapitalCityQuestions,
      "challengeArenaCapitalCityQuestions",
    ),
    ...asBaselineRows(
      challengeArenaEnterpriseLogoQuestions,
      "challengeArenaEnterpriseLogoQuestions",
    ),
  ];
}

function groupByCategory(rows: BaselineRow[]) {
  const grouped = new Map<string, BaselineRow[]>();
  for (const row of rows) {
    grouped.set(row.category, [...(grouped.get(row.category) ?? []), row]);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, categoryRows]) => ({ category, rows: categoryRows }));
}

function runBaseline() {
  return groupByCategory(bundledRows()).map(({ category, rows }) => {
    const report = validateContentBatch(rows, { imageReferenceExists });
    const sourcePools = [...new Set(rows.map((row) => row.sourcePool))].sort();
    return { category, sourcePools, rows, report };
  });
}

function severityCell(report: ContentQaReport) {
  return `${report.rollup.bySeverity.ERROR} ERROR / ${report.rollup.bySeverity.WARN} WARN`;
}

function codeCells(report: ContentQaReport) {
  return FINDING_CODES.map((code) => String(report.rollup.byCode[code]));
}

function detailLine(finding: ContentQaFinding) {
  const field = finding.field ? ` field=${finding.field}` : "";
  return `- ${finding.severity} ${finding.code} ${finding.questionRef}${field}: ${finding.detail}`;
}

function byCodeFindings(findings: ContentQaFinding[]) {
  const byCode = new Map<ContentQaFindingCode, ContentQaFinding[]>();
  for (const finding of findings) {
    byCode.set(finding.code, [...(byCode.get(finding.code) ?? []), finding]);
  }
  return FINDING_CODES.flatMap((code) => byCode.get(code) ?? []);
}

function rollupTable(categories: CategoryBaseline[]) {
  const header = [
    "| Category | Rows | Severity | Structural | Distractor Match | Exact Duplicate | Near Duplicate | Answer Overuse | Distractor Quality |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  const rows = categories.map((category) =>
    [
      `| \`${category.category}\``,
      String(category.rows.length),
      severityCell(category.report),
      ...codeCells(category.report),
    ].join(" | ") + " |",
  );
  return [...header, ...rows].join("\n");
}

function warningSummary(categories: CategoryBaseline[]) {
  const lines: string[] = [];
  for (const category of categories) {
    const warnFindings = category.report.findings.filter(
      (finding) => finding.severity === "WARN",
    );
    if (warnFindings.length === 0) continue;

    const counts = FINDING_CODES
      .map((code) => [code, warnFindings.filter((finding) => finding.code === code).length] as const)
      .filter(([, count]) => count > 0)
      .map(([code, count]) => `${code}: ${count}`)
      .join(", ");
    lines.push(`- \`${category.category}\`: ${counts}`);
  }
  return lines.length > 0 ? lines.join("\n") : "- None.";
}

function errorDetails(categories: CategoryBaseline[]) {
  const errors = categories.flatMap((category) =>
    byCodeFindings(
      category.report.findings.filter((finding) => finding.severity === "ERROR"),
    ).map((finding) => ({ category: category.category, finding })),
  );

  if (errors.length === 0) return "- None.";
  return errors
    .map(
      ({ category, finding }) =>
        `- \`${category}\` ${finding.code} ${finding.questionRef}${finding.field ? ` field=${finding.field}` : ""}: ${finding.detail}`,
    )
    .join("\n");
}

function sourceScope(categories: CategoryBaseline[]) {
  return categories
    .map(
      (category) =>
        `- \`${category.category}\`: ${category.rows.length} rows from ${category.sourcePools.map((source) => `\`${source}\``).join(", ")}`,
    )
    .join("\n");
}

function renderMarkdown(categories: CategoryBaseline[]) {
  const date = todayIsoDate();
  const totalRows = categories.reduce((sum, category) => sum + category.rows.length, 0);
  const totalErrors = categories.reduce(
    (sum, category) => sum + category.report.rollup.bySeverity.ERROR,
    0,
  );
  const totalWarnings = categories.reduce(
    (sum, category) => sum + category.report.rollup.bySeverity.WARN,
    0,
  );
  const contentEditNote =
    totalErrors === 0
      ? "Content edits: none. No ERROR findings remain in this baseline."
      : "Content edits: none. All ERROR findings in this baseline are `DISTRACTOR_MATCHES_CORRECT` fuzzy collisions in existing rows; replacing distractors would require content judgement, so they are reported for human review.";

  return [
    "# Content QA Baseline",
    "",
    `Baseline date: ${date}`,
    "",
    "This is the pre-expansion baseline that upcoming 5x content batches will be measured against. It was generated offline from bundled seed modules only; no backend calls, network requests, or seeding were performed.",
    "",
    "Scope:",
    "- `challengeArenaGeneralKnowledgeQuestions` from `app/convex/challengeArenaContent.ts`.",
    "- `knowledgeQuestions` rows with `category: \"which_came_first\"` from `app/convex/knowledgeQuestions.ts`.",
    "- `challengeArenaCapitalCityQuestions` from `app/convex/challengeArenaContent.ts`.",
    "- `challengeArenaEnterpriseLogoQuestions` from `app/convex/challengeArenaContent.ts`.",
    "- No bundled offline `football_quiz` row source was found; football quiz rows remain database/runtime content outside this baseline adapter.",
    "",
    `Overall: ${totalRows} rows, ${totalErrors} ERROR findings, ${totalWarnings} WARN findings.`,
    "",
    contentEditNote,
    "",
    "## Per-Category Rollup",
    "",
    rollupTable(categories),
    "",
    "## Error Findings",
    "",
    errorDetails(categories),
    "",
    "## Warning Summary",
    "",
    "WARN findings are review prompts only. No warning was edited by this baseline run.",
    "",
    warningSummary(categories),
    "",
    "## Source Pools",
    "",
    sourceScope(categories),
    "",
    "## Notes",
    "",
    "- This baseline records harness findings; it does not certify factual correctness.",
    "- ERROR findings in existing bundled content should be fixed only when the correct fix is unambiguous and factually certain. Anything else stays flagged for human review.",
    "- The content QA harness rules were reused as-is for this run.",
    "",
  ].join("\n");
}

function printRollup(categories: CategoryBaseline[]) {
  console.log(rollupTable(categories));
  const errors = categories.reduce(
    (sum, category) => sum + category.report.rollup.bySeverity.ERROR,
    0,
  );
  const warnings = categories.reduce(
    (sum, category) => sum + category.report.rollup.bySeverity.WARN,
    0,
  );
  console.log(
    `Baseline complete: ${categories.length} categories, ${errors} ERROR findings, ${warnings} WARN findings.`,
  );
}

function main() {
  const categories = runBaseline();
  const reportPath = path.join(repoRoot(), "docs", "CONTENT_QA_BASELINE.md");
  writeFileSync(reportPath, renderMarkdown(categories), "utf8");
  printRollup(categories);
  console.log(`Wrote ${reportPath}`);
}

main();
