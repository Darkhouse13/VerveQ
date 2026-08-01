// "LOOP" soundtrack — a perfect 360-frame musical loop obeying the same law
// as the visuals: every pattern's period divides 360, nothing rings across
// the seam (last tails die by ~frame 353), and the frame-0 kick masks the
// restart. 120 BPM (15 frames per beat), A-minor ostinato, a blip per orbit
// step whose 6-pitch cycle closes on itself. NO riser, NO crash, NO ding —
// all of those have tails or one-shot semantics that would break the seam.
// Mirrors src/promo/loop/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, bass, pluck, hat, clap, blip, tick } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 15; // 120 BPM
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/loop/timeline.ts
const TOTAL = 360;
const STEP = 60;
const TYPING_FROM = 42, TYPING_TO = 58;

const mix = new Mixer("loop", TOTAL, FPS, 0); // NO tail buffer — the wav ends at the seam

// the engine: kick every beat (24 kicks, first at 0 = the seam masker)
for (let f = 0; f < TOTAL; f += BEAT) mix.add(kick(), f, 0.85);
for (let f = 7; f < TOTAL - 8; f += BEAT) mix.add(hat(), f, 0.28);
for (let f = BEAT; f < TOTAL - 10; f += BEAT * 2) mix.add(clap(), f, 0.4);

// A-minor ostinato, period 120f (3 cycles per loop): A1 C2 E2 C2
const OSTINATO = [55, 65.4, 82.4, 65.4];
for (let f = 0, i = 0; f < TOTAL - 12; f += 30, i++) mix.add(bass(OSTINATO[i % 4], 0.26), f, 0.7);

// gentle top line, period 60f (matches the orbit): A3 C4 E4 C4
const ARP = [220, 262, 330, 262];
for (let f = 0, i = 0; f < TOTAL - 8; f += BEAT, i++) mix.add(pluck(ARP[i % 4], 0.18), f, 0.22);

// one blip per orbit step — the 6-pitch cycle returns home at the seam
const STEP_PITCH = [440, 494, 523, 587, 523, 494];
for (let s = 0; s < 6; s++) mix.add(blip(STEP_PITCH[s], 0.1), s * STEP, 0.55);

// typing ticks late in every step (identical each step = loop-safe)
for (let s = 0; s < 6; s++) {
  for (let f = TYPING_FROM; f <= TYPING_TO - 2; f += 4) mix.add(tick(), s * STEP + f, 0.26);
}

const master = mix.finalize(0.8, 1.05);

export const ensureLoopAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "loop.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureLoopAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "loop.wav present." : `Wrote loop.wav (${(TOTAL / FPS).toFixed(1)}s, seamless)`);
}
