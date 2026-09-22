// LAB lane delivery gate — asserted on rendered pixels and audio, never on
// intent. A reel that fails ANY check is not deliverable.
//
//   node lab/verify.mjs [YYYY-MM-DD] [slug…]
//
//   1. container: 1080×1920, 30fps, one video + one audio stream
//   2. duration matches src/lab/grid.json (±0.2s)
//   3. no dead air: no silent stretch ≥ 6.0s (−45 dB)
//   4. frame 0 readable (mean luma sane) AND motion already underway: frame 0
//      vs frame 15 (0.5s) differ on ≥0.2% of pixels — the hook law
//      (FACELESS_WINNER_SPEC #8): no intro card, the clock is draining.
//   5. CF-SAFEZONE, ground-agnostic: this lane runs cream, ink AND green
//      grounds, so instead of an absolute YMAX the four chrome strips
//      (top 220 / bottom 320 / sides 60, 8px antialias inset) must be
//      UNIFORM — ≥99.5% of a strip's pixels within ±28 luma of its median.
//      Subtle stripes/mowing bands sit inside that band; any glyph or UI
//      chrome does not. Checked on every scene-start+8 frame, each scene's
//      midpoint, and the reel's densest moment.
//   6. stills + a contact sheet per reel for the eyeball pass
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const GRID = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "grid.json"), "utf8"));
const GW = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "guesswho", "facts.json"), "utf8"));
const OL = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "older", "facts.json"), "utf8"));
const XI = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "xi", "facts.json"), "utf8"));
const FPS = GRID.fps;
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const OUT = path.join(dir, "..", "out", date, "lab");
const STILLS = path.join(OUT, "stills");

// scene tables derived from the grid — the same arithmetic the compositions use
const scenes = {
  "lab-guesswho": (() => {
    const G = GRID.guesswho;
    const n = GW.questions.length;
    const s = GW.questions.map((q, i) => ({ key: `q${i + 1}`, dur: i === n - 1 ? G.qLast : G.q }));
    s.push({ key: "closer", dur: G.closer });
    return s;
  })(),
  "lab-older": [...OL.rounds.map((r) => ({ key: `r${r.n}`, dur: GRID.older.round })), { key: "closer", dur: GRID.older.closer }],
  "lab-xi": [{ key: "names", dur: XI.xi.length * GRID.xi.name }, { key: "reveal", dur: GRID.xi.reveal }, { key: "closer", dur: GRID.xi.closer }],
};
// busiest frame per reel: Q5 mid-flip (board + stamp + flipping tiles), R10
// after the gap chip, XI with all plates + the club stamp
const DENSEST = {
  "lab-guesswho": 4 * GRID.guesswho.q + GRID.guesswho.flipStart + 8,
  "lab-older": 9 * GRID.older.round + GRID.older.gapAt + 16,
  "lab-xi": XI.xi.length * GRID.xi.name + 40,
};

let REELS = Object.keys(scenes);
const only = process.argv.slice(3);
if (only.length > 0) REELS = REELS.filter((s) => only.includes(s));

const STRIPS = [
  ["top", 0, 0, 1080, 212],
  ["bottom", 0, 1608, 1080, 312],
  ["left", 0, 0, 52, 1920],
  ["right", 1028, 0, 52, 1920],
];
const UNIFORM_MIN = 0.995;
const UNIFORM_BAND = 28;

const ffErr = (args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8" });
  return (r.stdout ?? "") + (r.stderr ?? "");
};
const probe = (file) => JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", file]).toString());
const grayFrame = (file, frame) => {
  const tmp = path.join(OUT, `.f${frame}.raw`);
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(frame / FPS), "-i", file, "-frames:v", "1", "-pix_fmt", "gray", "-f", "rawvideo", tmp]);
  const buf = readFileSync(tmp);
  rmSync(tmp);
  return buf;
};
const stripUniformity = (buf, x0, y0, w, h) => {
  const hist = new Uint32Array(256);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) hist[buf[y * 1080 + x]]++;
  const total = w * h;
  let acc = 0;
  let median = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total / 2) {
      median = v;
      break;
    }
  }
  let inside = 0;
  for (let v = Math.max(0, median - UNIFORM_BAND); v <= Math.min(255, median + UNIFORM_BAND); v++) inside += hist[v];
  return { frac: inside / total, median };
};

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
mkdirSync(STILLS, { recursive: true });

