// THE ONE COMMAND for the-dilemma, v1 and v2 editions alike:
//
//   node weekend/render-dilemma.mjs                     # every edition
//   node weekend/render-dilemma.mjs wknd-dilemma-1      # one (v1)
//   node weekend/render-dilemma.mjs wknd-dilemma-smoke  # one (v2)
//
// which (1) re-pulls the prod board and re-verifies EVERY on-screen fact —
// v1 editions through weekend/dilemma-live.mjs, v2 editions through
// weekend/dilemma-v2-live.mjs (which additionally recomputes each receipt row
// and binds the deadline to the earliest named lock) — any drift THROWS;
// (2) fit-checks/refreshes the VO; (3) renders + captions via weekend.mjs;
// (4) runs the full delivery gate.
//
// There is no countdown baked into the picture, so there is no posting
// window — but the PRICES are live. Re-run this command if the board has been
// repriced between render and post.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { verifyDilemmaFacts } from "./dilemma-live.mjs";
import { verifyDilemmaV2Facts } from "./dilemma-v2-live.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const V1 = JSON.parse(readFileSync(path.join(root, "src", "weekend", "reels", "dilemma-facts.json"), "utf8")).editions.map((e) => e.slug);
const V2_EDS = JSON.parse(readFileSync(path.join(root, "src", "weekend", "reels", "dilemma-v2-facts.json"), "utf8")).editions;
const V2 = V2_EDS.map((e) => e.slug);
// proof editions render only when named explicitly — they are pinned to the
// gameweek they proved the mechanism on and never post
const DEFAULT = [...V1, ...V2_EDS.filter((e) => !e.proof).map((e) => e.slug)];
const ALL = [...V1, ...V2];
const want = process.argv.slice(2);
const unknown = want.filter((w) => !ALL.includes(w));
if (unknown.length > 0) {
  console.error(`render-dilemma: unknown edition(s) ${unknown.join(", ")}. One of: ${ALL.join(", ")}`);
  process.exit(1);
}
const slugs = want.length > 0 ? want : DEFAULT;
const v1Slugs = slugs.filter((s) => V1.includes(s));
const v2Slugs = slugs.filter((s) => V2.includes(s));

const run = (label, args) => {
  console.log(`\n── ${label}`);
  const r = spawnSync("node", args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`render-dilemma: "${label}" failed (${r.status})`);
    process.exit(r.status ?? 1);
  }
};

// throws on any fact drift, per lane
if (v1Slugs.length > 0) await verifyDilemmaFacts(v1Slugs);
if (v2Slugs.length > 0) await verifyDilemmaV2Facts(v2Slugs);

run("VO fit-check / refresh", [path.join("weekend", "reels-vo.mjs")]);
run(`render ${slugs.join(", ")}`, ["weekend.mjs", ...slugs]);
run("delivery gate", [path.join("weekend", "verify-reels.mjs"), new Date().toISOString().slice(0, 10), ...slugs]);

console.log(`\nrender-dilemma: DONE — out/<today>/{${slugs.join(",")}}.mp4 + .txt captions.`);
