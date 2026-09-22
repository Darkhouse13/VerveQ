// SPOT THE IMPOSTER — one command, everything local:
//   node lab/imposter-render.mjs [--no-verify]
//
// double fact gate (offline --check against the Wikidata cache) → sound bed →
// Remotion render from the reel's OWN root (src/lab/imposter/index.ts) →
// caption → delivery gate (lab/imposter-verify.mjs, the lab/verify.mjs checks).
// Out to out/2026-09-23/tests/imposter.{mp4,txt} + imposter-sheet.png.
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ensureImposterAudio } from "./imposter-audio.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
export const POST_DATE = "2026-09-23";
const outDir = path.join(root, "out", POST_DATE, "tests");
mkdirSync(outDir, { recursive: true });

const run = (label, args) => {
  console.log(`\n── ${label}`);
  const r = spawnSync("node", args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

run("fact gate · imposter", [path.join("lab", "imposter-facts.mjs"), "--check"]);
ensureImposterAudio(true);

console.log("\nBundling imposter root…");
const serveUrl = await bundle({ entryPoint: path.join(root, "src", "lab", "imposter", "index.ts"), publicDir: path.join(root, "public") });
const composition = await selectComposition({ serveUrl, id: "LabImposter" });
const out = path.join(outDir, "imposter.mp4");
console.log(`\n[imposter] ${composition.durationInFrames}f (${(composition.durationInFrames / composition.fps).toFixed(1)}s)…`);
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  audioCodec: "aac",
  concurrency: process.env.LAB_CONCURRENCY ? Number(process.env.LAB_CONCURRENCY) : undefined,
  outputLocation: out,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 20) * 5;
    if (pct > last) {
      last = pct;
      process.stdout.write(pct + "% ");
    }
  },
});

const CAPTION = [
  "3 of them played for the club. 1 never did. Can you spot all 6 imposters?",
  "",
  "Impossible round answer 👇 (be honest if you Googled)",
  "",
  "Play the daily football quiz free at verveq.com",
  "",
  "#footballquiz #football #premierleague #championsleague #footballtrivia",
  "",
].join("\n");
writeFileSync(out.replace(/\.mp4$/, ".txt"), CAPTION);
console.log(`\n  → ${out} (+ caption .txt)`);

if (!process.argv.includes("--no-verify")) run("delivery gate", [path.join("lab", "imposter-verify.mjs")]);
console.log(`\nimposter-render: DONE — ${outDir}`);
