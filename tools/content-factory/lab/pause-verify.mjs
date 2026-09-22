// PAUSE IT — delivery gate. A faithful port of lab/verify.mjs's checks (that
// gate's scene tables are hard-wired to the three lab-* reels and to
// out/<date>/lab/, and this lane may not edit it), plus the loop laws this
// format adds.
//
//   node lab/pause-verify.mjs [YYYY-MM-DD]      (default 2026-09-23)
//
// From lab/verify.mjs, unchanged thresholds:
//   1. container 1080×1920, 30fps, video + audio stream
//   2. duration = facts (order × framesPerCard) ±0.2s
//   3. no silent stretch ≥ 6.0s (−45 dB)
//   4. frame 0 not black/blown AND f0 vs f15 differ on ≥0.2% px
//   5. CF-SAFEZONE ground-agnostic strips (top 212 / bottom 312 / sides 52,
//      ≥99.5% within ±28 luma of median) — here on EVERY card slot (75
//      frames), since each slot is a different card
// Added for the loop:
//   6. fairness — every card holds the same number of frames
//   7. codecs h264 + aac
//   8. visual seam: f299→f0 is no bigger a jump than a normal card cut, and
//      the chrome (title/top block) is continuous across it
//   9. audio seam: no click at the wrap, no lead pad, audio = video length
//  10. stills (f0, f1, last, a mid card) + a 5×5 contact sheet → pause-sheet.png
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const FACTS = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "pause", "facts.json"), "utf8"));
const FPS = 30;
const date = process.argv[2] ?? "2026-09-23";
const OUT = path.join(dir, "..", "out", date, "tests");
const STILLS = path.join(OUT, "pause-stills");
const file = path.join(OUT, "pause.mp4");
const FPC = FACTS.framesPerCard;
const TOTAL = FACTS.order.length * FPC;

const STRIPS = [
  ["top", 0, 0, 1080, 212],
  ["bottom", 0, 1608, 1080, 312],
  ["left", 0, 0, 52, 1920],
  ["right", 1028, 0, 52, 1920],
];
const UNIFORM_MIN = 0.995;
const UNIFORM_BAND = 28;

