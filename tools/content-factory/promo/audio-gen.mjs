// Procedural soundtrack for the brand promo — one baked master WAV, arranged on
// the SAME 120 BPM / 30fps grid the visuals use, so every kick, whoosh and
// stinger lands on the frame its animation fires. Original synthesis, seeded
// PRNG, zero dependencies, nothing licensed — same instinct as the rest of the
// factory. Music is baked here ON PURPOSE: this is a hero marketing asset, not
// a daily quiz clip, so it ships with its own scored track.
//
//   node promo/audio-gen.mjs [--force]
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SR = 44100;
const FPS = 30;
const BEAT = (FPS * 60) / 120; // 15 frames
const dir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUT = path.join(dir, "..", "public", "promo");

// MUST match src/promo/timeline.ts
const SCENES = [
  ["hook", 75], ["prove", 60], ["logo", 60],
  ["quiz", 45], ["survival", 45], ["career", 45], ["blitz", 45], ["arena", 45],
  ["ranks", 90], ["free", 55], ["cta", 95],
];
const START = {};
let acc = 0;
for (const [k, d] of SCENES) { START[k] = acc; acc += d; }
const TOTAL = acc; // 660 frames
const MODE_STARTS = [START.quiz, START.survival, START.career, START.blitz, START.arena];

const makeRng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const rng = makeRng(90210);
const noise = () => rng() * 2 - 1;
const f2s = (frame) => Math.round((frame / FPS) * SR);

// ---- one-shot synths (return Float32Array) ----------------------------------
const buf = (dur) => new Float32Array(Math.floor(SR * dur));

const kick = () => {
  const o = buf(0.2);
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const f = 120 * Math.exp(-t * 40) + 45;
    ph += (2 * Math.PI * f) / SR;
    const click = t < 0.004 ? noise() * Math.exp(-t * 600) * 0.5 : 0;
    o[i] = (Math.sin(ph) * Math.exp(-t * 26) + click) * 0.95;
  }
  return o;
};

const sub = (freq, dur) => {
  const o = buf(dur);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.006) * Math.exp(-t * (1.6 / dur));
    o[i] = (Math.sin(2 * Math.PI * freq * t) + Math.sin(2 * Math.PI * freq * 2 * t) * 0.15) * env * 0.8;
  }
  return o;
};

const bass = (freq, dur) => {
  const o = buf(dur);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.005) * Math.exp(-t * (3.2 / dur));
    const s = Math.sin(2 * Math.PI * freq * t) * 0.7 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.22 + Math.sin(2 * Math.PI * freq * 3 * t) * 0.1;
    o[i] = s * env * 0.5;
  }
  return o;
};

const pluck = (freq, dur = 0.19) => {
  const o = buf(dur);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const s = Math.sin(2 * Math.PI * freq * t) + 0.4 * Math.sin(2 * Math.PI * 2 * freq * t) + 0.2 * Math.sin(2 * Math.PI * 3 * freq * t);
    o[i] = s * Math.exp(-t * 17) * 0.32;
  }
  return o;
};

const hat = (open = false) => {
  const o = buf(open ? 0.12 : 0.04);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    o[i] = noise() * Math.exp(-t * (open ? 45 : 200)) * 0.28;
  }
  return o;
};

const impact = () => {
  const o = buf(0.28);
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const f = 150 - 90 * Math.min(1, t / 0.05);
    ph += (2 * Math.PI * f) / SR;
    const click = t < 0.008 ? noise() * Math.exp(-t * 420) * 0.6 : 0;
    o[i] = (Math.sin(ph) * Math.exp(-t * 22) * 0.9 + click) * 0.85;
  }
  return o;
};

const whoosh = (dur = 0.4) => {
  const o = buf(dur);
  let lp = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const bell = Math.sin(Math.PI * Math.min(1, t / dur));
    lp += (noise() - lp) * 0.12;
    o[i] = lp * bell * 0.45;
  }
  return o;
};

const riser = (dur) => {
  const o = buf(dur);
  let lp = 0;
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const frac = t / dur;
    const f = 180 + 900 * frac * frac;
    ph += (2 * Math.PI * f) / SR;
    lp += (noise() - lp) * (0.02 + 0.25 * frac);
    const bell = Math.min(1, frac / 0.9) * frac;
    o[i] = (Math.sin(ph) * 0.22 + lp * 0.5) * bell * 0.5;
  }
  return o;
};

const stinger = (root) => {
  const o = buf(1.1);
  const parts = [root, root * 1.26, root * 1.5, root * 2, root * 2.52];
  const amps = [0.42, 0.3, 0.28, 0.18, 0.1];
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    let s = 0;
    for (let j = 0; j < parts.length; j++) s += Math.sin(2 * Math.PI * parts[j] * t) * amps[j];
    const env = Math.min(1, t / 0.005) * Math.exp(-t * 2.6);
    o[i] = (s + noise() * Math.exp(-t * 26) * 0.06) * env * 0.5;
  }
  return o;
};

