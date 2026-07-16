/**
 * D7 — `npm run draw:layoutcheck [-- --config <path>]`
 *
 * Static single-screen constraint check for an EngineConfig against the
 * 390×844 budget in app/src/lib/drawEngine/LAYOUT_SPEC.md. Exit 1 = ineligible.
 */

import { checkLayout } from "../../src/lib/drawEngine";
import { loadConfig, parseFlags } from "./sim";

const flags = parseFlags(process.argv.slice(2));
const { config } = loadConfig(flags.get("config"));
const result = checkLayout(config);
const m = result.metrics;

console.log("draw:layoutcheck vs 390x844 (LAYOUT_SPEC.md)");
console.log(
  `  shape: rows=${config.rows} offers=${config.offersPerRow} fixtures=${config.fixtureCount} ` +
    `synergyFamilies=${config.maxSynergyFamilies}`,
);
console.log(`  content width ${m.contentW}px, height budget ${m.budgetH}px`);
console.log(
  `  fixture chip ${m.fixtureChipW.toFixed(1)}px | offer card ${m.offerCardW.toFixed(1)}x${m.offerCardH.toFixed(0)}px | ` +
    `squad chip ${m.squadChipW.toFixed(1)}px`,
);
console.log(`  draft view ${m.draftViewH.toFixed(0)}px | round view ${m.roundViewH.toFixed(0)}px`);
if (result.eligible) {
  console.log("ELIGIBLE: all caps and pixel budgets hold.");
} else {
  console.error("INELIGIBLE:\n  " + result.violations.join("\n  "));
  process.exitCode = 1;
}
