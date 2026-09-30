// TIER LIST — sound bed. Synthesized (promo/audio-lib.mjs), seeded by the
// Mixer name, timed off src/lab/tierlist/grid.json. No voice. A 120 BPM groove
// (one beat = 15 frames) runs the whole 9s so there is never dead air; a
// stinger opens on frame 0 and an impact lands with the ask slam.
//
//   node lab/tierlist-audio.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, bass, blip, crash, ding, encodeWav, hat, impact, kick, pluck, stinger, sub, whoosh } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "tierlist", "grid.json"), "utf8"));
export const TIERLIST_WAV = path.join(dir, "..", "public", "promo", "lab-tierlist.wav");

export const ensureTierListAudio = () => {
  const mix = new Mixer("lab-tierlist", G.total, G.fps);
  const ROOTS = [55, 43.65, 65.41, 49];
  const ARP = [
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [261.63, 329.63, 392],
    [196, 246.94, 293.66],
  ];
  for (let f = 0, b = 0; f < G.total; f += 15, b++) {
    const chord = Math.floor(b / 4) % 4;
    if (b % 2 === 0) mix.add(kick(), f, 0.36);
    mix.add(hat(b % 4 === 3), f + 7, 0.1);
    mix.add(hat(), f, 0.06);
    if (b % 4 === 0) mix.add(bass(ROOTS[chord], 0.9), f, 0.42);
    if (b % 4 === 2) mix.add(bass(ROOTS[chord] * 1.5, 0.4), f, 0.28);
    mix.add(pluck(ARP[chord][b % 3], 0.16), f + (b % 2 ? 7 : 0), 0.1);
  }
  mix.add(stinger(220, 1.2), 0, 0.55);
  mix.add(impact(), 0, 0.6);
  mix.add(sub(49, 0.6), 0, 0.4);
  // a soft whoosh with every light sweep
  for (let f = G.sweep; f < G.total; f += G.sweep) mix.add(whoosh(0.3), f - 6, 0.2);
  mix.add(impact(), G.askAt, 0.9);
  mix.add(crash(), G.askAt, 0.35);
  mix.add(ding(), G.askAt + 10, 0.4);
  for (let f = G.askAt + 30; f < G.total; f += 20) mix.add(blip(620, 0.06), f, 0.12);
  mkdirSync(path.dirname(TIERLIST_WAV), { recursive: true });
  writeFileSync(TIERLIST_WAV, encodeWav(mix.finalize()));
  console.log(`  → ${TIERLIST_WAV}`);
  return TIERLIST_WAV;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) ensureTierListAudio();
