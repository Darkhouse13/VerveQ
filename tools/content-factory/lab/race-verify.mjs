// BALLON D'OR RACE delivery gate — lab/verify.mjs's checks, same thresholds,
// pointed at this reel. lab/verify.mjs itself is hard-wired to the three LAB
// slugs, src/lab/grid.json and out/<date>/lab/, and this lane may not edit
// it, so the checks are ported here verbatim:
//
//   1. container: 1080×1920, 30fps, one video + one audio stream (+ H.264/AAC)
//   2. duration matches src/lab/race/timeline.json (±0.2s)
//   3. no dead air: no silent stretch ≥ 6.0s (−45 dB)
//   4. frame 0 readable (mean luma sane) AND motion underway (f0 vs f15 differ
//      on ≥0.2% of pixels)
//   5. CF-SAFEZONE, ground-agnostic: the four chrome strips (top 220 / bottom
//      320 / sides 60, 8px antialias inset) ≥99.5% within ±28 luma of their
//      median — on every year's start+8 and midpoint, the final table, the
//      closer, and the densest moment
//   6. (race-only) the final table is a FREEZE: ≥2.0s with <0.2% of pixels
//      changing between its first and last frame
//   7. stills + race-sheet.png for the eyeball pass
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const T = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "race", "timeline.json"), "utf8"));
const FPS = T.fps;
const OUT = path.join(dir, "..", "out", "2026-09-23", "tests");
const STILLS = path.join(OUT, "race-stills");
const file = path.join(OUT, "race.mp4");

const scenes = [
  ...T.segs.map((s) => ({ key: `y${s.year}`, dur: s.dur })),
  { key: "final", dur: T.settle + T.freeze },
  { key: "closer", dur: T.closer },
];
const DENSEST = T.race + T.settle + 10; // full ten-row table + ranks + headline

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
const probe = (f) => JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", f]).toString());
const grayFrame = (f, frame) => {
  const tmp = path.join(OUT, `.race-f${frame}.raw`);
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(frame / FPS), "-i", f, "-frames:v", "1", "-pix_fmt", "gray", "-f", "rawvideo", tmp]);
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
const diffFrac = (a, b) => {
  let changed = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    if (d > 20 || d < -20) changed++;
  }
  return changed / a.length;
};

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
mkdirSync(STILLS, { recursive: true });

console.log("\n== race ==");
if (!existsSync(file)) {
  check(false, "file exists", file);
  process.exit(1);
}
const expectSec = T.total / FPS;
const meta = probe(file);
const v = meta.streams.find((s) => s.codec_type === "video");
const a = meta.streams.find((s) => s.codec_type === "audio");
const durSec = parseFloat(meta.format.duration);
check(v && v.width === 1080 && v.height === 1920, "video 1080×1920", `${v?.width}×${v?.height}`);
check(v && Math.abs(eval(v.avg_frame_rate) - FPS) < 0.01, `fps ${FPS}`, v?.avg_frame_rate);
check(v?.codec_name === "h264" && a?.codec_name === "aac", "codecs H.264 + AAC", `${v?.codec_name} + ${a?.codec_name}`);
check(Boolean(a), "audio stream present", a?.codec_name);
check(Math.abs(durSec - expectSec) < 0.2, `duration ${expectSec.toFixed(1)}s`, `${durSec.toFixed(2)}s`);
check(durSec >= 40 && durSec <= 50, "duration inside the 40–50s brief", `${durSec.toFixed(1)}s`);

const sil = ffErr(["-i", file, "-af", "silencedetect=noise=-45dB:d=6", "-f", "null", "-"]);
const stretches = [...sil.matchAll(/silence_duration: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
check(stretches.length === 0, "no silent stretch ≥ 6s", stretches.map((s) => `${s.toFixed(1)}s`).join(", "));

const f0 = grayFrame(file, 0);
const f15 = grayFrame(file, 15);
let sum = 0;
for (let i = 0; i < f0.length; i++) sum += f0[i];
const yavg = sum / f0.length;
check(yavg > 16 && yavg < 235, "frame 0 not black/blown", `YAVG ${yavg.toFixed(1)}`);
const frac = diffFrac(f0, f15);
check(frac >= 0.002, "motion underway at frame 0 (f0 vs f15)", `${(frac * 100).toFixed(2)}% px changed`);

const sample = [];
let acc = 0;
for (const s of scenes) {
  sample.push(acc + Math.min(8, s.dur - 1), acc + Math.floor(s.dur / 2));
  acc += s.dur;
}
sample.push(DENSEST);
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

const fa = T.race + T.settle;
const fb = T.closerFrom - 1;
const fz = diffFrac(grayFrame(file, fa), grayFrame(file, fb));
check((fb - fa + 1) / FPS >= 2 && fz < 0.002, "final table frozen ≥ 2.0s", `${((fb - fa + 1) / FPS).toFixed(1)}s, ${(fz * 100).toFixed(3)}% px changed f${fa}→f${fb}`);

// stills (~12) + contact sheet
const pick = [0, 15];
for (const y of [1958, 1968, 1980, 1993, 1995, 2011, 2020, 2022, 2025]) {
  const s = T.segs.find((x) => x.year === y);
  pick.push(s.from + Math.min(s.dur - 1, 14));
}
pick.push(T.race + T.settle + 45, T.closerFrom + 60);
for (const f of pick) ffErr(["-y", "-ss", String(f / FPS), "-i", file, "-frames:v", "1", path.join(STILLS, `race-f${String(f).padStart(4, "0")}.png`)]);
const every = 2;
const n = Math.ceil(expectSec / every);
const cols = 6;
const rows = Math.ceil(n / cols);
ffErr(["-y", "-i", file, "-vf", `fps=1/${every},scale=270:-1,tile=${cols}x${rows}:padding=6:margin=6:color=0x111111`, "-frames:v", "1", path.join(OUT, "race-sheet.png")]);

console.log(failures === 0 ? `\nALL CHECKS PASSED (stills → ${STILLS}, sheet → ${path.join(OUT, "race-sheet.png")})` : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
