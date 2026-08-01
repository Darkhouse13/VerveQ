// "LICENSE" soundtrack — ~95 BPM (19 frames per beat) dry bureaucratic march:
// tight kick, rimshot-dry tick backbeat (the rubber stamps ARE the
// percussion), typewriter rolls under the form fields, a ding per qualifying
// checkbox, a buzz for DENIED, and a tidy stamped-and-filed payoff.
// Arranged on the same grid as src/promo/license/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, impact, whoosh, riser, stinger, crash, blip, tick, ding, buzz } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 19; // ~95 BPM
const BAR = 76;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/license/timeline.ts
const SCENES = [["decree", 76], ["card", 95], ["reqs", 95], ["denied", 76], ["cta", 114]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 456

const mix = new Mixer("license", TOTAL, FPS);

// the march: kick 1 & 3, dry tick backbeat on 2 & 4 (stamp-stamp), spare bass
const march = (from, to, g = 1.0) => {
  for (let f = from; f < to; f += BAR) {
    mix.add(kick(), f, 0.9 * g);
    mix.add(kick(), f + BEAT * 2, 0.75 * g);
    mix.add(tick(), f + BEAT, 0.9 * g); // the stamp backbeat
    mix.add(tick(), f + BEAT * 3, 0.9 * g);
    mix.add(clap(), f + BEAT * 3, 0.35 * g);
    mix.add(bass(49, 0.34), f, 0.8 * g); // G1, dutiful
    mix.add(bass(49, 0.26), f + BEAT * 2, 0.6 * g);
    mix.add(hat(), f + BEAT / 2, 0.35 * g);
    mix.add(hat(), f + BEAT * 2 + BEAT / 2, 0.35 * g);
  }
};

// DECREE — gavel hit, the march assembles
mix.add(impact(), 0, 0.95); // the notice is already on screen
mix.add(sub(49, 1.6), 0, 0.7);
march(0, START.card);
mix.add(impact(), 40, 0.85); // "EFFECTIVE IMMEDIATELY."
mix.add(clap(), 40, 0.7);

// CARD — form fields type in over the march
march(START.card, START.reqs, 0.9);
mix.add(whoosh(0.4), START.card - 4, 0.6);
for (const at of [14, 34, 52, 64]) { // field starts (mirror scenes.tsx)
  for (let f = 0; f < 10; f += 2) mix.add(tick(), START.card + at + f, 0.3); // typing
  mix.add(blip(494, 0.1), START.card + at, 0.4);
}

// REQS — a ding per checked box
march(START.reqs, START.denied, 0.95);
mix.add(whoosh(0.4), START.reqs - 4, 0.6);
const CHECKS = [14, 38, 62];
CHECKS.forEach((at, i) => {
  mix.add(impact(), START.reqs + at, 0.5);
  mix.add(ding(), START.reqs + at + 10, 0.8 + i * 0.05); // the ✓ fills
});
mix.add(riser(0.9), START.denied - 20, 0.75);

// DENIED — the gag: march stops dead, stamp + buzz
mix.add(impact(), START.denied, 0.9);
mix.add(sub(41.2, 1.2), START.denied, 0.85);
mix.add(impact(), START.denied + 22, 1.0); // DENIED stamp
mix.add(buzz(0.55), START.denied + 22, 0.9);
mix.add(crash(), START.denied + 22, 0.45);
mix.add(tick(), START.denied + 46, 0.8); // "REASON: VIBES ONLY." — one dry stamp
mix.add(blip(294, 0.12), START.denied + 46, 0.5);
mix.add(riser(0.8), START.cta - 18, 0.8);

// CTA — stamped, filed, approved: full march + stinger
mix.add(crash(), START.cta, 0.5);
mix.add(stinger(196, 1.4), START.cta + 4, 0.9); // G3 — "EARN YOURS."
mix.add(sub(49, 1.3), START.cta + 4, 0.9);
march(START.cta, TOTAL - 10, 1.1);
mix.add(whoosh(0.35), START.cta + 36, 0.6); // button lands
mix.add(ding(), TOTAL - 26, 0.7); // approved.

const master = mix.finalize();

export const ensureLicenseAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "license.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureLicenseAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "license.wav present." : `Wrote license.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
