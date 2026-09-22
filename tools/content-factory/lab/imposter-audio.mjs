// SPOT THE IMPOSTER — sound bed. Synthesized (promo/audio-lib.mjs), seeded by
// the Mixer name, timed off src/lab/imposter/grid.json so a re-time in the grid
// re-times the sound. No voice. A 120 BPM groove (one beat = 15 frames) runs
// under the whole reel so there is never dead air; the clock, the flip buzz
// and the stamp hit are the pacing devices on top. Written to its OWN file
// (public/promo/lab-imposter.wav) — the shared lab/audio.mjs is untouched.
//
//   node lab/imposter-audio.mjs [--force]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, bass, blip, buzz, crash, ding, encodeWav, hat, impact, kick, pluck, riser, stinger, sub, tick, whoosh } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "imposter", "grid.json"), "utf8"));
const F = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "imposter", "facts.json"), "utf8"));
export const IMPOSTER_WAV = path.join(dir, "..", "public", "promo", "lab-imposter.wav");

export const ensureImposterAudio = (force = false) => {
  if (!force && existsSync(IMPOSTER_WAV)) return IMPOSTER_WAV;
  const FPS = G.fps;
  const N = F.rounds.length;
  const TOTAL = (N - 1) * G.round + G.withholdAt + G.withholdHold;
  const mix = new Mixer("lab-imposter", TOTAL, FPS);

  // ── the groove: A minor-ish loop, two bars per chord ──
  const ROOTS = [55, 43.65, 65.41, 49]; // A1 F1 C2 G1
  const ARP = [
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [261.63, 329.63, 392],
    [196, 246.94, 293.66],
  ];
  const BEAT = 15;
  for (let f = 0, b = 0; f < TOTAL; f += BEAT, b++) {
    const chord = Math.floor(b / 8) % 4;
    if (b % 2 === 0) mix.add(kick(), f, 0.34);
    mix.add(hat(b % 4 === 3), f + 7, 0.1);
    mix.add(hat(), f, 0.06);
    if (b % 4 === 0) mix.add(bass(ROOTS[chord], 0.9), f, 0.42);
    if (b % 4 === 2) mix.add(bass(ROOTS[chord] * 1.5, 0.4), f, 0.28);
    mix.add(pluck(ARP[chord][b % 3], 0.16), f + (b % 2 ? 7 : 0), 0.09);
  }

  // ── per round ──
  F.rounds.forEach((r, i) => {
    const S = i * G.round;
    if (i > 0) {
      mix.add(whoosh(0.3), S - 4, 0.45);
      mix.add(impact(), S, 0.6);
    }
    mix.add(pluck(392, 0.2), S + 3, 0.25);
    // the clock: every half second, doubling in the last second
    const from = i === 0 ? 0 : G.timerFrom;
    for (let f = S + from; f < S + G.timerTo; f += 15) mix.add(tick(), f, f >= S + G.timerTo - 30 ? 0.55 : 0.3);
    for (let f = S + G.timerTo - 30 + 7; f < S + G.timerTo; f += 15) mix.add(tick(), f, 0.45);
    mix.add(riser(1.0), S + G.timerTo - 30, 0.28 + 0.04 * i);
    if (!r.withheld) {
      // the flip: buzz on the imposter, the stamp lands, the genuine three tick green
      mix.add(impact(), S + G.revealAt, 0.9);
      mix.add(buzz(0.35), S + G.revealAt + 2, 0.45);
      mix.add(kick(), S + G.stampAt, 0.9);
      mix.add(crash(), S + G.stampAt, 0.28);
      mix.add(sub(49, 0.6), S + G.stampAt, 0.45);
      [0, 1, 2].forEach((k) => mix.add(blip(660 + k * 110, 0.07), S + G.revealAt + 8 + k * 3, 0.2));
      mix.add(ding(), S + G.stampAt + 12, 0.35);
    } else {
      // the withhold: a hit, then the ask holds on a pulse to the end
      mix.add(impact(), S + G.withholdAt, 1);
      mix.add(sub(41, 1.2), S + G.withholdAt, 0.6);
      mix.add(crash(), S + G.withholdAt, 0.4);
      mix.add(stinger(220, 1.4), S + G.withholdAt + 10, 0.6);
      mix.add(ding(), S + G.withholdAt + G.brandAt, 0.4);
      for (let f = S + G.withholdAt + 40; f < TOTAL; f += 20) mix.add(blip(520, 0.06), f, 0.14);
    }
  });

  mkdirSync(path.dirname(IMPOSTER_WAV), { recursive: true });
  writeFileSync(IMPOSTER_WAV, encodeWav(mix.finalize()));
  console.log(`  → ${IMPOSTER_WAV}`);
  return IMPOSTER_WAV;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) ensureImposterAudio(process.argv.includes("--force"));
