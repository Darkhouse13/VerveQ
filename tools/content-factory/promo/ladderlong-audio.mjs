// "LADDER-LONG" soundtrack — one WAV per edition.
//
// Why per-edition and not one shared track: the club slams land on each club as
// it arrives, and the four editions have different path lengths (2 to 7 clubs).
// A shared bed would drift off the visuals within one rung.
//
// Every other promo in this lane copies its grid constants into the audio
// script by hand with a "MUST match timeline.ts" comment. This one PARSES the
// timeline instead, so the club counts cannot drift from the casting — the
// grid constants below are still mirrored by hand (they are stable), but the
// per-rung shape is derived from the single source of truth and the script
// fails loudly if the parse stops matching.
//
// The arrangement carries the escalation the visuals promise: each solved rung
// resolves a step higher, the tick bed tightens as the tiers get harder, and
// rung 10 gets a riser that never resolves — no ding, because nothing on screen
// answers it either.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, hat, impact, tick, ding, blip, riser, stinger, whoosh } from "./audio-lib.mjs";
import { FPS, readEditions, totalOf, followAt, ctaAt, followFrames } from "./ladderlong-grid.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// The grid is no longer mirrored here by hand. Batch 2 runs two cadences and a
// per-edition length, so promo/ladderlong-grid.mjs parses both grids and the
// edition table straight out of timeline.ts — see the header there for why.
export { readEditions };

// nine resolutions, climbing
const SOLVE = [523, 554, 587, 622, 659, 698, 740, 784, 831];

const buildEdition = (ed) => {
  const { slug, counts, grid: g } = ed;
  const { step: STEP, last: LAST, clubIn: CLUB_IN, clubGap: CLUB_GAP, thinkAt: THINK_AT, tickAt: TICK_AT, answerAt: ANSWER_AT } = g;
  const WITHHELD_AT = ANSWER_AT;
  const TOTAL = totalOf(ed);
  const FOLLOW_AT = followAt(ed);
  const CTA_AT = ctaAt(ed);
  const mix = new Mixer(`ladder-long-${slug}`, TOTAL, FPS);

  // Heartbeat under the whole climb, tightening for the unanswered rung. The
  // pulse spacings are in FRAMES and stay put across both cadences on purpose:
  // the bed is a 120 BPM clock, and it is the RUNGS that get shorter against
  // it, not the tempo that changes. A viewer who sees both should hear the same
  // record playing underneath at two different densities of event.
  for (let f = 0; f < STEP * 9; f += 21) mix.add(kick(), f, 0.46);
  for (let f = STEP * 9; f < FOLLOW_AT; f += 14) mix.add(kick(), f, 0.6);

  for (let i = 0; i < 10; i++) {
    const base = i * STEP;
    const last = i === 9;
    const thinkEnd = last ? WITHHELD_AT : ANSWER_AT;

    // clubs slam in — except rung 1, which is pre-placed on screen (see
    // LadderLong.tsx) and so gets a single downbeat instead of a run of slams
    if (i === 0) {
      mix.add(impact(), 0, 0.7);
    } else {
      for (let c = 0; c < counts[i]; c++) {
        mix.add(impact(), base + CLUB_IN + c * CLUB_GAP, 0.5 + i * 0.02);
      }
    }

    // guess bed — a hat pulse through the thinking window, denser late on
    const gap = last ? 8 : 12 - Math.floor(i / 3) * 2;
    for (let f = i === 0 ? 20 : THINK_AT; f < thinkEnd - 2; f += gap) mix.add(hat(), base + f, 0.18);

    // the 3-2-1 — three discrete ticks, one per second, rising in weight
    TICK_AT.forEach((t, k) => mix.add(tick(), base + t, 0.34 + k * 0.06));

    if (!last) {
      mix.add(ding(), base + ANSWER_AT, 0.5);
      mix.add(blip(SOLVE[i], 0.12), base + ANSWER_AT + 3, 0.44);
      mix.add(impact(), base + ANSWER_AT, 0.4);
    } else {
      // the unanswered rung: rise, hit, and leave it hanging. No ding, ever.
      mix.add(riser((WITHHELD_AT - THINK_AT) / FPS), base + THINK_AT, 0.55);
      mix.add(impact(), base + WITHHELD_AT, 0.9);
      mix.add(stinger(196, 1.6), base + WITHHELD_AT, 0.5);
      mix.add(whoosh(0.5), base + WITHHELD_AT + 22, 0.32);
    }
  }

  // the follow-hook card (batch 2 only) — the one beat in the piece that
  // RESOLVES upward. Rung 10 deliberately left its riser hanging; this lands a
  // clean fifth above the closing stinger so "there's another one tomorrow"
  // sounds like an answer rather than another question.
  if (followFrames(ed) > 0) {
    mix.add(whoosh(0.4), FOLLOW_AT - 6, 0.38);
    mix.add(impact(), FOLLOW_AT, 0.72);
    mix.add(stinger(220, 1.5), FOLLOW_AT + 2, 0.4);
  }

  // the closing card
  mix.add(whoosh(0.45), CTA_AT - 6, 0.42);
  mix.add(impact(), CTA_AT, 0.8);
  mix.add(stinger(147, 2.2), CTA_AT + 2, 0.42);

  return mix.finalize(0.82, 1.08);
};

export const ensureLadderLongAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  let written = 0;
  for (const ed of readEditions()) {
    const fp = path.join(outDir, `ladderlong-${ed.slug}.wav`);
    if (!force && existsSync(fp)) continue;
    writeFileSync(fp, encodeWav(buildEdition(ed)));
    written++;
  }
  return written;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const eds = readEditions();
  for (const e of eds) {
    console.log(
      `  ${e.slug.padEnd(16)} batch ${e.batch}  ${(e.grid.step / FPS).toFixed(2)}s/rung  ` +
        `${(totalOf(e) / FPS).toFixed(2)}s  clubs/rung: ${e.counts.join(",")}`,
    );
  }
  const n = ensureLadderLongAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "ladderlong wavs present." : `Wrote ${n} ladderlong wav(s)`);
}
