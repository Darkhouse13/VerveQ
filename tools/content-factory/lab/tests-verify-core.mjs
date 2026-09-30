// Delivery gate core for the 2026-09-25 concept tests — a faithful port of
// lab/verify.mjs (read-only; it hard-codes its three reels): same checks, same
// thresholds.
//
//   1. container: 1080×1920, the grid's fps, H.264 video + AAC audio
//   2. duration matches the scene table (±0.2s)
//   3. no dead air: no silent stretch ≥ 6.0s (−45 dB)
//   4. frame 0 readable AND motion already underway (f0 vs f15 ≥ 0.2% px)
//   5. CF-SAFEZONE, ground-agnostic: the four chrome strips (top 220 /
//      bottom 320 / sides 60, 8px antialias inset) ≥ 99.5% within ±28 luma of
//      their median on every scene-start+8, scene midpoint and densest frame
//   6. stills (f0 + one per scene) + a contact sheet
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";

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

export const verifyReel = ({ out, slug, fps, scenes, densest = [] }) => {
  const file = path.join(out, `${slug}.mp4`);
  const STILLS = path.join(out, "stills");
  mkdirSync(STILLS, { recursive: true });
  let failures = 0;
  const check = (ok, label, detail = "") => {
    console.log(`  ${ok ? "✓" : "✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
  };
  const grayFrame = (frame) => {
    const tmp = path.join(out, `.f${frame}.raw`);
    execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(frame / fps), "-i", file, "-frames:v", "1", "-pix_fmt", "gray", "-f", "rawvideo", tmp]);
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

  console.log(`\n== ${slug} ==`);
  if (!existsSync(file)) {
    check(false, "file exists", file);
    return 1;
  }
  const total = scenes.reduce((a, s) => a + s.dur, 0);
  const expectSec = total / fps;
  const meta = probe(file);
  const v = meta.streams.find((s) => s.codec_type === "video");
  const a = meta.streams.find((s) => s.codec_type === "audio");
  const durSec = parseFloat(meta.format.duration);
  check(v && v.width === 1080 && v.height === 1920, "video 1080×1920", `${v?.width}×${v?.height}`);
  check(v && v.codec_name === "h264", "video H.264", v?.codec_name);
  check(v && Math.abs(eval(v.avg_frame_rate) - fps) < 0.01, `fps ${fps}`, v?.avg_frame_rate);
  check(Boolean(a) && a.codec_name === "aac", "AAC audio stream present", a?.codec_name);
  check(Math.abs(durSec - expectSec) < 0.2, `duration ${expectSec.toFixed(1)}s`, `${durSec.toFixed(2)}s`);

  const sil = ffErr(["-i", file, "-af", "silencedetect=noise=-45dB:d=6", "-f", "null", "-"]);
  const stretches = [...sil.matchAll(/silence_duration: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
  check(stretches.length === 0, "no silent stretch ≥ 6s", stretches.map((s) => `${s.toFixed(1)}s`).join(", "));

  const f0 = grayFrame(0);
  const f15 = grayFrame(15);
  let sum = 0;
  let changed = 0;
  for (let i = 0; i < f0.length; i++) {
    sum += f0[i];
    const d = f0[i] - f15[i];
    if (d > 20 || d < -20) changed++;
  }
  const yavg = sum / f0.length;
  check(yavg > 16 && yavg < 235, "frame 0 not black/blown", `YAVG ${yavg.toFixed(1)}`);
  check(changed / f0.length >= 0.002, "motion underway at frame 0 (f0 vs f15)", `${((changed / f0.length) * 100).toFixed(2)}% px changed`);

  const sample = [];
  let acc = 0;
  for (const s of scenes) {
    sample.push(acc + 8, acc + Math.floor(s.dur / 2));
    acc += s.dur;
  }
  sample.push(...densest, total - 2);
  let worst = { frac: 2, frame: -1, strip: "" };
  let safeOk = true;
  const frames = [...new Set(sample)].filter((f) => f >= 0 && f < total);
  for (const f of frames) {
    const buf = grayFrame(f);
    for (const [name, x0, y0, w, h] of STRIPS) {
      const u = stripUniformity(buf, x0, y0, w, h);
      if (u.frac < UNIFORM_MIN) {
        safeOk = false;
        check(false, `safe zone @f${f} ${name} strip`, `${(u.frac * 100).toFixed(2)}% uniform (median ${u.median})`);
      }
      if (u.frac < worst.frac) worst = { frac: u.frac, frame: f, strip: name };
    }
  }
  check(safeOk, `safe zone clear on ${frames.length} frames × 4 strips`, `weakest ${(worst.frac * 100).toFixed(2)}% uniform (${worst.strip} @f${worst.frame})`);

  ffErr(["-y", "-i", file, "-frames:v", "1", path.join(STILLS, `${slug}-f0.png`)]);
  acc = 0;
  for (const s of scenes) {
    ffErr(["-y", "-ss", String((acc + Math.floor(s.dur * 0.7)) / fps), "-i", file, "-frames:v", "1", path.join(STILLS, `${slug}-${s.key}.png`)]);
    acc += s.dur;
  }
  const every = expectSec > 20 ? 2 : 1;
  const n = Math.ceil(expectSec / every);
  const cols = 6;
  const rows = Math.ceil(n / cols);
  ffErr(["-y", "-i", file, "-vf", `fps=1/${every},scale=270:-1,tile=${cols}x${rows}:padding=6:margin=6:color=0x111111`, "-frames:v", "1", path.join(out, `${slug}-sheet.png`)]);
  console.log(failures === 0 ? `\nALL CHECKS PASSED (stills → ${STILLS})` : `\n${failures} CHECK(S) FAILED`);
  return failures;
};
