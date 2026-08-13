// "WKND-REFEREE" bed — metronomic row accents at the standing 7.00s pace,
// mixed low under Charlie. Scene frames + rowStep from grid.json.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, impact, whoosh, riser, stinger, crash, blip, tick, buzz } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const GRID = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "grid.json"), "utf8"));
const OUT = path.join(dir, "..", "public", "promo");
const FPS = GRID.fps;

const START = {};
let acc = 0;
for (const s of GRID.referee.scenes) {
  START[s.key] = acc;
  acc += s.dur;
}
const TOTAL = acc; // 2340
const STEP = GRID.referee.rowStep;

export const ensureWkndRefereeAudio = () => {
  const out = path.join(OUT, "wknd-referee.wav");
  if (existsSync(out)) return;
  mkdirSync(OUT, { recursive: true });
  const mix = new Mixer("wknd-referee", TOTAL, FPS);

  // open: the two plates land, then the claim
  mix.add(impact(), 4, 0.8);
  mix.add(blip(560, 0.08), 4, 0.5);
  mix.add(impact(), 10, 0.8);
  mix.add(blip(740, 0.08), 10, 0.5);
  mix.add(sub(41.2, 1.1), 0, 0.8);
  mix.add(whoosh(0.35), 20, 0.5);

  // six rows, one land per STEP: label tick, then the two value slams
  for (let i = 0; i < 6; i++) {
    const f = START.rows + i * STEP;
    mix.add(tick(), f, 0.5);
    mix.add(kick(), f, 0.8);
    mix.add(blip(560, 0.09), f + 5, 0.45); // lime side
    mix.add(blip(740, 0.09), f + 10, 0.45); // pink side
  }

  mix.add(riser(0.8), START.question - 22, 0.75);
  mix.add(crash(), START.question, 0.5);
  mix.add(impact(), START.question, 0.95);
  mix.add(buzz(0.4), START.question + 130, 0.6); // I'M NOT DECIDING

  mix.add(impact(), START.punch, 0.95);
  mix.add(stinger(146.83, 1.4), START.punch, 0.8);
  mix.add(sub(36.7, 1.3), START.punch, 0.85);
  mix.add(whoosh(0.35), START.punch + 40, 0.5); // manifesto line wipes in

  mix.add(crash(), START.cta, 0.5);
  mix.add(kick(), START.cta, 1.0);
  mix.add(stinger(196, 1.2), START.cta + 8, 0.75);
  mix.add(sub(49, 0.9), START.cta + 34, 0.75);
  // still tail

  writeFileSync(out, encodeWav(mix.finalize()));
  console.log(`  → ${out}`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) ensureWkndRefereeAudio();
