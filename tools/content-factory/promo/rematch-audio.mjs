// "REMATCH" soundtrack — 100 BPM (18 frames per beat) revenge arc in sound:
// sparse minor-key grief under the loss, a groove that adds muscle through the
// training reps, a riser callout, driving tension while the scoreboard counts,
// then the lime REVENGE payoff lifts to major. Arranged on the same grid as
// src/promo/rematch/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, pluck, impact, whoosh, riser, stinger, crash, blip, tick } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 18; // 100 BPM
const BAR = 72;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/rematch/timeline.ts
const SCENES = [["loss", 72], ["grind", 90], ["callout", 72], ["rematch", 90], ["glory", 54], ["cta", 90]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 468

const mix = new Mixer(TOTAL, FPS);

// LOSS — grief: one hit, a low A-minor drone, a lonely heartbeat
mix.add(impact(), 0, 0.9); // "I LOST 9-4." already on screen
mix.add(sub(55, 2.2), 0, 0.55); // A1
mix.add(kick(), BEAT * 2, 0.5);
mix.add(kick(), BEAT * 3.5, 0.4);
mix.add(blip(330, 0.12), 38, 0.4); // "he hasn't shut up since"

// GRIND — the montage groove builds: kick → hats → bass → plucks
const GS = START.grind;
for (let f = GS; f < START.callout; f += BEAT) mix.add(kick(), f, 0.9);
for (let f = GS + BAR / 2; f < START.callout; f += BEAT) mix.add(hat(), f + BEAT / 2, 0.5);
const MINOR = [55, 55, 65.41, 73.42]; // A1 A1 C2 D2
let gi = 0;
for (let f = GS + BEAT * 2; f < START.callout; f += BEAT * 2) {
  mix.add(bass(MINOR[gi % 4], 0.4), f, 0.85);
  gi++;
}
// each rep card lands on a tick+blip (mirror REPS `at`s), scores rising
const REPS = [16, 28, 40, 52];
REPS.forEach((at, i) => {
  mix.add(impact(), GS + at, 0.45 + i * 0.08);
  mix.add(blip(392 + i * 66, 0.1), GS + at + 2, 0.5);
});
mix.add(blip(660, 0.12), GS + 58, 0.5); // streak pill
mix.add(riser(0.9), START.callout - 22, 0.8);

// CALLOUT — the stab
mix.add(impact(), START.callout, 1.0); // "REMATCH REQUESTED."
mix.add(stinger(110, 1.2), START.callout, 0.8); // A2 minor menace
mix.add(sub(55, 1.2), START.callout, 0.9);
mix.add(crash(), START.callout, 0.4);
for (let f = START.callout; f < START.rematch; f += BEAT) {
  mix.add(kick(), f, 0.85);
  mix.add(hat(), f + BEAT / 2, 0.45);
}
mix.add(blip(523, 0.12), START.callout + 28, 0.55); // GET REVENGE pill
mix.add(whoosh(0.4), START.rematch - 4, 0.6);

// REMATCH — tension: driving pulse + score ticks while the numbers climb
const RS = START.rematch;
for (let f = RS; f < START.glory; f += BEAT) {
  mix.add(kick(), f, 0.95);
  mix.add(hat(), f + BEAT / 2, 0.5);
  mix.add(bass(55, 0.3), f, 0.8);
}
for (let f = RS + 10; f < RS + 64; f += 6) mix.add(tick(), f, 0.4); // scores counting
mix.add(riser(1.0), RS + 40, 0.75);
mix.add(impact(), RS + 72, 0.95); // "FINAL." stamp
mix.add(clap(), RS + 72, 0.7);

// GLORY — the lift to major
mix.add(crash(), START.glory, 0.55);
mix.add(impact(), START.glory, 1.0); // "REVENGE."
mix.add(stinger(130.8, 1.5), START.glory, 0.95); // C3 — major now
mix.add(sub(65.41, 1.3), START.glory, 1.0);

// CTA — major-key victory groove
const CS = START.cta;
mix.add(stinger(261.6, 1.3), CS + 4, 0.8); // C4 — "YOUR TURN."
mix.add(crash(), CS, 0.45);
const MAJOR = [65.41, 49, 55, 65.41]; // C2 G1 A1 C2
let ci = 0;
for (let f = CS; f < TOTAL - 8; f += BEAT) {
  mix.add(kick(), f, 1.0);
  mix.add(hat(f % (BEAT * 2) === 0), f + BEAT / 2, 0.55);
  if (f % (BEAT * 2) === 0) {
    mix.add(bass(MAJOR[ci % 4], 0.4), f, 0.85);
    ci++;
  }
}
for (let f = CS; f < TOTAL - 8; f += BEAT * 4) mix.add(clap(), f + BEAT * 2, 0.75);
const ARP = [261.6, 329.6, 392, 523.3]; // C major
for (let k = 0, f = CS + BEAT; f < TOTAL - 8; f += BEAT, k++) mix.add(pluck(ARP[k % 4], 0.18), f, 0.42);
mix.add(whoosh(0.35), CS + 32, 0.6); // button lands

const master = mix.finalize();

export const ensureRematchAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "rematch.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureRematchAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "rematch.wav present." : `Wrote rematch.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
