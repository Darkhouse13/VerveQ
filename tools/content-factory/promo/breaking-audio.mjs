// "BREAKING" soundtrack — 112.5 BPM (16 frames per beat) newsroom urgency.
// A two-note alarm sting opens it, typewriter ticks score the headline typing
// itself out, a driving pulse builds through the "report", the OFFICIAL turn
// gets the big stinger, and DONE DEAL closes on a full four-on-floor.
// Arranged on the same grid as src/promo/breaking/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, impact, whoosh, riser, stinger, crash, blip, tick, ding, buzz } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 16; // 112.5 BPM
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/breaking/timeline.ts
const SCENES = [["alert", 80], ["stats", 64], ["official", 64], ["deal", 64], ["cta", 96]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 368

const mix = new Mixer("breaking", TOTAL, FPS);

// ALERT — news sting + typewriter
mix.add(impact(), 0, 0.9);
mix.add(sub(55, 1.4), 0, 0.6);
for (let i = 0; i < 4; i++) { // two-note alarm motif
  mix.add(blip(659, 0.1), i * 8, 0.5);
  mix.add(blip(523, 0.1), i * 8 + 4, 0.4);
}
for (let f = 2; f < 44; f += 2) mix.add(tick(), f, 0.3); // headline typing
for (let f = BEAT; f < START.stats; f += BEAT) mix.add(kick(), f, 0.7); // pulse creeps in
mix.add(impact(), 46, 0.95); // "FOR THE 47TH TIME."
mix.add(clap(), 46, 0.7);

// GROOVE — urgent newsroom pulse from stats through deal: kick every beat,
// insistent A1 bass eighths, offbeat hats
const GS = START.stats;
const GE = START.cta;
for (let f = GS; f < GE; f += BEAT) {
  mix.add(kick(), f, 0.95);
  mix.add(hat(), f + BEAT / 2, 0.5);
  mix.add(bass(55, 0.3), f, 0.8);
  mix.add(bass(55, 0.22), f + BEAT / 2, 0.55);
}
for (let f = GS; f < GE; f += BEAT * 4) mix.add(clap(), f + BEAT * 2, 0.7);

// STATS — chips land; the 0 gets a buzz
mix.add(whoosh(0.4), GS - 4, 0.6);
mix.add(buzz(0.35), GS + 8, 0.6); // ARGUMENTS WON: 0
mix.add(blip(494), GS + 20, 0.5); // SELF-RATING: EXPERT
mix.add(blip(392), GS + 32, 0.5); // EVIDENCE: NONE
mix.add(riser(0.9), START.official - 24, 0.8);

// OFFICIAL — the turn
mix.add(impact(), START.official, 1.0); // "OFFICIAL:"
mix.add(stinger(164.8, 1.3), START.official, 0.85); // E3
mix.add(sub(41.2, 1.2), START.official, 0.9);
mix.add(crash(), START.official, 0.45);
mix.add(impact(), START.official + 16, 0.75); // "THERE'S NOW A WAY"
mix.add(ding(), START.official + 34, 0.9); // "HERE WE GO."
mix.add(clap(), START.official + 34, 0.7);

// DEAL — terms land on plucky hits
mix.add(whoosh(0.35), START.deal - 4, 0.6);
for (let i = 0; i < 3; i++) mix.add(blip(440 + i * 110), START.deal + 8 + i * 12, 0.55);
mix.add(riser(0.8), START.cta - 20, 0.8);

// CTA — DONE DEAL: full payoff
mix.add(crash(), START.cta, 0.55);
mix.add(impact(), START.cta + 4, 1.0); // "DONE DEAL."
mix.add(stinger(146.83, 1.5), START.cta + 4, 0.95); // D3
mix.add(sub(36.7, 1.4), START.cta + 4, 1.0);
for (let f = START.cta; f < TOTAL - 8; f += BEAT) {
  mix.add(kick(), f, 1.0);
  mix.add(hat(), f + BEAT / 2, 0.55);
}
for (let f = START.cta; f < TOTAL - 8; f += BEAT * 4) mix.add(clap(), f + BEAT * 2, 0.75);
for (let f = START.cta + BEAT; f < TOTAL - 8; f += BEAT) mix.add(bass(36.7, 0.3), f, 0.85);
mix.add(whoosh(0.35), START.cta + 34, 0.6); // button lands

const master = mix.finalize();

export const ensureBreakingAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "breaking.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureBreakingAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "breaking.wav present." : `Wrote breaking.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
