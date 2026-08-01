// "FAN TYPES" soundtrack — ~106 BPM (17 frames per beat) swagger strut:
// boom-bap kick placement, backbeat claps, lazy swung hats and a walking
// minor bass. Each specimen lands on a rising hit; the villain gets a buzz
// and the heaviest sub in the set. Arranged on the same grid as
// src/promo/fantypes/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, pluck, impact, whoosh, riser, stinger, crash, blip, buzz, ding } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 17; // ~106 BPM
const BAR = 68;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/fantypes/timeline.ts
const SCENES = [["hook", 68], ["t1", 51], ["t2", 51], ["t3", 51], ["t4", 51], ["t5", 68], ["verdict", 68], ["cta", 85]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 493

const mix = new Mixer(TOTAL, FPS);

// the strut: kick on 1 and the "and of 2", claps on 2 & 4, swung hats,
// walking A-minor bass (A1 C2 A1 G1)
const WALK = [55, 65.41, 55, 49];
const strut = (from, to, g = 1.0) => {
  for (let f = from; f < to; f += BAR) {
    mix.add(kick(), f, g);
    mix.add(kick(), f + Math.round(BEAT * 1.5), g * 0.75);
    mix.add(clap(), f + BEAT, 0.7);
    mix.add(clap(), f + BEAT * 3, 0.75);
    for (let b = 0; b < 4; b++) {
      const at = f + b * BEAT;
      if (at >= to) break;
      mix.add(hat(), at + Math.round(BEAT / 2), 0.45);
      if (b % 2 === 1) mix.add(hat(), at + Math.round(BEAT * 0.875), 0.3); // the swing ghost
      mix.add(bass(WALK[b], 0.34), at, 0.85);
    }
  }
};

// HOOK — strut from frame 0, specimen dots pop
mix.add(impact(), 0, 0.8);
mix.add(sub(55, 1.2), 0, 0.6);
strut(0, START.t1);
for (let i = 0; i < 5; i++) mix.add(blip(392 + i * 55), 30 + i * 6, 0.4); // dots

// SPECIMENS — a rising hit per card, roast lands on a pluck
const CARDS = [START.t1, START.t2, START.t3, START.t4];
CARDS.forEach((f, i) => {
  mix.add(impact(), f, 0.75 + i * 0.05);
  mix.add(blip(330 + i * 70), f + 2, 0.5);
  mix.add(pluck(220 + i * 55, 0.2), f + 12, 0.5); // the roast line
});
strut(START.t1, START.t5, 0.9);

// THE VILLAIN — groove drops out, buzz + the heaviest sub
mix.add(buzz(0.6), START.t5, 0.9);
mix.add(impact(), START.t5, 1.0);
mix.add(sub(36.7, 1.6), START.t5, 1.1); // D1
mix.add(crash(), START.t5, 0.4);
mix.add(kick(), START.t5 + BEAT * 2, 0.7); // lone heartbeat under the roast
mix.add(pluck(196, 0.22), START.t5 + 12, 0.5);
mix.add(riser(0.9), START.verdict - 22, 0.8);

// VERDICT — half strut back + the lime band
mix.add(impact(), START.verdict, 0.85);
strut(START.verdict, START.cta, 0.85);
mix.add(whoosh(0.4), START.verdict + 28, 0.6);
mix.add(ding(), START.verdict + 32, 0.8); // "ONE QUIZ EXPOSES EVERYONE."
mix.add(riser(0.8), START.cta - 18, 0.8);

// CTA — full strut + stinger
mix.add(crash(), START.cta, 0.5);
mix.add(stinger(220, 1.4), START.cta + 4, 0.9); // A3 — "WHICH ONE ARE YOU?"
mix.add(sub(55, 1.3), START.cta + 4, 0.9);
strut(START.cta, TOTAL - 8);
mix.add(whoosh(0.35), START.cta + 32, 0.6); // button lands

const master = mix.finalize();

export const ensureFanTypesAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "fantypes.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureFanTypesAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "fantypes.wav present." : `Wrote fantypes.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