for (const slug of REELS) {
  const file = path.join(OUT, `${slug}.mp4`);
  console.log(`\n== ${slug} ==`);
  if (!existsSync(file)) {
    check(false, "file exists", file);
    continue;
  }
  const sc = scenes[slug];
  const total = sc.reduce((a, s) => a + s.dur, 0);
  const expectSec = total / FPS;

  const meta = probe(file);
  const v = meta.streams.find((s) => s.codec_type === "video");
  const a = meta.streams.find((s) => s.codec_type === "audio");
  const durSec = parseFloat(meta.format.duration);
  check(v && v.width === 1080 && v.height === 1920, "video 1080×1920", `${v?.width}×${v?.height}`);
  check(v && Math.abs(eval(v.avg_frame_rate) - FPS) < 0.01, `fps ${FPS}`, v?.avg_frame_rate);
  check(Boolean(a), "audio stream present", a?.codec_name);
  check(Math.abs(durSec - expectSec) < 0.2, `duration ${expectSec.toFixed(1)}s`, `${durSec.toFixed(2)}s`);

  const sil = ffErr(["-i", file, "-af", "silencedetect=noise=-45dB:d=6", "-f", "null", "-"]);
  const stretches = [...sil.matchAll(/silence_duration: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
  check(stretches.length === 0, "no silent stretch ≥ 6s", stretches.map((s) => `${s.toFixed(1)}s`).join(", "));

  // frame 0 + hook motion
  const f0 = grayFrame(file, 0);
  const f15 = grayFrame(file, 15);
  let sum = 0;
  let changed = 0;
  for (let i = 0; i < f0.length; i++) {
    sum += f0[i];
    const d = f0[i] - f15[i];
    if (d > 20 || d < -20) changed++;
  }
  const yavg = sum / f0.length;
  const frac = changed / f0.length;
  check(yavg > 16 && yavg < 235, "frame 0 not black/blown", `YAVG ${yavg.toFixed(1)}`);
  check(frac >= 0.002, "motion underway at frame 0 (f0 vs f15)", `${(frac * 100).toFixed(2)}% px changed`);

  // safe zone — uniform chrome strips
  const sample = [];
  let acc = 0;
  for (const s of sc) {
    sample.push(acc + 8, acc + Math.floor(s.dur / 2));
    acc += s.dur;
  }
  sample.push(DENSEST[slug]);
  let worst = { frac: 2, frame: -1, strip: "" };
  let safeOk = true;
  for (const f of [...new Set(sample)]) {
    const buf = grayFrame(file, f);
    for (const [name, x0, y0, w, h] of STRIPS) {
      const u = stripUniformity(buf, x0, y0, w, h);
      if (u.frac < UNIFORM_MIN) {
        safeOk = false;
        check(false, `safe zone @f${f} ${name} strip`, `${(u.frac * 100).toFixed(2)}% uniform (median ${u.median})`);
      }
      if (u.frac < worst.frac) worst = { frac: u.frac, frame: f, strip: name };
    }
  }
  check(safeOk, `safe zone clear on ${new Set(sample).size} frames × 4 strips`, `weakest ${(worst.frac * 100).toFixed(2)}% uniform (${worst.strip} @f${worst.frame})`);

  // stills + contact sheet
  ffErr(["-y", "-i", file, "-frames:v", "1", path.join(STILLS, `${slug}-f0.png`)]);
  acc = 0;
  for (const s of sc) {
    ffErr(["-y", "-ss", String((acc + Math.floor(s.dur * 0.7)) / FPS), "-i", file, "-frames:v", "1", path.join(STILLS, `${slug}-${s.key}.png`)]);
    acc += s.dur;
  }
  const every = 2;
  const n = Math.ceil(expectSec / every);
  const cols = 6;
  const rows = Math.ceil(n / cols);
  ffErr(["-y", "-i", file, "-vf", `fps=1/${every},scale=270:-1,tile=${cols}x${rows}:padding=6:margin=6:color=0x111111`, "-frames:v", "1", path.join(OUT, `${slug}-sheet.png`)]);
}

console.log(failures === 0 ? `\nALL CHECKS PASSED (stills → ${STILLS})` : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
