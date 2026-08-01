// "FINAL" soundtrack — ~129 BPM (14 frames per beat) stadium four-on-the-floor:
// kick every beat, clap backbeat, open-hat offbeats, a chant-like pluck motif
// climbing G–B–D, crowd-swell noise under the date card and the CTA, dings as
// the matchday-prep boxes check off. Arranged on the same grid as
// src/promo/final/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, pluck, hat, clap, impact, whoosh, riser, stinger, crash, blip, ding } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 14; // ~129 BPM
const BAR = 56;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/final/timeline.ts
const SCENES = [["date", 70], ["debates", 76], ["prep", 70], ["drills", 92], ["cta", 108]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 416

const mix = new Mixer(TOTAL, FPS);

// the stadium engine: four-on-the-floor + offbeat open hats + G1/C2 bass
const G1 = 49, C2 = 65.4, D2 = 73.4;
const stadium = (from, to, g = 1.0, roots = [G1, G1, C2, D2]) => {
  let barIdx = 0;
  for (let f = from; f < to; f += BAR, barIdx++) {
    const root = roots[barIdx % roots.length];
    for (let b = 0; b < 4; b++) {
      mix.add(kick(), f + BEAT * b, (b === 0 ? 0.95 : 0.8) * g);
      mix.add(hat(true), f + BEAT * b + BEAT / 2, 0.4 * g);
    }
    mix.add(clap(), f + BEAT, 0.5 * g);
    mix.add(clap(), f + BEAT * 3, 0.55 * g);
    mix.add(bass(root, 0.3), f, 0.85 * g);
    mix.add(bass(root, 0.22), f + BEAT * 2, 0.65 * g);
  }
};

// the chant motif — G4 B4 D5 climbing, once per bar
const G4 = 392, B4 = 494, D5 = 587;
const chant = (from, to, g = 1.0) => {
  for (let f = from; f < to; f += BAR) {
    mix.add(pluck(G4, 0.16), f, 0.5 * g);
    mix.add(pluck(B4, 0.16), f + BEAT, 0.5 * g);
    mix.add(pluck(D5, 0.22), f + BEAT * 2, 0.6 * g);
  }
};

// DATE — crowd swell, one big hit, the engine starts
mix.add(impact(), 0, 0.95);
mix.add(sub(G1, 1.6), 0, 0.75);
mix.add(whoosh(1.4), 0, 0.5); // crowd
stadium(BAR / 2, START.debates, 0.85);
mix.add(blip(D5, 0.1), 22, 0.5); // subline lands

// DEBATES — engine + chant, a pop per hot take
stadium(START.debates, START.prep, 0.95);
chant(START.debates, START.prep, 0.9);
mix.add(whoosh(0.4), START.debates - 4, 0.6);
for (const at of [16, 30, 44, 58]) mix.add(blip(660, 0.09), START.debates + at, 0.55); // bubbles (mirror scenes.tsx)

// PREP — half-time drop: kicks thin out, then YOU SHOULD TOO slams it back
for (let f = START.prep; f < START.prep + BAR; f += BEAT * 2) mix.add(kick(), f, 0.7);
mix.add(sub(G1, 1.0), START.prep, 0.7);
mix.add(impact(), START.prep + 32, 1.0); // "YOU SHOULD TOO."
mix.add(crash(), START.prep + 32, 0.4);
stadium(START.prep + 32, START.drills, 1.0);

// DRILLS — engine + a ding per checked drill
stadium(START.drills, START.cta, 1.0);
chant(START.drills, START.cta, 0.85);
mix.add(whoosh(0.4), START.drills - 4, 0.6);
const CHECKS = [16, 40, 64];
CHECKS.forEach((at, i) => {
  mix.add(impact(), START.drills + at, 0.45);
  mix.add(ding(), START.drills + at + 12, 0.75 + i * 0.05);
});
mix.add(riser(0.9), START.cta - 24, 0.8);

// CTA — full stadium + stinger payoff
mix.add(crash(), START.cta, 0.5);
mix.add(stinger(196, 1.5), START.cta + 4, 0.95); // G3 — "BE MATCH FIT."
mix.add(sub(G1, 1.4), START.cta + 4, 0.9);
stadium(START.cta, TOTAL - 10, 1.15);
chant(START.cta + BAR, TOTAL - 10, 1.0);
mix.add(whoosh(0.35), START.cta + 40, 0.6); // button lands
mix.add(whoosh(1.6), TOTAL - 60, 0.45); // crowd out
mix.add(ding(), TOTAL - 24, 0.65);

const master = mix.finalize();

export const ensureFinalAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "final.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureFinalAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "final.wav present." : `Wrote final.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
