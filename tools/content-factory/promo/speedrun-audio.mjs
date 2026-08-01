// "SPEEDRUN" soundtrack — 150 BPM (12 frames per beat) chiptune drive: square
// -wave lead looping an E-minor run, kick every beat, 8th hats, clap backbeat,
// a rising blip per split (golds get the ding), a full stop + stinger at NEW
// WORLD RECORD, then the drive returns for the CTA. Arranged on the same grid
// as src/promo/speedrun/timeline.ts (SPLITS mirrored below).
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SR, Mixer, encodeWav, kick, sub, bass, hat, clap, impact, whoosh, riser, stinger, crash, blip, ding } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 12; // 150 BPM
const BAR = 48;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/speedrun/timeline.ts
const SCENES = [["title", 64], ["run", 150], ["wr", 72], ["cta", 100]];
const SPLITS = [
  { at: 14, gold: false },
  { at: 40, gold: false },
  { at: 66, gold: true },
  { at: 98, gold: false },
  { at: 124, gold: true },
];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 386

// chip lead — detuned square pair, the console voice of this promo only
const square = (freq, dur = 0.14) => {
  const o = new Float32Array(Math.floor(SR * dur));
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const a = Math.sign(Math.sin(2 * Math.PI * freq * t));
    const b = Math.sign(Math.sin(2 * Math.PI * freq * 1.004 * t));
    o[i] = (a * 0.6 + b * 0.4) * Math.min(1, t / 0.004) * Math.exp(-t * 16) * 0.18;
  }
  return o;
};

const mix = new Mixer("speedrun", TOTAL, FPS);

// E-minor chip run: E4 G4 A4 B4 | E4 G4 B4 E5 — one note per beat
const RUNUP = [330, 392, 440, 494, 330, 392, 494, 659];
const drive = (from, to, g = 1.0, withLead = true) => {
  let step = 0;
  for (let f = from; f < to; f += BEAT, step++) {
    mix.add(kick(), f, 0.85 * g);
    mix.add(hat(), f + BEAT / 2, 0.35 * g);
    if (step % 2 === 1) mix.add(clap(), f, 0.5 * g);
    if (withLead) mix.add(square(RUNUP[step % RUNUP.length]), f, 0.9 * g);
    if (step % 4 === 0) mix.add(bass(82.4, 0.2), f, 0.7 * g); // E2
  }
};

// TITLE — REC beep, the drive spools up
mix.add(impact(), 0, 0.9);
mix.add(sub(82.4, 1.4), 0, 0.7);
mix.add(blip(880, 0.1), 2, 0.6); // ● REC
mix.add(blip(880, 0.1), 32, 0.4); // rec blink
drive(BAR / 2, START.run, 0.8, false); // drums only — lead waits for the run
mix.add(riser(0.8), START.run - 18, 0.7);

// RUN — full drive + a rising blip per split, dings on golds
drive(START.run, START.wr, 1.0);
SPLITS.forEach((sp, i) => {
  mix.add(blip(523 + i * 88, 0.1), START.run + sp.at, 0.7);
  if (sp.gold) mix.add(ding(), START.run + sp.at + 4, 0.7);
});
mix.add(riser(0.7), START.wr - 16, 0.8);

// WR — full stop, then the fanfare
mix.add(impact(), START.wr, 1.0);
mix.add(crash(), START.wr, 0.5);
mix.add(sub(82.4, 1.4), START.wr, 0.9);
mix.add(stinger(330, 1.5), START.wr + 6, 0.95); // E4 fanfare
// victory arpeggio: E G B E climbing fast
[330, 392, 494, 659, 784, 988].forEach((n, i) => mix.add(square(n, 0.12), START.wr + 22 + i * 4, 0.8));
mix.add(ding(), START.wr + 50, 0.7);
mix.add(riser(0.8), START.cta - 18, 0.75);

// CTA — drive returns, one gear higher
mix.add(crash(), START.cta, 0.5);
mix.add(stinger(196, 1.4), START.cta + 4, 0.9);
mix.add(sub(98, 1.3), START.cta + 4, 0.85);
drive(START.cta, TOTAL - 10, 1.05);
mix.add(whoosh(0.35), START.cta + 40, 0.6); // button lands
mix.add(ding(), TOTAL - 22, 0.65);

const master = mix.finalize();

export const ensureSpeedrunAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "speedrun.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureSpeedrunAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "speedrun.wav present." : `Wrote speedrun.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
