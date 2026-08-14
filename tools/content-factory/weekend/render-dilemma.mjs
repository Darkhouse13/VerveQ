// DILEMMA-B1 — THE ONE COMMAND. Re-render is exactly:
//
//   node weekend/render-dilemma.mjs                 # both editions
//   node weekend/render-dilemma.mjs wknd-dilemma-2  # one
//
// which (1) re-pulls the prod board and re-verifies EVERY price, position,
// fixture, venue, kickoff, sum and superlative the reels put on screen — drift
// THROWS, so a stale price cannot reach a frame; (2) fit-checks/refreshes the
// VO; (3) renders the MP4 + caption via weekend.mjs; (4) runs the full delivery
// gate including the motion gate.
//
// Unlike wknd-42h there is no countdown baked into the picture, so there is no
// 15-minute posting window — but the PRICES are live, and a reprice between
// render and post would make a shipped reel wrong. Re-run this command if the
// board has been repriced since the render.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyDilemmaFacts } from "./dilemma-live.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const ALL = ["wknd-dilemma-1", "wknd-dilemma-2"];
const want = process.argv.slice(2);
const unknown = want.filter((w) => !ALL.includes(w));
if (unknown.length > 0) {
  console.error(`render-dilemma: unknown edition(s) ${unknown.join(", ")}. One of: ${ALL.join(", ")}`);
  process.exit(1);
}
const slugs = want.length > 0 ? want : ALL;

const run = (label, args) => {
  console.log(`\n── ${label}`);
  const r = spawnSync("node", args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`render-dilemma: "${label}" failed (${r.status})`);
    process.exit(r.status ?? 1);
  }
};

await verifyDilemmaFacts(slugs); // throws on any fact drift

run("VO fit-check / refresh", [path.join("weekend", "reels-vo.mjs")]);
run(`render ${slugs.join(", ")}`, ["weekend.mjs", ...slugs]);
run("delivery gate", [path.join("weekend", "verify-reels.mjs"), new Date().toISOString().slice(0, 10), ...slugs]);

console.log(`\nrender-dilemma: DONE — out/<today>/{${slugs.join(",")}}.mp4 + .txt captions.`);
