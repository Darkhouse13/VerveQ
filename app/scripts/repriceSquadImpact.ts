/**
 * MISSION FW-REPRICE — how many standing squads does the reprice push over 91.0?
 *
 * The R1 deliverable ("count of squads grandfathered by R1 (expected: few,
 * possibly zero)"), measured rather than guessed. Reads a deployment's
 * fantasySquads / fantasySquadSlots / fantasyPlayers and re-costs every BUDGET
 * squad's 13 at the NEW prices from the artifacts.
 *
 * A grandfathered squad is one whose post-reprice total exceeds SQUAD_BUDGET:
 * `validateBudget`'s baseline is `totalCostOf(priorSlots)` at CURRENT prices,
 * so on the owner's first edit after the seed that total becomes his allowance
 * and the squad stays legal. Crew squads have no budget at all and are counted
 * separately rather than mixed in.
 *
 * Read-only: it opens no mutation and takes no `--execute`.
 *
 *   npx tsx scripts/repriceSquadImpact.ts                 # DEV (guarded default)
 *   CONFIRM_LIVE_DEPLOY=different-lynx-153 \
 *     npx tsx scripts/repriceSquadImpact.ts --live        # prod
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { guardTarget } from "./lib/deployTarget";
import { SQUAD_BUDGET, SQUAD_SIZE } from "../convex/lib/fantasyConstants";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICING_DIR = path.resolve(APP_DIR, "..", "research", "fantasy", "pricing");

interface PlayerRow {
  _id: string;
  providerPlayerId: string;
  name: string;
  price: number | null;
}
interface SquadRow {
  _id: string;
  context: "budget" | "crew";
  gameweekId: string;
  userId?: string;
}
interface SlotRow {
  squadId: string;
  slotIndex: number;
  playerId?: string;
  committedPrice?: number | null;
}

function table<T>(zipPath: string, name: string): T[] {
  const out = spawnSync("unzip", ["-p", zipPath, `${name}/documents.jsonl`], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  });
  if (out.status !== 0) throw new Error(`could not read ${name} from the export`);
  return out.stdout
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

function main(): void {
  const live = process.argv.includes("--live");
  const target = guardTarget(live ? { allowLive: true } : {});
  const deployment = target.deploymentName;
  if (deployment === null) throw new Error("Could not resolve a deployment name; refusing to guess.");
  console.log(`target=${deployment} (source=${target.source})`);

  const newPrice = new Map<string, number>();
  for (const file of ["price-final.json", "expansion-price-final.json"]) {
    const parsed = JSON.parse(fs.readFileSync(path.join(PRICING_DIR, file), "utf8")) as {
      players: { apiFootballId: number; price: number }[];
    };
    for (const p of parsed.players) newPrice.set(String(p.apiFootballId), p.price);
  }
  console.log(`artifacts: ${newPrice.size} distinct priced players`);

  const zipPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "reprice-impact-")), "s.zip");
  const exported = spawnSync(
    "npx",
    ["convex", "export", "--path", zipPath, "--deployment", deployment],
    { cwd: APP_DIR, encoding: "utf8", shell: process.platform === "win32" },
  );
  if (exported.status !== 0) {
    process.stderr.write(exported.stderr ?? "");
    throw new Error(`convex export failed with exit code ${exported.status}`);
  }

  const players = table<PlayerRow>(zipPath, "fantasyPlayers");
  const squads = table<SquadRow>(zipPath, "fantasySquads");
  const slots = table<SlotRow>(zipPath, "fantasySquadSlots");
  const byConvexId = new Map(players.map((p) => [p._id, p]));

  const slotsBySquad = new Map<string, SlotRow[]>();
  for (const s of slots) {
    const list = slotsBySquad.get(s.squadId) ?? [];
    list.push(s);
    slotsBySquad.set(s.squadId, list);
  }

  let budgetSquads = 0;
  let crewSquads = 0;
  let overBudget = 0;
  let filledIncomplete = 0;
  let unknownPlayer = 0;
  const overs: { squadId: string; oldTotal: number; newTotal: number; filled: number }[] = [];
  const every: { squadId: string; oldTotal: number; newTotal: number; filled: number }[] = [];

  for (const squad of squads) {
    if (squad.context !== "budget") {
      crewSquads += 1;
      continue;
    }
    budgetSquads += 1;
    const mine = slotsBySquad.get(squad._id) ?? [];
    let oldTotal = 0;
    let newTotal = 0;
    let filled = 0;
    let bad = false;
    for (const slot of mine) {
      if (slot.playerId === undefined || slot.playerId === null) continue;
      filled += 1;
      const player = byConvexId.get(slot.playerId);
      if (player === undefined) {
        bad = true;
        continue;
      }
      // The price stored now IS the pre-reprice price (this runs before the seed).
      oldTotal += slot.committedPrice ?? player.price ?? 0;
      const next = newPrice.get(player.providerPlayerId);
      if (next === undefined) {
        bad = true;
        continue;
      }
      // A locked slot keeps its committed price through a reprice — prices are
      // static within a gameweek and the stamp is what the budget counts.
      newTotal += slot.committedPrice ?? next;
    }
    if (bad) unknownPlayer += 1;
    if (filled !== SQUAD_SIZE) filledIncomplete += 1;
    every.push({ squadId: squad._id, oldTotal, newTotal, filled });
    if (Math.round(newTotal * 2) / 2 > SQUAD_BUDGET) {
      overBudget += 1;
      overs.push({ squadId: squad._id, oldTotal, newTotal, filled });
    }
  }

  console.log(`squads: ${budgetSquads} budget, ${crewSquads} crew (crew has no budget — not affected)`);
  console.log(`budget squads with fewer than ${SQUAD_SIZE} filled slots: ${filledIncomplete}`);
  console.log(`budget squads referencing a player absent from the artifacts: ${unknownPlayer}`);
  console.log(
    `\nGRANDFATHERED BY R1 (new total > ${SQUAD_BUDGET.toFixed(1)}): ${overBudget} of ${budgetSquads} budget squads`,
  );
  for (const o of overs.slice(0, 25)) {
    console.log(
      `  ${o.squadId}: ${o.oldTotal.toFixed(1)} -> ${o.newTotal.toFixed(1)} (${o.filled} filled)`,
    );
  }
  if (every.length > 0 && every.length <= 25) {
    console.log(`\nevery budget squad, re-costed:`);
    for (const o of every.sort((a, b) => b.newTotal - a.newTotal)) {
      console.log(
        `  ${o.squadId}: ${o.oldTotal.toFixed(1)} -> ${o.newTotal.toFixed(1)} ` +
          `(${o.filled}/${SQUAD_SIZE} filled, ${(o.newTotal - o.oldTotal >= 0 ? "+" : "")}${(o.newTotal - o.oldTotal).toFixed(1)})`,
      );
    }
  }
}

main();
