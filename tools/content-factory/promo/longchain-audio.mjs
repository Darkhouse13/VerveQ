// "THE LONG CHAIN" soundtrack — 3000 frames, 100.0s, 200 beats at 120 BPM.
// Same loop law as promo/chain-audio.mjs: every period divides TOTAL and the
// frame-0 kick masks the seam. Mirrors src/promo/longchain/timeline.ts —
// re-time one, re-time both.
//
// The arrangement's job over 100 seconds is to stop the piece feeling like a
// slideshow (see the note in SCRIPTS_PHASE2.md — the sweep's 90-120s winners
// are all commentary-led, so a silent board is the real risk here). Each pair
// gets its own rising stamp pitch, the 3-2-1 ticks are audible, and the answer
// lands on a stinger. PAIR SIX GETS NO STINGER — the ear notices the missing
// resolution the same way the eye notices the missing green.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, hat, clap, bass, pluck, impact, blip, tick, riser, stinger, whoosh } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 15;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/longchain/timeline.ts
const TOTAL = 3000;
const HOOK_CUT = 60;
const PAIRS_AT = 300;
const PAIR_DUR = 390;
const N_PAIRS = 6;
const CLOSE_AT = 2640;
const LOCKUP_AT = 2820;
const FADE_FROM = 2960;
const P_SLOT = 45;
const P_TICK = [135, 165, 195];
const P_ANSWER = 225;
const P_FACT = 270;
const CARET_PERIOD = 15;

const mix = new Mixer(TOTAL, FPS, 0); // NO tail — the wav ends exactly at the seam

// ---- engine ----
// nothing under the b-roll: the clip's own room tone carries the cold open,
// same law as the Dave lane. The kick starts ON the hard cut to cream.
for (let f = HOOK_CUT; f < TOTAL; f += BEAT) mix.add(kick(), f, f < CLOSE_AT ? 0.78 : 0.42);
for (let f = HOOK_CUT + 7; f < CLOSE_AT - 6; f += BEAT) mix.add(hat(), f, 0.22);
for (let f = HOOK_CUT + BEAT * 2; f < CLOSE_AT - 12; f += BEAT * 4) mix.add(clap(), f, 0.3);

// bass ostinato, period 60f (50 cycles in 3000, and it divides every boundary)
const OST = [73.4, 98, 87.3, 65.4];
for (let f = HOOK_CUT, i = 0; f < CLOSE_AT - 14; f += 60, i++) mix.add(bass(OST[i % 4], 0.34), f, 0.6);

// ---- the contract ----
mix.add(impact(), HOOK_CUT, 0.8);
mix.add(whoosh(0.5), HOOK_CUT - 6, 0.4);
mix.add(impact(), HOOK_CUT + 45, 0.6);
mix.add(impact(), HOOK_CUT + 120, 0.6);
mix.add(riser(1.1), PAIRS_AT - 34, 0.34);

// ---- six pairs, each a step brighter than the last ----
const STAMP = [392, 440, 494, 523, 587, 659];
for (let i = 0; i < N_PAIRS; i++) {
  const at = PAIRS_AT + i * PAIR_DUR;
  const last = i === N_PAIRS - 1;

  // plates slam in
  mix.add(impact(), at, 0.6);
  mix.add(blip(STAMP[i], 0.12), at + 6, 0.34);
  // the slot opens
  mix.add(blip(STAMP[i] * 1.5, 0.1), at + P_SLOT, 0.3);
  // 3-2-1 — audible, because the viewer is meant to answer in their head
  P_TICK.forEach((t) => mix.add(tick(), at + t, 0.5));

  if (last) {
    // pair six: the beat where the answer WOULD land stays empty. One dead
    // tick instead of a stinger. This is the whole format in one sound.
    mix.add(tick(), at + P_ANSWER, 0.3);
  } else {
    mix.add(impact(), at + P_ANSWER, 0.72);
    mix.add(stinger(STAMP[i] * 1.334, 0.9), at + P_ANSWER + 2, 0.44);
    mix.add(pluck(STAMP[i] * 2, 0.16), at + P_ANSWER + 7, 0.26);
  }
  mix.add(blip(STAMP[i], 0.1), at + P_FACT, 0.24);
}

// the caret ticks through every open slot
for (let i = 0; i < N_PAIRS; i++) {
  const at = PAIRS_AT + i * PAIR_DUR;
  const until = i === N_PAIRS - 1 ? PAIR_DUR : P_ANSWER;
  for (let f = P_SLOT; f < until - 4; f += CARET_PERIOD) mix.add(tick(), at + f, 0.14);
}

// ---- close ----
mix.add(impact(), CLOSE_AT, 0.6);
mix.add(blip(392, 0.14), CLOSE_AT + 3, 0.3);
mix.add(impact(), LOCKUP_AT, 0.56);
// the lockup keeps ticking: the question is still open when the video ends
for (let f = LOCKUP_AT; f < FADE_FROM; f += CARET_PERIOD) mix.add(tick(), f, 0.18);

// clearing sweep for the seam
mix.add(blip(330, 0.1), FADE_FROM, 0.26);
mix.add(hat(true), FADE_FROM + 6, 0.26);

const master = mix.finalize(0.8, 1.05);

export const ensureLongChainAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "longchain.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureLongChainAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "longchain.wav present." : `Wrote longchain.wav (${(TOTAL / FPS).toFixed(1)}s, seamless)`);
}
