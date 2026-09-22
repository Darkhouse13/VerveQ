// SPOT THE IMPOSTER — delivery gate. A faithful port of lab/verify.mjs (same
// six checks, same thresholds: container, duration vs grid, no ≥6s silence at
// −45 dB, frame-0 luma + f0↔f15 motion ≥0.2%, CF-SAFEZONE strip uniformity
// ≥99.5% within ±28 luma, stills + contact sheet). lab/verify.mjs hard-codes
// the three LAB reels and out/<date>/lab, and the isolation rule forbids
// editing it, so the scene table and paths are the only lines that differ.
//
//   node lab/imposter-verify.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const GRID = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "imposter", "grid.json"), "utf8"));
const IM = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "imposter", "facts.json"), "utf8"));
const FPS = GRID.fps;
const OUT = path.join(dir, "..", "out", "2026-09-23", "tests");
const STILLS = path.join(OUT, "imposter-stills");

const scenes = {
  imposter: IM.rounds.map((r) => ({ key: `r${r.n}`, dur: r.withheld ? GRID.withholdAt + GRID.withholdHold : GRID.round })),
};
// busiest frame: round 5 after the stamp (flipped card + stamp + verdict + ladder)
const DENSEST = { imposter: 4 * GRID.round + GRID.stampAt + 16 };
let REELS = Object.keys(scenes);

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
