// "WRAPPED" soundtrack — ~164 BPM (11 frames per beat), the pop record of the
// set: four-on-floor, open-hat offbeats, a bright I–vi–IV–V pluck progression,
// tick-rolls under the counters and a comedy buzz on "ARGUMENTS WON: 0".
// Arranged on the same grid as src/promo/wrapped/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, pluck, impact, whoosh, riser, stinger, crash, blip, tick, ding, buzz } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 11; // ~164 BPM
const BAR = 44;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/wrapped/timeline.ts
const SCENES = [["intro", 66], ["stat1", 55], ["stat2", 55], ["stat3", 55], ["turn", 66], ["cta", 88]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 385

const mix = new Mixer(TOTAL, FPS);

// the pop groove: I–vi–IV–V in C (C2 A1 F1 G1), one chord per bar
const ROOTS = [65.41, 55, 43.65, 49];
const CHORD = [
  [261.6, 329.6, 392], // C E G
  [220, 261.6, 329.6], // A C E
  [174.6, 220, 261.6], // F A C
  [196, 246.9, 293.7], // G B D
];
const groove = (from, to, kickGain = 1.0) => {
  let bar = 0;
  for (let f = from; f < to; f += BAR, bar++) {
    const r = ROOTS[bar % 4];
    const ch = CHORD[bar % 4];
    for (let b = 0; b < 4; b++) {
      const g = f + b * BEAT;
      if (g >= to) break;
      mix.add(kick(), g, kickGain);
      mix.add(hat(b % 2 === 1), g + Math.round(BEAT / 2), 0.5); // open hats offbeat
      mix.add(bass(r, 0.28), g, 0.8);
      mix.add(pluck(ch[b % 3], 0.16), g, 0.45);
    }
    mix.add(clap(), f + BEAT * 2, 0.7);
  }
};

// INTRO — party from frame 0
mix.add(ding(), 0, 0.9);
mix.add(impact(), 0, 0.7);
groove(0, START.stat1);
const CONF = [0, 11, 22, 33, 44, 55]; // confetti pops (mirror scenes.tsx)
CONF.forEach((at, i) => mix.add(blip(523 + i * 60), at, 0.4));

// STAT 1 — counter roll → ding
groove(START.stat1, START.stat2);
for (let f = START.stat1 + 4; f < START.stat1 + 32; f += 2) mix.add(tick(), f, 0.35); // odometer
mix.add(ding(), START.stat1 + 33, 0.85);

// STAT 2 — the gag: hold the groove back a beat, land the 0 on a buzz
groove(START.stat2 + BEAT, START.stat3, 0.85);
mix.add(buzz(0.5), START.stat2 + 10, 0.85); // ARGUMENTS WON: 0
mix.add(clap(), START.stat2 + 10, 0.6);
mix.add(blip(659), START.stat2 + 28, 0.55); // (self-reported: 147)

// STAT 3 — roll again → ding, riser into the turn
groove(START.stat3, START.turn);
for (let f = START.stat3 + 4; f < START.stat3 + 32; f += 2) mix.add(tick(), f, 0.35);
mix.add(ding(), START.stat3 + 33, 0.85);
mix.add(riser(0.9), START.turn - 22, 0.8);

// TURN — strip back to hits, then PROOF gets the stinger
mix.add(impact(), START.turn, 0.85); // "NEW SEASON."
mix.add(impact(), START.turn + 12, 0.8); // "NEW STAT:"
mix.add(sub(49, 0.9), START.turn, 0.7);
mix.add(stinger(196, 1.3), START.turn + 26, 0.95); // G3 — "PROOF."
mix.add(crash(), START.turn + 26, 0.5);
mix.add(sub(49, 1.2), START.turn + 26, 0.95);
mix.add(riser(0.8), START.cta - 18, 0.75);

// CTA — full pop payoff
mix.add(crash(), START.cta, 0.5);
mix.add(stinger(261.6, 1.4), START.cta + 4, 0.85); // C4 — "CHANGE YOUR STATS."
groove(START.cta, TOTAL - 8);
mix.add(whoosh(0.35), START.cta + 32, 0.6); // button lands

const master = mix.finalize();

export const ensureWrappedAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "wrapped.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureWrappedAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "wrapped.wav present." : `Wrote wrapped.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
