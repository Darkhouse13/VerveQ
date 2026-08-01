// "HOW GOOD ARE YOU REALLY?" soundtrack — 100 BPM quiz-show. A clock ticks
// every beat under the questions, stabs mark each new question, a ding on the
// correct reveal, a buzz on the "most fans fail" stat, then it breaks into a
// triumphant four-on-floor for the modes/CTA payoff.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, pluck, impact, whoosh, riser, stinger, crash, blip, tick, ding, buzz } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 18; // 100 BPM
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/quiztease/timeline.ts
const SCENES = [["hook", 90], ["q1", 108], ["q2", 90], ["rapid", 72], ["stat", 72], ["modes", 72], ["cta", 90]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 594

const mix = new Mixer(TOTAL, FPS);

// HOOK — a stab + a low pulse, clock starts
mix.add(impact(), 0, 0.8);
mix.add(sub(49, 1.4), 0, 0.5);
mix.add(riser(0.8), 60, 0.5);

// CLOCK — ticks every beat from Q1 through the rapid round (the tension bed)
for (let f = START.q1; f < START.stat; f += BEAT) mix.add(tick(), f, 0.8);
// a soft heartbeat kick on the downbeats of the questions
for (let f = START.q1; f < START.rapid; f += BEAT * 2) mix.add(kick(), f, 0.55);

// Q1 — stab in, ding on the reveal (~ 80% through the scene)
mix.add(impact(), START.q1, 0.7);
mix.add(bass(98, 0.5), START.q1, 0.6);
mix.add(ding(), START.q1 + 80, 0.9);
mix.add(blip(659), START.q1 + 80, 0.5);

// Q2 — faster, stab + ding
mix.add(impact(), START.q2, 0.7);
mix.add(bass(110, 0.5), START.q2, 0.6);
mix.add(ding(), START.q2 + 64, 0.9);

// RAPID — accelerating blips + a riser building the overwhelm
mix.add(whoosh(0.4), START.rapid - 4, 0.6);
for (let i = 0, f = START.rapid; f < START.stat; f += Math.max(6, 14 - i), i++) mix.add(blip(500 + i * 70), Math.round(f), 0.45);
mix.add(riser(1.1), START.rapid + 20, 0.7);

// STAT — the gut-punch: buzz + big hit
mix.add(buzz(0.6), START.stat, 0.9);
mix.add(impact(), START.stat, 0.8);
mix.add(sub(41, 1.2), START.stat, 0.9);
mix.add(crash(), START.stat, 0.4);

// MODES — break into an upbeat four-on-floor payoff
const GS = START.modes;
const GE = TOTAL;
for (let f = GS; f < GE; f += BEAT) {
  mix.add(kick(), f, 1.0);
  mix.add(hat(), f + BEAT / 2, 0.6);
}
const ARP = [262, 330, 392, 523];
for (let k = 0, f = GS; f < GE; f += BEAT / 2, k++) mix.add(pluck(ARP[k % ARP.length]), Math.round(f), 0.55);
for (let f = GS; f < GE; f += BEAT * 4) mix.add(bass(65.4, 0.7), f, 0.9); // C2

// CTA — stinger on "FIND OUT."
mix.add(whoosh(0.35), START.cta - 4, 0.6);
mix.add(stinger(130.8, 1.3), START.cta, 0.85); // C3 chord
mix.add(crash(), START.cta, 0.45);
mix.add(kick(), START.cta, 1.0);

const master = mix.finalize();

export const ensureQuizTeaseAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "quiztease.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureQuizTeaseAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "quiztease.wav present." : `Wrote quiztease.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
