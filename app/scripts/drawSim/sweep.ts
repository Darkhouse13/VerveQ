/**
 * D6 — `npm run draw:sweep`
 *
 * Seeded random search over the documented knob ranges below. Three stages,
 * all inside the ≤300 configs × ≤1500 boards budget:
 *   explore: nExplore random genomes (incl. the hand-tuned anchor) × screenBoards
 *   exploit: nExploit perturbations of the explore leaders × screenBoards
 *   final:   top finalists re-evaluated at fullBoards
 * Layout-ineligible configs are excluded before simulation. Output: top-5 by
 * profile distance with a per-criterion pass table + JSON artifact + the
 * winner at artifacts/best-config.json (usable via draw:sim --config).
 *
 * Flags: --explore N --exploit N --screen N --finalists N --boards N --seed s
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildArchetypes,
  checkLayout,
  DEFAULT_ENGINE_CONFIG,
  rngFromString,
  rngInt,
  type EngineConfig,
} from "../../src/lib/drawEngine";
import { buildBoostOnlyArchetypes, buildMixedDipArchetypes } from "./archetypeTables";
import { evaluateConfig, type ConfigEval } from "./evaluate";
import { parseFlags, renderEval } from "./sim";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Searched knob ranges. Layout-shaped knobs stay fixed (rows=6, offers=3,
 * fixtures=5 — anything larger is layout-ineligible). Ranges were anchored by
 * hand probes: bot round-score bands sit near random≈1700 / greedy≈2300 /
 * chaser≈2400 / oracle≈3900 at synergyScale 1 with low tag cardinality.
 */
const RANGES = {
  thresholdBase: [400, 2400],
  thresholdGrowth: [1.04, 1.4],
  bossMult: [0.7, 1.15],
  /** thresholdShape final entry — the boss wall on top of bossMult (Ticket 0.1 C3). */
  bossShape: [1.0, 1.6],
  formSpread: [0.12, 0.45],
  bustKeep: [0.15, 0.4],
  fullClearBonus: [1.1, 1.6],
  /** synergy table entry m ⇒ 1 + (m-1)·scale over the base 1.5/2/2.5/3 table. */
  synergyScale: [0.4, 1.25],
  /** archetype multipliers m ⇒ m^strength. */
  modifierStrength: [0.6, 1.6],
  ratingSkew: [0.7, 1.6],
  clubCount: [5, 13],
  nationCount: [3, 8],
  eraCount: [3, 6],
  /** Card-set size (boards sample 18) — small sets concentrate cross-board margins. */
  setSize: [22, 60],
  /** 0 = default boost+penalty table, 1 = boost-only, 2 = mixed mild/deep dips. */
  archStyle: [0, 2],
  clubsPerCardWeightPresets: [
    [4, 4, 2],
    [3, 4, 3],
    [2, 5, 3],
    [2, 4, 4],
  ],
} as const;

/** Flat knob vector the search operates on; configs are built from genomes. */
interface Genome {
  base: number;
  growth: number;
  bossMult: number;
  bossShape: number;
  formSpread: number;
  bustKeep: number;
  fullClearBonus: number;
  synergyScale: number;
  modifierStrength: number;
  ratingSkew: number;
  clubCount: number;
  nationCount: number;
  eraCount: number;
  setSize: number;
  archStyle: number;
  presetIdx: number;
}

/** Anchor = the Ticket 0.1 calibrator search winner (passes all but P3a there). */
const ANCHOR: Genome = {
  base: 400,
  growth: 1.29,
  bossMult: 0.9,
  bossShape: 1,
  formSpread: 0.2994,
  bustKeep: 0.1515,
  fullClearBonus: 1.5389,
  synergyScale: 0.48,
  modifierStrength: 1.577,
  ratingSkew: 0.8116,
  clubCount: 12,
  nationCount: 6,
  eraCount: 6,
  setSize: 44,
  archStyle: 0,
  presetIdx: 1,
};

function sampleGenome(rng: () => number): Genome {
  const uniform = (r: readonly [number, number]) => r[0] + (r[1] - r[0]) * rng();
  const int = (r: readonly [number, number]) => r[0] + rngInt(rng, r[1] - r[0] + 1);
  return {
    base: Math.round(uniform(RANGES.thresholdBase)),
    growth: uniform(RANGES.thresholdGrowth),
    bossMult: uniform(RANGES.bossMult),
    bossShape: uniform(RANGES.bossShape),
    formSpread: uniform(RANGES.formSpread),
    bustKeep: uniform(RANGES.bustKeep),
    fullClearBonus: uniform(RANGES.fullClearBonus),
    synergyScale: uniform(RANGES.synergyScale),
    modifierStrength: uniform(RANGES.modifierStrength),
    ratingSkew: uniform(RANGES.ratingSkew),
    clubCount: int(RANGES.clubCount),
    nationCount: int(RANGES.nationCount),
    eraCount: int(RANGES.eraCount),
    setSize: int(RANGES.setSize),
    archStyle: int(RANGES.archStyle),
    presetIdx: rngInt(rng, RANGES.clubsPerCardWeightPresets.length),
  };
}

