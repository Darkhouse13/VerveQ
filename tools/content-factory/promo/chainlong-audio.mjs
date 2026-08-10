// "CHAIN-LONG" soundtrack — one WAV per edition, its own bed identity.
//
// The bed is seeded from `chain-long-<slug>` in the Mixer constructor (FNV-1a
// of name + "|sfx" → mulberry32, the standing per-promo law), so the chain
// sounds like its own series and adding it perturbs no other promo's noise.
// The grid is PARSED from src/promo/chainlong/timeline.ts via
// promo/chainlong-grid.mjs — the single-source law; nothing here is
// hand-mirrored.
//
// The arrangement is the relay's, not the ladder's: one slam as each slot
// LIGHTS (there are no club paths to run slams over), the guess bed densifying
// as the pool runs dry, a ding-and-climb as each name stamps, and slot 10 a
// riser that never resolves — no ding, because nothing on screen answers it
// either. The confession beat (the omission line's frame) gets the hanging
// stinger; the follow card resolves upward exactly as batch 2's does.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, hat, impact, tick, ding, blip, riser, stinger, whoosh } from "./audio-lib.mjs";
import { FPS, readEditions, totalOf, followAt, ctaAt } from "./chainlong-grid.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

export { readEditions };

// nine resolutions, climbing — the same ladder the visuals promise
const SOLVE = [523, 554, 587, 622, 659, 698, 740, 784, 831];

const buildEdition = (ed) => {
  const { slug, grid: g } = ed;
  const { step: STEP, thinkAt: THINK_AT, tickAt: TICK_AT, answerAt: ANSWER_AT } = g;
  const TURN_AT = ANSWER_AT;
  const TOTAL = totalOf(ed);
  const FOLLOW_AT = followAt(ed);
  const CTA_AT = ctaAt(ed);
  const mix = new Mixer(`chain-long-${slug}`, TOTAL, FPS);

  // heartbeat under the whole relay, tightening once the hand-over starts
  for (let f = 0; f < STEP * 9; f += 21) mix.add(kick(), f, 0.46);
  for (let f = STEP * 9; f < FOLLOW_AT; f += 14) mix.add(kick(), f, 0.6);

  for (let i = 0; i < 10; i++) {
    const base = i * STEP;
    const last = i === 9;
    const thinkEnd = last ? TURN_AT : ANSWER_AT;

    // the slot lights — one slam, weight climbing down the chain. Slot 1 is
    // already lit on screen at frame 0, so it gets the downbeat only.
    mix.add(impact(), base, i === 0 ? 0.7 : 0.5 + i * 0.03);

    // guess bed — a hat pulse through the window, denser as the pool drains
    const gap = last ? 8 : 12 - Math.floor(i / 3) * 2;
    for (let f = i === 0 ? 20 : THINK_AT; f < thinkEnd - 2; f += gap) mix.add(hat(), base + f, 0.18);

    // the 3-2-1 — rising in weight
    TICK_AT.forEach((t, k) => mix.add(tick(), base + t, 0.34 + k * 0.06));

    if (!last) {
      mix.add(ding(), base + ANSWER_AT, 0.5);
      mix.add(blip(SOLVE[i], 0.12), base + ANSWER_AT + 3, 0.44);
      mix.add(impact(), base + ANSWER_AT, 0.4);
    } else {
      // the hand-over: rise, hit, and leave it hanging. No ding, ever — slot
      // 10 is the viewer's, and the confession lands on the same hit.
      mix.add(riser((TURN_AT - THINK_AT) / FPS), base + THINK_AT, 0.55);
      mix.add(impact(), base + TURN_AT, 0.9);
      mix.add(stinger(196, 1.6), base + TURN_AT, 0.5);
      mix.add(whoosh(0.5), base + TURN_AT + 22, 0.32);
    }
  }

  // the follow card — the one beat that resolves upward (batch 2's law)
  mix.add(whoosh(0.4), FOLLOW_AT - 6, 0.38);
  mix.add(impact(), FOLLOW_AT, 0.72);
  mix.add(stinger(220, 1.5), FOLLOW_AT + 2, 0.4);

  // the closing card
  mix.add(whoosh(0.45), CTA_AT - 6, 0.42);
  mix.add(impact(), CTA_AT, 0.8);
  mix.add(stinger(147, 2.2), CTA_AT + 2, 0.42);

  return mix.finalize(0.82, 1.08);
};

export const ensureChainLongAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  let written = 0;
  for (const ed of readEditions()) {
    const fp = path.join(outDir, `chainlong-${ed.slug}.wav`);
    if (!force && existsSync(fp)) continue;
    writeFileSync(fp, encodeWav(buildEdition(ed)));
    written++;
  }
  return written;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const e of readEditions()) {
    console.log(`  ${e.slug.padEnd(20)} ${(e.grid.step / FPS).toFixed(2)}s/slot  ${(totalOf(e) / FPS).toFixed(2)}s  slots: ${e.slots}+1 open`);
  }
  const n = ensureChainLongAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "chainlong wavs present." : `Wrote ${n} chainlong wav(s)`);
}
