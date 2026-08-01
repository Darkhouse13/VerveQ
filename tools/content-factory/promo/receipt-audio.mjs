// "RECEIPT" soundtrack — a till printer scoring its own video: dot-matrix
// zips per printed line (tick runs), paper-feed motor breaths, a light 120
// BPM (15 frames per beat) groove underneath, the till bell + coin drop on
// TOTAL OWED, a sharp rip at the tear, and the stamp as the final impact.
// Every constant mirrors src/promo/receipt/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, impact, whoosh, riser, stinger, blip, tick, ding } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 15; // 120 BPM
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/receipt/timeline.ts
const TOTAL = 400;
const LINE_STARTS = [8, 22, 36, 48, 76, 104, 132, 160, 188, 214, 226, 252, 262, 280];
const TOTAL_LINE_AT = 226;
const CTA_LINE_AT = 280;
const PRINT_FRAMES = 14;
const BARCODE_AT = 298;
const TEAR_AT = 322;
const STAMP_AT = 344;

const mix = new Mixer("receipt", TOTAL, FPS);

// open on the printer waking up (hook is already on screen)
mix.add(impact(), 0, 0.8);
mix.add(sub(55, 1.4), 0, 0.6); // A1
mix.add(whoosh(0.6), 0, 0.35); // feed motor spin-up

// dot-matrix zip per line: a tick every frame across the sweep + motor breath
for (const at of LINE_STARTS) {
  mix.add(whoosh(0.35), at, 0.22);
  for (let f = 0; f < PRINT_FRAMES; f += 1) mix.add(tick(), at + f, 0.24 + (f % 2) * 0.08);
  mix.add(blip(392, 0.05), at + PRINT_FRAMES, 0.3); // line committed
}

// light groove under the printing — enters after the first item line
const A1 = 55, C2 = 65.4;
let step = 0;
for (let f = 48; f < TEAR_AT - 6; f += BEAT, step++) {
  mix.add(kick(), f, 0.55);
  mix.add(hat(), f + BEAT / 2, 0.22);
  if (step % 2 === 1) mix.add(clap(), f, 0.3);
  if (step % 4 === 0) mix.add(bass(step % 8 === 0 ? A1 : C2, 0.26), f, 0.6);
}

// TOTAL OWED — the till bell + coin drop
mix.add(ding(), TOTAL_LINE_AT + PRINT_FRAMES, 0.85);
mix.add(blip(988, 0.08), TOTAL_LINE_AT + PRINT_FRAMES + 4, 0.5);
mix.add(blip(784, 0.08), TOTAL_LINE_AT + PRINT_FRAMES + 8, 0.45);
mix.add(clap(), TOTAL_LINE_AT + PRINT_FRAMES, 0.4);

// the CTA line gets its own committed thunk
mix.add(impact(), CTA_LINE_AT + PRINT_FRAMES, 0.5);
mix.add(blip(659, 0.1), CTA_LINE_AT + PRINT_FRAMES, 0.5);

// barcode: one long zip
for (let f = 0; f < 8; f += 1) mix.add(tick(), BARCODE_AT + f, 0.3);
mix.add(riser(0.7), TEAR_AT - 18, 0.65);

// the TEAR — sharp rip (two fast noise bells + a low thud), music stops dead
mix.add(whoosh(0.16), TEAR_AT, 1.0);
mix.add(whoosh(0.22), TEAR_AT + 3, 0.8);
mix.add(impact(), TEAR_AT + 4, 0.7);
mix.add(sub(49, 1.0), TEAR_AT + 4, 0.7);

// the STAMP — the payoff hit, then a tidy close
mix.add(impact(), STAMP_AT, 1.0);
mix.add(clap(), STAMP_AT, 0.7);
mix.add(sub(41.2, 1.4), STAMP_AT, 0.9);
mix.add(stinger(220, 1.3), STAMP_AT + 4, 0.8); // A3
for (let f = STAMP_AT + BEAT; f < TOTAL - 12; f += BEAT) {
  mix.add(kick(), f, 0.6);
  mix.add(hat(), f + BEAT / 2, 0.25);
}
mix.add(ding(), TOTAL - 22, 0.7); // filed.

const master = mix.finalize();

export const ensureReceiptAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "receipt.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureReceiptAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "receipt.wav present." : `Wrote receipt.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
