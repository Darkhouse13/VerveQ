// CF-WEEKEND delivery gate — ffmpeg frame + silence + cue verification for
// the three reels. A reel that fails ANY check is not deliverable.
//
//   node weekend/verify-reels.mjs [YYYY-MM-DD]   # defaults to today's out dir
//
// Checks per reel:
//   1. container: 1080×1920, 30fps, one video + one audio stream
//   2. duration matches grid.json total (±0.2s)
//   3. every VO cue window is audibly non-silent (mean vol > −45 dB inside
//      [cue.at, cue.at + min(voDur, 1.5s)]) — the "N/N cues on frame" gate
//   4. no dead air: silencedetect(−45dB) must find no stretch ≥ 6.0s inside
//      the piece (a still CTA tail shorter than that is by design)
//   5. frame 0 is readable: mean luma of frame 0 within sane bounds
//      (not black, not blown out) — stills exported for the eyeball pass
//   7. CF-42H MOTION GATE (motion-gated reels only): the full runtime is
//      sampled at 0.75s intervals (gray, full-res) and EVERY consecutive
//      pair must differ — ≥0.2% of pixels changed by >20 luma. A static
//      stretch anywhere fails the build; digitally-rendered stills diff at
//      0.000%, so the threshold separates cleanly.
//   6. CF-SAFEZONE: no text/critical element in the platform-chrome strips
//      (top 220 / bottom 320 / sides 60 of 1080×1920). Asserted on RENDERED
//      pixels, not intent: each scene's settled midpoint frame + the reel's
//      densest frame are cropped to the four strips (8px inward tolerance
//      for glyph antialiasing) and each strip's YMAX must stay below 110 —
//      background stripes measure ≤~50, any glyph or UI chrome ≥~180. The
//      full-bleed CTA flash lives in the first ~6 frames of its scene and
//      midpoint sampling never lands there.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const GRID = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "grid.json"), "utf8"));
const VO = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "vo.json"), "utf8"));
const FPS = GRID.fps;
const date = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const OUT = path.join(dir, "..", "out", date);
const STILLS = path.join(OUT, "stills-reels");

const voDur = new Map(VO.lines.map((l) => [l.key, l.dur]));
let REELS = [
  ["wknd-settleit", "settleit"],
  ["wknd-referee", "referee"],
  ["wknd-squad", "squad"],
  ["wknd-42h", "boost"],
  ["wknd-dilemma-1", "dilemma1"],
  ["wknd-dilemma-2", "dilemma2"],
];
// optional slug filter after the date arg — render-42h.mjs verifies only its
// own reel so the one-command flow doesn't demand the other three MP4s
const only = process.argv.slice(3);
if (only.length > 0) REELS = REELS.filter(([slug]) => only.includes(slug));

// the busiest frame per reel — most elements on screen at once (chat fully
// escalated / row 6 landed / tradeoff card wall + footer / all six fixture
// cards + stamp). Also exported as the "dense" before/after still.
// dilemma: mid-sideB, both option cards up and every row of the read side
// landed — the most elements this format ever holds at once.
const DENSEST = { settleit: 1540, referee: 1330, squad: 1500, boost: 250, dilemma1: 300, dilemma2: 300 };

// reels built under the DOPAMINE LAW — the motion gate applies
// Paid, cold-traffic pieces only. wknd-42h is built on the DOPAMINE LAW and a
// static stretch there is a real defect.
//
// the-dilemma was gated here at first and it was a mistake worth recording: it
// is a READ-AND-DECIDE format — two option cards a viewer has to actually read
// before the 3-2-1 — so its held frames are the point, exactly like the still
// CTA tails that keep the three organic reels ungated. Holding it to 0.2% per
// 0.75s did not make the reel better; it made the time bar refill every second
// so the gate had something to measure, which put a meter on screen that
// reported nothing. Gate removed, bar made truthful. If a future format wants
// this gate, it should be because motion is the thesis, not to pass a check.
const MOTION_GATED = new Set(["wknd-42h"]);
const MOTION_STEP_S = 0.75;
const MOTION_MIN_FRAC = 0.002; // ≥0.2% of pixels changed by >20 luma
const MOTION_MIN_DELTA = 20;

// chrome strips with 8px inward antialias tolerance; SAFE = 220/320/60
const STRIPS = [
  ["top", "1080:212:0:0"],
  ["bottom", "1080:312:0:1608"],
  ["left", "52:1920:0:0"],
  ["right", "52:1920:1028:0"],
];
const SAFE_YMAX = 110;

// ffmpeg writes filter reports (volumedetect, silencedetect, signalstats) to
// STDERR even on success — spawnSync so both streams are always captured.
const ffErr = (args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8" });
  return (r.stdout ?? "") + (r.stderr ?? "");
};
const probe = (file) =>
  JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", file]).toString());

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗ FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

mkdirSync(STILLS, { recursive: true });

