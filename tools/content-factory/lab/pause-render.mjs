// PAUSE IT — one command, everything local:
//   node lab/pause-render.mjs [--date 2026-09-23] [--no-facts] [--no-verify]
//
// prod fact gate (lab/pause-facts.mjs) → loop bed (lab/pause-audio.mjs) →
// Remotion render from its OWN root (src/lab/pause/index.ts) → caption →
// delivery gate (lab/pause-verify.mjs). Out to out/<date>/tests/pause.mp4.
import path from "node:path";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const date = arg("--date", "2026-09-23");
const outDir = path.join(root, "out", date, "tests");
mkdirSync(outDir, { recursive: true });

const run = (label, args) => {
  console.log(`\n── ${label}`);
  const r = spawnSync("node", args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!process.argv.includes("--no-facts")) run("fact gate · pause (PROD)", [path.join("lab", "pause-facts.mjs")]);
run("sound bed · pause", [path.join("lab", "pause-audio.mjs"), "--force"]);

console.log("\nBundling pause root…");
const serveUrl = await bundle({ entryPoint: path.join(root, "src", "lab", "pause", "index.ts"), publicDir: path.join(root, "public") });
const composition = await selectComposition({ serveUrl, id: "LabPause" });
const out = path.join(outDir, "pause.mp4");
console.log(`\n[pause] ${composition.durationInFrames}f (${(composition.durationInFrames / composition.fps).toFixed(1)}s)…`);
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  audioCodec: "aac",
  crf: 16, // hard 4-frame cuts of big type — keep the encoder generous
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

// loop remux: Remotion's AAC mux leaves ~39ms of priming silence at the head
// and runs 10.048s — on a looping platform that is a gap + a late downbeat at
// every wrap. Keep the video stream bit-for-bit, re-encode the loop bed with
// ffmpeg's AAC (edit-listed priming → decodes from sample 0), cut to 10.000s.
{
  const tmp = out.replace(/\.mp4$/, ".remux.mp4");
  const wav = path.join(root, "public", "promo", "lab-pause.wav");
  const secs = (composition.durationInFrames / composition.fps).toFixed(3);
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", out, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", secs, "-movflags", "+faststart", tmp], { stdio: "inherit" });
  if (r.status !== 0) process.exit(1);
  renameSync(tmp, out);
  console.log(`\n  loop remux → ${secs}s, audio from sample 0`);
}

const caption = [
  "Pause it. Whoever's on your screen is your new striker. Who did you get? 👇",
  "",
  "Play the daily football quiz free at verveq.com",
  "",
  "#pausechallenge #football #footballquiz #soccer #strikers",
].join("\n");
writeFileSync(path.join(outDir, "pause.txt"), caption + "\n");
console.log(`\n  → ${out} (+ pause.txt)`);

if (!process.argv.includes("--no-verify")) run("delivery gate", [path.join("lab", "pause-verify.mjs"), date]);
console.log(`\npause-render: DONE — ${outDir}`);
