// "THE DECISION" soundtrack — 120 BPM (15 frames per beat) tension arc: an
// impact under the 2,431 hook, a draft groove that adds muscle, a fixture-clear
// slam per gauntlet row, a stripped half-feel under the fork, big lone ticks on
// the 3-2-1 the viewer answers — then the set's pattern interrupt: near-silence
// under "HE PUSHED.", the buzz+impact on BUSTED, and a major-key CTA groove.
// Arranged on the same grid as src/promo/draw/timeline.ts.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, pluck, impact, whoosh, riser, stinger, crash, blip, tick, ding, buzz } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 15; // 120 BPM
const BAR = 60;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/draw/timeline.ts
const SCENES = [["hook", 60], ["run", 105], ["gauntlet", 90], ["fork", 120], ["count", 90], ["reveal", 105], ["cta", 150]];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 720

const mix = new Mixer(TOTAL, FPS);

// HOOK — the counter races (slot-machine ticks), slams shut on 2,431 at f20
for (let f = 0; f < 20; f += 2) mix.add(tick(), f, 0.55); // the spin
mix.add(riser(0.55), 0, 0.5); // rising under the count
mix.add(impact(), 20, 1.0); // the score locks
mix.add(sub(55, 1.6), 20, 0.6); // A1
mix.add(crash(), 20, 0.3);
mix.add(blip(330, 0.12), 38, 0.45); // "he should have walked away"
mix.add(riser(0.6), START.run - 14, 0.6);

// RUN — the draft groove: kick pulse, a whoosh per card rip, ding on the chain
const RS = START.run;
mix.add(impact(), RS, 0.7); // "TODAY'S BOARD."
for (let f = RS; f < START.gauntlet; f += BEAT) mix.add(kick(), f, 0.85);
for (let f = RS + BAR / 2; f < START.gauntlet; f += BEAT) mix.add(hat(), f + BEAT / 2, 0.45);
const MINOR = [55, 55, 65.41, 73.42]; // A1 A1 C2 D2
let ri = 0;
for (let f = RS + BEAT * 2; f < START.gauntlet; f += BEAT * 2) {
  mix.add(bass(MINOR[ri % 4], 0.35), f, 0.8);
  ri++;
}
[10, 18, 26].forEach((at, i) => mix.add(whoosh(0.3), RS + at, 0.5 + i * 0.08)); // card rips
mix.add(impact(), RS + 48, 0.55); // the pick locks
mix.add(blip(523, 0.12), RS + 48 + 2, 0.5);
mix.add(ding(), RS + 62, 0.6); // CLUB D SPINE ×1.33

// GAUNTLET — a slam per cleared fixture while the counter ticks up
const GS = START.gauntlet;
for (let f = GS; f < START.fork; f += BEAT) {
  mix.add(kick(), f, 0.9);
  mix.add(hat(), f + BEAT / 2, 0.5);
  mix.add(bass(55, 0.3), f, 0.8);
}
[8, 26, 44].forEach((at, i) => {
  mix.add(impact(), GS + at, 0.6 + i * 0.12); // CLEARED stamps
  mix.add(blip(392 + i * 88, 0.1), GS + at + 2, 0.5);
});
for (let f = GS + 8; f < GS + 78; f += 5) mix.add(tick(), f, 0.35); // the counter climbs
mix.add(riser(0.8), START.fork - 20, 0.7);

// FORK — strip to a half-feel: space for the reading
const FS = START.fork;
mix.add(impact(), FS, 0.9); // "YOUR CALL."
mix.add(stinger(110, 1.3), FS, 0.75); // A2 menace
for (let f = FS; f < START.count; f += BEAT * 2) mix.add(kick(), f, 0.7);
mix.add(sub(55, 3.0), FS, 0.5);
mix.add(impact(), FS + 12, 0.55); // BANK slams
mix.add(impact(), FS + 26, 0.6); // PUSH slams
mix.add(blip(330, 0.12), FS + 56, 0.4); // "bust and you keep 15%"
mix.add(riser(1.2), START.count - 30, 0.8);

// COUNT — three lone ticks, a heartbeat kick, tension all the way up
const CS = START.count;
[0, 30, 60].forEach((at, i) => {
  mix.add(tick(), CS + at, 1.0);
  mix.add(impact(), CS + at, 0.45 + i * 0.15); // 3… 2… 1…
});
for (let f = CS; f < CS + 80; f += BEAT * 2) mix.add(kick(), f, 0.5);
mix.add(riser(0.9), CS + 55, 0.85);
// then: nothing. the percussion stops dead before the reveal — the interrupt.

// REVEAL — near-silence under "HE PUSHED.", then the punishment
const VS = START.reveal;
mix.add(sub(49, 1.0), VS, 0.35); // G1, barely there
mix.add(buzz(0.5), VS + 34, 0.9); // BUSTED — the buzz Dave earned
mix.add(impact(), VS + 34, 1.0);
mix.add(crash(), VS + 34, 0.5);
mix.add(sub(46.25, 1.6), VS + 34, 0.8); // F#1 — it hurts
mix.add(blip(262, 0.14), VS + 62, 0.45); // "KEPT 365."

// CTA — the major-key turn: it's about you now
const TS = START.cta;
mix.add(stinger(261.6, 1.3), TS + 4, 0.8); // C4 — "WOULD YOU HAVE BANKED?"
mix.add(crash(), TS, 0.45);
const MAJOR = [65.41, 49, 55, 65.41]; // C2 G1 A1 C2
let ci = 0;
for (let f = TS; f < TOTAL - 8; f += BEAT) {
  mix.add(kick(), f, 1.0);
  mix.add(hat(f % (BEAT * 2) === 0), f + BEAT / 2, 0.55);
  if (f % (BEAT * 2) === 0) {
    mix.add(bass(MAJOR[ci % 4], 0.35), f, 0.85);
    ci++;
  }
}
for (let f = TS; f < TOTAL - 8; f += BEAT * 4) mix.add(clap(), f + BEAT * 2, 0.75);
const ARP = [261.6, 329.6, 392, 523.3]; // C major
for (let k = 0, f = TS + BEAT; f < TOTAL - 8; f += BEAT, k++) mix.add(pluck(ARP[k % 4], 0.18), f, 0.4);
[30, 36, 42, 48].forEach((at, i) => mix.add(blip(392 + i * 66, 0.09), TS + at, 0.5)); // the line pops in
mix.add(whoosh(0.35), TS + 62, 0.6); // button lands

const master = mix.finalize();

export const ensureDrawAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "the-decision.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureDrawAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "the-decision.wav present." : `Wrote the-decision.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
