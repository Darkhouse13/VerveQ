// "ASMR" soundtrack — the quiet one. No drums until the CTA: wooden thocks
// as the streak ticks, dry clicks as letters land, the two-note ding of
// CORRECT, a soft F-pentatonic pluck bed, then a gentle 112.5 BPM groove
// (16 frames per beat) only under GET YOUR FIX. Event grids are imported
// conceptually from src/promo/asmr/timeline.ts — keep the numbers in sync.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SR, Mixer, encodeWav, kick, sub, pluck, hat, whoosh, riser, stinger, blip, tick, ding, makeRng } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 16; // ~112.5 BPM (CTA groove only)
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/asmr/timeline.ts
const SCENES = [["hook", 64], ["streak", 96], ["letters", 84], ["ten", 66], ["cta", 96]];
const STREAK_STEP = 10, STREAK_COUNT = 8, LETTER_STEP = 11, WORD_LEN = 6;
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 406

// the wooden thock — low sine knock with a tiny noise transient. THE sound
// of this promo; not in audio-lib because nothing else wants this dryness.
const rng = makeRng(4242);
const thock = (freq = 175) => {
  const o = new Float32Array(Math.floor(SR * 0.11));
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * (freq + 40 * Math.exp(-t * 90))) / SR;
    const knock = t < 0.003 ? (rng() * 2 - 1) * Math.exp(-t * 900) * 0.7 : 0;
    o[i] = (Math.sin(ph) * Math.exp(-t * 42) + knock) * 0.8;
  }
  return o;
};

const mix = new Mixer("asmr", TOTAL, FPS);

// soft pentatonic bed — F A C D, lazy, all the way through
const BED = [349, 440, 523, 587];
for (let f = 8, i = 0; f < START.cta - 10; f += 26, i++) {
  mix.add(pluck(BED[i % BED.length], 0.3), f, 0.22);
}

// HOOK — one soft knock to open (the pill is already on screen), sub warmth
mix.add(thock(150), 0, 0.8);
mix.add(sub(87, 1.8), 0, 0.45); // F2
mix.add(blip(698, 0.1), 22, 0.3); // headline settles

// STREAK — a thock per tick, rising pitch (the satisfaction ladder)
for (let i = 0; i < STREAK_COUNT; i++) {
  const f = START.streak + 8 + i * STREAK_STEP;
  mix.add(thock(150 + i * 14), f, 0.85);
  mix.add(hat(), f + 4, 0.12); // tiny breath after each knock
}

// LETTERS — dry clicks stepping up, then the CORRECT ding
for (let i = 0; i < WORD_LEN; i++) {
  const f = START.letters + 8 + i * LETTER_STEP;
  mix.add(tick(), f, 0.6);
  mix.add(blip(392 + i * 66, 0.07), f, 0.35);
}
mix.add(ding(), START.letters + 8 + WORD_LEN * LETTER_STEP + 2, 0.8);

// TEN — the double payoff: thock + ding + warm sub swell
mix.add(thock(130), START.ten, 0.9);
mix.add(sub(87, 1.6), START.ten, 0.6);
mix.add(ding(), START.ten + 6, 0.85);
mix.add(ding(), START.ten + 30, 0.6); // "…is being right."
mix.add(riser(0.8), START.cta - 20, 0.5);

// CTA — drums finally allowed: gentle four-on-the-floor, still soft-handed
mix.add(stinger(349, 1.4), START.cta + 4, 0.8); // F4
mix.add(sub(87, 1.4), START.cta + 4, 0.7);
for (let f = START.cta + 8; f < TOTAL - 10; f += BEAT) {
  mix.add(kick(), f, 0.6);
  mix.add(hat(), f + BEAT / 2, 0.25);
}
for (let f = START.cta + 8; f < TOTAL - 10; f += BEAT * 2) mix.add(thock(190), f + BEAT, 0.5);
for (let f = START.cta + 8, i = 0; f < TOTAL - 14; f += 13, i++) {
  mix.add(pluck(BED[i % BED.length] * 2, 0.16), f, 0.2);
}
mix.add(whoosh(0.3), START.cta + 40, 0.45); // button lands
mix.add(ding(), TOTAL - 22, 0.65);

const master = mix.finalize(0.78, 1.0); // headroom — this one must stay gentle

export const ensureAsmrAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "asmr.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureAsmrAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "asmr.wav present." : `Wrote asmr.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