const crash = () => {
  const o = buf(0.9);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    o[i] = noise() * Math.exp(-t * 5) * 0.4;
  }
  return o;
};

const blip = (freq) => {
  const o = buf(0.08);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    o[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 40) * 0.4;
  }
  return o;
};

// ---- mixer ------------------------------------------------------------------
const master = new Float32Array(f2s(TOTAL) + SR); // + tail for ring-outs
const add = (src, atFrame, gain = 1) => {
  const off = f2s(atFrame);
  for (let i = 0; i < src.length; i++) {
    const j = off + i;
    if (j >= 0 && j < master.length) master[j] += src[i] * gain;
  }
};

// ---- arrangement ------------------------------------------------------------
// Section 1 — HOOK (0–75): sparse, tense. Impacts under the three word-slams.
add(sub(41, 2.2), 0, 0.5); // low drone
for (const f of [0, 18, 36]) add(impact(), f, 0.8);
add(riser(1.4), 33, 0.5); // tension into PROVE

// Section 2 — PROVE (75–135): big hit, then a riser sweeping into the drop.
add(impact(), 75, 1.0);
add(riser(1.6), 87, 0.85); // peaks at the drop (135)
add(whoosh(0.5), 120, 0.6);

// Section 3+ — groove from the drop (135) through ranks (~505).
const GROOVE_START = START.logo; // 135
const GROOVE_END = START.free; // 510
add(sub(41, 0.9), GROOVE_START, 1.0); // the drop boom
add(crash(), GROOVE_START, 0.5);

// four-on-the-floor kick + offbeat hats
for (let f = GROOVE_START; f < GROOVE_END; f += BEAT) {
  add(kick(), f, 1.0);
  add(hat(), f + BEAT / 2, 0.7);
}

// bass — root per bar following A · A · F · G (an anthemic loop), hit on 1 & 3
const ROOTS = [55.0, 55.0, 43.65, 49.0]; // A1 A1 F1 G1
let barIdx = 0;
for (let f = GROOVE_START; f < GROOVE_END; f += BEAT * 4) {
  const r = ROOTS[barIdx % ROOTS.length];
  add(bass(r, 0.9), f, 1.0);
  add(bass(r, 0.9), f + BEAT * 2, 0.9);
  barIdx++;
}

// pluck arpeggio through the mode montage (eighth notes), same A-F-G feel up top
const ARP = [220, 330, 440, 330]; // A3 E4 A4 E4
for (let k = 0, f = START.quiz; f < START.ranks; f += BEAT / 2, k++) {
  add(pluck(ARP[k % ARP.length]), Math.round(f), 0.6);
}

// per-mode whoosh + impact on each card entrance
for (const f of MODE_STARTS) {
  add(whoosh(0.35), f - 4, 0.6);
  add(impact(), f, 0.7);
}

// ranks — ascending blips as the tiers climb, riser into FREE
const TIER_HZ = [330, 392, 440, 523];
TIER_HZ.forEach((hz, i) => add(blip(hz), START.ranks + 12 + i * 16, 0.8));
add(riser(1.2), START.ranks + 54, 0.6);

// FREE (510–565): two stabs, half-time kick
add(impact(), START.free, 0.7);
add(bass(49, 0.5), START.free, 0.8);
add(kick(), START.free, 0.9);
add(kick(), START.free + BEAT * 2, 0.9);
add(impact(), START.free + 26, 0.6);

// CTA (565): final riser → big stinger + boom + crash on "SETTLE IT"
add(riser(0.8), START.cta - 22, 0.8);
add(sub(41, 1.0), START.cta, 1.0);
add(crash(), START.cta, 0.55);
add(stinger(146.83), START.cta, 0.9); // D3 chord ring-out
add(kick(), START.cta, 1.0);
// a couple of resolving kicks then let it ring
add(kick(), START.cta + BEAT * 2, 0.8);
add(kick(), START.cta + BEAT * 4, 0.7);
add(stinger(146.83 * 2), START.cta + BEAT * 4, 0.4);

// ---- normalize + gentle soft-clip ------------------------------------------
let peak = 0;
for (let i = 0; i < master.length; i++) peak = Math.max(peak, Math.abs(master[i]));
const norm = peak > 0 ? 0.82 / peak : 1;
for (let i = 0; i < master.length; i++) master[i] = Math.tanh(master[i] * norm * 1.1);

// ---- WAV encode (mono 16-bit) ----------------------------------------------
const encodeWav = (samples) => {
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    b.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return b;
};

export const ensurePromoAudio = (outDir = DEFAULT_OUT, force = false) => {
  mkdirSync(outDir, { recursive: true });
  const fp = path.join(outDir, "soundtrack.wav");
  if (!force && existsSync(fp)) return 0;
  writeFileSync(fp, encodeWav(master));
  return 1;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = ensurePromoAudio(DEFAULT_OUT, process.argv.includes("--force"));
  console.log(n === 0 ? "Promo soundtrack already present." : `Wrote promo soundtrack (${(TOTAL / FPS).toFixed(1)}s) to ${DEFAULT_OUT}`);
}
