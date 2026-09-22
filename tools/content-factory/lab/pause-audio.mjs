// PAUSE IT — sound bed. Synthesized like lab/audio.mjs (same audio-lib, Mixer
// name = seed), but built as a LOOP: 120 BPM, so the 10.0s reel is exactly 5
// bars, and every tail that rings past the last sample is folded back onto the
// head — the bed wraps with no click, no gap, no cut-off decay at the seam.
// A dry tick lands on every card cut (every 4 frames) — the same tick for
// every card, so the sound never favours a name either.
//
//   node lab/pause-audio.mjs [--force]   → public/promo/lab-pause.wav
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, SR, bass, clap, encodeWav, hat, kick, tick } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const FACTS = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "pause", "facts.json"), "utf8"));
const OUT = path.join(dir, "..", "public", "promo");
const NAME = "lab-pause";
const FPS = 30;

export const ensurePauseAudio = (force = false) => {
  const out = path.join(OUT, `${NAME}.wav`);
  if (!force && existsSync(out)) return out;
  const FPC = FACTS.framesPerCard;
  const TOTAL = FACTS.order.length * FPC; // 300
  const BEAT = 15; // 120 BPM @30fps
  if (TOTAL % (BEAT * 4) !== 0) throw new Error(`pause-audio: ${TOTAL}f is not a whole number of 4/4 bars at 120 BPM`);
  const mix = new Mixer(NAME, TOTAL, FPS, 1.2);

  // drums: four-on-the-floor, claps on 2 & 4, 8th hats with an open off-beat
  for (let f = 0; f < TOTAL; f += BEAT) {
    const beatInBar = (f / BEAT) % 4;
    mix.add(kick(), f, beatInBar === 0 ? 0.85 : 0.7);
    if (beatInBar === 1 || beatInBar === 3) mix.add(clap(), f, 0.42);
    mix.add(hat(false), f, 0.2);
    mix.add(hat(true), f + BEAT / 2, 0.16);
  }
  // driving bass: A minor, one root per beat with an octave push on the "and"
  const ROOTS = [55, 55, 43.65, 49]; // A1 A1 F1 G1 — one per bar, cycling
  for (let f = 0; f < TOTAL; f += BEAT) {
    const bar = Math.floor(f / (BEAT * 4));
    const r = ROOTS[bar % ROOTS.length];
    mix.add(bass(r, 0.34), f, 0.55);
    mix.add(bass(r * 2, 0.18), f + BEAT / 2, 0.32);
  }
  // the card tick — identical for every card
  for (let f = 0; f < TOTAL; f += FPC) mix.add(tick(), f, 0.34);

  // fold the ring-out tail back onto the head so the loop is seamless
  const L = Math.round((TOTAL / FPS) * SR);
  for (let j = L; j < mix.buf.length; j++) mix.buf[j - L] += mix.buf[j];
  mix.buf = mix.buf.slice(0, L);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(out, encodeWav(mix.finalize(0.85, 1.15)));
  console.log(`  → ${out}`);
  return out;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) ensurePauseAudio(process.argv.includes("--force"));
