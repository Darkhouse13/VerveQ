// "TUTORIAL" soundtrack — 112.5 BPM (16 frames per beat) clean instructional
// groove: kick 1&3, clap 2&4, tidy hats, C-major pluck riff, a blip per step
// chip, a whoosh + delivered-tick for the sent link, a camera shutter at the
// screenshot, TOTAL SILENCE under the deadpan frame (the gag), then the
// groove returns for CLASS DISMISSED. Arranged on the same grid as
// src/promo/tutorial/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, pluck, hat, clap, impact, whoosh, riser, stinger, crash, blip, tick, ding } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 16; // 112.5 BPM
const BAR = 64;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/tutorial/timeline.ts
const SCENES = [["hook", 60], ["step1", 66], ["step2", 66], ["step3", 78], ["done", 56], ["cta", 90]];
const SHUTTER_AT = 38;
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 416

const mix = new Mixer("tutorial", TOTAL, FPS);

// the classroom groove — polite, tidy, C major
const C2 = 65.4, F2 = 87.3;
const RIFF = [523, 659, 784, 659]; // C5 E5 G5 E5
const groove = (from, to, g = 1.0) => {
  let step = 0;
  for (let f = from; f < to; f += BEAT, step++) {
    if (step % 2 === 0) mix.add(kick(), f, 0.85 * g);
    else mix.add(clap(), f, 0.5 * g);
    mix.add(hat(), f + BEAT / 2, 0.3 * g);
    mix.add(pluck(RIFF[step % RIFF.length], 0.18), f, 0.4 * g);
    if (step % 4 === 0) mix.add(bass(step % 8 === 0 ? C2 : F2, 0.28), f, 0.75 * g);
  }
};

// HOOK — one clean hit, the groove starts politely
mix.add(impact(), 0, 0.9);
mix.add(sub(C2, 1.5), 0, 0.7);
groove(BEAT, START.step1, 0.85);
mix.add(blip(880, 0.1), 18, 0.5); // "A TUTORIAL." chip

// STEPS — groove on; each step chip gets a rising blip, each slam an impact
groove(START.step1, START.done, 1.0);
const stepStarts = [START.step1, START.step2, START.step3];
stepStarts.forEach((f, i) => {
  mix.add(whoosh(0.4), f - 4, 0.6);
  mix.add(blip(523 + i * 110, 0.12), f + 2, 0.65); // STEP N chip
  mix.add(impact(), f + 8, 0.8); // the statement slams
});
// step2: the link is sent
mix.add(whoosh(0.5), START.step2 + 26, 0.7);
mix.add(tick(), START.step2 + 44, 0.6); // delivered ✓✓
mix.add(tick(), START.step2 + 48, 0.6);
// step3: the shutter — click-CLACK + flash
mix.add(tick(), START.step3 + SHUTTER_AT, 0.9);
mix.add(clap(), START.step3 + SHUTTER_AT + 2, 0.8);
mix.add(ding(), START.step3 + SHUTTER_AT + 14, 0.6); // saved to camera roll
mix.add(blip(392, 0.12), START.step3 + SHUTTER_AT + 26, 0.45); // attach. send. mute.

// DONE — TRUE SILENCE (the deadpan). one dry tick halfway, nothing else.
mix.add(tick(), START.done + 30, 0.5);
mix.add(riser(0.7), START.cta - 14, 0.7);

// CTA — the groove returns with the bell
mix.add(crash(), START.cta, 0.5);
mix.add(stinger(262, 1.4), START.cta + 4, 0.95); // C4 — school bell energy
mix.add(sub(C2, 1.4), START.cta + 4, 0.85);
groove(START.cta, TOTAL - 10, 1.1);
mix.add(whoosh(0.35), START.cta + 40, 0.6); // button lands
mix.add(ding(), TOTAL - 22, 0.7); // dismissed.

const master = mix.finalize();

export const ensureTutorialAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "tutorial.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureTutorialAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "tutorial.wav present." : `Wrote tutorial.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
