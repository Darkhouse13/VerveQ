// "WKND-42H" bed — the clock is the instrument: a tick every second wherever
// the countdown is on screen (open / rules / cta), card and shirt slams from
// the grid's cadences, the squeeze buzz, and a clean CTA stinger. Mixed low
// under Charlie. All frame math from grid.json — the one timing truth.
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
for (const s of GRID.boost.scenes) {
  START[s.key] = acc;
  acc += s.dur;
}
const TOTAL = acc; // 960
const CARD_STEP = GRID.boost.cardStep;
const SHIRT_STEP = GRID.boost.shirtStep;

export const ensureWkndBoostAudio = () => {
  const out = path.join(OUT, "wknd-42h.wav");
  if (existsSync(out)) return;
  mkdirSync(OUT, { recursive: true });
  const mix = new Mixer("wknd-42h", TOTAL, FPS);

  // open: already mid-motion at frame 0 — a tick lands ON frame 0, sub under
  mix.add(tick(), 0, 0.85);
  mix.add(sub(46.2, 1.0), 0, 0.8);
  for (let f = FPS; f < START.fixtures; f += FPS) mix.add(tick(), f, 0.7); // the clock

  // fixtures: headline slam, GOOD clap-kick, one kick per card, stamp ding
  mix.add(impact(), START.fixtures, 0.95);
  mix.add(kick(), START.fixtures + 24, 0.8); // GOOD.
  for (let i = 0; i < 6; i++) mix.add(kick(), START.fixtures + 40 + i * CARD_STEP, 0.85);
  mix.add(ding(), START.fixtures + 156, 0.6);

  // fill: till-ding + falling blip per shirt (the bar draining)
  mix.add(impact(), START.fill, 0.9);
  for (let i = 0; i < 8; i++) {
    const f = START.fill + 6 + i * SHIRT_STEP;
    mix.add(kick(), f, 0.85);
    mix.add(ding(), f + 2, 0.5);
    mix.add(blip(720 - i * 55, 0.1), f + 10, 0.38);
  }

  // squeeze: duel in, three alt pops, the sum, PICK buzz, riser → pick slam,
  // then the four-shirt sprint (rapid dings) to 91.0
  mix.add(impact(), START.squeeze, 0.95);
  mix.add(whoosh(0.3), START.squeeze + 26, 0.5); // OR
  for (let i = 0; i < 3; i++) mix.add(blip(520 + i * 90, 0.1), START.squeeze + 36 + i * 10, 0.45);
  mix.add(ding(), START.squeeze + 96, 0.5); // = 13.5
  mix.add(buzz(0.4), START.squeeze + 80, 0.6); // PICK. pulse begins
  mix.add(riser(0.9), START.squeeze + 120, 0.7);
  mix.add(kick(), START.squeeze + 148, 1.0); // the pick lands
  mix.add(crash(), START.squeeze + 148, 0.45);
  for (let i = 0; i < 4; i++) mix.add(ding(), START.squeeze + 154 + i * 6, 0.55); // sprint to 91.0
  mix.add(sub(49, 0.8), START.squeeze + 172, 0.7);

  // rules: three metronome hits; the clock ticks underneath throughout
  for (const at of [4, 59, 114]) {
    mix.add(impact(), START.rules + at, 0.9);
    mix.add(sub(41.2, 0.7), START.rules + at, 0.6);
  }
  mix.add(kick(), START.rules + 134, 0.8); // AT HIS OWN KICKOFF.
  for (let f = START.rules; f < START.cta; f += FPS) mix.add(tick(), f, 0.55);

  // cta: flash crash, stinger, the clock never stops — the deadline is real
  mix.add(crash(), START.cta, 0.5);
  mix.add(kick(), START.cta, 1.0);
  mix.add(stinger(196, 1.2), START.cta + 8, 0.75);
  mix.add(sub(49, 0.9), START.cta + 18, 0.7);
  for (let f = START.cta + FPS; f < TOTAL; f += FPS) mix.add(tick(), f, 0.6);

  writeFileSync(out, encodeWav(mix.finalize()));
  console.log(`  → ${out}`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) ensureWkndBoostAudio();
