// BALLON D'OR RACE — sound bed. Synthesized and seeded (Mixer name = seed),
// timed off src/lab/race/timeline.json so a re-time re-times the sound. No
// voice (lab lane law): a driving pulse under the race whose tick climbs in
// pitch decade by decade, a blip per landed year, an impact + crash on every
// lead change, a riser into the final table, the lab closer sting. Always
// regenerated (cheap), written to public/promo/lab-race.wav — a file only
// this reel uses.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, bass, blip, buzz, crash, ding, encodeWav, hat, impact, kick, pluck, riser, stinger, sub, whoosh } from "../promo/audio-lib.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

export const ensureRaceAudio = () => {
  const T = JSON.parse(readFileSync(path.join(dir, "..", "src", "lab", "race", "timeline.json"), "utf8"));
  const name = "lab-race";
  const mix = new Mixer(name, T.total, T.fps);
  const RACE = T.race;
  const gap = T.segs.find((s) => !s.awarded);

  // the pulse: 120 bpm under the whole race; it drops out for the 2020 gap
  const BASS = [49, 49, 58.27, 55];
  for (let f = 0; f < RACE; f += 15) {
    if (gap && f >= gap.from && f < gap.from + gap.dur) continue;
    const beat = f / 15;
    if (beat % 2 === 0) mix.add(kick(), f, 0.55);
    mix.add(hat(beat % 2 === 1), f + 7, 0.12);
    if (beat % 4 === 0) mix.add(bass(BASS[(beat / 4) % 4], 0.45), f, 0.28);
  }

  for (const s of T.segs) {
    const prog = (s.year - T.segs[0].year) / (T.segs.at(-1).year - T.segs[0].year);
    if (!s.awarded) {
      mix.add(buzz(0.5), s.from, 0.28);
      mix.add(sub(41, 0.8), s.from, 0.45);
      continue;
    }
    mix.add(blip(420 + 460 * prog, 0.07), s.from, 0.3);
    if (s.event === "step") mix.add(pluck(196 + 60 * prog, 0.2), s.from + 2, 0.3);
    if (s.event === "level") {
      mix.add(riser(0.5), Math.max(0, s.from - 12), 0.3);
      mix.add(ding(), s.from + 6, 0.45);
      mix.add(kick(), s.from + 6, 0.7);
    }
    if (s.event === "lead") {
      mix.add(whoosh(0.3), Math.max(0, s.from - 6), 0.45);
      mix.add(impact(), s.from + 6, 1);
      mix.add(crash(), s.from + 6, 0.4);
      mix.add(sub(49, 0.9), s.from + 6, 0.6);
      mix.add(stinger(220, 0.9), s.from + 10, 0.4);
    }
  }

  // into the final table
  const last = T.segs.at(-1);
  mix.add(riser(1.4), Math.max(0, last.from - 30), 0.5);
  mix.add(impact(), RACE, 1);
  mix.add(crash(), RACE, 0.5);
  mix.add(sub(41, 1.4), RACE, 0.65);
  mix.add(stinger(196, 1.6), RACE + 4, 0.7);
  // the freeze is still, not silent: a soft heartbeat under it
  for (let f = RACE + 45; f < T.closerFrom; f += 15) mix.add(blip(f % 30 === 0 ? 392 : 523.25, 0.06), f, 0.12);
  for (let f = RACE + 45; f < T.closerFrom; f += 30) mix.add(kick(), f, 0.3);

  // closer — the lab lane's standard sting
  const C = T.closerFrom;
  mix.add(crash(), C, 0.45);
  mix.add(kick(), C, 1);
  mix.add(stinger(196, 1.4), C + 4, 0.75);
  mix.add(sub(49, 1.1), C + 14, 0.6);
  mix.add(ding(), C + 30, 0.5);
  for (let f = C + 50; f < T.total; f += 15) mix.add(blip(740, 0.06), f, 0.15);

  mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${name}.wav`);
  writeFileSync(out, encodeWav(mix.finalize()));
  console.log(`  → ${out}`);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) ensureRaceAudio();
