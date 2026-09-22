// LAB lane sound beds — synthesized, seeded per reel (Mixer name = seed), and
// timed off src/lab/grid.json so a re-time in the grid re-times the sound.
// No VO in this lane: pitch.quiz's 232K faceless winner is paced by its clock
// and stings alone (FACELESS_WINNER_SPEC #12), and that is the pacing device
// here. Music is never baked — a trending sound can be added in-app on the
// organic post.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, blip, buzz, crash, ding, encodeWav, hat, impact, kick, pluck, riser, stinger, sub, tick, whoosh } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const GRID = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "grid.json"), "utf8"));
const GW = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "guesswho", "facts.json"), "utf8"));
const OL = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "older", "facts.json"), "utf8"));
const XI = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "xi", "facts.json"), "utf8"));
const OUT = path.join(dir, "..", "public", "promo");
const FPS = GRID.fps;

const write = (name, mix) => {
  mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${name}.wav`);
  writeFileSync(out, encodeWav(mix.finalize()));
  console.log(`  → ${out}`);
};
const fresh = (name) => !existsSync(path.join(OUT, `${name}.wav`));

// a clock that ticks every half second and doubles up in the last second
const clock = (mix, from, to, gainLo = 0.32, gainHi = 0.55) => {
  for (let f = from; f < to; f += 15) mix.add(tick(), f, f >= to - 30 ? gainHi : gainLo);
  for (let f = to - 30 + 7; f < to; f += 15) mix.add(tick(), f, gainHi * 0.8);
};

export const ensureLabGuessWhoAudio = () => {
  const name = "lab-guesswho";
  if (!fresh(name)) return;
  const G = GRID.guesswho;
  const N = GW.questions.length;
  const starts = [];
  let acc = 0;
  for (let i = 0; i < N; i++) {
    starts.push(acc);
    acc += i === N - 1 ? G.qLast : G.q;
  }
  const TOTAL = acc + G.closer;
  const mix = new Mixer(name, TOTAL, FPS);
  mix.add(sub(49, 0.6), 0, 0.5);
  GW.questions.forEach((q, i) => {
    const S = starts[i];
    mix.add(whoosh(0.3), S, 0.45);
    mix.add(pluck(196, 0.22), S + 2, 0.3);
    clock(mix, S, S + G.timer);
    mix.add(impact(), S + G.stampAt, 0.95);
    mix.add(q.answer === "YES" ? ding() : buzz(0.35), S + G.stampAt + 3, q.answer === "YES" ? 0.5 : 0.45);
    if (!q.withheld) {
      q.eliminated.forEach((_, j) => {
        const at = S + G.flipStart + j * G.flipStep + 8;
        mix.add(kick(), at, 0.6);
        mix.add(buzz(0.22), at + 1, 0.32);
      });
      const done = S + G.flipStart + q.eliminated.length * G.flipStep + 6;
      mix.add(ding(), done, 0.42);
      mix.add(blip(660, 0.08), done + 4, 0.25);
    } else {
      mix.add(riser(1.2), S + G.stampAt - 36, 0.5);
      mix.add(impact(), S + G.holdCardAt, 1);
      mix.add(sub(41, 1.0), S + G.holdCardAt, 0.6);
      mix.add(crash(), S + G.holdCardAt, 0.3);
      for (let f = S + G.holdCardAt + 30; f < S + G.qLast; f += 20) mix.add(blip(520, 0.06), f, 0.16);
    }
  });
  const C = acc;
  mix.add(crash(), C, 0.45);
  mix.add(kick(), C, 1);
  mix.add(stinger(196, 1.4), C + 4, 0.75);
  mix.add(sub(49, 1.1), C + 14, 0.6);
  mix.add(ding(), C + 30, 0.5);
  for (let f = C + 50; f < TOTAL; f += 15) mix.add(blip(740, 0.06), f, 0.15);
  write(name, mix);
};

export const ensureLabOlderAudio = () => {
  const name = "lab-older";
  if (!fresh(name)) return;
  const G = GRID.older;
  const N = OL.rounds.length;
  const TOTAL = N * G.round + G.closer;
  const mix = new Mixer(name, TOTAL, FPS);
  OL.rounds.forEach((r, i) => {
    const S = i * G.round;
    mix.add(kick(), S, 0.9);
    mix.add(whoosh(0.32), S, 0.5);
    mix.add(impact(), S + 4, 0.55);
    mix.add(pluck(i >= 6 ? 233.08 : 196, 0.2), S + 8, 0.28);
    clock(mix, S + G.timerFrom, S + G.timerTo);
    if (r.n >= 7) mix.add(riser(0.8), S + G.timerTo - 24, 0.35 + 0.05 * (r.n - 7));
    mix.add(impact(), S + G.revealAt, 1);
    mix.add(sub(55, 0.6), S + G.revealAt, 0.5);
    mix.add(ding(), S + G.revealAt + 3, 0.5);
    if (r.n === N) mix.add(crash(), S + G.revealAt, 0.4);
    mix.add(blip(r.gapDays < 30 ? 880 : 620, 0.09), S + G.gapAt, 0.35);
    mix.add(kick(), S + G.gapAt, 0.45);
  });
  const C = N * G.round;
  mix.add(crash(), C, 0.45);
  mix.add(kick(), C, 1);
  mix.add(stinger(220, 1.4), C + 4, 0.75);
  mix.add(sub(55, 1.1), C + 14, 0.6);
  mix.add(ding(), C + 30, 0.5);
  for (let f = C + 50; f < TOTAL; f += 15) mix.add(blip(740, 0.06), f, 0.15);
  write(name, mix);
};

export const ensureLabXIAudio = () => {
  const name = "lab-xi";
  if (!fresh(name)) return;
  const G = GRID.xi;
  const N = XI.xi.length;
  const NAMES_END = N * G.name;
  const TOTAL = NAMES_END + G.reveal + G.closer;
  const mix = new Mixer(name, TOTAL, FPS);
  // a quiet stadium pulse under the whole build — never dead air
  for (let f = 0; f < NAMES_END; f += 15) {
    mix.add(hat(f % 30 === 15), f, f % 60 === 0 ? 0.26 : 0.13);
    if (f % 60 === 30) mix.add(pluck(f % 120 === 30 ? 174.61 : 196, 0.16), f, 0.16);
  }
  XI.xi.forEach((x, i) => {
    const at = i * G.name + G.landAt;
    mix.add(kick(), at, 0.85);
    mix.add(impact(), at, 0.7);
    mix.add(blip(380 + i * 32, 0.08), at + 4, 0.32);
    if (i >= N - 3) mix.add(sub(49, 0.4), at, 0.35);
  });
  mix.add(riser(1.5), NAMES_END - 45, 0.5);
  const R = NAMES_END;
  mix.add(crash(), R + 10, 0.5);
  mix.add(impact(), R + 10, 1);
  mix.add(sub(41, 1.2), R + 10, 0.65);
  mix.add(stinger(220, 1.6), R + 14, 0.7);
  for (let f = R + 50; f < R + G.reveal; f += 15) mix.add(blip(620, 0.06), f, 0.14);
  const C = NAMES_END + G.reveal;
  mix.add(kick(), C, 1);
  mix.add(stinger(196, 1.3), C + 4, 0.7);
  mix.add(ding(), C + 30, 0.5);
  for (let f = C + 50; f < TOTAL; f += 15) mix.add(blip(740, 0.06), f, 0.15);
  write(name, mix);
};

export const ensureLabAudio = () => {
  ensureLabGuessWhoAudio();
  ensureLabOlderAudio();
  ensureLabXIAudio();
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) ensureLabAudio();
