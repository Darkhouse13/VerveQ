#!/usr/bin/env npx tsx
/**
 * runCuratedGameplayWorkflow.ts
 *
 * Unified regenerate/build/seed workflow for curated gameplay modes.
 *
 * Usage:
 *   npx tsx scripts/runCuratedGameplayWorkflow.ts --mode all
 *   npx tsx scripts/runCuratedGameplayWorkflow.ts --mode higher-lower
 *   npx tsx scripts/runCuratedGameplayWorkflow.ts --mode verve-grid
 *   npx tsx scripts/runCuratedGameplayWorkflow.ts --mode who-am-i
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import {
  printResolvedConvexTarget,
  resolveConvexTarget,
} from "./curatedParityDeploymentSafety";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");

type ModeName = "all" | "higher-lower" | "verve-grid" | "who-am-i";

type ModeConfig = {
  label: string;
  artifactFiles: string[];
  seedTables: string[];
  requiresBoardBuild: boolean;
};

const MODE_CONFIGS: Record<Exclude<ModeName, "all">, ModeConfig> = {
  "higher-lower": {
    label: "Higher or Lower",
    artifactFiles: ["higherLowerPools.json", "higherLowerFacts.json"],
    seedTables: ["higherLowerPools", "higherLowerFacts"],
    requiresBoardBuild: false,
  },
  "verve-grid": {
    label: "VerveGrid",
    artifactFiles: ["verveGridApprovedIndex.json", "verveGridBoards.json"],
    seedTables: ["verveGridApprovedIndex", "verveGridBoards"],
    requiresBoardBuild: true,
  },
  "who-am-i": {
    label: "Who Am I",
    artifactFiles: ["whoAmIApprovedClues.json", "whoAmIQaReport.json"],
    seedTables: ["whoAmIApprovedClues"],
    requiresBoardBuild: false,
  },
};

const ALL_MODE_ORDER: Array<Exclude<ModeName, "all">> = [
  "higher-lower",
  "verve-grid",
  "who-am-i",
];

function parseArgs(): { mode: ModeName } {
  const args = process.argv.slice(2);
  const modeIndex = args.indexOf("--mode");
  const positionalMode = args.find(
    (arg) =>
      arg === "all" ||
      arg === "higher-lower" ||
      arg === "verve-grid" ||
      arg === "who-am-i",
  );
  const modeValue =
    modeIndex >= 0 ? args[modeIndex + 1] : positionalMode ?? "all";

  if (
    modeValue !== "all" &&
    modeValue !== "higher-lower" &&
    modeValue !== "verve-grid" &&
    modeValue !== "who-am-i"
  ) {
    throw new Error(
      `Unknown mode "${modeValue}". Expected one of: all, higher-lower, verve-grid, who-am-i`,
    );
  }

  return { mode: modeValue };
}

function getSelectedModes(mode: ModeName): Array<Exclude<ModeName, "all">> {
  return mode === "all" ? ALL_MODE_ORDER : [mode];
}

function divider(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function runCommand(
  label: string,
  command: string,
  args: string[],
  cwd = REPO_ROOT,
): Promise<void> {
  console.log(`\n[run] ${label}`);
  console.log(`      ${command} ${args.join(" ")}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

function getArtifactPath(fileName: string): string {
  return path.join(DATA_DIR, fileName);
}

function assertArtifactExists(fileName: string): string {
  const fullPath = getArtifactPath(fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Required artifact is missing: ${fullPath}`);
  }
  return fullPath;
}

function readArtifactSummary(fileName: string): string {
  const fullPath = assertArtifactExists(fileName);
  const raw = fs.readFileSync(fullPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (Array.isArray(parsed)) {
    return `${fileName}: ${parsed.length.toLocaleString()} records`;
  }

  if (parsed && typeof parsed === "object") {
    return `${fileName}: object`;
  }

  return `${fileName}: unexpected shape`;
}

function printModeSummary(mode: Exclude<ModeName, "all">): void {
  const config = MODE_CONFIGS[mode];
  console.log(`[summary] ${config.label}`);
  for (const fileName of config.artifactFiles) {
    console.log(`  - ${readArtifactSummary(fileName)}`);
  }
}

async function regenerateFootballArtifacts(): Promise<void> {
  divider("Regenerate Curated Football Artifacts");
  await runCommand(
    "fetchSportsData football resume",
    "npx",
    ["tsx", "scripts/fetchSportsData.ts", "--resume", "--sport", "football"],
  );
}

async function buildVerveGridBoardsIfNeeded(
  selectedModes: Array<Exclude<ModeName, "all">>,
): Promise<void> {
  const needsBoardBuild = selectedModes.some(
    (mode) => MODE_CONFIGS[mode].requiresBoardBuild,
  );

  if (!needsBoardBuild) {
    console.log("\n[skip] VerveGrid board build not required for this run");
    return;
  }

  divider("Build VerveGrid Boards");
  await runCommand(
    "buildVerveGridBoards",
    "npx",
    ["tsx", "scripts/buildVerveGridBoards.ts"],
  );
}

async function seedModeTables(
  selectedModes: Array<Exclude<ModeName, "all">>,
): Promise<void> {
  divider("Seed Curated Gameplay Tables");

  const seededTables = new Set<string>();
  for (const mode of selectedModes) {
    const config = MODE_CONFIGS[mode];
    for (const table of config.seedTables) {
      if (seededTables.has(table)) continue;
      seededTables.add(table);
      await runCommand(
        `seed ${table}`,
        "npx",
        ["tsx", "scripts/seedSportsDatabase.ts", "--table", table],
      );
    }
  }
}

function printFinalSummary(
  selectedModes: Array<Exclude<ModeName, "all">>,
): void {
  divider("Curated Gameplay Workflow Summary");
  console.log(
    `[modes] ${selectedModes.map((mode) => MODE_CONFIGS[mode].label).join(", ")}`,
  );
  for (const mode of selectedModes) {
    printModeSummary(mode);
  }
}

async function main(): Promise<void> {
  const { mode } = parseArgs();
  const selectedModes = getSelectedModes(mode);
  const target = resolveConvexTarget();

  divider("Curated Gameplay Workflow");
  console.log(`[mode] ${mode}`);
  printResolvedConvexTarget(target, {
    label: "curated gameplay workflow target",
    safetyNote: "non-destructive curated seed workflow; destructive curated parity guard not engaged",
  });
  console.log(
    `[steps] regenerate football artifacts -> build VerveGrid boards if required -> seed approved tables`,
  );
  console.log(
    "[note] For deterministic repo-artifact backend parity without refetching provider data, use runCuratedParityWorkflow.ts / npm run gameplay:curated-parity.",
  );

  await regenerateFootballArtifacts();
  await buildVerveGridBoardsIfNeeded(selectedModes);

  for (const selectedMode of selectedModes) {
    printModeSummary(selectedMode);
  }

  await seedModeTables(selectedModes);
  printFinalSummary(selectedModes);
}

main().catch((error) => {
  console.error("\n[curated-gameplay-workflow] failed");
  console.error(error);
  process.exit(1);
});
