/**
 * THE DRAW — card-set seeding wrapper.
 *
 * The actual seeding logic is the Convex internal mutation
 * drawSeed:seedSyntheticCards (idempotent upsert of the pinned synthetic set,
 * setVersion "synthetic-v1", plus creation of the DISABLED drawSettings
 * singleton). This script is the guarded entry point:
 *
 *   npx tsx scripts/seedDrawCards.ts              # plan: print target + set summary, no writes
 *   npx tsx scripts/seedDrawCards.ts --execute    # run the mutation on the resolved target
 *
 * Live-deployment protection follows the house pattern (scripts/lib/
 * deployTarget): pointing at a known live target requires
 * CONFIRM_LIVE_DEPLOY=<deployment name> exactly.
 */

import { spawnSync } from "node:child_process";
import { guardTarget, LIVE_CONFIRM_ENV } from "./lib/deployTarget";
import {
  DRAW_ACTIVE_CONFIG,
  DRAW_CARD_SET_SEED,
  DRAW_CONFIG_VERSION,
  DRAW_SET_VERSION,
} from "../convex/drawSeed";
import { generateCardSet } from "../src/lib/drawEngine";

function main() {
  const flags = new Set(process.argv.slice(2));
  const execute = flags.has("--execute");

  const target = guardTarget({ allowLive: true });
  console.log(`mode=${execute ? "execute" : "plan"}`);
  console.log(`target=${target.deploymentName ?? target.host ?? "(unknown)"}`);
  console.log(`liveGuardEnv=${LIVE_CONFIRM_ENV}`);
  console.log(`setVersion=${DRAW_SET_VERSION}`);
  console.log(`cardSetSeed=${DRAW_CARD_SET_SEED}`);
  console.log(`configVersion=${DRAW_CONFIG_VERSION}`);

  // Plan summary from the exact inputs the mutation uses (same pinned seed,
  // same pinned cardGen), so the plan is what execute will write.
  const preview = generateCardSet(DRAW_CARD_SET_SEED, DRAW_ACTIVE_CONFIG.cardGen);
  console.log(`cards=${preview.length}`);
  console.log(
    `sample=${preview
      .slice(0, 3)
      .map((card) => `${card.id}:${card.name}(${card.rating})`)
      .join(", ")}`,
  );

  if (!execute) {
    console.log("mutation=none (pass --execute to run drawSeed:seedSyntheticCards)");
    return;
  }

  const result = spawnSync("npx", ["convex", "run", "drawSeed:seedSyntheticCards"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`convex run failed with exit code ${result.status}`);
  }
}

main();
