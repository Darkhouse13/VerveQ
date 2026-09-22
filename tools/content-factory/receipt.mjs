// One stat-receipt carousel (CONCEPT-SWEEP 2026-09 §3.7) into the feed queue.
//
//   node receipt.mjs <spec.json> <YYYY-MM-DD> [slot]      (slot defaults to carousel)
//
// The spec is the StatReceipt props plus "caption". Every number in it must
// already be checked against the source named on the card — this script
// renders, it does not verify.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const [specFile, date, slot = "carousel"] = process.argv.slice(2);
if (!specFile || !/^\d{4}-\d{2}-\d{2}$/.test(date || "")) throw new Error("usage: node receipt.mjs <spec.json> <YYYY-MM-DD> [slot]");
const { caption, ...props } = JSON.parse(readFileSync(specFile, "utf8"));
if (!caption) throw new Error("spec needs a caption");

const outDir = path.join(dir, "out", "social", date, slot);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(dir, "src", "posts", "index.ts") });
const composition = await selectComposition({ serveUrl, id: "PostStatReceipt", inputProps: props });
const media = [];
for (let frame = 0; frame < composition.durationInFrames; frame++) {
  const name = `${String(frame + 1).padStart(2, "0")}.jpg`;
  await renderStill({ composition, serveUrl, inputProps: props, frame, output: path.join(outDir, name), imageFormat: "jpeg", jpegQuality: 92 });
  media.push(name);
}
writeFileSync(path.join(outDir, "post.json"), JSON.stringify({ kind: "stat-receipt", source: specFile, media, caption }, null, 2) + "\n");
console.log(`[receipt] ${date}/${slot}: ${media.length} slides → ${outDir}`);
