// "THE WALL" soundtrack. Mirrors src/promo/wall/timeline.ts. A ten-second
// quiz-show clock over a static puzzle: one tick per second, doubling in the
// last three, then two dings for the two answered cells and a hard verdict
// stinger. No melody — the clock IS the arrangement, because the viewer is
// reading, not listening.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, hat, tick, ding, impact, stinger, riser, whoosh } from "./audio-lib.mjs";

const FPS = 30;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/wall/timeline.ts
const TOTAL = 390;
const CLOCK_FRAMES = 300;
const REVEAL_AT = [300, 318];
const VERDICT_AT = 336;

const mix = new Mixer(TOTAL, FPS);

// the clock: one tick a second, then double-time for the last three
for (let f = 0; f < CLOCK_FRAMES; f += 30) {
  const secsLeft = (CLOCK_FRAMES - f) / 30;
  mix.add(tick(), f, secsLeft <= 3 ? 0.62 : 0.42);
  if (secsLeft <= 3) mix.add(tick(), f + 15, 0.5);
}

// a low pulse so the static frames still have a floor
for (let f = 0; f < CLOCK_FRAMES; f += 60) mix.add(kick(), f, 0.45);
for (let f = 30; f < CLOCK_FRAMES; f += 60) mix.add(hat(), f, 0.18);

// tension into the buzzer
mix.add(riser(1.6), CLOCK_FRAMES - 48, 0.42);

// the two answered cells
REVEAL_AT.forEach((f, i) => {
  mix.add(ding(), f, 0.55);
  mix.add(impact(), f, 0.42);
  if (i === 1) mix.add(hat(true), f + 8, 0.24);
});

// the verdict
mix.add(impact(), VERDICT_AT, 0.95);
mix.add(stinger(174, 1.5), VERDICT_AT, 0.5);
mix.add(whoosh(0.5), VERDICT_AT + 16, 0.3);

const master = mix.finalize(0.82, 1.06);

export const ensureWallAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "wall.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureWallAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "wall.wav present." : `Wrote wall.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
