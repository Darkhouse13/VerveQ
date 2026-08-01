// "THE ANSWER ISN'T IN THIS VIDEO" soundtrack — 1050 frames, 35.0s, 70 beats
// at 120 BPM. Same loop law as promo/chain-audio.mjs. Mirrors
// src/promo/nottelling/timeline.ts — re-time one, re-time both.
//
// The arrangement is built around a resolution that never comes. Five club
// stamps climb a scale — and the sixth degree, the one the ear is waiting for,
// is never played. The bass sits on an unresolved interval for the whole piece.
// The only consonant chord in the video lands on the product frame, at the
// same instant as the only green. Sound and colour tell the same story.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, hat, clap, bass, pluck, impact, blip, tick, riser, stinger, buzz } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 15;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/nottelling/timeline.ts
const TOTAL = 1050;
const CLUB_AT = [0, 90, 180, 270, 360];
const BALLON_AT = 450;
const WHO_AT = 540;
const REFUSE_AT = 630;
const POSITION_AT = 720;
const PROD_AT = 810;
const CTA_AT = 930;
const FADE_FROM = 1020;
const CARET_PERIOD = 15;

const mix = new Mixer("not-telling", TOTAL, FPS, 0); // NO tail — the wav ends exactly at the seam

// engine — drops back under the product act so the recording is heard
for (let f = 0; f < TOTAL; f += BEAT) mix.add(kick(), f, f < PROD_AT ? 0.78 : 0.4);
for (let f = 7; f < PROD_AT - 6; f += BEAT) mix.add(hat(), f, 0.22);
for (let f = BEAT * 2; f < PROD_AT - 12; f += BEAT * 4) mix.add(clap(), f, 0.3);

// bass: a minor second rocking against itself, period 70f (15 cycles in 1050).
// It never lands on the root, which is the whole point of the piece.
const OST = [73.4, 77.8];
for (let f = 0, i = 0; f < PROD_AT - 14; f += 35, i++) mix.add(bass(OST[i % 2], 0.3), f, 0.6);

// the five clubs climb — 392, 440, 494, 523, 587. The sixth degree (659) that
// the ear is now expecting is never played anywhere in this file.
const STAMP = [392, 440, 494, 523, 587];
CLUB_AT.forEach((f, i) => {
  mix.add(impact(), f, 0.6);
  mix.add(blip(STAMP[i], 0.13), f + 2, 0.46);
  mix.add(pluck(STAMP[i] * 2, 0.15), f + 5, 0.26);
});

// the sourced fact reframes it
mix.add(impact(), BALLON_AT, 0.68);
mix.add(riser(0.8), BALLON_AT + 4, 0.3);

// the question
mix.add(blip(660, 0.12), WHO_AT, 0.4);

// the refusal — a buzz where a reveal stinger would normally sit
mix.add(impact(), REFUSE_AT, 0.74);
mix.add(buzz(0.45), REFUSE_AT + 3, 0.34);
mix.add(blip(311, 0.14), POSITION_AT, 0.28);

// the product act — the ONLY consonant resolution in the piece, on the same
// frame as the only green
mix.add(impact(), PROD_AT, 0.66);
mix.add(stinger(523.25, 1.2), PROD_AT + 2, 0.5);
mix.add(pluck(1046.5, 0.18), PROD_AT + 9, 0.3);
mix.add(blip(784, 0.14), CTA_AT, 0.34);

// the caret ticks the whole puzzle act — the unanswered question
for (let f = WHO_AT; f < PROD_AT - 4; f += CARET_PERIOD) mix.add(tick(), f, 0.2);

// clearing sweep for the seam
mix.add(blip(330, 0.1), FADE_FROM, 0.26);
mix.add(hat(true), FADE_FROM + 6, 0.26);

const master = mix.finalize(0.8, 1.05);

export const ensureNotTellingAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "nottelling.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureNotTellingAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "nottelling.wav present." : `Wrote nottelling.wav (${(TOTAL / FPS).toFixed(1)}s, seamless)`);
}
