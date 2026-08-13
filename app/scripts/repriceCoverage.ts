/**
 * FW-REPRICE — who does the reprice NOT cover?
 *
 * The two universe snapshots were exported 2026-07-29 and 2026-08-12, and
 * FW-T1 transfer ingestion has created fantasyPlayers rows since. This lists
 * every priced row on a deployment that neither artifact names, so "every one
 * of the ~4,700 players repriced" can be stated with a number instead of a
 * hope.
 *
 * Read-only.
 *
 *   npx tsx scripts/repriceCoverage.ts                            # DEV
 *   CONFIRM_LIVE_DEPLOY=different-lynx-153 \
 *     npx tsx scripts/repriceCoverage.ts --live                   # prod
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { guardTarget } from "./lib/deployTarget";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRICING_DIR = path.resolve(APP_DIR, "..", "research", "fantasy", "pricing");

interface PlayerRow {
  _id: string;
  providerPlayerId: string;
  name: string;
  clubId: string;
  leagueId: number;
  feedPosition: string;
  price: number | null;
  active: boolean;
  _creationTime?: number;
}

function main(): void {
  const live = process.argv.includes("--live");
  const target = guardTarget(live ? { allowLive: true } : {});
  const deployment = target.deploymentName;
  if (deployment === null) throw new Error("Could not resolve a deployment name.");
  console.log(`target=${deployment}`);

  const priced = new Map<string, number>();
  for (const file of ["price-final.json", "expansion-price-final.json"]) {
    const parsed = JSON.parse(fs.readFileSync(path.join(PRICING_DIR, file), "utf8")) as {
      players: { apiFootballId: number; price: number }[];
    };
    for (const p of parsed.players) priced.set(String(p.apiFootballId), p.price);
  }

  const zipPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "reprice-cov-")), "s.zip");
  const exported = spawnSync(
    "npx",
    ["convex", "export", "--path", zipPath, "--deployment", deployment],
    { cwd: APP_DIR, encoding: "utf8", shell: process.platform === "win32" },
  );
  if (exported.status !== 0) throw new Error("convex export failed");
  const out = spawnSync("unzip", ["-p", zipPath, "fantasyPlayers/documents.jsonl"], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  });
  const rows = out.stdout
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as PlayerRow);

  const uncovered = rows.filter((r) => !priced.has(r.providerPlayerId));

  // Do we already hold 2025-26 minutes for them? The top-five pull is by
  // league page, so a player who appeared in one of those leagues is in the
  // aggregates whether or not the universe snapshot named him.
  const TOP5 = new Set([39, 140, 135, 78, 61]);
  const minutesById = new Map<string, number>();
  const agg = JSON.parse(
    fs.readFileSync(path.join(PRICING_DIR, "data", "player-aggregates-2025-26.json"), "utf8"),
  ) as {
    rows: {
      player: { id: number };
      statistics: { league?: { id?: number }; games?: { minutes?: number } }[];
    }[];
  };
  for (const row of agg.rows) {
    let m = 0;
    for (const st of row.statistics ?? []) {
      if (TOP5.has(Number(st.league?.id))) m += Number(st.games?.minutes ?? 0) || 0;
    }
    minutesById.set(String(row.player.id), (minutesById.get(String(row.player.id)) ?? 0) + m);
  }
  const withMin = uncovered.filter((r) => (minutesById.get(r.providerPlayerId) ?? 0) > 0);
  const over900 = uncovered.filter((r) => (minutesById.get(r.providerPlayerId) ?? 0) >= 900);
  console.log(
    `uncovered with 2025-26 top-five minutes on disk: ${withMin.length}; of those >= 900': ${over900.length}`,
  );
  for (const r of over900.sort(
    (a, b) => (minutesById.get(b.providerPlayerId) ?? 0) - (minutesById.get(a.providerPlayerId) ?? 0),
  )) {
    console.log(`    ${String(minutesById.get(r.providerPlayerId)).padStart(5)}' ${r.name} (lg ${r.leagueId}, ${r.feedPosition})`);
  }
  console.log(`table ${rows.length} rows; artifacts cover ${priced.size}; UNCOVERED ${uncovered.length}`);
  const byLeague = new Map<number, number>();
  const byPrice = new Map<string, number>();
  for (const r of uncovered) {
    byLeague.set(r.leagueId, (byLeague.get(r.leagueId) ?? 0) + 1);
    const key = r.price === null ? "null" : r.price.toFixed(1);
    byPrice.set(key, (byPrice.get(key) ?? 0) + 1);
  }
  console.log(`  by league: ${[...byLeague.entries()].sort((a, b) => a[0] - b[0]).map(([l, c]) => `${l}:${c}`).join(" ")}`);
  console.log(`  by current price: ${[...byPrice.entries()].sort().map(([p, c]) => `${p}:${c}`).join(" ")}`);
  console.log(`  active: ${uncovered.filter((r) => r.active).length}, inactive: ${uncovered.filter((r) => !r.active).length}`);
  for (const r of uncovered.sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 80)) {
    console.log(
      `    ${String(r.price ?? "null").padStart(5)} ${r.name.padEnd(28)} club=${r.clubId.padEnd(6)} lg=${String(r.leagueId).padEnd(4)} ${r.feedPosition} active=${r.active}`,
    );
  }
}

main();
