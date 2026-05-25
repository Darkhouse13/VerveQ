#!/usr/bin/env npx tsx
/**
 * Runs the CIE planted-error Verify-stage validation.
 *
 * Usage:
 *   npx tsx scripts/runCieValidation.ts
 *   npx tsx scripts/runCieValidation.ts --k 5 --timeout-ms 60000
 */

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import {
  GOLDEN_GEOGRAPHY_ITEMS,
  type CorruptionType,
  type GoldenItem,
  verifierVisibleItem,
} from "./cie-golden-geography";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const DEFAULT_OUTPUT_ROOT = path.join(__dirname, "data", "cie-validation");

type FamilyName = "openai" | "anthropic";
type Verdict = "agree" | "disagree" | "flag" | "error" | "missing";

type FamilyConfig = {
  family: FamilyName;
  apiKeyEnv: string;
  modelEnv: string;
  defaultModel: string;
  model: string;
  apiKey: string | undefined;
};

type CliArgs = {
  k: number;
  timeoutMs: number;
  outputRoot: string;
  skipPreflight: boolean;
};

type ParsedVerifierOutput = {
  verdict: Verdict;
  confidence?: unknown;
  checkedClaims?: unknown;
  issues?: unknown;
  sourceRefsChecked?: unknown;
  rawJson?: unknown;
  parseError?: string;
};

type AttemptRecord = {
  runId: string;
  trial: number;
  itemId: string;
  label: GoldenItem["label"];
  corruptionType?: CorruptionType;
  authorFamily: FamilyName;
  verifierFamily: FamilyName;
  verifierModel: string;
  startedAt: string;
  completedAt: string;
  elapsedMs: number;
  request: {
    systemPrompt: string;
    userPayload: unknown;
  };
  rawOutput: unknown;
  parsed: ParsedVerifierOutput;
  error?: { name: string; message: string };
  passed: boolean;
  blocked: boolean;
};

function loadRootEnv(): void {
  const envPath = path.join(REPO_ROOT, ".env");
  if (!fs.existsSync(envPath)) return;

  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const readValue = (name: string): string | undefined => {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const k = Number(readValue("--k") ?? "5");
  const timeoutMs = Number(readValue("--timeout-ms") ?? "60000");
  const outputRoot = readValue("--output-root") ?? DEFAULT_OUTPUT_ROOT;
  const skipPreflight = args.includes("--skip-preflight");

  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`Invalid --k value "${k}". Expected a positive integer.`);
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000) {
    throw new Error(
      `Invalid --timeout-ms value "${timeoutMs}". Expected >= 1000.`,
    );
  }

  return { k, timeoutMs, outputRoot, skipPreflight };
}

