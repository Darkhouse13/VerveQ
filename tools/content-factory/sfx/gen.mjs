// Procedural SFX generator — writes the baked sound layer as original WAV files
// into ../public/sfx. No dependencies, no sourced audio, no licensing: every
// sound is synthesized from math with a seeded PRNG, so regenerating produces
// byte-identical files. This is the same "dodge licensing" instinct as the
// no-music rule — we own every sample.
//
//   node sfx/gen.mjs           # generate any missing files
//   node sfx/gen.mjs --force   # rebuild all of them
//
// Five sounds × three kits (deep/punchy · bright/clicky · soft/woody):
//   impact  — the club-slam thump
//   whoosh  — swish into the CTA
//   tick    — countdown 3 · 2 · 1
//   stinger — the reveal "ta-da" chord
//   riser   — tension bed under the countdown
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SR = 44100;
const dir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.join(dir, "..", "public", "sfx");

// deterministic noise so output is reproducible (git-stable, cache-stable)
const makeRng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const noise = (rng) => rng() * 2 - 1;

// mono float (-1..1) → 16-bit PCM WAV buffer
const encodeWav = (samples) => {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return buf;
};

const buf = (dur) => new Float32Array(Math.floor(SR * dur));

// ---- synths -----------------------------------------------------------------
const impact = (k) => {
  const out = buf(0.28);
  const rng = makeRng(1001);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = k.impactHi + (k.impactLo - k.impactHi) * Math.min(1, t / 0.05); // pitch drop
    ph += (2 * Math.PI * f) / SR;
    const body = Math.sin(ph) * Math.exp(-t * 22);
    const click = t < 0.008 ? noise(rng) * Math.exp(-t * 420) * 0.6 : 0;
    out[i] = (body * 0.9 + click) * 0.9;
  }
  return out;
};

const whoosh = (k) => {
  const out = buf(0.5);
  const rng = makeRng(2002);
  let lp = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const bell = Math.sin(Math.PI * Math.min(1, t / 0.5)); // fade in and out
    lp += (noise(rng) - lp) * k.whooshCut; // one-pole lowpass
    out[i] = lp * bell * 0.5;
  }
  return out;
};

const tick = (k) => {
  const out = buf(0.03);
  const rng = makeRng(3003);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * k.tickHz) / SR;
    out[i] = (Math.sin(ph) * 0.7 + noise(rng) * 0.3) * Math.exp(-t * 180) * 0.8;
  }
  return out;
};

const stinger = (k) => {
  const out = buf(0.6);
  const rng = makeRng(4004);
  const partials = [k.root, k.root * 1.26, k.root * 1.5, k.root * 2]; // root, ~M3, P5, octave
  const amps = [0.5, 0.35, 0.3, 0.18];
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let s = 0;
    for (let j = 0; j < partials.length; j++) s += Math.sin(2 * Math.PI * partials[j] * t) * amps[j];
    const attack = Math.min(1, t / 0.006);
    const decay = Math.exp(-t * 4.5);
    const air = noise(rng) * Math.exp(-t * 30) * 0.05;
    out[i] = (s + air) * attack * decay * 0.5;
  }
  return out;
};

const riser = (k) => {
  const out = buf(0.9);
  const rng = makeRng(5005);
  let lp = 0;
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const frac = t / 0.9;
    const f = 180 + (k.riserTop - 180) * frac; // sweeps up
    ph += (2 * Math.PI * f) / SR;
    const tone = Math.sin(ph) * 0.25;
    lp += (noise(rng) - lp) * (0.02 + 0.2 * frac);
    const bell = Math.min(1, frac / 0.85) * (1 - Math.max(0, (frac - 0.85) / 0.15));
    out[i] = (tone + lp * 0.4) * bell * 0.5;
  }
  return out;
};

const SYNTHS = { impact, whoosh, tick, stinger, riser };

// deep/punchy · bright/clicky · soft/woody
const KITS = {
  a: { impactHi: 150, impactLo: 60, whooshCut: 0.06, tickHz: 1500, root: 294, riserTop: 700 },
  b: { impactHi: 220, impactLo: 95, whooshCut: 0.14, tickHz: 2600, root: 392, riserTop: 1000 },
  c: { impactHi: 180, impactLo: 80, whooshCut: 0.09, tickHz: 2000, root: 349, riserTop: 820 },
};

export const ensureSfx = (outDir = DEFAULT_OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  let written = 0;
  for (const [kit, params] of Object.entries(KITS)) {
    for (const [name, synth] of Object.entries(SYNTHS)) {
      const fp = path.join(outDir, `${name}_${kit}.wav`);
      if (!force && existsSync(fp)) continue;
      writeFileSync(fp, encodeWav(synth(params)));
      written++;
    }
  }
  return written;
};

// run directly → generate; import (from render.mjs) → just expose ensureSfx
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensureSfx(DEFAULT_OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "SFX already present." : `Wrote ${n} SFX file(s) to ${DEFAULT_OUT}`);
}
