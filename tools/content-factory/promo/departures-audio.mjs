// "DEPARTURES" soundtrack — a Solari board scoring itself: airport room tone,
// a PA two-tone on open, a dense mechanical flap-clatter burst as each row
// spins (decaying tick runs + soft rattle), a settle thunk per row, then the
// triple boarding chime and a light 120 BPM groove under the FINAL BOARDING
// CALL. Every constant mirrors src/promo/departures/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, pluck, hat, impact, whoosh, riser, blip, tick, ding } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 15; // 120 BPM
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/departures/timeline.ts
const TOTAL = 390;
const ROW_STARTS = [10, 62, 114, 166, 216, 268];
const DEST_LEN = 15, STATUS_LEN = 9, STAGGER = 1.6, SPIN_FRAMES = 26;
const BOARDING_AT = 268;
const ROW_SETTLE = Math.round((DEST_LEN + STATUS_LEN) * STAGGER + SPIN_FRAMES); // ≈ 64

const mix = new Mixer("departures", TOTAL, FPS);

// airport room tone — overlapping long noise bells, very low
for (let f = 0; f < TOTAL - 40; f += 55) mix.add(whoosh(2.2), f, 0.14);

// PA two-tone on open (the hook is already on screen)
mix.add(pluck(659, 0.5), 2, 0.7); // E5
mix.add(pluck(523, 0.6), 14, 0.65); // C5
mix.add(sub(65.4, 1.6), 2, 0.5);

// each row: flap clatter that decays as cells settle, then a thunk
for (const at of ROW_STARTS) {
  for (let f = 0; f < ROW_SETTLE; f += 2) {
    const decay = 1 - f / (ROW_SETTLE * 1.15);
    mix.add(tick(), at + f, 0.42 * decay);
    if (f % 6 === 0) mix.add(hat(), at + f + 1, 0.16 * decay);
  }
  mix.add(impact(), at + ROW_SETTLE, 0.4); // the row locks in
  mix.add(blip(330, 0.08), at + ROW_SETTLE, 0.4);
}

// a low pulse keeps time between rows (pre-groove heartbeat)
for (let f = BEAT; f < BOARDING_AT; f += BEAT * 2) mix.add(kick(), f, 0.3);
mix.add(riser(0.9), BOARDING_AT - 20, 0.6);

// FINAL BOARDING CALL — triple rising chime + the groove finally lands
mix.add(pluck(523, 0.4), BOARDING_AT, 0.8);
mix.add(pluck(659, 0.4), BOARDING_AT + 8, 0.8);
mix.add(pluck(784, 0.6), BOARDING_AT + 16, 0.9); // C-E-G boarding triad
mix.add(sub(65.4, 1.5), BOARDING_AT + 16, 0.8);
let step = 0;
for (let f = BOARDING_AT + 24; f < TOTAL - 12; f += BEAT, step++) {
  mix.add(kick(), f, 0.7);
  mix.add(hat(), f + BEAT / 2, 0.3);
  if (step % 4 === 0) mix.add(bass(65.4, 0.28), f, 0.7);
}
mix.add(ding(), TOTAL - 24, 0.7); // doors closing.

const master = mix.finalize();

export const ensureDeparturesAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "departures.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureDeparturesAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "departures.wav present." : `Wrote departures.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
