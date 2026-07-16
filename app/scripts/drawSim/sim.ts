/**
 * D5 — `npm run draw:sim -- --boards 2000 --config <path>`
 *
 * Runs oracle + greedy + synergyChaser + random over N seeded boards, prints
 * per-bot distributions and the P0–P5 PASS/FAIL table, and writes a JSON
 * artifact next to this script (artifacts/ is gitignored).
 *
 * Flags:
 *   --boards N        boards to simulate (default 2000)
 *   --config path     JSON file with a partial EngineConfig (deep-merged onto defaults)
 *   --seed s          seed base (default "drawsim-v0")
 *   --p3samples N     Monte-Carlo samples per bank point (default 200)
 *   --out path        artifact path (default artifacts/sim-<seed>-<boards>.json)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkLayout, mergeConfig, type EngineConfig } from "../../src/lib/drawEngine";
import { evaluateConfig, type ConfigEval } from "./evaluate";
import { formatCriteriaTable } from "./metrics";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function parseFlags(argv: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = i + 1 < argv.length && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      flags.set(key, val);
    }
  }
  return flags;
}

export function loadConfig(configPath: string | undefined): EngineConfig {
  if (!configPath) return mergeConfig(undefined);
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  // Accept either a bare partial config or a sweep artifact entry ({ config: ... }).
  return mergeConfig(raw.config ?? raw);
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export function renderEval(ev: ConfigEval): string {
  const lines: string[] = [];
  lines.push(`boards=${ev.boards} seed=${ev.seedBase}`);
  lines.push("");
  const header = [
    "bot".padEnd(8),
    "medRnds".padEnd(8),
    "rounds 0..5".padEnd(30),
    "p10".padEnd(8),
    "p50".padEnd(8),
    "p90".padEnd(8),
    "bust".padEnd(7),
    "bank".padEnd(7),
    "fullclr".padEnd(8),
    "nearmiss",
  ].join(" ");
  lines.push(header);
  for (const name of ["oracle", "greedy", "chaser", "random"]) {
    const b = ev.bots[name];
    lines.push(
      [
        name.padEnd(8),
        String(b.medianRounds).padEnd(8),
        b.roundsDist.join("/").padEnd(30),
        b.scoreP10.toFixed(0).padEnd(8),
        b.scoreP50.toFixed(0).padEnd(8),
        b.scoreP90.toFixed(0).padEnd(8),
        pct(b.bustRate).padEnd(7),
        pct(b.bankRate).padEnd(7),
        pct(b.fullClearRate).padEnd(8),
        pct(b.nearMissRate),
      ].join(" "),
    );
  }
  lines.push("");
  lines.push(
    `oracle: median ${ev.oracle.medianNodes} nodes, ${ev.oracle.medianMs.toFixed(2)} ms/board; ` +
      `${ev.oracle.deadBoards} dead boards (${ev.oracle.deadFlagged} flagged)`,
  );
  lines.push(
    `p3: ${ev.p3.points} bank points, median gap ${pct(ev.p3.medianGap)}, ` +
      `median spread ${pct(ev.p3.medianSpread)}, in-range ${pct(ev.p3.fracInRange)}`,
  );
  lines.push(`p4: line diversity on ${pct(ev.p4Rate)} of boards`);
  lines.push("");
  lines.push(formatCriteriaTable(ev.criteria));
  const passed = ev.criteria.filter((c) => c.pass).length;
  lines.push("");
  lines.push(`criteria: ${passed}/${ev.criteria.length} PASS, profile distance ${ev.distance.toFixed(3)}`);
  return lines.join("\n");
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const boards = Number(flags.get("boards") ?? 2000);
  const seedBase = flags.get("seed") ?? "drawsim-v0";
  const p3Samples = Number(flags.get("p3samples") ?? 200);
  const config = loadConfig(flags.get("config"));

  const layout = checkLayout(config);
  if (!layout.eligible) {
    console.error("Config is layout-INELIGIBLE:\n  " + layout.violations.join("\n  "));
    process.exitCode = 1;
    return;
  }

  const ev = evaluateConfig(config, { boards, seedBase, p3Samples, p5Every: 97 });

  if (ev.oracle.medianMs > 1000) {
    console.error(
      `STOP: oracle median ${ev.oracle.medianMs.toFixed(0)} ms/board exceeds the 1s budget.`,
    );
    process.exitCode = 1;
  }

  console.log(renderEval(ev));

  const outPath =
    flags.get("out") ?? path.join(HERE, "artifacts", `sim-${seedBase}-${boards}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ config, eval: ev }, null, 2));
  console.log(`\nartifact: ${outPath}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
