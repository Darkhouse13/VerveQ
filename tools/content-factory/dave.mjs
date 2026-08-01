// THE DAVE TAPES — render the live-action lane.
//
//   node dave.mjs                      # render every film that has a clip
//   node dave.mjs polygraph            # render one
//   node dave.mjs --envelope polygraph # print the clip's audio envelope
//
// Deliberately NOT part of promo.mjs. That script renders pieces this repo
// draws from nothing; this one cuts footage that arrived from a camera we
// don't own. Different inputs, different failure modes (a missing clip is not
// a missing synth), different review step — so, different script.
//
// The clips are committed under public/dave/. They are the expensive,
// non-deterministic part of this lane: ~45 Higgsfield credits each and a
// different take every roll, so they are treated as source footage, not as
// build output. `npm run promo` can rebuild any promo from nothing forever;
// this lane cannot, and pretending otherwise would mean losing the batch to a
// re-roll. Commit the MP4s.
import path from "node:path";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { buildDaveCaption } from "./dave/captions.mjs";
import { ensureDaveAudio } from "./promo/dave-audio.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const today = new Date().toISOString().slice(0, 10);
const outDir = path.join(dir, "out", today);

// Mirrors src/dave/films.ts. Kept as plain data here because the render script
// is .mjs and the film table is .ts — same split promo.mjs already lives with
// for its timelines.
const NAMES = ["polygraph", "support-group", "nature", "warning"];
const CLIP = (n) => path.join(dir, "public", "dave", `${n}.mp4`);

const args = process.argv.slice(2);

// --- the envelope tool -------------------------------------------------
//
// Seedance decides its own comic timing — where the question lands, how long
// the silence runs, when the needle goes. You cannot caption that from the
// prompt, because the prompt is a wish and the clip is a fact. So you read the
// fact: this prints a peak-amplitude bar per 100ms, you find the speech, and
// those numbers become `cues` in films.ts.
//
// It is the same rule the semi-final promo established — copy follows the
// measured voice, never the other way round. Re-roll a clip, re-run this.
const ffmpeg = () => {
  for (const bin of ["ffmpeg", path.join(dir, "node_modules", ".bin", "remotion")]) {
    try {
      if (bin === "ffmpeg") execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
      return bin;
    } catch {}
  }
  return null;
};

const envelope = (name) => {
  const clip = CLIP(name);
  if (!existsSync(clip)) throw new Error(`no clip: ${clip}`);
  // scratch, not out/ — out/<date>/ is the folder you upload from, and a
  // stray probe.wav in it is one more thing to think about at 7am
  const probeDir = path.join(dir, "node_modules", ".cache", "dave");
  mkdirSync(probeDir, { recursive: true });
  const wav = path.join(probeDir, `${name}.probe.wav`);
  // Remotion ships its own ffmpeg build, so this works on a fresh clone with
  // nothing installed — but that build is compiled --disable-filters with only
  // a whitelist re-enabled, so stick to scale/volume/silencedetect and friends.
  execFileSync("npx", ["remotion", "ffmpeg", "-y", "-i", clip, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", wav], {
    cwd: dir,
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  const b = readFileSync(wav);
  let o = 12;
  while (o < b.length - 8) {
    const id = b.toString("ascii", o, o + 4);
    const sz = b.readUInt32LE(o + 4);
    if (id === "data") {
      o += 8;
      break;
    }
    o += 8 + sz + (sz % 2);
  }
  const n = (b.length - o) / 2;
  const win = 1600; // 100ms @ 16k
  console.log(`\n${name} — peak per 100ms (find the speech, put it in films.ts)\n`);
  for (let i = 0; i < n; i += win) {
    let pk = 0;
    for (let j = i; j < Math.min(i + win, n); j++) {
      const v = Math.abs(b.readInt16LE(o + j * 2));
      if (v > pk) pk = v;
    }
    const t = (i / 16000).toFixed(1);
    console.log(`${String(t).padStart(5)}s |${"#".repeat(Math.round((pk / 32768) * 44))}`);
  }
  console.log("");
};

if (args[0] === "--envelope") {
  const n = args[1];
  if (!n) throw new Error("--envelope needs a film name");
  envelope(n);
  process.exit(0);
}

// --- render ------------------------------------------------------------
const wanted = args.length ? args : NAMES;
for (const n of wanted) if (!NAMES.includes(n)) throw new Error(`unknown film: ${n} (have: ${NAMES.join(", ")})`);

const ready = wanted.filter((n) => existsSync(CLIP(n)));
const missing = wanted.filter((n) => !existsSync(CLIP(n)));
for (const n of missing) console.log(`skip  ${n} — no footage at public/dave/${n}.mp4`);
if (!ready.length) {
  console.log("nothing to render.");
  process.exit(0);
}

// act two's score — generated, not committed (public/promo/ is gitignored,
// same as every other baked track). The footage keeps its own audio; these
// wavs start on the cut.
ensureDaveAudio();

mkdirSync(outDir, { recursive: true });
console.log(`bundling…`);
const serveUrl = await bundle({ entryPoint: path.join(dir, "src", "index.ts") });

for (const name of ready) {
  const id = `Dave-${name}`;
  const composition = await selectComposition({ serveUrl, id });
  const outPath = path.join(outDir, `dave-${name}.mp4`);
  console.log(`render ${name} → ${path.relative(dir, outPath)}`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: outPath,
    // the AI clip's own audio is the soundtrack while Dave is on screen; from
    // the cut onward the baked act-two score takes over (dave-audio.mjs). No
    // music baked in, per the README: add a trending sound in-app
    onProgress: ({ progress }) => process.stdout.write(`\r  ${Math.round(progress * 100)}%`),
  });
  process.stdout.write("\n");
  // caption sits beside the MP4, same as every other lane — the daily workflow
  // is "upload the file, paste the txt", and it stays that way
  writeFileSync(path.join(outDir, `dave-${name}.txt`), buildDaveCaption(name), "utf8");
}

console.log(`\ndone → ${path.relative(dir, outDir)}`);
console.log(
  `\nWatch each one once with sound before posting. The dialogue in these clips\n` +
    `was generated, not recorded: the envelope proves WHEN Seedance speaks, which\n` +
    `is what the title cards are timed to, but only your ears can confirm it said\n` +
    `what the prompt asked for. That check is the price of the camera.`
);
