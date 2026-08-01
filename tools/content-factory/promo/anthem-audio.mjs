// "ANTHEM" soundtrack — 150 BPM (12 frames per beat), the fastest and most
// percussive of the set. A kick + bass stab on every chanted word, half-time
// menace under SAME ARGUMENT, a rising strobe through the modes, then TRUE
// SILENCE for the deadpan frame — the cut to nothing is the hook — before the
// full four-on-floor payoff. Arranged on the same grid as
// src/promo/anthem/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, pluck, impact, whoosh, riser, stinger, crash, blip } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 12; // 150 BPM
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/anthem/timeline.ts
const SCENES = [["chant", 96], ["same", 72], ["strobe", 60], ["deadpan", 72], ["cta", 96]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 396

const mix = new Mixer(TOTAL, FPS);

// CHANT — a hit per word: kick + alternating bass stab, hats on the 8ths
const CHANT_ROOTS = [41.2, 41.2, 49, 49, 55, 55, 61.74, 61.74]; // E1 E1 G1 G1 A1 A1 B1 B1
for (let i = 0; i < 8; i++) {
  const f = i * BEAT;
  mix.add(kick(), f, 1.0);
  mix.add(bass(CHANT_ROOTS[i], 0.32), f, 0.9);
  if (i % 2 === 1) mix.add(clap(), f, 0.6);
  mix.add(hat(), f + BEAT / 2, 0.5);
}
const CHANT_MEL = [329.6, 329.6, 392, 392, 440, 440, 493.9, 493.9]; // mirrors the roots up top
for (let i = 0; i < 8; i++) mix.add(pluck(CHANT_MEL[i], 0.16), i * BEAT, 0.4);

// SAME — half-time menace: two big hits, kick 1 & 3, clap on 3
mix.add(impact(), START.same, 1.0); // "SAME"
mix.add(sub(41.2, 1.1), START.same, 0.9);
mix.add(crash(), START.same, 0.4);
for (let f = START.same; f < START.strobe; f += BEAT * 4) {
  mix.add(kick(), f, 0.9);
  mix.add(kick(), f + BEAT * 2, 0.7);
  mix.add(clap(), f + BEAT * 2, 0.75);
}
mix.add(whoosh(0.4), START.same + 32, 0.6);
mix.add(impact(), START.same + 36, 0.85); // "WHO ACTUALLY KNOWS BALL?" band

// STROBE — a kick and a rising blip per mode, riser into the cut
for (let i = 0; i < 5; i++) {
  const f = START.strobe + i * BEAT;
  mix.add(kick(), f, 1.0);
  mix.add(blip(440 + i * 80), f, 0.55);
  mix.add(hat(), f + BEAT / 2, 0.5);
  mix.add(bass(41.2 * (i % 2 === 0 ? 1 : 1.5), 0.3), f, 0.8);
}
mix.add(riser(0.9), START.deadpan - 24, 0.85);
mix.add(crash(), START.deadpan - 2, 0.35); // the cut itself

// DEADPAN — TRUE SILENCE. nothing. that's the joke landing.

// CTA — everything back at once
const CS = START.cta;
mix.add(crash(), CS, 0.55);
mix.add(impact(), CS, 0.9); // VERVEQ
mix.add(stinger(146.83, 1.4), CS + 14, 0.9); // D3 — "TALK IS CHEAP."
mix.add(sub(36.7, 1.3), CS + 14, 0.9);
for (let f = CS; f < TOTAL - 6; f += BEAT) {
  mix.add(kick(), f, 1.0);
  mix.add(hat(), f + BEAT / 2, 0.55);
}
for (let f = CS; f < TOTAL - 6; f += BEAT * 4) mix.add(clap(), f + BEAT * 2, 0.75);
const ARP = [293.7, 349.2, 440, 587.3]; // D4 F4 A4 D5
for (let k = 0, f = CS + BEAT; f < TOTAL - 6; f += BEAT, k++) mix.add(pluck(ARP[k % ARP.length]), f, 0.42);
for (let f = CS; f < TOTAL - 6; f += BEAT * 2) mix.add(bass(36.7, 0.4), f, 0.85); // D1
mix.add(whoosh(0.35), CS + 32, 0.6); // button lands

const master = mix.finalize();

export const ensureAnthemAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "anthem.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureAnthemAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "anthem.wav present." : `Wrote anthem.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