function getFamilyConfigs(): Record<FamilyName, FamilyConfig> {
  const openaiModel =
    process.env.CIE_OPENAI_MODEL?.trim() || "gpt-4o-2024-08-06";
  const anthropicModel =
    process.env.CIE_ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-20241022";

  return {
    openai: {
      family: "openai",
      apiKeyEnv: "OPENAI_API_KEY",
      modelEnv: "CIE_OPENAI_MODEL",
      defaultModel: "gpt-4o-2024-08-06",
      model: openaiModel,
      apiKey: process.env.OPENAI_API_KEY,
    },
    anthropic: {
      family: "anthropic",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      modelEnv: "CIE_ANTHROPIC_MODEL",
      defaultModel: "claude-3-5-sonnet-20241022",
      model: anthropicModel,
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
  };
}

function assertTwoCredentialedFamilies(
  configs: Record<FamilyName, FamilyConfig>,
): void {
  const missing = Object.values(configs).filter((config) => !config.apiKey);
  if (missing.length > 0) {
    throw new Error(
      [
        "CIE validation requires two distinct model-family credentials.",
        `Missing: ${missing.map((config) => config.apiKeyEnv).join(", ")}`,
        "Stop: not running single-family verification because it defeats decorrelation.",
      ].join(" "),
    );
  }
}

function validateGoldenSet(): void {
  if (GOLDEN_GEOGRAPHY_ITEMS.length !== 30) {
    throw new Error(
      `Expected 30 golden items, found ${GOLDEN_GEOGRAPHY_ITEMS.length}.`,
    );
  }

  const clean = GOLDEN_GEOGRAPHY_ITEMS.filter((item) => item.label === "clean");
  const corrupted = GOLDEN_GEOGRAPHY_ITEMS.filter(
    (item) => item.label === "corrupted",
  );
  if (clean.length !== 15 || corrupted.length !== 15) {
    throw new Error(
      `Expected 15 clean and 15 corrupted items, found ${clean.length} clean / ${corrupted.length} corrupted.`,
    );
  }

  for (const corruptionType of [1, 2, 3, 4, 5] as CorruptionType[]) {
    const count = corrupted.filter(
      (item) => item.corruptionType === corruptionType,
    ).length;
    if (count !== 3) {
      throw new Error(
        `Expected 3 corrupted items for type ${corruptionType}, found ${count}.`,
      );
    }
  }

  for (const item of GOLDEN_GEOGRAPHY_ITEMS) {
    verifierVisibleItem(item);
    if (item.label === "corrupted" && !item.truth) {
      throw new Error(`Corrupted item ${item.id} is missing truth metadata.`);
    }
  }
}

function getGitValue(args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function makeRunId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `run-${stamp}`;
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function appendJsonl(filePath: string, value: unknown): void {
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

const SYSTEM_PROMPT = [
  "You are the VerveQ Content Ingestion Engine Verify stage.",
  "Verify only the candidate against the resolved source records supplied in this request.",
  "Do not rely on your memory when it conflicts with the cited sourceRef.",
  "Check every atomic provenance claim, the stated correctAnswer, and each distractor.",
  "For MCQ capital items, a distractor is invalid only if it is not in the source record's closed capital list.",
  "For numeric population items, the answer must match the cited source value exactly except for harmless comma formatting.",
  "For which-came-first items, compare the dates in the resolved source record.",
  "If a claim is correct in the real world but the cited sourceRef does not support it, do not agree.",
  "Return agree only when every claim is supported by its cited sourceRef and the candidate has no answer collision.",
  "Return disagree for a contradicted value, an actually-correct distractor, wrong chronology, or provenance mismatch.",
  "Return flag for missing, ambiguous, or insufficient source evidence.",
  'Return only JSON: {"verdict":"agree|disagree|flag","confidence":0..1,"checkedClaims":[...],"issues":[...],"sourceRefsChecked":[...]}',
].join("\n");

function buildUserPayload(
  item: GoldenItem,
  authorFamily: FamilyName,
  verifierFamily: FamilyName,
): unknown {
  return {
    task: "verify_cie_candidate",
    instruction:
      "Evaluate the candidate. Emit agree, disagree, or flag. The scorer-only label and truth metadata are intentionally omitted.",
    authorFamily,
    verifierFamily,
    candidate: verifierVisibleItem(item),
  };
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Keep the raw text for audit on non-JSON provider errors.
    }

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}: ${String(text).slice(0, 1000)}`,
      );
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(
  config: FamilyConfig,
  systemPrompt: string,
  userPayload: unknown,
  timeoutMs: number,
): Promise<{ raw: unknown; text: string }> {
  const raw = await fetchJsonWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    },
    timeoutMs,
  );

  const choices = (raw as { choices?: Array<{ message?: { content?: string } }> })
    .choices;
  const text = choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new Error("OpenAI response did not include message content.");
  }

  return { raw, text };
}

async function callAnthropic(
  config: FamilyConfig,
  systemPrompt: string,
  userPayload: unknown,
  timeoutMs: number,
): Promise<{ raw: unknown; text: string }> {
  const raw = await fetchJsonWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey ?? "",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 900,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: "user", content: JSON.stringify(userPayload) }],
      }),
    },
    timeoutMs,
  );

  const content = (raw as { content?: Array<{ type?: string; text?: string }> })
    .content;
  const text = content
    ?.filter((entry) => entry.type === "text" && typeof entry.text === "string")
    .map((entry) => entry.text)
    .join("\n");

  if (!text) {
    throw new Error("Anthropic response did not include text content.");
  }

  return { raw, text };
}

function extractJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(text.slice(first, last + 1));
    }
    throw new Error("No JSON object found in verifier response.");
  }
}

function parseVerifierText(text: string): ParsedVerifierOutput {
  try {
    const json = extractJsonObject(text) as {
      verdict?: unknown;
      confidence?: unknown;
      checkedClaims?: unknown;
      issues?: unknown;
      sourceRefsChecked?: unknown;
    };
    const verdict =
      json.verdict === "agree" ||
      json.verdict === "disagree" ||
      json.verdict === "flag"
        ? json.verdict
        : "missing";
    return {
      verdict,
      confidence: json.confidence,
      checkedClaims: json.checkedClaims,
      issues: json.issues,
      sourceRefsChecked: json.sourceRefsChecked,
      rawJson: json,
    };
  } catch (error) {
    return {
      verdict: "missing",
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

async function verifyAttempt(
  runId: string,
  trial: number,
  item: GoldenItem,
  authorFamily: FamilyName,
  verifierFamily: FamilyName,
  configs: Record<FamilyName, FamilyConfig>,
  timeoutMs: number,
): Promise<AttemptRecord> {
  const verifierConfig = configs[verifierFamily];
  const startedAt = new Date();
  const userPayload = buildUserPayload(item, authorFamily, verifierFamily);
  let rawOutput: unknown = null;
  let parsed: ParsedVerifierOutput = { verdict: "error" };
  let errorRecord: AttemptRecord["error"] | undefined;

  try {
    const result =
      verifierFamily === "openai"
        ? await callOpenAI(verifierConfig, SYSTEM_PROMPT, userPayload, timeoutMs)
        : await callAnthropic(
            verifierConfig,
            SYSTEM_PROMPT,
            userPayload,
            timeoutMs,
          );
    rawOutput = result.raw;
    parsed = parseVerifierText(result.text);
  } catch (error) {
    parsed = { verdict: "error" };
    errorRecord = {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  const completedAt = new Date();
  const passed = parsed.verdict === "agree" && !errorRecord;
  const blocked = !passed;

  if ((errorRecord || parsed.verdict !== "agree") && passed) {
    throw new Error(
      `Fail-closed assertion violated for ${item.id}: non-agree result passed.`,
    );
  }

  return {
    runId,
    trial,
    itemId: item.id,
    label: item.label,
    corruptionType: item.corruptionType,
    authorFamily,
    verifierFamily,
    verifierModel: verifierConfig.model,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    elapsedMs: completedAt.getTime() - startedAt.getTime(),
    request: {
      systemPrompt: SYSTEM_PROMPT,
      userPayload,
    },
    rawOutput,
    parsed,
    error: errorRecord,
    passed,
    blocked,
  };
}

async function preflightFamilies(
  configs: Record<FamilyName, FamilyConfig>,
  timeoutMs: number,
): Promise<void> {
  const preflightSystem =
    'Provider preflight. Return only JSON: {"verdict":"agree","confidence":1,"checkedClaims":[],"issues":[],"sourceRefsChecked":[]}';
  const preflightPayload = {
    task: "provider_preflight",
    instruction: "Return the exact JSON shape requested by the system prompt.",
  };

  for (const family of ["openai", "anthropic"] as FamilyName[]) {
    const config = configs[family];
    try {
      const result =
        family === "openai"
          ? await callOpenAI(config, preflightSystem, preflightPayload, timeoutMs)
          : await callAnthropic(
              config,
              preflightSystem,
              preflightPayload,
              timeoutMs,
            );
      const parsed = parseVerifierText(result.text);
      if (parsed.verdict !== "agree") {
        throw new Error(
          `Preflight returned non-agree verdict: ${parsed.verdict}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Provider preflight failed for ${family} (${config.model}). Stop: validation requires two usable distinct model families. ${message}`,
      );
    }
  }
}

async function main(): Promise<void> {
  loadRootEnv();
  const args = parseArgs();
  const configs = getFamilyConfigs();

  assertTwoCredentialedFamilies(configs);
  validateGoldenSet();
  if (!args.skipPreflight) {
    await preflightFamilies(configs, args.timeoutMs);
  }

  const branch = getGitValue(["branch", "--show-current"]);
  if (branch === "master") {
    throw new Error("Refusing to run CIE validation on master.");
  }

  const runId = makeRunId();
  const outputDir = path.join(args.outputRoot, runId);
  fs.mkdirSync(outputDir, { recursive: true });

  const attemptsPath = path.join(outputDir, "attempts.jsonl");
  const manifest = {
    runId,
    startedAt: new Date().toISOString(),
    branch,
    commit: getGitValue(["rev-parse", "HEAD"]),
    k: args.k,
    itemCount: GOLDEN_GEOGRAPHY_ITEMS.length,
    orderings: [
      { authorFamily: "anthropic", verifierFamily: "openai" },
      { authorFamily: "openai", verifierFamily: "anthropic" },
    ],
    models: {
      openai: configs.openai.model,
      anthropic: configs.anthropic.model,
    },
    credentialEnvVars: {
      openai: configs.openai.apiKeyEnv,
      anthropic: configs.anthropic.apiKeyEnv,
    },
    outputFiles: {
      attempts: attemptsPath,
    },
  };
  writeJson(path.join(outputDir, "manifest.json"), manifest);

  const totalAttempts = args.k * 2 * GOLDEN_GEOGRAPHY_ITEMS.length;
  let completed = 0;
  console.log(`CIE validation run ${runId}`);
  console.log(`Branch: ${branch}`);
  console.log(
    `Models: openai=${configs.openai.model}, anthropic=${configs.anthropic.model}`,
  );
  console.log(`Attempts: ${totalAttempts} (${args.k} trials x 2 orderings x 30 items)`);
  console.log(`Output: ${outputDir}`);

  for (let trial = 1; trial <= args.k; trial++) {
    for (const ordering of [
      { authorFamily: "anthropic" as const, verifierFamily: "openai" as const },
      { authorFamily: "openai" as const, verifierFamily: "anthropic" as const },
    ]) {
      for (const item of GOLDEN_GEOGRAPHY_ITEMS) {
        const attempt = await verifyAttempt(
          runId,
          trial,
          item,
          ordering.authorFamily,
          ordering.verifierFamily,
          configs,
          args.timeoutMs,
        );
        appendJsonl(attemptsPath, attempt);
        completed += 1;

        const status = attempt.passed ? "pass" : "block";
        const corruption = attempt.corruptionType
          ? ` type=${attempt.corruptionType}`
          : "";
        console.log(
          `[${completed}/${totalAttempts}] trial=${trial} ${ordering.authorFamily}->${ordering.verifierFamily} ${item.id}${corruption} verdict=${attempt.parsed.verdict} ${status}`,
        );
      }
    }
  }

  writeJson(path.join(outputDir, "completed.json"), {
    runId,
    completedAt: new Date().toISOString(),
    attempts: completed,
  });

  console.log(`Completed CIE validation run: ${outputDir}`);
  console.log(`Next: npx tsx scripts/scoreCieValidation.ts --run-dir "${outputDir}"`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
