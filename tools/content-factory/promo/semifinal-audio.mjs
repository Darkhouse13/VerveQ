// "SEMI-FINAL" soundtrack — 120 BPM (15 frames per beat), 33.5s. A minor
// dread-build under the story, lifting to C major on the CTA.
//
// This is the one promo whose score has to share the frame with a voice, which
// changes two things:
//   1. It's sparser than the rest of the set on purpose — under a narrator,
//      every extra layer is mud. The gaps between lines are where it gets loud
//      (SemiFinal.tsx ducks it live).
//   2. Its accents are keyed to the SPEECH, not just the grid: it reads the
//      same src/promo/semifinal/vo.json the visuals do, so the hit on "NEVER",
//      the stamp on "suspended" and the three history impacts land on the exact
//      frames those words are spoken. Hand-copying those numbers would drift
//      the moment a line is re-cut.
// Mirrors the scene table in src/promo/semifinal/timeline.ts.
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Mixer, encodeWav, kick, sub, bass, hat, clap, pluck, impact, whoosh, riser, stinger, crash, blip, tick, buzz } from "./audio-lib.mjs";

const FPS = 30;
const BEAT = 15; // 120 BPM
const BAR = 60;
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/semifinal/timeline.ts
const SCENES = [
  ["never", 90],
  ["notonce", 30],
  ["susp", 90],
  ["red", 135],
  ["ban", 180],
  ["days", 120],
  ["hist", 150],
  ["tonight", 45],
  ["ask", 75],
  ["cta", 90],
];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 1005 = 33.5s

// ── speech cues (shared source of truth with the visuals) ───────────────────
const VO = JSON.parse(readFileSync(path.join(dir, "..", "src", "promo", "semifinal", "vo.json"), "utf8"));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// absolute frame at which `needle` is spoken inside line `key`
const cue = (key, needle) => {
  const line = VO.lines.find((l) => l.key === key);
  if (!line) throw new Error(`no VO line "${key}"`);
  const w = line.words.findIndex((x) => norm(x.word) === norm(needle));
  if (w === -1) throw new Error(`VO cue "${needle}" not in "${key}" ("${line.text}")`);
  return START[key] + Math.round(line.words[w].t0 * FPS);
};

const mix = new Mixer("semi-final", TOTAL, FPS);

// NEVER — dread. One impact, a long A1 drone, and a stab on the word itself.
mix.add(impact(), 0, 0.95);
mix.add(sub(55, 3.0), 0, 0.6); // A1 under the whole hook
mix.add(crash(), 0, 0.3);
const NEVER = cue("never", "never");
mix.add(impact(), NEVER, 0.9);
mix.add(stinger(110, 1.0), NEVER, 0.55); // A2 minor
mix.add(kick(), START.never + BEAT * 4, 0.45);

// NOT ONCE — the ink flash. Hardest single hit in the piece, then near-nothing.
mix.add(impact(), START.notonce, 1.0);
mix.add(sub(41.2, 0.9), START.notonce, 0.85); // E1 — drops a fourth, floor gives way
mix.add(crash(), START.notonce, 0.45);

// SUSPENDED — the pulse starts. Half-time kick, hats on the off-beat.
for (let f = START.susp; f < START.red; f += BEAT * 2) {
  mix.add(kick(), f, 0.85);
  mix.add(hat(), f + BEAT, 0.42);
}
mix.add(bass(55, 0.4), START.susp, 0.7);
mix.add(bass(65.41, 0.4), START.susp + BEAT * 4, 0.7); // C2
const SUSP = cue("susp", "suspended");
mix.add(impact(), SUSP, 0.9); // the stamp lands
mix.add(stinger(110, 1.1), SUSP, 0.7);
mix.add(clap(), SUSP, 0.6);

// RED CARD — the buzz of it, and the flick. Groove tightens to every beat.
const RED = cue("red", "red");
mix.add(buzz(0.45), RED - 6, 0.5); // the card comes out
mix.add(impact(), RED, 1.0);
mix.add(crash(), RED, 0.4);
mix.add(sub(49, 1.2), RED, 0.7); // G1
for (let f = START.red; f < START.ban; f += BEAT) {
  mix.add(kick(), f, 0.8);
  mix.add(hat(f % (BEAT * 2) === 0), f + BEAT / 2, 0.4);
}
mix.add(blip(392, 0.1), cue("red", "against"), 0.5); // "AGAINST HUNGARY" chip

