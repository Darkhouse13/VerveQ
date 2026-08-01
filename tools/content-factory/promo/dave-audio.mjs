// THE DAVE TAPES, act two — the score for everything after the cut.
//
// The law that built this lane didn't move: the footage's own generated audio
// is the soundtrack while Dave is on screen, and nothing plays under it. But
// batch 2 stretched the cream world from one 3-second card to a 17.5-second
// act (verdict → demo round → turn → lockup), and seventeen silent seconds is
// not deadpan, it's dead. So the moment the film cuts to cream — the moment it
// stops being footage and becomes ours — the promo lane's synthesis takes
// over: impact on the verdict, a light pulse under the app frame, ticks on the
// countdown, the buzz Dave has earned, a stinger on the lockup.
//
// One arrangement, four keys: every film rides the same grid (the grammar is
// the format), but each is pitched to its own accent so the four films don't
// share a note-for-note tail. Same seeded, license-clean synthesis as every
// other baked track — you can still drop a trending sound on top in-app.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, impact, whoosh, riser, stinger, crash, blip, tick, ding, buzz } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 15; // 120 BPM — same clock the old snap ran

// MUST match ACT2 in src/dave/films.ts — the ticks are timed to the countdown
// and the buzz to Dave's ✗; a change there is a change here or the score lies.
const A = {
  verdict: 0,
  demo: 4 * BEAT,
  question: 8 * BEAT,
  count: 14 * BEAT,
  daveTag: 17 * BEAT,
  reveal: 20 * BEAT,
  result: 23 * BEAT,
  turn: 26 * BEAT,
  lockup: 29 * BEAT,
};
const TOTAL = 35 * BEAT; // 525 — src/dave/films.ts SNAP

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// each film in its own key — root for the low end, a fifth-ish up for the
// stinger. Keyed by film so a fifth film picks its own note, not a default.
const KEYS = {
  polygraph: { root: 55, sting: 220 }, // A — clinical
  "support-group": { root: 49, sting: 196 }, // G — the church hall
  nature: { root: 65.4, sting: 261.6 }, // C — daylight
  warning: { root: 41.2, sting: 164.8 }, // E — institutional dread
};

const arrange = ({ root, sting }) => {
  const mix = new Mixer(TOTAL, FPS);

  // THE VERDICT — lands on the hard cut. The biggest hit in the piece: the cut
  // is the punchline and the score's job is to make it felt.
  mix.add(impact(), 0, 1.0);
  mix.add(sub(root, 1.4), 0, 0.9);
  mix.add(clap(), 0, 0.5);
  mix.add(tick(), 2 * BEAT, 0.5); // one dry stamp while the ruling hangs

  // THE DEMO — the app arrives. A light pulse keeps the round moving without
  // becoming a song: kick on the bar, hats offbeat, bass at the bar turns.
  mix.add(whoosh(0.4), A.demo - 4, 0.7);
  for (let f = A.demo; f < A.reveal; f += 4 * BEAT) {
    mix.add(kick(), f, 0.55);
    mix.add(kick(), f + 2 * BEAT, 0.4);
    mix.add(bass(root, 0.3), f, 0.5);
  }
  for (let f = A.demo + BEAT; f < A.reveal; f += 2 * BEAT) mix.add(hat(), f, 0.3);

  // the question slams, the options pop — mirrors D.question +8 +i*5 in
  // DaveFilm.tsx
  mix.add(impact(), A.question, 0.6);
  [0, 1, 2, 3].forEach((i) => mix.add(blip(560 + i * 60, 0.08), A.question + 8 + i * 5, 0.4));

  // 3… 2… 1… — a tick per count, pitch stepping down, a riser leaning into
  // the reveal
  [0, 1, 2].forEach((i) => {
    mix.add(tick(), A.count + i * 2 * BEAT, 0.9);
    mix.add(blip(494 - i * 54, 0.1), A.count + i * 2 * BEAT, 0.35);
  });
  mix.add(riser(1.2), A.reveal - 36, 0.7);

  // Dave's pick gets named mid-countdown — one dry stamp, the joke is visual
  mix.add(tick(), A.daveTag, 0.7);
  mix.add(blip(196, 0.1), A.daveTag, 0.5);

  // THE REVEAL — the ✓ dings, the board shakes, and Dave's ✗ buzzes just
  // behind it (the DENIED buzz — same sound the license promo gave him)
  mix.add(ding(), A.reveal, 0.95);
  mix.add(impact(), A.reveal, 0.7);
  mix.add(crash(), A.reveal, 0.35);
  mix.add(buzz(0.45), A.reveal + 12, 0.8);

  // the ruling on the round, then the scoreline chip
  mix.add(impact(), A.result, 0.85);
  mix.add(clap(), A.result, 0.6);
  mix.add(sub(root, 0.9), A.result, 0.6);
  mix.add(tick(), A.result + 8, 0.6);

  // THE TURN — it's about you now
  mix.add(impact(), A.turn, 0.9);
  mix.add(sub(root, 1.0), A.turn, 0.8);
  mix.add(stinger(sting, 1.1), A.turn + 2, 0.7);

  // THE LOCKUP — the full stop
  mix.add(crash(), A.lockup, 0.5);
  mix.add(stinger(sting, 1.5), A.lockup + 2, 0.95);
  mix.add(sub(root, 1.3), A.lockup, 0.9);
  mix.add(kick(), A.lockup + 2 * BEAT, 0.5);
  mix.add(kick(), A.lockup + 4 * BEAT, 0.5);
  mix.add(ding(), TOTAL - 20, 0.7); // Free · no sign-up.

  return mix.finalize();
};

export const ensureDaveAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  let wrote = 0;
  for (const [name, key] of Object.entries(KEYS)) {
    const fp = path.join(outDir, `dave-${name}.wav`);
    if (!force && existsSync(fp)) continue;
    writeFileSync(fp, encodeWav(arrange(key)));
    wrote++;
  }
  return wrote;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureDaveAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "dave-*.wav present." : `Wrote ${n} dave-*.wav (${(TOTAL / FPS).toFixed(1)}s each)`);
}