for (const [slug, gridKey] of REELS) {
  const file = path.join(OUT, `${slug}.mp4`);
  console.log(`\n== ${slug} ==`);
  if (!existsSync(file)) {
    check(false, "file exists", file);
    continue;
  }
  const g = GRID[gridKey];
  const total = g.scenes.reduce((a, s) => a + s.dur, 0);
  const expectSec = total / FPS;

  // 1–2: container + duration
  const meta = probe(file);
  const v = meta.streams.find((s) => s.codec_type === "video");
  const a = meta.streams.find((s) => s.codec_type === "audio");
  const durSec = parseFloat(meta.format.duration);
  check(v && v.width === 1080 && v.height === 1920, "video 1080×1920", `${v?.width}×${v?.height}`);
  check(v && Math.abs(eval(v.avg_frame_rate) - FPS) < 0.01, `fps ${FPS}`, v?.avg_frame_rate);
  check(Boolean(a), "audio stream present", a?.codec_name);
  check(Math.abs(durSec - expectSec) < 0.2, `duration ${expectSec.toFixed(1)}s`, `${durSec.toFixed(2)}s`);

  // 3: every VO cue window audibly non-silent
  let cueOk = 0;
  for (const cue of g.cues) {
    const dur = Math.min(voDur.get(cue.key) ?? 1.0, 1.5);
    const from = cue.at / FPS;
    const out = ffErr(["-ss", String(from), "-t", String(dur), "-i", file, "-map", "0:a", "-af", "volumedetect", "-f", "null", "-"]);
    const m = out.match(/mean_volume: ([-\d.]+) dB/);
    const vol = m ? parseFloat(m[1]) : -Infinity;
    const ok = vol > -45;
    if (ok) cueOk++;
    else check(false, `cue ${cue.key} audible @f${cue.at}`, `${vol} dB`);
  }
  check(cueOk === g.cues.length, `VO cues on frame: ${cueOk}/${g.cues.length}`);

  // 4: no dead air ≥ 6s
  const sil = ffErr(["-i", file, "-af", "silencedetect=noise=-45dB:d=6", "-f", "null", "-"]);
  const stretches = [...sil.matchAll(/silence_duration: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
  check(stretches.length === 0, "no silent stretch ≥ 6s", stretches.map((s) => `${s.toFixed(1)}s`).join(", "));

  // 6: CF-SAFEZONE — chrome strips must hold no text/critical element
  const sampleFrames = [];
  let sceneAcc = 0;
  for (const s of g.scenes) {
    sampleFrames.push(sceneAcc + Math.floor(s.dur / 2));
    sceneAcc += s.dur;
  }
  sampleFrames.push(DENSEST[gridKey]);
  let worst = { y: -1, frame: -1, strip: "" };
  let safeOk = true;
  for (const f of sampleFrames) {
    for (const [stripName, cropSpec] of STRIPS) {
      const out = ffErr(["-ss", String(f / FPS), "-i", file, "-frames:v", "1", "-vf", `crop=${cropSpec},signalstats,metadata=print`, "-f", "null", "-"]);
      const ymax = parseFloat(out.match(/YMAX[:=]([\d.]+)/)?.[1] ?? "NaN");
      if (!(ymax <= SAFE_YMAX)) {
        safeOk = false;
        check(false, `safe zone @f${f} ${stripName} strip`, `YMAX ${ymax}`);
      }
      if (ymax > worst.y) worst = { y: ymax, frame: f, strip: stripName };
    }
  }
  check(safeOk, `safe zone clear on ${sampleFrames.length} frames × 4 strips`, `worst YMAX ${worst.y} (${worst.strip} @f${worst.frame})`);

  // 7: motion gate — no dead frames, asserted on rendered pixels
  if (MOTION_GATED.has(slug)) {
    const raw = path.join(OUT, `${slug}-motion.raw`);
    execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", file, "-vf", `fps=${(1 / MOTION_STEP_S).toFixed(6)}`, "-pix_fmt", "gray", "-f", "rawvideo", raw]);
    const buf = readFileSync(raw);
    const FR = 1080 * 1920;
    const n = Math.floor(buf.length / FR);
    let worst = { frac: Infinity, i: -1 };
    let motionOk = true;
    for (let i = 1; i < n; i++) {
      let changed = 0;
      const a = (i - 1) * FR;
      const b = i * FR;
      for (let px = 0; px < FR; px++) {
        const d = buf[a + px] - buf[b + px];
        if (d > MOTION_MIN_DELTA || d < -MOTION_MIN_DELTA) changed++;
      }
      const frac = changed / FR;
      if (frac < worst.frac) worst = { frac, i };
      if (frac < MOTION_MIN_FRAC) {
        motionOk = false;
        check(false, `motion @${((i - 1) * MOTION_STEP_S).toFixed(2)}–${(i * MOTION_STEP_S).toFixed(2)}s`, `${(frac * 100).toFixed(3)}% px changed`);
      }
    }
    rmSync(raw);
    check(motionOk && n > 2, `motion: ${n - 1} consecutive ${MOTION_STEP_S}s samples all differ`, `weakest pair ${(worst.frac * 100).toFixed(2)}% px @${((worst.i - 1) * MOTION_STEP_S).toFixed(2)}s`);
  }

  // 5: frame 0 readable + stills for the eyeball pass
  const f0 = path.join(STILLS, `${slug}-f0.png`);
  ffErr(["-y", "-i", file, "-frames:v", "1", f0]);
  const luma = ffErr(["-i", file, "-vf", "select=eq(n\\,0),signalstats,metadata=print", "-frames:v", "1", "-f", "null", "-"]);
  const yavg = parseFloat(luma.match(/YAVG[:=]([\d.]+)/)?.[1] ?? "NaN");
  check(yavg > 16 && yavg < 235, "frame 0 not black/blown", `YAVG ${yavg}`);
  // scene-start stills
  let acc = 0;
  for (const s of g.scenes) {
    ffErr(["-y", "-ss", String((acc + 8) / FPS), "-i", file, "-frames:v", "1", path.join(STILLS, `${slug}-${s.key}.png`)]);
    acc += s.dur;
  }
}

console.log(failures === 0 ? `\nALL CHECKS PASSED (stills → ${STILLS})` : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
