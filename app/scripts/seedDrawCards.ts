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
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { guardTarget, LIVE_CONFIRM_ENV } from "./lib/deployTarget";
import {
  DRAW_ACTIVE_CONFIG,
  DRAW_CARD_SET_SEED,
  DRAW_CONFIG_VERSION,
  DRAW_REAL_SET_VERSION,
  DRAW_SET_VERSION,
} from "../convex/drawSeed";
import { generateCardSet } from "../src/lib/drawEngine";

function main() {
  const argv = process.argv.slice(2);
  const flags = new Set(argv);
  const execute = flags.has("--execute");
  // E5: `--set real-v4` seeds the committed real set via drawSeed:seedRealCards
  // (full sync of drawCardsReal.candidates.json); default stays synthetic.
  const setArg = argv.includes("--set") ? argv[argv.indexOf("--set") + 1] : DRAW_SET_VERSION;
  if (setArg !== DRAW_SET_VERSION && setArg !== DRAW_REAL_SET_VERSION) {
    throw new Error(`unknown --set "${setArg}" (know: ${DRAW_SET_VERSION}, ${DRAW_REAL_SET_VERSION})`);
  }
  const real = setArg === DRAW_REAL_SET_VERSION;
  const mutation = real ? "drawSeed:seedRealCards" : "drawSeed:seedSyntheticCards";

  const target = guardTarget({ allowLive: true });
  console.log(`mode=${execute ? "execute" : "plan"}`);
  console.log(`target=${target.deploymentName ?? target.host ?? "(unknown)"}`);
  console.log(`liveGuardEnv=${LIVE_CONFIRM_ENV}`);
  console.log(`setVersion=${setArg}`);
  console.log(`configVersion=${DRAW_CONFIG_VERSION}`);

  // Plan summary from the exact inputs the mutation uses, so the plan is
  // what execute will write.
  if (real) {
    const p = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "convex",
      "data",
      "drawCardsReal.candidates.json",
    );
    const cards = JSON.parse(fs.readFileSync(p, "utf8")) as {
      cardId: string;
      name: string;
      rating: number;
    }[];
    console.log(`cards=${cards.length}`);
    console.log(
      `sample=${cards
        .slice(0, 3)
        .map((card) => `${card.cardId}:${card.name}(${card.rating})`)
        .join(", ")}`,
    );
  } else {
    console.log(`cardSetSeed=${DRAW_CARD_SET_SEED}`);
    const preview = generateCardSet(DRAW_CARD_SET_SEED, DRAW_ACTIVE_CONFIG.cardGen);
    console.log(`cards=${preview.length}`);
    console.log(
      `sample=${preview
        .slice(0, 3)
        .map((card) => `${card.id}:${card.name}(${card.rating})`)
        .join(", ")}`,
    );
  }

  if (!execute) {
    console.log(`mutation=none (pass --execute to run ${mutation})`);
    return;
  }

  const result = spawnSync("npx", ["convex", "run", mutation], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`convex run failed with exit code ${result.status}`);
  }
}

main();
