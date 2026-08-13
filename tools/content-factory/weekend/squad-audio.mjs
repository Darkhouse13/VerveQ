// "WKND-SQUAD" bed — the board's own noises: a till-ding per signing, the
// budget draining as a falling blip, the red-math buzz, mixed low under
// Charlie. Scene frames + starStep from grid.json.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, impact, whoosh, riser, stinger, crash, blip, tick, buzz, ding } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const GRID = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "grid.json"), "utf8"));
const OUT = path.join(dir, "..", "public", "promo");
const FPS = GRID.fps;

const START = {};
let acc = 0;
for (const s of GRID.squad.scenes) {
  START[s.key] = acc;
  acc += s.dur;
}
const TOTAL = acc; // 2400
const STEP = GRID.squad.starStep;

export const ensureWkndSquadAudio = () => {
  const out = path.join(OUT, "wknd-squad.wav");
  if (existsSync(out)) return;
  mkdirSync(OUT, { recursive: true });
  const mix = new Mixer("wknd-squad", TOTAL, FPS);

  // open: 91.0 lands
  mix.add(impact(), 0, 0.95);
  mix.add(sub(41.2, 1.2), 0, 0.85);
  mix.add(whoosh(0.3), 22, 0.5); // LET'S BUILD pill

  // four signings: kick + till-ding + a falling blip as the bar drains
  for (let i = 0; i < 4; i++) {
    const f = START.stars + i * STEP;
    mix.add(kick(), f, 0.9);
    mix.add(ding(), f + 3, 0.6);
    mix.add(blip(700 - i * 120, 0.12), f + 12, 0.4); // 700→340Hz: the budget falling
  }

  mix.add(riser(0.7), START.math - 20, 0.7);
  mix.add(impact(), START.math, 0.95);
  mix.add(buzz(0.5), START.math + 110, 0.75); // 4.5 A SHIRT, in red
  mix.add(sub(36.7, 1.2), START.math + 110, 0.8);

  // tradeoff: the hot card rotates every 90f — a tense tick each turn
  mix.add(impact(), START.tradeoff, 0.85);
  for (let f = START.tradeoff + 90; f < START.gems; f += 90) mix.add(tick(), f, 0.5);

  // gems: three cheap dings (they're 4.0s — the till barely rings)
  for (let i = 0; i < 3; i++) mix.add(ding(), START.gems + 30 + i * 70, 0.55);
  mix.add(impact(), START.gems, 0.8);

  mix.add(impact(), START.withhold, 0.9);
  mix.add(buzz(0.35), START.withhold + 70, 0.6); // WHO GOES? COMMENTS.

  mix.add(crash(), START.cta, 0.5);
  mix.add(kick(), START.cta, 1.0);
  mix.add(stinger(196, 1.2), START.cta + 8, 0.75);
  mix.add(sub(49, 0.9), START.cta + 14, 0.75);
  // still tail

  writeFileSync(out, encodeWav(mix.finalize()));
  console.log(`  → ${out}`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) ensureWkndSquadAudio();
