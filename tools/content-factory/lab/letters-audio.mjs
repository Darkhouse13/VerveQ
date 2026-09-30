// MISSING LETTERS sound bed — synthesized and timed off src/lab/grid.json
// (letters). Same palette as the Who's Older bed: a half-second clock, a
// riser into the late rounds, and one pluck per tile as the gaps fill in.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Mixer, blip, crash, ding, encodeWav, impact, kick, pluck, riser, stinger, sub, tick, whoosh } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const GRID = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "grid.json"), "utf8"));
const F = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "letters", "facts.json"), "utf8"));

export const ensureLettersAudio = (force = false) => {
  const out = path.join(dir, "..", "public", "promo", "lab-letters.wav");
  if (existsSync(out) && !force) return;
  const G = GRID.letters;
  const N = F.rounds.length;
  const TOTAL = N * G.round + G.closer;
  const mix = new Mixer(`lab-letters-${F.edition}`, TOTAL, GRID.fps);
  const NOTES = [392, 440, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99];
  F.rounds.forEach((r, i) => {
    const S = i * G.round;
    mix.add(kick(), S, 0.9);
    mix.add(whoosh(0.32), S, 0.5);
    mix.add(impact(), S + 4, 0.5);
    for (let f = S + 6; f < S + G.timerTo; f += 15) mix.add(tick(), f, f >= S + G.timerTo - 30 ? 0.55 : 0.32);
    if (r.n >= 7) mix.add(riser(0.8), S + G.timerTo - 24, 0.35 + 0.05 * (r.n - 7));
    mix.add(impact(), S + G.revealAt, 0.9);
    mix.add(sub(55, 0.6), S + G.revealAt, 0.45);
    const hidden = r.words.flat().filter((t) => t.hide).length;
    for (let k = 0; k < hidden; k++) mix.add(pluck(NOTES[k % NOTES.length], 0.12), S + G.revealAt + k * G.fillStep, 0.22);
    mix.add(ding(), S + G.revealAt + hidden * G.fillStep + 6, 0.5);
    if (r.n === N) mix.add(crash(), S + G.revealAt, 0.4);
  });
  const C = N * G.round;
  mix.add(crash(), C, 0.45);
  mix.add(kick(), C, 1);
  mix.add(stinger(220, 1.4), C + 4, 0.75);
  mix.add(sub(55, 1.1), C + 14, 0.6);
  mix.add(ding(), C + 30, 0.5);
  for (let f = C + 50; f < TOTAL; f += 15) mix.add(blip(740, 0.06), f, 0.15);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, encodeWav(mix.finalize()));
  console.log(`  → ${out}`);
};