const clamp = (x: number, r: readonly [number, number]) => Math.min(r[1], Math.max(r[0], x));

/** Local jitter around a promising genome (exploit stage). */
function perturbGenome(g: Genome, rng: () => number): Genome {
  const jitter = (x: number, frac: number, r: readonly [number, number]) =>
    clamp(x * (1 + frac * 2 * (rng() - 0.5)), r);
  const jitterInt = (x: number, r: readonly [number, number]) =>
    clamp(x + (rngInt(rng, 3) - 1), r);
  return {
    base: Math.round(jitter(g.base, 0.15, RANGES.thresholdBase)),
    growth: jitter(g.growth, 0.05, RANGES.thresholdGrowth),
    bossMult: jitter(g.bossMult, 0.08, RANGES.bossMult),
    bossShape: jitter(g.bossShape, 0.08, RANGES.bossShape),
    formSpread: jitter(g.formSpread, 0.15, RANGES.formSpread),
    bustKeep: jitter(g.bustKeep, 0.15, RANGES.bustKeep),
    fullClearBonus: jitter(g.fullClearBonus, 0.08, RANGES.fullClearBonus),
    synergyScale: jitter(g.synergyScale, 0.1, RANGES.synergyScale),
    modifierStrength: jitter(g.modifierStrength, 0.15, RANGES.modifierStrength),
    ratingSkew: jitter(g.ratingSkew, 0.12, RANGES.ratingSkew),
    clubCount: jitterInt(g.clubCount, RANGES.clubCount),
    nationCount: jitterInt(g.nationCount, RANGES.nationCount),
    eraCount: jitterInt(g.eraCount, RANGES.eraCount),
    setSize: clamp(g.setSize + (rngInt(rng, 9) - 4), RANGES.setSize),
    archStyle: rng() < 0.8 ? g.archStyle : rngInt(rng, RANGES.archStyle[1] + 1),
    presetIdx: rng() < 0.8 ? g.presetIdx : rngInt(rng, RANGES.clubsPerCardWeightPresets.length),
  };
}

function buildConfig(g: Genome): EngineConfig {
  const scaled = (m: number) => 1 + (m - 1) * g.synergyScale;
  return {
    ...DEFAULT_ENGINE_CONFIG,
    formSpread: g.formSpread,
    bustKeep: g.bustKeep,
    fullClearBonus: g.fullClearBonus,
    synergyTable: [1, 1, 1, scaled(1.5), scaled(2.0), scaled(2.5), scaled(3.0)],
    thresholds: {
      base: g.base,
      growth: g.growth,
      bossMult: g.bossMult,
      thresholdShape: [1, 1, 1, 1, Number(g.bossShape.toFixed(3))],
    },
    archetypes:
      g.archStyle === 2
        ? buildMixedDipArchetypes(g.modifierStrength)
        : g.archStyle === 1
          ? buildBoostOnlyArchetypes(g.modifierStrength)
          : buildArchetypes(g.modifierStrength),
    cardGen: {
      ...DEFAULT_ENGINE_CONFIG.cardGen,
      setSize: g.setSize,
      ratingSkew: g.ratingSkew,
      clubCount: g.clubCount,
      nationCount: g.nationCount,
      eraCount: g.eraCount,
      clubsPerCardWeights: [...RANGES.clubsPerCardWeightPresets[g.presetIdx]],
    },
  };
}

interface Entry {
  id: number;
  genome: Genome;
  config: EngineConfig;
  screen: ConfigEval;
  full?: ConfigEval;
}

