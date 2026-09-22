// BALLON D'OR RACE renderer — one command, everything local:
//   node lab/race-render.mjs                  # gate → timeline → bed → render → caption → verify
//   node lab/race-render.mjs --stills 0,300   # just PNG stills of those frames (layout pass)
//
// Out to out/2026-09-23/tests/race.mp4 (+ race.txt caption, race-sheet.png
// from lab/race-verify.mjs). Bundles its own root (src/lab/race/index.ts).
import path from "node:path";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
export const RACE_DATE = "2026-09-23";
const outDir = path.join(root, "out", RACE_DATE, "tests");
mkdirSync(outDir, { recursive: true });

const CAPTION = [
  "Most Ballon d'Or wins by club, 1956 → 2025. Barcelona and Real Madrid are level on 12. 🏆",
  "",
  "The 2026 gala is on 26 October. Who wins in October? 👇",
  "",
  "Play the daily football quiz free at verveq.com",
  "",
  "#ballondor #football #realmadrid #barcelona #footballhistory",
].join("\n");

const run = (label, args) => {
  console.log(`\n── ${label}`);
  const r = spawnSync("node", args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const stillsArg = process.argv.indexOf("--stills");
run("fact gate", [path.join("lab", "race-facts.mjs"), "--check"]);
run("timeline", [path.join("lab", "race-timeline.mjs")]);
if (stillsArg < 0) run("sound bed", [path.join("lab", "race-audio.mjs")]);

console.log("\nBundling race root…");
// a minimal publicDir: bundling the shared public/ copies ~340MB into /tmp
// per bundle (tmpfs, shared with other sessions' renders) — this reel needs
// one file, its own bed
const pub = path.join(os.tmpdir(), `race-public-${process.pid}`);
mkdirSync(path.join(pub, "promo"), { recursive: true });
const bed = path.join(root, "public", "promo", "lab-race.wav");
if (!existsSync(bed)) run("sound bed", [path.join("lab", "race-audio.mjs")]);
copyFileSync(bed, path.join(pub, "promo", "lab-race.wav"));
const serveUrl = await bundle({ entryPoint: path.join(root, "src", "lab", "race", "index.ts"), publicDir: pub });
const cleanup = () => {
  rmSync(pub, { recursive: true, force: true });
  if (serveUrl.startsWith(os.tmpdir())) rmSync(serveUrl, { recursive: true, force: true });
};
const composition = await selectComposition({ serveUrl, id: "LabBallonRace" });

if (stillsArg >= 0) {
  const frames = process.argv[stillsArg + 1].split(",").map(Number);
  const sdir = process.env.RACE_STILLS ?? path.join(outDir, "race-stills");
  mkdirSync(sdir, { recursive: true });
  for (const f of frames) {
    const output = path.join(sdir, `f${String(f).padStart(4, "0")}.png`);
    await renderStill({ composition, serveUrl, frame: f, output });
    console.log(`  → ${output}`);
  }
  cleanup();
  process.exit(0);
}

const out = path.join(outDir, "race.mp4");
console.log(`\n[race] ${composition.durationInFrames}f (${(composition.durationInFrames / composition.fps).toFixed(1)}s)…`);
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
cleanup();
writeFileSync(path.join(outDir, "race.txt"), CAPTION + "\n");
console.log(`\n  → ${out} (+ race.txt)`);

if (!process.argv.includes("--no-verify")) run("delivery gate", [path.join("lab", "race-verify.mjs")]);
console.log(`\nrace-render: DONE — ${outDir}`);
