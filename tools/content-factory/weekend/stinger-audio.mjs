// "WKND-STINGER" soundtrack — 120 BPM (15 frames per beat), 8.0s. A kick +
// bass hit per drum line, a big stinger on the lockup, a riser into LATE
// AUGUST, impact + whoosh on the CTA button, then stillness for the tail so
// the ident loops/cuts clean. Arranged on the same grid as
// src/weekend/stinger/timeline.ts — re-time one, re-time both.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, impact, whoosh, riser, stinger, crash } from "../promo/audio-lib.mjs";

const FPS = 30;
const BEAT = 15; // 120 BPM
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/weekend/stinger/timeline.ts
const SCENES = [["drum", 60], ["lock", 75], ["date", 60], ["cta", 45]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 240

const mix = new Mixer(TOTAL, FPS);

// DRUM — two lines, a hit per line, hats on the off-beats between
for (let i = 0; i < 2; i++) {
  const f = i * BEAT * 2;
  mix.add(kick(), f, 1.0);
  mix.add(bass(41.2 * (i === 0 ? 1 : 1.5), 0.36), f, 0.9); // E1 → B1
  mix.add(clap(), f, i === 1 ? 0.65 : 0);
  mix.add(hat(), f + BEAT, 0.5);
}

// LOCK — the wordmark lands: crash + impact + D3 stinger, sub underneath
mix.add(crash(), START.lock, 0.5);
mix.add(impact(), START.lock + 8, 1.0); // the Slam delay on the lockup
mix.add(stinger(146.83, 1.5), START.lock + 8, 0.9);
mix.add(sub(36.7, 1.4), START.lock + 8, 0.9);
mix.add(whoosh(0.35), START.lock + 28, 0.55); // subline wipes in

// riser into DATE
mix.add(riser(0.8), START.date - 20, 0.8);

// DATE — LATE AUGUST hits; a light pulse keeps it alive
mix.add(impact(), START.date, 0.95);
mix.add(sub(41.2, 1.0), START.date, 0.85);
for (let f = START.date; f < START.cta; f += BEAT) mix.add(hat(), f + BEAT / 2, 0.4);
mix.add(kick(), START.date + BEAT * 2, 0.8);
mix.add(clap(), START.date + 26, 0.6); // JOIN THE WAITLIST pill

// CTA — button lands, then TRUE stillness for the loopable tail
mix.add(crash(), START.cta, 0.45);
mix.add(kick(), START.cta, 1.0);
mix.add(whoosh(0.3), START.cta + 6, 0.55);
mix.add(stinger(220, 1.1), START.cta + 6, 0.7); // A3 — VERVEQ.COM
mix.add(sub(55, 0.9), START.cta + 6, 0.8);
// nothing after ~f230 — the freeze is audible too.

const master = mix.finalize();

export const ensureWkndStingerAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "wknd-stinger.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureWkndStingerAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "wknd-stinger.wav present." : `Wrote wknd-stinger.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
