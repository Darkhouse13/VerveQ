// "PICK A SIDE" soundtrack — a perfect 450-frame loop, same law as
// promo/chain-audio.mjs: every pattern's period divides TOTAL, nothing rings
// across the seam, and the frame-0 kick masks the restart. 120 BPM (15f/beat,
// 30 beats). Mirrors src/promo/pickaside/timeline.ts — re-time one, re-time both.
//
// The arrangement carries the argument: a flat two-note ostinato while the
// ballot sits there, an impact on the turn, a bright major stinger on the
// verdict (the only place the picture goes green), then the floor drops out
// under the product act so the real recording is heard, not scored over.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, hat, clap, bass, pluck, impact, blip, tick, riser, stinger } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 15;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/pickaside/timeline.ts
const TOTAL = 450;
const TURN_AT = 90;
const VERDICT_AT = 180;
const SIDE_AT = 270;
const PROD_AT = 345;
const FADE_FROM = 425;
const CARET_PERIOD = 15;

const mix = new Mixer("pick-a-side", TOTAL, FPS, 0); // NO tail — the wav ends exactly at the seam

// engine — thins out under the product act so the recording sits in the clear
for (let f = 0; f < TOTAL; f += BEAT) mix.add(kick(), f, f < PROD_AT ? 0.8 : 0.42);
for (let f = 7; f < PROD_AT - 6; f += BEAT) mix.add(hat(), f, 0.24);
for (let f = BEAT * 2; f < PROD_AT - 12; f += BEAT * 4) mix.add(clap(), f, 0.34);

// bass ostinato, period 90f (5 cycles in 450) — deliberately unresolved, two
// notes rocking back and forth: the sound of an argument going nowhere
const OST = [73.4, 98];
for (let f = 0, i = 0; f < PROD_AT - 14; f += 45, i++) mix.add(bass(OST[i % 2], 0.3), f, 0.62);

// the turn — the question changes shape
mix.add(impact(), TURN_AT, 0.55);
mix.add(riser(0.9), TURN_AT + 4, 0.3);

// the verdict — the only bright major moment, synced to the green card
mix.add(impact(), VERDICT_AT, 0.72);
mix.add(stinger(523.25, 1.0), VERDICT_AT + 2, 0.5);
mix.add(pluck(1046.5, 0.16), VERDICT_AT + 7, 0.3);

// the ask
mix.add(blip(660, 0.12), SIDE_AT, 0.42);

// cut to the product act — one whoosh-free hit, then let the picture breathe
mix.add(impact(), PROD_AT, 0.6);
mix.add(blip(392, 0.14), PROD_AT + 3, 0.3);

// the caret ticks the whole board act — the unanswered question
for (let f = 0; f < PROD_AT - 4; f += CARET_PERIOD) mix.add(tick(), f, 0.2);

// clearing sweep for the seam (dies well before TOTAL)
mix.add(blip(330, 0.1), FADE_FROM, 0.28);
mix.add(hat(true), FADE_FROM + 6, 0.28);

const master = mix.finalize(0.8, 1.05);

export const ensurePickASideAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "pickaside.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensurePickASideAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "pickaside.wav present." : `Wrote pickaside.wav (${(TOTAL / FPS).toFixed(1)}s, seamless)`);
}
