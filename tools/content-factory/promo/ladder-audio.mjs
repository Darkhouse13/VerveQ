// "THE LADDER" soundtrack. Mirrors src/promo/ladder/timeline.ts frame-for-frame.
// The arrangement carries the escalation the visuals promise: each solved rung
// resolves a semitone-ish step higher, the tick bed gets denser as the tiers
// get harder, and the final rung gets a riser that never resolves — no ding,
// because nothing on screen answers it either.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, hat, impact, tick, ding, blip, riser, stinger, whoosh } from "./audio-lib.mjs";

const FPS = 30;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/ladder/timeline.ts
const STEP = 84;
const LAST = 144;
const TOTAL = STEP * 4 + LAST; // 480
const CLUB_IN = 8;
const CLUB_GAP = 10;
const THINK_AT = 38;
const ANSWER_AT = 62;
const YOURTURN_AT = 92;
const CLUBS_PER_RUNG = 3;

const mix = new Mixer(TOTAL, FPS);

// a heartbeat under the whole climb, tightening on the last rung
for (let f = 0; f < STEP * 4; f += 21) mix.add(kick(), f, 0.5);
for (let f = STEP * 4; f < TOTAL; f += 14) mix.add(kick(), f, 0.62);

// resolution pitches — the ladder audibly climbs
const SOLVE = [523, 587, 659, 784];

for (let i = 0; i < 5; i++) {
  const base = i * STEP;
  const last = i === 4;
  const thinkEnd = last ? YOURTURN_AT : ANSWER_AT;

  // clubs slam in — except rung 1, which is pre-placed on screen (see
  // Ladder.tsx) and so gets a single downbeat instead of three slams
  if (i === 0) {
    mix.add(impact(), 0, 0.7);
  } else {
    for (let c = 0; c < CLUBS_PER_RUNG; c++) {
      mix.add(impact(), base + CLUB_IN + c * CLUB_GAP, 0.55 + i * 0.05);
    }
  }

  // guessing window — denser ticks as the tier gets harder
  const gap = last ? 4 : 6 - Math.floor(i / 2);
  const tickFrom = i === 0 ? 6 : THINK_AT;
  for (let f = tickFrom; f < thinkEnd - 2; f += gap) mix.add(tick(), base + f, 0.3);
  for (let f = THINK_AT; f < thinkEnd - 2; f += 12) mix.add(hat(), base + f, 0.2);

  if (!last) {
    // solved: bright resolution, one step higher each time
    mix.add(ding(), base + ANSWER_AT, 0.5);
    mix.add(blip(SOLVE[i], 0.12), base + ANSWER_AT + 3, 0.45);
    mix.add(impact(), base + ANSWER_AT, 0.4);
  } else {
    // the unanswered rung: rise, hit, and leave it hanging
    mix.add(riser((YOURTURN_AT - THINK_AT) / FPS), base + THINK_AT, 0.55);
    mix.add(impact(), base + YOURTURN_AT, 0.9);
    mix.add(stinger(196, 1.4), base + YOURTURN_AT, 0.5);
    mix.add(whoosh(0.5), base + YOURTURN_AT + 20, 0.35);
  }
}

const master = mix.finalize(0.82, 1.08);

export const ensureLadderAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "ladder.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureLadderAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "ladder.wav present." : `Wrote ladder.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
