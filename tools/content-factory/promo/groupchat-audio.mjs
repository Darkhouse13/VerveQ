// "GROUP CHAT" soundtrack — ~138 BPM (13 frames per beat), urgent and
// skittering. Message-pop blips ARE the melody: every bubble in the video
// lands on a pop, the pile-on accelerates them into a roll, a hard cut kills
// the groove for the verdict, and the receipt brings it back triumphant.
// Arranged on the same grid as src/promo/groupchat/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, impact, whoosh, riser, stinger, crash, blip, ding } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 13; // ~138 BPM
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/groupchat/timeline.ts
const SCENES = [["hook", 78], ["pileon", 78], ["snap", 52], ["score", 78], ["cta", 91]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 377

const mix = new Mixer(TOTAL, FPS);

// message pops: received = low pair, sent = high pair (classic chat sound feel)
const popIn = (f, g = 0.6) => { mix.add(blip(470), f, g); mix.add(blip(590), f + 2, g * 0.7); };
const popOut = (f, g = 0.6) => { mix.add(blip(740), f, g); mix.add(blip(880), f + 2, g * 0.7); };

// HOOK — a tense pulse under the take, a pop per bubble (matches scenes.tsx)
mix.add(sub(46.25, 2.6), 0, 0.5); // F#1 drone
popIn(0, 0.7); // "He's not even top 10"
popOut(13); // "BLOCKED."
popIn(26); // "43 trophies"
for (let f = 36; f < 52; f += 4) mix.add(hat(), f, 0.3); // typing tick-tick
popIn(52, 0.7); // "you watch one league"
for (let f = 26; f < START.pileon; f += BEAT) mix.add(kick(), f, 0.45); // heartbeat creeps in

// PILE-ON — groove kicks in, pops accelerate into a roll (mirror RAIN's `at`s)
const GS = START.pileon;
for (let f = GS; f < START.snap; f += BEAT) {
  mix.add(kick(), f, 0.95);
  mix.add(hat(), f + Math.floor(BEAT / 2), 0.5);
}
for (let f = GS; f < START.snap; f += BEAT * 4) mix.add(clap(), f + BEAT * 2, 0.7);
// bass ostinato: F#1 eighths with a lift at the bar turn
const ROOTS = [46.25, 46.25, 55, 61.74]; // F#1 F#1 A1 B1
let bi = 0;
for (let f = GS; f < START.snap; f += BEAT * 2) {
  mix.add(bass(ROOTS[bi % ROOTS.length], 0.42), f, 0.85);
  bi++;
}
const RAIN_AT = [0, 9, 17, 24, 31, 37, 42, 47, 51, 55];
RAIN_AT.forEach((at, i) => (i % 2 === 0 ? popIn(GS + at, 0.55) : popOut(GS + at, 0.55)));
mix.add(riser(1.0), START.snap - 30, 0.85); // meltdown into the cut

// SNAP — groove dies, two verdict hits
mix.add(impact(), START.snap, 1.0); // "4,000 MESSAGES."
mix.add(sub(41, 1.0), START.snap, 0.8);
mix.add(impact(), START.snap + 13, 1.0); // "ZERO ANSWERS."
mix.add(sub(36.7, 1.2), START.snap + 13, 1.0);
mix.add(crash(), START.snap + 13, 0.4);

// SCORE — the receipt: ding on the card, stamp thump, half groove returns
mix.add(whoosh(0.4), START.score - 4, 0.6);
mix.add(impact(), START.score, 0.7); // "ONE QUIZ SETTLES IT."
mix.add(ding(), START.score + 14, 0.9); // receipt card pops
mix.add(blip(659), START.score + 18, 0.5);
mix.add(impact(), START.score + 38, 0.9); // SETTLED stamp
mix.add(clap(), START.score + 38, 0.7);
for (let f = START.score + 13; f < START.cta; f += BEAT * 2) mix.add(kick(), f, 0.6);

// CTA — full four-on-floor payoff
mix.add(crash(), START.cta, 0.5);
mix.add(stinger(155.56, 1.4), START.cta + 4, 0.9); // D#3 — "END THE ARGUMENT."
mix.add(sub(38.89, 1.3), START.cta + 4, 0.9);
for (let f = START.cta; f < TOTAL - 6; f += BEAT) {
  mix.add(kick(), f, 1.0);
  mix.add(hat(), f + Math.floor(BEAT / 2), 0.55);
}
for (let f = START.cta; f < TOTAL - 6; f += BEAT * 4) mix.add(clap(), f + BEAT * 2, 0.75);
for (let f = START.cta + BEAT * 2; f < TOTAL - 6; f += BEAT * 2) mix.add(bass(51.91, 0.4), f, 0.8); // G#1
mix.add(whoosh(0.35), START.cta + 34, 0.6); // button lands

const master = mix.finalize();

export const ensureGroupChatAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "groupchat.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureGroupChatAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "groupchat.wav present." : `Wrote groupchat.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
