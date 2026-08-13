// "WKND-SETTLEIT" bed — accents only, mixed low under Charlie (narrated
// format, standing rule: no music baked in, trending sound never added to a
// narrated piece). Scene frames come from src/weekend/reels/grid.json — the
// shared timing truth. The per-bubble pop list below MUST mirror
// SETTLEIT_CHAT in src/weekend/reels/timeline.ts — re-time one, re-time both.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, hat, impact, whoosh, riser, stinger, crash, blip, tick, buzz } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const GRID = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "grid.json"), "utf8"));
const OUT = path.join(dir, "..", "public", "promo");
const FPS = GRID.fps;

const START = {};
let acc = 0;
for (const s of GRID.settleit.scenes) {
  START[s.key] = acc;
  acc += s.dur;
}
const TOTAL = acc; // 2400

// bubble pops: [scene, localFrame, side] — mirrors SETTLEIT_CHAT
const POPS = [
  ["open", 0, "L"],
  ["claimA", 8, "L"], ["claimA", 150, "L"],
  ["claimB", 8, "R"], ["claimB", 150, "R"],
  ["dave", 8, "L"], ["dave", 120, "L"], ["dave", 170, "R"], ["dave", 220, "L"], ["dave", 285, "L"],
  ["escalate", 8, "L"], ["escalate", 75, "R"], ["escalate", 150, "L"], ["escalate", 220, "R"],
  ["escalate", 290, "L"], ["escalate", 355, "R"], ["escalate", 420, "V"], ["escalate", 455, "L"],
  ["exit", 120, "R"], ["exit", 170, "L"],
];
const RECEIPTS = [
  ["claimA", 70],
  ["claimB", 70],
  ["dave", 235],
];

export const ensureWkndSettleItAudio = () => {
  const out = path.join(OUT, "wknd-settleit.wav");
  if (existsSync(out)) return;
  mkdirSync(OUT, { recursive: true });
  const mix = new Mixer("wknd-settleit", TOTAL, FPS);

  for (const [scene, at, side] of POPS) {
    const f = START[scene] + at;
    if (side === "V") {
      mix.add(blip(520, 0.09), f, 0.5);
      mix.add(blip(660, 0.09), f + 4, 0.5);
    } else {
      mix.add(blip(side === "R" ? 740 : 560, 0.08), f, 0.55);
    }
  }
  for (const [scene, at] of RECEIPTS) {
    const f = START[scene] + at;
    mix.add(impact(), f, 0.85);
    mix.add(sub(46, 0.9), f, 0.7);
  }
  // escalation heat: sparse ticks that tighten across the scene
  for (let f = START.escalate; f < START.exit; f += 30) mix.add(tick(), f, 0.3);
  // DAVE LEFT THE GROUP — the earned buzz
  mix.add(buzz(0.45), START.exit + 30, 0.7);
  // into the verdict world
  mix.add(riser(0.7), START.turn - 20, 0.7);
  mix.add(impact(), START.turn, 0.95);
  mix.add(sub(41.2, 1.2), START.turn, 0.85);
  mix.add(impact(), START.turn + 120, 0.8); // SCOREBOARD line lands
  mix.add(crash(), START.cta, 0.5);
  mix.add(kick(), START.cta, 1.0);
  mix.add(stinger(196, 1.2), START.cta + 8, 0.75);
  mix.add(whoosh(0.3), START.cta + 30, 0.5);
  mix.add(sub(49, 0.9), START.cta + 30, 0.75);
  // still tail from ~f2380

  writeFileSync(out, encodeWav(mix.finalize()));
  console.log(`  → ${out}`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) ensureWkndSettleItAudio();
