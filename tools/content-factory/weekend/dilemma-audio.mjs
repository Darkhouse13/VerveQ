// "the-dilemma" beds — one per edition, each seeded from its own slug (the
// 2026-08-01 SFX seed ruling: Mixer seeds per piece from its stable name, so
// two editions never share a noise bed and neither drifts when the other is
// re-rendered). No trending sound: this format is narrated, and the 2026-08-01
// ruling puts every voiced format on original audio.
//
// The clock is the instrument. A tick lands on every second for the whole
// runtime — the drain bar and the decide clock are doing the same thing
// visually, so the bed and the picture are the same metronome. Everything else
// is the grid's own cadences (row lands, the 3-2-1, the closer stinger).
// Frame math from grid.json — the one timing truth; re-time the grid and this
// follows.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, impact, whoosh, riser, stinger, crash, blip, tick, ding } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const GRID = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "grid.json"), "utf8"));
const FACTS = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "dilemma-facts.json"), "utf8"));
const OUT = path.join(dir, "..", "public", "promo");
const FPS = GRID.fps;

const buildOne = (ed) => {
  const g = GRID[ed.id === "d1" ? "dilemma1" : "dilemma2"];
  const START = {};
  let acc = 0;
  for (const s of g.scenes) {
    START[s.key] = acc;
    acc += s.dur;
  }
  const TOTAL = acc; // 600
  const ROW_STEP = g.rowStep;

  const out = path.join(OUT, `${ed.slug}.wav`);
  if (existsSync(out)) return;
  mkdirSync(OUT, { recursive: true });
  const mix = new Mixer(ed.slug, TOTAL, FPS);

  // the clock: a tick on every second of the whole runtime, landing ON frame 0
  // so the piece is already running when the viewer arrives
  for (let f = 0; f < TOTAL; f += FPS) mix.add(tick(), f, f === 0 ? 0.85 : 0.62);

  // task: the question is already up — one low sub to seat it, no slam-in
  mix.add(sub(46.2, 1.0), 0, 0.8);

  // sides: the card lights, then one row lands per rowStep
  for (const [key, side] of [
    ["sideA", ed.sides[0]],
    ["sideB", ed.sides[1]],
  ]) {
    mix.add(impact(), START[key], 0.9);
    mix.add(whoosh(0.28), START[key], 0.45);
    side.players.forEach((_, i) => {
      const f = START[key] + 6 + i * ROW_STEP;
      mix.add(kick(), f, 0.85);
      mix.add(ding(), f + 2, 0.5);
    });
    // the side's price plate reading, a beat after the last row
    mix.add(blip(660 - side.players.length * 40, 0.1), START[key] + 6 + side.players.length * ROW_STEP, 0.4);
  }

  // count: 3-2-1 on the composition's 36f step, rising, then the cut to the
  // closer lands where a resolution would have been — and isn't one
  for (let i = 0; i < 3; i++) {
    const f = START.count + i * 36;
    mix.add(impact(), f, 0.85 + i * 0.05);
    mix.add(sub(41.2 + i * 2, 0.7), f, 0.6);
  }
  mix.add(riser(1.0), START.count + 40, 0.6);

  // closer: flash crash + stinger, and the clock keeps ticking under it —
  // the decision does not get made here
  mix.add(crash(), START.closer, 0.5);
  mix.add(kick(), START.closer, 1.0);
  mix.add(stinger(196, 1.2), START.closer + 10, 0.72);
  mix.add(sub(49, 0.9), START.closer + 20, 0.68);

  writeFileSync(out, encodeWav(mix.finalize()));
  console.log(`  → ${out}`);
};

export const ensureWkndDilemmaAudio = (slug) => () => {
  const ed = FACTS.editions.find((e) => e.slug === slug);
  if (!ed) throw new Error(`dilemma-audio: no edition "${slug}"`);
  buildOne(ed);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) for (const ed of FACTS.editions) buildOne(ed);
