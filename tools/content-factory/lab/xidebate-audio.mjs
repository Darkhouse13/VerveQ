// XI DEBATE — sound bed. Synthesized (promo/audio-lib.mjs), seeded by the
// Mixer name, timed off src/lab/xidebate/grid.json. No voice. A 120 BPM groove
// under the whole 16s (never dead air); a kick + rising blip on every pair
// that lands; an impact when the question opens; a soft pulse with the
// spotlight that walks the slots afterwards.
//
//   node lab/xidebate-audio.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, bass, blip, crash, ding, encodeWav, hat, impact, kick, pluck, riser, stinger, sub } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const G = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "xidebate", "grid.json"), "utf8"));
export const XIDEBATE_WAV = path.join(dir, "..", "public", "promo", "lab-xidebate.wav");

export const ensureXIDebateAudio = () => {
  const mix = new Mixer("lab-xidebate", G.total, G.fps);
  const ROOTS = [49, 55, 43.65, 65.41];
  const ARP = [
    [196, 246.94, 293.66],
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [261.63, 329.63, 392],
  ];
  for (let f = 0, b = 0; f < G.total; f += 15, b++) {
    const chord = Math.floor(b / 8) % 4;
    if (b % 2 === 0) mix.add(kick(), f, 0.3);
    mix.add(hat(b % 4 === 3), f + 7, 0.09);
    if (b % 4 === 0) mix.add(bass(ROOTS[chord], 0.9), f, 0.38);
    mix.add(pluck(ARP[chord][b % 3], 0.16), f + (b % 2 ? 7 : 0), 0.08);
  }
  mix.add(stinger(196, 1.1), 0, 0.5);
  G.order.forEach((_, k) => {
    const at = Math.max(0, G.landAt + k * G.step);
    mix.add(kick(), at, 0.75);
    mix.add(impact(), at, 0.45);
    mix.add(blip(360 + k * 30, 0.08), at + 3, 0.28);
  });
  mix.add(riser(1.2), G.askAt - 36, 0.45);
  mix.add(impact(), G.askAt, 1);
  mix.add(crash(), G.askAt, 0.4);
  mix.add(sub(41, 1.1), G.askAt, 0.55);
  mix.add(ding(), G.askAt + 12, 0.45);
  for (let f = G.askAt + 18; f < G.total; f += 18) mix.add(blip(560, 0.06), f, 0.14);
  mkdirSync(path.dirname(XIDEBATE_WAV), { recursive: true });
  writeFileSync(XIDEBATE_WAV, encodeWav(mix.finalize()));
  console.log(`  → ${XIDEBATE_WAV}`);
  return XIDEBATE_WAV;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) ensureXIDebateAudio();
