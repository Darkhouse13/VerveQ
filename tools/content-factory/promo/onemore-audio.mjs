// "ONE MORE" soundtrack — ~129 BPM (14 frames per beat), hypnotic and
// nocturnal. The arrangement IS the joke: every bar of the spiral adds one
// more layer (kick → hats → bass → arp), each ONE MORE stamp hits harder,
// then everything cuts dead for the "work in six hours" beat — and relapses.
// Arranged on the same grid as src/promo/onemore/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, pluck, impact, whoosh, riser, stinger, crash, blip, tick } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 14; // ~129 BPM
const BAR = 56;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/onemore/timeline.ts
const SCENES = [["hook", 84], ["spiral", 140], ["busted", 70], ["cta", 98]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 392

const mix = new Mixer(TOTAL, FPS);

// HOOK — bedside quiet: a tick on every colon blink, a slow sub heartbeat
for (let f = 0; f < START.spiral; f += BEAT) mix.add(tick(), f, 0.7);
for (let f = 0; f < START.spiral; f += BEAT * 2) mix.add(sub(41.2, 0.6), f, 0.5); // E1
mix.add(impact(), 0, 0.55); // "YOU SAID ONE GAME." is already on screen
mix.add(blip(520), 34, 0.5); // "THAT WAS AT ELEVEN." pill

// SPIRAL — one more layer per bar (56f): kick → hats → bass → arp
const GS = START.spiral; // 84
const GE = START.busted; // 224
for (let f = GS; f < GE; f += BEAT) mix.add(kick(), f, 0.95); // bar 1+: the pulse
for (let f = GS + BAR; f < GE; f += BEAT) mix.add(hat(f % (BEAT * 2) === 0), f + BEAT / 2, 0.5); // bar 2+
const ROOTS = [41.2, 41.2, 49, 55]; // E1 E1 G1 A1
let bi = 0;
for (let f = GS + BAR * 2 - BEAT * 2; f < GE; f += BEAT * 2) { // bar ~3+
  mix.add(bass(ROOTS[bi % ROOTS.length], 0.45), f, 0.85);
  bi++;
}
const ARP = [164.8, 196, 246.9, 329.6]; // E3 G3 B3 E4 — minor, obsessive
for (let k = 0, f = GS + BAR * 2; f < GE; f += BEAT, k++) mix.add(pluck(ARP[k % ARP.length]), f, 0.5); // bar 3+
// the stamps: each ONE MORE hits harder (mirror LOOPS `at`s in scenes.tsx)
const STAMPS = [0, 42, 77, 105, 126];
STAMPS.forEach((at, i) => {
  mix.add(impact(), GS + at, 0.6 + i * 0.1);
  mix.add(blip(392 + i * 90), GS + at + 3, 0.5);
});
for (let f = GS; f < GE; f += BEAT) mix.add(tick(), f, 0.45); // the clock never stops
mix.add(riser(0.9), GE - 26, 0.8);

// BUSTED — dead silence for the gag… then the relapse slam
// (nothing from 224 to 259 — the silence IS the sound design)
const REL = START.busted + 35; // 259
mix.add(impact(), REL, 1.0);
mix.add(sub(41.2, 1.2), REL, 1.0);
mix.add(crash(), REL, 0.5);
mix.add(kick(), REL, 1.0);
mix.add(kick(), REL + BEAT, 0.8);

// CTA — full stack payoff
const CS = START.cta; // 294
mix.add(crash(), CS, 0.5);
mix.add(stinger(164.8, 1.4), CS + 4, 0.9); // E3 — "IT'S NEVER JUST ONE."
mix.add(sub(41.2, 1.3), CS + 4, 0.9);
for (let f = CS; f < TOTAL - 6; f += BEAT) {
  mix.add(kick(), f, 1.0);
  mix.add(hat(), f + BEAT / 2, 0.55);
}
for (let f = CS; f < TOTAL - 6; f += BEAT * 4) mix.add(clap(), f + BEAT * 2, 0.75);
for (let k = 0, f = CS + BEAT; f < TOTAL - 6; f += BEAT, k++) mix.add(pluck(ARP[k % ARP.length] * 2), f, 0.4);
for (let f = CS; f < TOTAL - 6; f += BEAT * 2) mix.add(bass(41.2, 0.45), f, 0.85);
mix.add(whoosh(0.35), CS + 34, 0.6); // button lands
mix.add(tick(), TOTAL - 20, 0.8); // one last clock tick under the warning

const master = mix.finalize();

export const ensureOneMoreAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "onemore.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureOneMoreAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "onemore.wav present." : `Wrote onemore.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
