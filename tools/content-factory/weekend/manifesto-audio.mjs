// "WKND-MANIFESTO" soundtrack — ~128.6 BPM (14 frames per beat), 18.6s.
// Half-time menace under the struck-through pains (a buzz rides each strike),
// twin impacts on the flip, the four-on-floor arrives WITH the creed's payoff
// line, a rising blip per mechanic shape, riser → TRUE SILENCE for the
// deadpan ("the waitlist is open." — the cut to nothing is the hook, Anthem's
// law), then the full payoff under the CTA. Arranged on the same grid as
// src/weekend/manifesto/timeline.ts — re-time one, re-time both.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, pluck, impact, whoosh, riser, stinger, crash, blip, buzz } from "../promo/audio-lib.mjs";

const FPS = 30;
const BEAT = 14; // ~128.6 BPM
const LINE = BEAT * 2;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/weekend/manifesto/timeline.ts
const SCENES = [["grind", 112], ["flip", 56], ["creed", 84], ["shapes", 140], ["deadpan", 66], ["cta", 100]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 558

// Post-epoch fix (2026-08-12): name-first Mixer, same reasoning as
// stinger-audio.mjs — the shipped 2026-07-29 MP4 is grandfathered.
const mix = new Mixer("wknd-manifesto", TOTAL, FPS);

// GRIND — half-time menace: kick + minor-root bass per pain, the strike buzzes
const GRIND_ROOTS = [41.2, 43.65, 41.2, 38.89]; // E1 F1 E1 D#1 — uneasy
for (let i = 0; i < 4; i++) {
  const f = i * LINE;
  mix.add(kick(), f, 0.95);
  mix.add(bass(GRIND_ROOTS[i], 0.4), f, 0.85);
  mix.add(buzz(0.22), f + 10, 0.5); // the strike-through lands
  mix.add(hat(), f + BEAT, 0.4);
}

// FLIP — two big hits
mix.add(impact(), START.flip, 1.0); // WE DELETED
mix.add(sub(41.2, 1.0), START.flip, 0.9);
mix.add(impact(), START.flip + LINE, 1.0); // THE LOT.
mix.add(crash(), START.flip + LINE, 0.45);
mix.add(sub(36.7, 1.2), START.flip + LINE, 0.95);

// CREED — the title beat: stinger on line 1, the four-on-floor arrives WITH
// line 2 ("IT'S A WEEKEND.") and runs to the riser
mix.add(stinger(146.83, 1.3), START.creed, 0.85); // D3
mix.add(sub(36.7, 1.2), START.creed, 0.85);
const PAYOFF = START.creed + LINE * 1.5; // 42f in — mirror of scenes.tsx `second`
mix.add(crash(), PAYOFF, 0.5);
mix.add(impact(), PAYOFF, 0.95);
for (let f = PAYOFF; f < START.shapes; f += BEAT) {
  mix.add(kick(), f, 1.0);
  mix.add(hat(), f + BEAT / 2, 0.5);
}

// SHAPES — kick per beat, a rising blip + alternating bass per card, arp on top
const ARP = [293.7, 349.2, 440, 587.3]; // D4 F4 A4 D5
for (let f = START.shapes, k = 0; f < START.deadpan - 4; f += BEAT, k++) {
  mix.add(kick(), f, 0.95);
  mix.add(hat(), f + BEAT / 2, 0.5);
  mix.add(pluck(ARP[k % ARP.length]), f, 0.4);
}
for (let i = 0; i < 5; i++) {
  const f = START.shapes + i * LINE;
  mix.add(blip(440 + i * 90), f, 0.55);
  mix.add(bass(36.7 * (i % 2 === 0 ? 1 : 1.5), 0.34), f, 0.8);
  if (i % 2 === 1) mix.add(clap(), f, 0.65);
}
mix.add(riser(0.9), START.deadpan - 26, 0.85);
mix.add(crash(), START.deadpan - 2, 0.35); // the cut itself

// DEADPAN — TRUE SILENCE. that's the hook.

// CTA — everything back at once
const CS = START.cta;
mix.add(crash(), CS, 0.55);
mix.add(impact(), CS, 0.95); // THE WEEKEND lockup
mix.add(stinger(146.83, 1.4), CS, 0.9);
mix.add(sub(36.7, 1.3), CS, 0.9);
for (let f = CS; f < TOTAL - 8; f += BEAT) {
  mix.add(kick(), f, 1.0);
  mix.add(hat(), f + BEAT / 2, 0.55);
}
for (let f = CS; f < TOTAL - 8; f += BEAT * 4) mix.add(clap(), f + BEAT * 2, 0.75);
for (let f = CS, k = 0; f < TOTAL - 8; f += BEAT, k++) mix.add(pluck(ARP[k % ARP.length]), f, 0.4);
for (let f = CS; f < TOTAL - 8; f += BEAT * 2) mix.add(bass(36.7, 0.42), f, 0.85); // D1
mix.add(clap(), CS + 18, 0.6); // LATE AUGUST pill
mix.add(whoosh(0.35), CS + 40, 0.6); // button lands

const master = mix.finalize();

export const ensureWkndManifestoAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "wknd-manifesto.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureWkndManifestoAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "wknd-manifesto.wav present." : `Wrote wknd-manifesto.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
