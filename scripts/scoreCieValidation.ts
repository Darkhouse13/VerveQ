#!/usr/bin/env npx tsx
/**
 * Scores a CIE planted-error Verify-stage validation run.
 *
 * Usage:
 *   npx tsx scripts/scoreCieValidation.ts --run-dir scripts/data/cie-validation/run-...
 *   npx tsx scripts/scoreCieValidation.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_ROOT = path.join(__dirname, "data", "cie-validation");

type Label = "clean" | "corrupted";
type CorruptionType = 1 | 2 | 3 | 4 | 5;
type Verdict = "agree" | "disagree" | "flag" | "error" | "missing";
type FamilyName = string;

type AttemptRecord = {
  runId: string;
  trial: number;
  itemId: string;
  label: Label;
  corruptionType?: CorruptionType;
  authorFamily: FamilyName;
  verifierFamily: FamilyName;
  verifierModel: string;
  parsed: { verdict: Verdict };
  error?: { name: string; message: string };
  passed: boolean;
  blocked: boolean;
};

type GroupMetrics = {
  attempts: number;
  caught: number;
  blocked: number;
  passed: number;
  errorsOrMissing: number;
  catchRate: number;
  blockRate: number;
  passRate: number;
};

function parseArgs(): { runDir: string } {
  const args = process.argv.slice(2);
  const runDirIdx = args.indexOf("--run-dir");
  const runDir =
    runDirIdx >= 0 ? args[runDirIdx + 1] : findLatestRunDir(DEFAULT_OUTPUT_ROOT);
  if (!runDir) {
    throw new Error(
      `No run directory supplied and no runs found under ${DEFAULT_OUTPUT_ROOT}.`,
    );
  }
  return { runDir: path.resolve(runDir) };
}

function findLatestRunDir(root: string): string | undefined {
  if (!fs.existsSync(root)) return undefined;
  const entries = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("run-"))
    .map((entry) => {
      const fullPath = path.join(root, entry.name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries[0]?.fullPath;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function readAttempts(runDir: string): AttemptRecord[] {
  const attemptsPath = path.join(runDir, "attempts.jsonl");
  if (!fs.existsSync(attemptsPath)) {
    throw new Error(`Missing attempts file: ${attemptsPath}`);
  }

  return fs
    .readFileSync(attemptsPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AttemptRecord);
}

function isCatch(attempt: AttemptRecord): boolean {
  return attempt.parsed.verdict === "disagree" || attempt.parsed.verdict === "flag";
}

function isErrorOrMissing(attempt: AttemptRecord): boolean {
  return (
    Boolean(attempt.error) ||
    attempt.parsed.verdict === "error" ||
    attempt.parsed.verdict === "missing"
  );
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function metricsFor(attempts: AttemptRecord[]): GroupMetrics {
  const caught = attempts.filter(isCatch).length;
  const blocked = attempts.filter((attempt) => attempt.blocked).length;
  const passed = attempts.filter((attempt) => attempt.passed).length;
  const errorsOrMissing = attempts.filter(isErrorOrMissing).length;

  return {
    attempts: attempts.length,
    caught,
    blocked,
    passed,
    errorsOrMissing,
    catchRate: rate(caught, attempts.length),
    blockRate: rate(blocked, attempts.length),
    passRate: rate(passed, attempts.length),
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function assertFailClosed(attempts: AttemptRecord[]): void {
  const violations = attempts.filter((attempt) => {
    const shouldBlock = attempt.parsed.verdict !== "agree" || Boolean(attempt.error);
    return shouldBlock && attempt.passed;
  });

  if (violations.length > 0) {
    throw new Error(
      `Fail-closed assertion violated by attempts: ${violations
        .map((attempt) => `${attempt.itemId}/trial${attempt.trial}`)
        .join(", ")}`,
    );
  }
}

function byTrialDistribution(
  attempts: AttemptRecord[],
  filter: (attempt: AttemptRecord) => boolean,
): Array<{ trial: number; catchRate: number; attempts: number; caught: number }> {
  const trials = [...new Set(attempts.map((attempt) => attempt.trial))].sort(
    (a, b) => a - b,
  );
  return trials.map((trial) => {
    const trialAttempts = attempts.filter(
      (attempt) => attempt.trial === trial && filter(attempt),
    );
    const caught = trialAttempts.filter(isCatch).length;
    return {
      trial,
      attempts: trialAttempts.length,
      caught,
      catchRate: rate(caught, trialAttempts.length),
    };
  });
}

function stringifyDistribution(
  distribution: Array<{ trial: number; catchRate: number }>,
): string {
  return distribution
    .map((entry) => `K${entry.trial}=${percent(entry.catchRate)}`)
    .join(", ");
}

function getManifestOrderings(
  manifest: Record<string, unknown>,
  attempts: AttemptRecord[],
): Array<{ authorFamily: FamilyName; verifierFamily: FamilyName }> {
  const manifestOrderings = manifest.orderings;
  if (Array.isArray(manifestOrderings)) {
    const parsed = manifestOrderings
      .map((entry) => {
        if (
          entry &&
          typeof entry === "object" &&
          "authorFamily" in entry &&
          "verifierFamily" in entry
        ) {
          const authorFamily = (entry as { authorFamily?: unknown }).authorFamily;
          const verifierFamily = (entry as { verifierFamily?: unknown })
            .verifierFamily;
          if (
            typeof authorFamily === "string" &&
            typeof verifierFamily === "string"
          ) {
            return { authorFamily, verifierFamily };
          }
        }
        return undefined;
      })
      .filter(
        (
          entry,
        ): entry is { authorFamily: FamilyName; verifierFamily: FamilyName } =>
          Boolean(entry),
      );
    if (parsed.length > 0) return parsed;
  }

  const seen = new Set<string>();
  const derived: Array<{ authorFamily: FamilyName; verifierFamily: FamilyName }> =
    [];
  for (const attempt of attempts) {
    const key = `${attempt.authorFamily}->${attempt.verifierFamily}`;
    if (!seen.has(key)) {
      seen.add(key);
      derived.push({
        authorFamily: attempt.authorFamily,
        verifierFamily: attempt.verifierFamily,
      });
    }
  }
  return derived;
}

function stringifyModels(models: unknown): string {
  if (!models || typeof models !== "object") return "unknown";
  const entries = Object.entries(models as Record<string, unknown>);
  if (entries.length === 0) return "unknown";
  return entries
    .map(([family, model]) => `${family} ${String(model)}`)
    .join(" / ");
}

function buildReport(runDir: string, attempts: AttemptRecord[]): {
  summary: Record<string, unknown>;
  markdown: string;
} {
  assertFailClosed(attempts);

  const manifestPath = path.join(runDir, "manifest.json");
  const manifest = fs.existsSync(manifestPath)
    ? readJson<Record<string, unknown>>(manifestPath)
    : {};

  const cleanAttempts = attempts.filter((attempt) => attempt.label === "clean");
  const corruptedAttempts = attempts.filter(
    (attempt) => attempt.label === "corrupted",
  );

  const falsePositiveCount = cleanAttempts.filter((attempt) => attempt.blocked).length;
  const falsePositiveRate = rate(falsePositiveCount, cleanAttempts.length);
  const failOpenAttempts = corruptedAttempts.filter((attempt) => attempt.passed);
  const uniqueFailOpenItems = [...new Set(failOpenAttempts.map((attempt) => attempt.itemId))];
  const verifierErrorFailOpenCount = attempts.filter(
    (attempt) => isErrorOrMissing(attempt) && attempt.passed,
  ).length;

  const perType = ([1, 2, 3, 4, 5] as CorruptionType[]).map((corruptionType) => {
    const typeAttempts = corruptedAttempts.filter(
      (attempt) => attempt.corruptionType === corruptionType,
    );
    const distribution = byTrialDistribution(
      attempts,
      (attempt) =>
        attempt.label === "corrupted" &&
        attempt.corruptionType === corruptionType,
    );
    const metrics = metricsFor(typeAttempts);
    const floor = Math.min(...distribution.map((entry) => entry.catchRate));
    return {
      corruptionType,
      ...metrics,
      trialDistribution: distribution,
      worstCaseFloor: floor,
      failOpenAttempts: typeAttempts.filter((attempt) => attempt.passed).length,
      uniqueFailOpenItems: [
        ...new Set(
          typeAttempts.filter((attempt) => attempt.passed).map((attempt) => attempt.itemId),
        ),
      ],
    };
  });

  const perOrdering = getManifestOrderings(manifest, attempts).map((ordering) => {
    const orderingAttempts = attempts.filter(
      (attempt) =>
        attempt.authorFamily === ordering.authorFamily &&
        attempt.verifierFamily === ordering.verifierFamily,
    );
    const orderingClean = orderingAttempts.filter(
      (attempt) => attempt.label === "clean",
    );
    const orderingCorrupted = orderingAttempts.filter(
      (attempt) => attempt.label === "corrupted",
    );
    return {
      ...ordering,
      corruptedCatchRate: metricsFor(orderingCorrupted).catchRate,
      cleanFalsePositiveRate: rate(
        orderingClean.filter((attempt) => attempt.blocked).length,
        orderingClean.length,
      ),
      failOpenAttempts: orderingCorrupted.filter((attempt) => attempt.passed).length,
    };
  });

  const lockedTypesPass = perType
    .filter((entry) => [1, 2, 3].includes(entry.corruptionType))
    .every((entry) => entry.catchRate >= 0.95);
  const falsePositivePass = falsePositiveRate <= 0.05;
  const errorFailOpenPass = verifierErrorFailOpenCount === 0;
  const recommendation =
    lockedTypesPass && falsePositivePass && errorFailOpenPass ? "GO" : "NO-GO";

  const summary = {
    runDir,
    manifest,
    attempts: attempts.length,
    cleanAttempts: cleanAttempts.length,
    corruptedAttempts: corruptedAttempts.length,
    falsePositiveCount,
    falsePositiveRate,
    failOpenCount: failOpenAttempts.length,
    uniqueFailOpenItems,
    verifierErrorFailOpenCount,
    perType,
    perOrdering,
    goNoGo: {
      recommendation,
      lockedTypesPass,
      falsePositivePass,
      errorFailOpenPass,
      note:
        "Types 4-5 are reported as findings; slips there indicate the engine likely needs deterministic structured-source assertion checks.",
    },
  };

  const lines: string[] = [];
  lines.push("# CIE planted-error validation report");
  lines.push("");
  lines.push(`Run directory: ${runDir}`);
  lines.push(`Run ID: ${String(manifest.runId ?? "unknown")}`);
  lines.push(`Branch: ${String(manifest.branch ?? "unknown")}`);
  lines.push(`Models: ${stringifyModels(manifest.models)}`);
  lines.push("");
  lines.push("## Core metrics");
  lines.push("");
  lines.push(`- Clean false-positive rate: ${percent(falsePositiveRate)} (${falsePositiveCount}/${cleanAttempts.length})`);
  lines.push(`- Fail-open count on corrupted attempts: ${failOpenAttempts.length}/${corruptedAttempts.length}`);
  lines.push(`- Unique fail-open items: ${uniqueFailOpenItems.length === 0 ? "none" : uniqueFailOpenItems.join(", ")}`);
  lines.push(`- Verifier error/missing-verdict fail-open count: ${verifierErrorFailOpenCount}`);
  lines.push("");
  lines.push("## Per corruption type");
  lines.push("");
  lines.push("| Type | Attempts | Caught | Catch rate | Worst K floor | Distribution | Fail-opens | Errors/missing |");
  lines.push("| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |");
  for (const entry of perType) {
    lines.push(
      `| ${entry.corruptionType} | ${entry.attempts} | ${entry.caught} | ${percent(entry.catchRate)} | ${percent(entry.worstCaseFloor)} | ${stringifyDistribution(entry.trialDistribution)} | ${entry.failOpenAttempts} | ${entry.errorsOrMissing} |`,
    );
  }
  lines.push("");
  lines.push("## Family orderings");
  lines.push("");
  lines.push("| Author family | Verifier family | Corrupted catch rate | Clean false-positive rate | Fail-opens |");
  lines.push("| --- | --- | ---: | ---: | ---: |");
  for (const entry of perOrdering) {
    lines.push(
      `| ${entry.authorFamily} | ${entry.verifierFamily} | ${percent(entry.corruptedCatchRate)} | ${percent(entry.cleanFalsePositiveRate)} | ${entry.failOpenAttempts} |`,
    );
  }
  lines.push("");
  lines.push("## GO / NO-GO");
  lines.push("");
  lines.push(`Recommendation: ${recommendation}`);
  lines.push(
    `Locked criteria: types 1-3 catch >=95% = ${lockedTypesPass ? "pass" : "fail"}; clean false-positive <=5% = ${falsePositivePass ? "pass" : "fail"}; verifier-error fail-open count = ${errorFailOpenPass ? "pass" : "fail"}.`,
  );
  lines.push(
    "Types 4-5 are findings: if they slip, add deterministic structured-source assertion checks rather than trusting model judgment alone.",
  );
  lines.push("");

  return { summary, markdown: lines.join("\n") };
}

function main(): void {
  const { runDir } = parseArgs();
  const attempts = readAttempts(runDir);
  const { summary, markdown } = buildReport(runDir, attempts);

  fs.writeFileSync(
    path.join(runDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(path.join(runDir, "report.md"), markdown, "utf8");

  console.log(markdown);
}

main();
