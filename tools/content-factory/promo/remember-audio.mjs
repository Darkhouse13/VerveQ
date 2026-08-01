// "REMEMBER" soundtrack — 90 BPM (20 frames per beat) but WARM: lazy kick on
// 1 and 3, soft claps, long round subs and an F-major pentatonic music-box
// pluck line. The same tempo as versus, none of the menace — nostalgia in
// sound. Arranged on the same grid as src/promo/remember/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, pluck, impact, whoosh, riser, stinger, crash, blip, ding } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 20; // 90 BPM
const BAR = 80;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/remember/timeline.ts
const SCENES = [["year", 80], ["album", 80], ["numbers", 80], ["turn", 100], ["cta", 100]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 440

const mix = new Mixer(TOTAL, FPS);

// the warm bed: lazy kick 1 & 3, soft clap on 3, long subs, F-major roots
const ROOTS = [43.65, 55, 58.27, 49]; // F1 A1 Bb1 G1
const warm = (from, to, gain = 1.0) => {
  let bar = 0;
  for (let f = from; f < to; f += BAR, bar++) {
    mix.add(kick(), f, 0.75 * gain);
    mix.add(kick(), f + BEAT * 2, 0.6 * gain);
    mix.add(clap(), f + BEAT * 2, 0.4 * gain);
    mix.add(sub(ROOTS[bar % 4], 1.6), f, 0.5 * gain);
    mix.add(hat(), f + BEAT + BEAT / 2, 0.3 * gain);
    mix.add(hat(), f + BEAT * 3 + BEAT / 2, 0.3 * gain);
  }
};
// the music-box line: F pentatonic, one gentle note per beat, offset a hair
const BOX = [349.2, 440, 523.3, 466.2, 349.2, 523.3, 440, 392]; // F4 A4 C5 Bb4…
const musicbox = (from, to, gain = 0.4) => {
  let k = 0;
  for (let f = from; f < to; f += BEAT, k++) mix.add(pluck(BOX[k % BOX.length], 0.22), f + 3, gain);
};

// YEAR — one warm hit, the bed breathes in
mix.add(impact(), 0, 0.65);
mix.add(sub(43.65, 2.4), 0, 0.6);
warm(0, START.album, 0.9);
musicbox(BEAT, START.album, 0.38);
mix.add(ding(), 28, 0.5); // "you stayed up" chip

// ALBUM — stickers pop on soft dings; the shiny gets the bright one
warm(START.album, START.numbers);
musicbox(START.album, START.numbers, 0.42);
mix.add(blip(523, 0.12), START.album + 18, 0.5);
mix.add(ding(), START.album + 30, 0.85); // the SHINY
mix.add(blip(392, 0.12), START.album + 42, 0.45);

// NUMBERS — plates land on rising music-box notes
warm(START.numbers, START.turn);
const PLATE = [440, 523.3, 587.3, 698.5, 880];
for (let i = 0; i < 5; i++) mix.add(pluck(PLATE[i], 0.24), START.numbers + 16 + i * 9, 0.55);
mix.add(riser(1.0), START.turn - 26, 0.6);

// TURN — fuller: the realization
mix.add(impact(), START.turn, 0.85);
mix.add(crash(), START.turn, 0.35);
warm(START.turn, START.cta, 1.1);
musicbox(START.turn, START.cta, 0.45);
mix.add(stinger(174.6, 1.4), START.turn + 44, 0.8); // F3 — "TIME IT PAID OFF."
mix.add(whoosh(0.45), START.turn + 42, 0.5);

// CTA — the warm payoff, full but never harsh
mix.add(crash(), START.cta, 0.4);
mix.add(stinger(349.2, 1.5), START.cta + 4, 0.75); // F4 — "PUT IT TO WORK."
warm(START.cta, TOTAL - 10, 1.15);
musicbox(START.cta + BEAT, TOTAL - 10, 0.5);
mix.add(whoosh(0.35), START.cta + 34, 0.5); // button lands
mix.add(ding(), TOTAL - 24, 0.6); // one last music-box goodbye

const master = mix.finalize();

export const ensureRememberAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "remember.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureRememberAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "remember.wav present." : `Wrote remember.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