// THE BAN — the punchline. Groove holds through the rule, then cuts out for
// the ~0.55s of silence the narrator leaves before "England." Only the riser
// creeps through the gap; silence is the setup, and the hit lands on the word.
const ENG_AT = cue("ban", "England");
for (let f = START.ban; f < ENG_AT - BEAT; f += BEAT) {
  mix.add(kick(), f, 0.78);
  mix.add(hat(), f + BEAT / 2, 0.38);
}
mix.add(bass(73.42, 0.4), START.ban, 0.7); // D2
mix.add(blip(523.3, 0.12), cue("ban", "friendlies."), 0.5); // FRIENDLIES card
mix.add(riser(0.85), ENG_AT - 26, 0.7); // into the gap
mix.add(impact(), ENG_AT, 1.0); // ENGLAND
mix.add(crash(), ENG_AT, 0.5);
mix.add(stinger(110, 1.3), ENG_AT, 0.8); // A2 minor — the trap closing
mix.add(sub(55, 1.3), ENG_AT, 0.9);
mix.add(whoosh(0.4), START.days - 6, 0.55);

// 7,550 — the counter spins. Ticks through the count, riser, impact on landing.
const CA = cue("days", "seven");
const CB = cue("days", "fifty") + 5;
for (let f = CA; f < CB; f += 3) mix.add(tick(), f, 0.34);
mix.add(riser(Math.max(0.5, (CB - CA) / FPS)), CA, 0.6);
mix.add(impact(), CB, 1.0); // the number lands
mix.add(crash(), CB, 0.4);
mix.add(sub(55, 1.4), CB, 0.8);
mix.add(clap(), CB, 0.65);

// THE HISTORY — three impacts, each bigger, each on its spoken word.
["hand", "red", "revenge"].forEach((w, i) => {
  const at = cue("hist", w);
  mix.add(impact(), at, 0.8 + i * 0.1);
  mix.add(sub([55, 65.41, 73.42][i], 0.8), at, 0.7); // A1 → C2 → D2, climbing
  mix.add(clap(), at, 0.5 + i * 0.08);
  if (i === 2) mix.add(crash(), at, 0.45);
});
for (let f = START.hist; f < START.tonight; f += BEAT * 2) mix.add(kick(), f, 0.7);
mix.add(riser(1.1), START.tonight - 33, 0.8); // into the turn

// UNTIL TONIGHT — the drop.
mix.add(impact(), START.tonight, 1.0);
mix.add(crash(), START.tonight, 0.6);
mix.add(stinger(130.8, 1.5), START.tonight, 0.9); // C3 — the lift to major
mix.add(sub(65.41, 1.4), START.tonight, 0.95);

// THE ASK — hold the tension, quarter-note ticks under the question
for (let f = START.ask; f < START.cta; f += BEAT) {
  mix.add(kick(), f, 0.75);
  mix.add(tick(), f + BEAT / 2, 0.35);
}
mix.add(whoosh(0.35), START.cta - 5, 0.6);

// PROVE IT — C major payoff, the only four-on-the-floor in the piece
const CS = START.cta;
mix.add(impact(), CS, 1.0);
mix.add(crash(), CS, 0.5);
mix.add(stinger(261.6, 1.4), CS + 3, 0.8); // C4
const MAJOR = [65.41, 98, 82.41, 65.41]; // C2 G2 E2 C2
let ci = 0;
for (let f = CS; f < TOTAL - 6; f += BEAT) {
  mix.add(kick(), f, 1.0);
  mix.add(hat(f % (BEAT * 2) === 0), f + BEAT / 2, 0.5);
  if (f % (BEAT * 2) === 0) {
    mix.add(bass(MAJOR[ci % 4], 0.4), f, 0.85);
    ci++;
  }
}
for (let f = CS; f < TOTAL - 6; f += BAR) mix.add(clap(), f + BEAT * 2, 0.7);
const ARP = [261.6, 329.6, 392, 523.3]; // C E G C
for (let k = 0, f = CS + BEAT; f < TOTAL - 6; f += BEAT, k++) mix.add(pluck(ARP[k % 4], 0.18), f, 0.4);

const master = mix.finalize();

export const ensureSemifinalAudio = (outDir = OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "semifinal.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureSemifinalAudio(OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "semifinal.wav present." : `Wrote semifinal.wav (${(TOTAL / FPS).toFixed(1)}s)`);
}
