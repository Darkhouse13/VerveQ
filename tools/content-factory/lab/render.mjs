// LAB lane renderer — one command, everything local:
//   node lab/render.mjs                       # all three concepts
//   node lab/render.mjs lab-guesswho lab-xi   # a subset
//
// fact gates → sound beds → Remotion render (its own root, src/lab/index.ts)
// → caption → delivery gate (lab/verify.mjs). Out to out/<date>/lab/.
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ensureLabGuessWhoAudio, ensureLabOlderAudio, ensureLabXIAudio } from "./audio.mjs";
import { buildLabCaption } from "./captions.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const today = new Date().toISOString().slice(0, 10);
const outDir = path.join(root, "out", today, "lab");
mkdirSync(outDir, { recursive: true });

const ASSETS = [
  { name: "lab-guesswho", id: "LabGuessWho", facts: "guesswho-facts.mjs", audio: ensureLabGuessWhoAudio },
  { name: "lab-older", id: "LabWhosOlder", facts: "older-facts.mjs", factsArgs: ["--check"], audio: ensureLabOlderAudio },
  { name: "lab-xi", id: "LabTheXI", facts: "xi-facts.mjs", audio: ensureLabXIAudio },
];

const want = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const skipVerify = process.argv.includes("--no-verify");
const unknown = want.filter((w) => !ASSETS.some((p) => p.name === w));
if (unknown.length > 0) {
  console.error(`Unknown asset(s) ${unknown.join(", ")}. One of: ${ASSETS.map((p) => p.name).join(", ")}`);
  process.exit(1);
}
const list = want.length > 0 ? ASSETS.filter((p) => want.includes(p.name)) : ASSETS;

const run = (label, args) => {
  console.log(`\n── ${label}`);
  const r = spawnSync("node", args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

for (const p of list) run(`fact gate · ${p.name}`, [path.join("lab", p.facts), ...(p.factsArgs ?? [])]);
for (const p of list) p.audio();

console.log("\nBundling lab root…");
const serveUrl = await bundle({ entryPoint: path.join(root, "src", "lab", "index.ts"), publicDir: path.join(root, "public") });

for (const p of list) {
  const out = path.join(outDir, `${p.name}.mp4`);
  const composition = await selectComposition({ serveUrl, id: p.id });
  console.log(`\n[${p.name}] ${composition.durationInFrames}f (${(composition.durationInFrames / composition.fps).toFixed(1)}s)…`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    // LAB_CONCURRENCY=2 when the machine is in use — fewer headless tabs
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
  writeFileSync(out.replace(/\.mp4$/, ".txt"), buildLabCaption(p.name));
  console.log(`\n  → ${out} (+ caption .txt)`);
}

if (!skipVerify) run("delivery gate", [path.join("lab", "verify.mjs"), today, ...list.map((p) => p.name)]);
console.log(`\nlab/render: DONE — ${outDir}`);
