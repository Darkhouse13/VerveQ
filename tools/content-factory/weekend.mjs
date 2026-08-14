// Renders THE WEEKEND campaign assets (CT-1) to out/<date>/<slug>.mp4,
// generating each soundtrack first if needed. Mirrors promo.mjs exactly —
// separate runner so the campaign lane can't destabilise the promo lane.
//
//   node weekend.mjs                  # render all campaign assets
//   node weekend.mjs wknd-stinger     # render one by slug
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ensureWkndStingerAudio } from "./weekend/stinger-audio.mjs";
import { ensureWkndManifestoAudio } from "./weekend/manifesto-audio.mjs";
import { ensureWkndSettleItAudio } from "./weekend/settleit-audio.mjs";
import { ensureWkndRefereeAudio } from "./weekend/referee-audio.mjs";
import { ensureWkndSquadAudio } from "./weekend/squad-audio.mjs";
import { ensureWkndBoostAudio } from "./weekend/boost-audio.mjs";
import { ensureWkndDilemmaAudio } from "./weekend/dilemma-audio.mjs";
import { buildWeekendCaption } from "./weekend/captions.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const today = new Date().toISOString().slice(0, 10);
const outDir = path.join(dir, "out", today);
mkdirSync(outDir, { recursive: true });

const ASSETS = [
  { name: "wknd-stinger", id: "WkndStinger", audio: ensureWkndStingerAudio },
  { name: "wknd-manifesto", id: "WkndManifesto", audio: ensureWkndManifestoAudio },
  // CF-WEEKEND reels — narrated; run `node weekend/reels-vo.mjs` first (cached
  // takes render from public/promo/vo-wknd/; a keyless clone renders a MUTE
  // PROOF that must never be posted).
  { name: "wknd-settleit", id: "WkndSettleIt", audio: ensureWkndSettleItAudio },
  { name: "wknd-referee", id: "WkndReferee", audio: ensureWkndRefereeAudio },
  { name: "wknd-squad", id: "WkndSquad", audio: ensureWkndSquadAudio },
  // CF-42H paid-boost reel — render via weekend/render-42h.mjs (refreshes the
  // live countdown + re-verifies every fact on prod first), not directly.
  { name: "wknd-42h", id: "Wknd42h", audio: ensureWkndBoostAudio },
  // DILEMMA-B1 — the experiment lane's second occupant. Render via
  // weekend/render-dilemma.mjs (re-verifies every price on prod first), not
  // directly: a wrong price under "no right answer" branding is the one
  // failure this format cannot survive.
  { name: "wknd-dilemma-1", id: "WkndDilemma-d1", audio: ensureWkndDilemmaAudio("wknd-dilemma-1") },
  { name: "wknd-dilemma-2", id: "WkndDilemma-d2", audio: ensureWkndDilemmaAudio("wknd-dilemma-2") },
];

const want = process.argv.slice(2);
const unknown = want.filter((w) => !ASSETS.some((p) => p.name === w));
if (unknown.length > 0) {
  console.error(`Unknown asset(s) ${unknown.join(", ")}. One of: ${ASSETS.map((p) => p.name).join(", ")}`);
  process.exit(1);
}
const list = want.length > 0 ? ASSETS.filter((p) => want.includes(p.name)) : ASSETS;

for (const p of list) p.audio();
console.log("Bundling…");
const serveUrl = await bundle({ entryPoint: path.join(dir, "src", "index.ts"), publicDir: path.join(dir, "public") });

for (const p of list) {
  const out = path.join(outDir, `${p.name}.mp4`);
  const composition = await selectComposition({ serveUrl, id: p.id });
  console.log(`\n[${p.name}] ${composition.durationInFrames}f (${(composition.durationInFrames / composition.fps).toFixed(1)}s)…`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: out,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 20) * 5;
      if (pct > last) {
        last = pct;
        process.stdout.write(pct + "% ");
      }
    },
  });
  writeFileSync(out.replace(/\.mp4$/, ".txt"), buildWeekendCaption(p.name));
  console.log(`\n  → ${out} (+ caption .txt)`);
}
console.log("\nDone.");
