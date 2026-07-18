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
 *   --p3samples N     Monte-Carlo samples per decision state (default 200)
 *   --kgreedy k       greedy push-rule face multiplier (overrides the config file)
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

/** Harness-level knobs that ride alongside the EngineConfig in config files. */
export interface LoadedConfig {
  config: EngineConfig;
  /** Greedy push-rule face multiplier (Ticket 0.2), default 1. */
  kGreedy: number;
  /** Assisted/reader band-fraction push tolerance (Ticket G), default 0.5. */
  kAssisted: number;
}

export function loadConfig(configPath: string | undefined): LoadedConfig {
  if (!configPath) return { config: mergeConfig(undefined), kGreedy: 1, kAssisted: 0.5 };
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  // Accept either a bare partial config or a sweep artifact entry
  // ({ config: ..., kGreedy?: ..., kAssisted?: ... }).
  return {
    config: mergeConfig(raw.config ?? raw),
    kGreedy: Number(raw.kGreedy ?? 1),
    kAssisted: Number(raw.kAssisted ?? 0.5),
  };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export function renderEval(ev: ConfigEval): string {
  const lines: string[] = [];
  lines.push(`boards=${ev.boards} seed=${ev.seedBase}`);
  lines.push("");
  const header = [
    "bot".padEnd(14),
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
  for (const name of ["oracle", "greedy", "chaser", "assisted", "reader", "coarseAssisted", "coarseReader", "random"]) {
    const b = ev.bots[name];
    if (!b) continue; // pre-Ticket-G artifacts have no assisted/reader
    lines.push(
      [
        name.padEnd(14),
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
    `p3: tense runs ${pct(ev.p3.tenseRunFrac)} (${ev.p3.tenseRuns}/${ev.p3.runs}); ` +
      `${ev.p3.states} decision states, per-state tense ${pct(ev.p3.perStateTenseFrac)} (${ev.p3.tenseCount}), ` +
      `tense median spread ${Number.isNaN(ev.p3.tenseMedianSpread) ? "n/a" : pct(ev.p3.tenseMedianSpread)}`,
  );
  const dec = (v: number[]) => v.map((x) => pct(x)).join(" / ");
  lines.push(`    EV-gap p10/p25/p50/p75/p90: ${dec(ev.p3.gapDeciles)}`);
  lines.push(`    spread p10/p25/p50/p75/p90: ${dec(ev.p3.spreadDeciles)}`);
  const occupied = ev.p3.gapHist.filter((b) => b.count > 0);
  const peak = Math.max(1, ...occupied.map((b) => b.count));
  for (const b of occupied) {
    const bar = "#".repeat(Math.max(1, Math.round((b.count / peak) * 40)));
    lines.push(
      `    ${`${(b.lo * 100).toFixed(0)}%`.padStart(6)}..${`${(b.hi * 100).toFixed(0)}%`.padStart(5)} ` +
        `${String(b.count).padStart(6)} ${bar}`,
    );
  }
  const att = ev.p2Attribution;
  lines.push(
    `p2 near-miss attribution (report-only): by fail round ${att.byRound
      .map((c, r) => `r${r + 1}=${c}`)
      .join(" ")} — forced r1 ${pct(att.forcedShare)}, chosen push r>=2 ${pct(att.chosenShare)} ` +
      `of ${att.nearMisses} near-misses`,
  );
  if (ev.bots.assisted && ev.bots.reader) {
    // Ticket G ladder (report-only): random < greedy < chaser < assisted <= reader.
    const ladder = ["random", "greedy", "chaser", "assisted", "reader"]
      .map((n) => `${n}=${ev.bots[n].scoreP50.toFixed(0)}`)
      .join(" < ");
    lines.push(`ladder v1.1 (median final score, want nondecreasing): ${ladder}`);
  }
  if (ev.bots.coarseAssisted && ev.bots.coarseReader) {
    // Ticket G2 ladder: random < greedy < chaser < coarseAssisted <= coarseReader.
    const ladder = ["random", "greedy", "chaser", "coarseAssisted", "coarseReader"]
      .map((n) => `${n}=${ev.bots[n].scoreP50.toFixed(0)}`)
      .join(" < ");
    lines.push(`ladder v1.2 (median final score, want nondecreasing): ${ladder}`);
  }
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
  const { config, kGreedy: fileKGreedy, kAssisted: fileKAssisted } = loadConfig(flags.get("config"));
  const kGreedy = Number(flags.get("kgreedy") ?? fileKGreedy);
  const kAssisted = Number(flags.get("kassisted") ?? fileKAssisted);

  const layout = checkLayout(config);
  if (!layout.eligible) {
    console.error("Config is layout-INELIGIBLE:\n  " + layout.violations.join("\n  "));
    process.exitCode = 1;
    return;
  }

  const ev = evaluateConfig(config, { boards, seedBase, p3Samples, p5Every: 97, kGreedy, kAssisted });

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
  fs.writeFileSync(outPath, JSON.stringify({ config, kGreedy, kAssisted, eval: ev }, null, 2));
  console.log(`\nartifact: ${outPath}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