const ffErr = (args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return (r.stdout ?? "") + (r.stderr ?? "");
};
const probe = (f) => JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", f]).toString());
// decode ALL frames once (gray) — exact frame indices, no seek fuzz
const decodeAll = () => {
  const raw = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-pix_fmt", "gray", "-f", "rawvideo", "-"], { maxBuffer: 1080 * 1920 * 400 });
  const n = raw.length / (1080 * 1920);
  return Array.from({ length: n }, (_, i) => raw.subarray(i * 1080 * 1920, (i + 1) * 1080 * 1920));
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
const diffFrac = (a, b, y0 = 0, y1 = 1920) => {
  let changed = 0;
  for (let i = y0 * 1080; i < y1 * 1080; i++) {
    const d = a[i] - b[i];
    if (d > 20 || d < -20) changed++;
  }
  return changed / ((y1 - y0) * 1080);
};

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
mkdirSync(STILLS, { recursive: true });
console.log(`\n== pause (${file}) ==`);
if (!existsSync(file)) {
  check(false, "file exists", file);
  process.exit(1);
}

// 1, 2, 7
const meta = probe(file);
const v = meta.streams.find((s) => s.codec_type === "video");
const a = meta.streams.find((s) => s.codec_type === "audio");
const durSec = parseFloat(meta.format.duration);
check(v && v.width === 1080 && v.height === 1920, "video 1080×1920", `${v?.width}×${v?.height}`);
check(v && Math.abs(eval(v.avg_frame_rate) - FPS) < 0.01, `fps ${FPS}`, v?.avg_frame_rate);
check(Boolean(a), "audio stream present", a?.codec_name);
check(v?.codec_name === "h264" && a?.codec_name === "aac", "codecs h264 + aac", `${v?.codec_name} + ${a?.codec_name}`);
check(Math.abs(durSec - TOTAL / FPS) < 0.2, `duration ${(TOTAL / FPS).toFixed(1)}s`, `${durSec.toFixed(2)}s`);

// 3
const sil = ffErr(["-i", file, "-af", "silencedetect=noise=-45dB:d=6", "-f", "null", "-"]);
const stretches = [...sil.matchAll(/silence_duration: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
check(stretches.length === 0, "no silent stretch ≥ 6s", stretches.map((s) => `${s.toFixed(1)}s`).join(", "));

// 6
const counts = {};
FACTS.order.forEach((k) => (counts[k] = (counts[k] ?? 0) + FPC));
const vals = Object.values(counts);
check(Object.keys(counts).length === FACTS.cards.length && Math.min(...vals) === Math.max(...vals), "fairness: every card holds the same frames", `${FACTS.cards.length} cards × ${vals[0]}f`);

const frames = decodeAll();
check(frames.length === TOTAL, `decoded frame count ${TOTAL}`, String(frames.length));

// 4
const f0 = frames[0];
let sum = 0;
for (let i = 0; i < f0.length; i++) sum += f0[i];
const yavg = sum / f0.length;
check(yavg > 16 && yavg < 235, "frame 0 not black/blown", `YAVG ${yavg.toFixed(1)}`);
const m15 = diffFrac(f0, frames[15]);
check(m15 >= 0.002, "motion underway at frame 0 (f0 vs f15)", `${(m15 * 100).toFixed(2)}% px changed`);

// 5 — every card slot (first frame of the slot = the 6px drop, the widest excursion)
let worst = { frac: 2, frame: -1, strip: "" };
let safeOk = true;
for (let f = 0; f < TOTAL; f += FPC) {
  for (const [name, x0, y0, w, h] of STRIPS) {
    const u = stripUniformity(frames[f], x0, y0, w, h);
    if (u.frac < UNIFORM_MIN) {
      safeOk = false;
      check(false, `safe zone @f${f} ${name} strip`, `${(u.frac * 100).toFixed(2)}% uniform (median ${u.median})`);
    }
    if (u.frac < worst.frac) worst = { frac: u.frac, frame: f, strip: name };
  }
}
check(safeOk, `safe zone clear on ${TOTAL / FPC} frames × 4 strips`, `weakest ${(worst.frac * 100).toFixed(2)}% uniform (${worst.strip} @f${worst.frame})`);

// 8 — visual seam
const cuts = [];
for (let f = FPC; f < TOTAL; f += FPC) cuts.push(diffFrac(frames[f - 1], frames[f]));
cuts.sort((x, y) => x - y);
const seam = diffFrac(frames[TOTAL - 1], frames[0]);
const maxCut = cuts[cuts.length - 1];
check(seam <= maxCut * 1.05, "loop seam f299→f0 no bigger than a normal cut", `seam ${(seam * 100).toFixed(2)}% vs cuts median ${(cuts[cuts.length >> 1] * 100).toFixed(2)}% / max ${(maxCut * 100).toFixed(2)}%`);
// chrome continuity: title block (y 340–740) across the seam vs across an in-reel cut
const chromeSeam = diffFrac(frames[TOTAL - 1], frames[0], 340, 740);
const chromeCut = diffFrac(frames[FPC - 1], frames[FPC], 340, 740);
check(chromeSeam <= Math.max(0.01, chromeCut * 1.5), "title block continuous across the seam", `seam ${(chromeSeam * 100).toFixed(3)}% vs in-reel cut ${(chromeCut * 100).toFixed(3)}%`);

// 9 — audio seam: decode to mono f32, compare the step at the wrap with the
// typical sample-to-sample step, and the RMS of the last vs first 40ms
const pcm = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-ac", "1", "-ar", "44100", "-f", "f32le", "-"], { maxBuffer: 64 * 1024 * 1024 });
const s = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
let stepSum = 0;
for (let i = 1; i < s.length; i++) stepSum += Math.abs(s[i] - s[i - 1]);
const meanStep = stepSum / (s.length - 1);
const wrapStep = Math.abs(s[0] - s[s.length - 1]);
const rms = (from, to) => {
  let acc = 0;
  for (let i = from; i < to; i++) acc += s[i] * s[i];
  return Math.sqrt(acc / (to - from));
};
let lead = 0;
while (lead < s.length && Math.abs(s[lead]) < 1e-4) lead++;
const W = Math.round(0.2 * 44100);
// the wrap lands on a kick (bar 1 downbeat), so its step is an attack, not a
// click — judge it against the other downbeats (every 60f) in the same encode
const maxStepAround = (buf) => {
  let m = 0;
  for (let i = 1; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - buf[i - 1]));
  return m;
};
const HW = 64;
const wrapWin = new Float32Array([...s.subarray(s.length - HW - (s.length - Math.round((TOTAL / FPS) * 44100)), s.length - (s.length - Math.round((TOTAL / FPS) * 44100))), ...s.subarray(0, HW)]);
const downbeats = [];
for (let f = 60; f < TOTAL; f += 60) {
  const c = Math.round((f / FPS) * 44100);
  downbeats.push(maxStepAround(s.subarray(c - HW, c + HW)));
}
const wrapMax = maxStepAround(wrapWin);
const dbMax = Math.max(...downbeats);
check(wrapMax <= dbMax * 1.25, "audio wraps like any other downbeat (no click)", `wrap max step ${wrapMax.toFixed(3)} vs in-reel downbeats ≤ ${dbMax.toFixed(3)} (mean step ${meanStep.toFixed(4)}, raw end→start ${wrapStep.toFixed(3)})`);
check(lead <= 441, "audio starts on the downbeat (≤10ms lead pad)", `${((lead / 44100) * 1000).toFixed(1)}ms`);
check(Math.abs(s.length / 44100 - TOTAL / FPS) < 1 / FPS, "audio length = video length (±1 frame)", `${(s.length / 44100).toFixed(3)}s`);
check(rms(s.length - W, s.length) > 0.01 && rms(0, W) > 0.01, "bed alive either side of the seam (200ms rms)", `tail ${rms(s.length - W, s.length).toFixed(3)} / head ${rms(0, W).toFixed(3)}`);

// 10 — stills + sheet
const still = (f, name) => ffErr(["-y", "-i", file, "-vf", `select=eq(n\\,${f})`, "-frames:v", "1", "-vsync", "0", path.join(STILLS, name)]);
still(0, "pause-f0.png");
still(1, "pause-f1.png");
still(TOTAL - 1, `pause-f${TOTAL - 1}.png`);
still(Math.floor(TOTAL / 2), `pause-f${Math.floor(TOTAL / 2)}.png`);
// 25 tiles: the middle frame of every slot in pass 1 (each card once)
const perPass = FACTS.cards.length;
ffErr(["-y", "-i", file, "-vf", `select='lt(n\\,${perPass * FPC})*eq(mod(n\\,${FPC})\\,2)',scale=270:-1,tile=5x5:padding=6:margin=6:color=0x111111`, "-frames:v", "1", "-vsync", "0", path.join(OUT, "pause-sheet.png")]);

console.log(failures === 0 ? `\nALL CHECKS PASSED (stills → ${STILLS}, sheet → ${path.join(OUT, "pause-sheet.png")})` : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
