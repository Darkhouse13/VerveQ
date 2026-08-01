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
import { buildWeekendCaption } from "./weekend/captions.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const today = new Date().toISOString().slice(0, 10);
const outDir = path.join(dir, "out", today);
mkdirSync(outDir, { recursive: true });

const ASSETS = [
  { name: "wknd-stinger", id: "WkndStinger", audio: ensureWkndStingerAudio },
  { name: "wknd-manifesto", id: "WkndManifesto", audio: ensureWkndManifestoAudio },
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