function main(): void {
  const flags = parseFlags(process.argv.slice(2));
  const nExplore = Number(flags.get("explore") ?? 150);
  const nExploit = Number(flags.get("exploit") ?? 110);
  const screenBoards = Number(flags.get("screen") ?? 250);
  const finalists = Number(flags.get("finalists") ?? 20);
  const fullBoards = Math.min(1500, Number(flags.get("boards") ?? 1500));
  const seed = flags.get("seed") ?? "drawsweep-v0";
  const rng = rngFromString(seed);
  const totalConfigs = nExplore + nExploit;
  if (totalConfigs > 300) throw new Error(`config budget exceeded: ${totalConfigs} > 300`);

  console.log(
    `sweep: explore ${nExplore} + exploit ${nExploit} configs x ${screenBoards} boards, ` +
      `top ${finalists} x ${fullBoards} boards`,
  );

  const entries: Entry[] = [];
  let skippedLayout = 0;
  let nextId = 0;
  const t0 = performance.now();

  const screenOne = (genome: Genome): void => {
    const id = nextId++;
    const config = buildConfig(genome);
    if (!checkLayout(config).eligible) {
      skippedLayout++;
      return;
    }
    const screen = evaluateConfig(config, {
      boards: screenBoards,
      seedBase: `${seed}|screen`,
      p3Samples: 64,
      p5Every: 0,
    });
    entries.push({ id, genome, config, screen });
    if (nextId % 25 === 0) {
      const best = entries.reduce((m, e) => Math.min(m, e.screen.distance), Infinity);
      console.log(
        `  screened ${nextId}/${totalConfigs} (best distance ${best.toFixed(3)}, ` +
          `${((performance.now() - t0) / 1000).toFixed(0)}s)`,
      );
    }
  };

  for (let i = 0; i < nExplore; i++) screenOne(i === 0 ? ANCHOR : sampleGenome(rng));

  entries.sort((a, b) => a.screen.distance - b.screen.distance);
  const parents = entries.slice(0, Math.min(10, entries.length));
  console.log(
    `\nexploit stage around top ${parents.length} (best ${parents[0].screen.distance.toFixed(3)})`,
  );
  for (let i = 0; i < nExploit; i++) screenOne(perturbGenome(parents[i % parents.length].genome, rng));

  entries.sort((a, b) => a.screen.distance - b.screen.distance);
  const shortlist = entries.slice(0, finalists);
  console.log(`\nfinal stage: re-evaluating ${shortlist.length} finalists at ${fullBoards} boards`);
  for (const entry of shortlist) {
    entry.full = evaluateConfig(entry.config, {
      boards: fullBoards,
      seedBase: `${seed}|full`,
      p3Samples: 200,
      p5Every: 199,
    });
    console.log(`  config#${entry.id}: distance ${entry.full.distance.toFixed(3)}`);
  }
  shortlist.sort((a, b) => (a.full as ConfigEval).distance - (b.full as ConfigEval).distance);

  const top5 = shortlist.slice(0, 5);
  console.log("\n================ TOP 5 ================");
  const ids = ["P0", "P1a", "P1b", "P1c", "P1d", "P2", "P3a", "P3b", "P4", "P5"];
  console.log(
    ["rank".padEnd(5), "config".padEnd(11), "dist".padEnd(8), ...ids.map((s) => s.padEnd(5))].join(" "),
  );
  top5.forEach((entry, rank) => {
    const full = entry.full as ConfigEval;
    const marks = ids.map((id) => {
      const c = full.criteria.find((x) => x.id === id);
      return (c && c.pass ? "PASS" : "fail").padEnd(5);
    });
    console.log(
      [
        `#${rank + 1}`.padEnd(5),
        `config#${entry.id}`.padEnd(11),
        full.distance.toFixed(3).padEnd(8),
        ...marks,
      ].join(" "),
    );
  });

  console.log("\n======== WINNER (full detail) ========");
  console.log(renderEval(top5[0].full as ConfigEval));
  console.log("\nwinner genome: " + JSON.stringify(top5[0].genome));

  const artifactsDir = path.join(HERE, "artifacts");
  fs.mkdirSync(artifactsDir, { recursive: true });
  const artifact = {
    seed,
    nExplore,
    nExploit,
    screenBoards,
    fullBoards,
    skippedLayout,
    top5: top5.map((e, rank) => ({
      rank: rank + 1,
      id: e.id,
      genome: e.genome,
      distance: (e.full as ConfigEval).distance,
      criteria: (e.full as ConfigEval).criteria,
      config: e.config,
      eval: e.full,
    })),
  };
  const outPath = path.join(artifactsDir, `sweep-${seed}.json`);
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  fs.writeFileSync(
    path.join(artifactsDir, "best-config.json"),
    JSON.stringify({ config: top5[0].config }, null, 2),
  );
  console.log(`\nartifacts: ${outPath} + best-config.json`);

  const coreFails = (top5[0].full as ConfigEval).criteria.filter(
    (c) => ["P0", "P1a", "P1b", "P1c", "P1d", "P2", "P3a", "P3b"].includes(c.id) && !c.pass,
  );
  if (coreFails.length > 0) {
    console.error(
      `\nSTOP: no config passes P0-P3 within budget. Winner still fails: ${coreFails
        .map((c) => c.id)
        .join(", ")}. Profile must not be loosened here - report upstream.`,
    );
    process.exitCode = 1;
  }
}

main();
