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
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
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
const REELS = [
  ["wknd-settleit", "settleit"],
  ["wknd-referee", "referee"],
  ["wknd-squad", "squad"],
];

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
