// DILEMMA-WEEKLY v2 beds — a separate generator from dilemma-audio.mjs on
// purpose: the v1 beds back the POST-AS-BUILT paid-vs-organic twin, and the
// bec8ab1 lesson (a shared generator reseeded every shipped bed 3h27m after
// they went out) says the frozen lane and the moving lane never share one.
// Same instrument, shorter runway: a tick on every second of the 13.4s
// runtime (the drain bar and decide clock drawn as sound), row-nudge kicks on
// the grid's rowStep, the 3-2-1 on the v2 count scene's 30f step, and the
// closer stinger under a clock that keeps ticking — the decision does not get
// made here. Seeded per edition from its slug (the 2026-08-01 SFX ruling), so
// editions never share a noise bed and none drifts when another re-renders.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, impact, whoosh, riser, stinger, crash, blip, tick, ding } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const GRID = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "grid.json"), "utf8"));
const FACTS = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "dilemma-v2-facts.json"), "utf8"));
const OUT = path.join(dir, "..", "public", "promo");
const FPS = GRID.fps;

const buildOne = (ed) => {
  const g = GRID[ed.grid];
  if (!g) throw new Error(`dilemma-v2-audio: no grid "${ed.grid}" for ${ed.slug}`);
  const START = {};
  let acc = 0;
  for (const s of g.scenes) {
    START[s.key] = acc;
    acc += s.dur;
  }
  const TOTAL = acc; // 402
  const ROW_STEP = g.rowStep;

  const out = path.join(OUT, `${ed.slug}.wav`);
  if (existsSync(out)) return;
  mkdirSync(OUT, { recursive: true });
  const mix = new Mixer(ed.slug, TOTAL, FPS);

  // the clock: a tick on every second, landing ON frame 0 — the piece is
  // already running when the viewer arrives
  for (let f = 0; f < TOTAL; f += FPS) mix.add(tick(), f, f === 0 ? 0.85 : 0.62);

  // task: the question is already up — one low sub to seat it, no slam-in
  mix.add(sub(46.2, 1.0), 0, 0.8);

  // sides: the card lights, then the row nudges land on the grid cadence —
  // there is no spoken read at this length; the bed carries the alternation
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
    mix.add(blip(660 - side.players.length * 40, 0.1), START[key] + 6 + side.players.length * ROW_STEP, 0.4);
  }

  // count: 3-2-1 on the v2 composition's 30f step, rising
  for (let i = 0; i < 3; i++) {
    const f = START.count + i * 30;
    mix.add(impact(), f, 0.85 + i * 0.05);
    mix.add(sub(41.2 + i * 2, 0.7), f, 0.6);
  }
  mix.add(riser(0.8), START.count + 34, 0.6);

  // closer: flash crash + stinger, the clock still ticking under it
  mix.add(crash(), START.closer, 0.5);
  mix.add(kick(), START.closer, 1.0);
  mix.add(stinger(196, 1.2), START.closer + 8, 0.72);
  mix.add(sub(49, 0.9), START.closer + 16, 0.68);

  writeFileSync(out, encodeWav(mix.finalize()));
  console.log(`  → ${out}`);
};

export const ensureWkndDilemmaV2Audio = (slug) => () => {
  const ed = FACTS.editions.find((e) => e.slug === slug);
  if (!ed) throw new Error(`dilemma-v2-audio: no edition "${slug}"`);
  buildOne(ed);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) for (const ed of FACTS.editions) buildOne(ed);
