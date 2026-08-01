// "HORROR" soundtrack — dread on a ~69 BPM heartbeat (26 frames per pulse):
// a low A-minor drone, lub-dub double kicks, sparse high ticks like a clock
// in an empty house, a riser into the "PROVE IT." slam (buzz + impact), a
// minor-chord poster sting — then the CTA flips the genre: bright major
// stinger, clean four-on-the-floor relief. Arranged on the same grid as
// src/promo/horror/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, pluck, hat, clap, impact, whoosh, riser, stinger, crash, blip, tick, ding, buzz } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 26; // one heartbeat, ~69 BPM
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/horror/timeline.ts
const SCENES = [["cold", 66], ["denial", 80], ["reveal", 70], ["poster", 86], ["cta", 100]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 402

const mix = new Mixer(TOTAL, FPS);

// the heartbeat: lub-DUB every pulse (soft kick, then a harder one 8f later)
const heartbeat = (from, to, g = 1.0) => {
  for (let f = from; f < to; f += BEAT) {
    mix.add(kick(), f, 0.55 * g);
    mix.add(kick(), f + 8, 0.85 * g);
  }
};

// the drone: overlapping low A1 + C2 subs — a slow minor wash
const A1 = 55, C2 = 65.4, E2 = 82.4;
const drone = (from, to, g = 1.0) => {
  for (let f = from; f < to; f += 45) {
    mix.add(sub(A1, 2.2), f, 0.5 * g);
    mix.add(sub(C2, 2.2), f + 20, 0.28 * g);
  }
};

// COLD — drone + heartbeat + a clock somewhere down the hall
drone(0, START.reveal, 1.0);
heartbeat(0, START.reveal, 0.9);
for (let f = 30; f < START.reveal; f += 60) mix.add(tick(), f, 0.35);

// DENIAL — typed lines get dry key-taps, dread thickens
for (const at of [6, 40]) {
  for (let f = 0; f < 22; f += 3) mix.add(tick(), START.denial + at + f, 0.22); // typing
  mix.add(blip(220, 0.12), START.denial + at, 0.4);
}
mix.add(riser(1.4), START.reveal - 42, 0.85);

// REVEAL — "it's two words." … PROVE IT. (buzz + impact + everything stops)
mix.add(blip(196, 0.14), START.reveal + 2, 0.5);
mix.add(impact(), START.reveal + 24, 1.0);
mix.add(buzz(0.7), START.reveal + 24, 0.95);
mix.add(sub(41.2, 1.8), START.reveal + 24, 0.95); // E1 floor drop
mix.add(crash(), START.reveal + 24, 0.4);
// dead air after the slam — just the heartbeat, faster (fear)
heartbeat(START.reveal + 40, START.cta, 1.0);

// POSTER — minor sting (stacked bass, not the major stinger), drone returns
drone(START.poster, START.cta, 0.8);
mix.add(bass(A1 * 2, 1.6), START.poster + 4, 0.7); // A2
mix.add(bass(C2 * 2, 1.6), START.poster + 4, 0.55); // C3 — the minor third
mix.add(bass(E2 * 2, 1.6), START.poster + 4, 0.5); // E3
mix.add(blip(880, 0.1), START.poster + 26, 0.4); // tagline
mix.add(tick(), START.poster + 44, 0.5); // credits line
mix.add(riser(1.0), START.cta - 26, 0.8);

// CTA — the genre flip: bright major stinger, clean relief groove
mix.add(crash(), START.cta, 0.55);
mix.add(stinger(262, 1.5), START.cta + 4, 0.95); // C4 major — daylight
mix.add(sub(65.4, 1.4), START.cta + 4, 0.85);
for (let f = START.cta + 14; f < TOTAL - 10; f += 14) {
  mix.add(kick(), f, 0.85);
  mix.add(hat(true), f + 7, 0.4);
}
for (let f = START.cta + 28; f < TOTAL - 10; f += 28) mix.add(clap(), f, 0.5);
for (let f = START.cta + 14; f < TOTAL - 10; f += 56) {
  mix.add(pluck(523, 0.16), f, 0.5); // C5
  mix.add(pluck(659, 0.16), f + 14, 0.5); // E5
  mix.add(pluck(784, 0.22), f + 28, 0.6); // G5
}
mix.add(whoosh(0.35), START.cta + 40, 0.6); // button lands
mix.add(ding(), TOTAL - 24, 0.7); // you survived

const master = mix.finalize();

export const ensureHorrorAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "horror.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureHorrorAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "horror.wav present." : `Wrote horror.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
