// "THE CHAIN" soundtrack — a perfect 330-frame loop, same law as
// promo/loop-audio.mjs: every pattern's period divides TOTAL, nothing rings
// across the seam, and the frame-0 kick masks the restart. 120 BPM (15f/beat,
// 22 beats). Four stamps rise in pitch; the fifth never arrives, because the
// fifth slot on screen is the comment box. Mirrors src/promo/chain/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, hat, clap, bass, pluck, impact, blip, tick } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 15;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/chain/timeline.ts
const TOTAL = 330;
const NAME_AT = [0, 45, 90, 135];
const FADE_FROM = 300;
const CARET_PERIOD = 15;

const mix = new Mixer("chain", TOTAL, FPS, 0); // NO tail — the wav ends exactly at the seam

// engine: 22 kicks, the first one masking the loop point
for (let f = 0; f < TOTAL; f += BEAT) mix.add(kick(), f, 0.8);
for (let f = 7; f < TOTAL - 6; f += BEAT) mix.add(hat(), f, 0.24);
for (let f = BEAT * 2; f < TOTAL - 12; f += BEAT * 4) mix.add(clap(), f, 0.34);

// bass ostinato, period 110f (3 cycles in 330): D2 A2 F2
const OST = [73.4, 110, 87.3];
for (let f = 0, i = 0; f < TOTAL - 14; f += 55, i++) mix.add(bass(OST[i % 3], 0.3), f, 0.62);

// the four links stamp in, each a step brighter than the last
const STAMP = [440, 523, 587, 698];
NAME_AT.forEach((f, i) => {
  mix.add(impact(), f, 0.62);
  mix.add(blip(STAMP[i], 0.13), f + 2, 0.5);
  mix.add(pluck(STAMP[i] * 2, 0.16), f + 5, 0.28);
});

// the open slot keeps ticking the whole time — the unanswered question
for (let f = 0; f < TOTAL - 4; f += CARET_PERIOD) mix.add(tick(), f, 0.2);

// clearing sweep as the names fade for the seam (dies well before TOTAL)
mix.add(blip(330, 0.1), FADE_FROM, 0.3);
mix.add(hat(true), FADE_FROM + 6, 0.3);

const master = mix.finalize(0.8, 1.05);

export const ensureChainAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "chain.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureChainAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "chain.wav present." : `Wrote chain.wav (${(TOTAL / FPS).toFixed(1)}s, seamless)`);
}
