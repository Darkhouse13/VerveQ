// CF-42H — THE ONE COMMAND. Re-render is exactly:
//
//   node weekend/render-42h.mjs            # (FAL_KEY=… if the hour changed)
//
// which (1) re-pulls the prod market and re-verifies EVERY on-screen fact
// (drift throws — a stale render cannot happen), restamping the live
// countdown; (2) fit-checks/refreshes VO — the spoken hours number lives in
// the line text, so a changed hour invalidates exactly that one cached take;
// (3) renders wknd-42h.mp4 + caption via weekend.mjs; (4) runs the full
// delivery gate incl. the motion gate. Post within 15 minutes of rendering —
// the on-screen countdown is truthful at render time (±15min tolerance).
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { refreshBoostLive } from "./boost-live.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");

const run = (label, args) => {
  console.log(`\n── ${label}`);
  const r = spawnSync("node", args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`render-42h: "${label}" failed (${r.status})`);
    process.exit(r.status ?? 1);
  }
};

await refreshBoostLive(); // throws on fact drift / passed kickoff

// VO: cached takes are free; a changed hours-line regenerates one take and
// THROWS without FAL_KEY rather than rendering a stale spoken number.
run("VO fit-check / refresh", [path.join("weekend", "reels-vo.mjs")]);
run("render wknd-42h", ["weekend.mjs", "wknd-42h"]);
run("delivery gate", [path.join("weekend", "verify-reels.mjs"), new Date().toISOString().slice(0, 10), "wknd-42h"]);

console.log("\nrender-42h: DONE — post out/<today>/wknd-42h.mp4 with its .txt caption within 15 minutes.");
