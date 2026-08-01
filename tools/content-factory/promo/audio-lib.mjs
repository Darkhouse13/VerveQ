// Shared synthesis library for the promo soundtracks. Original synthesis,
// seeded PRNG, zero deps — every promo scores itself from these building blocks
// so the three videos sound like one brand while each arranges its own track.
// (audio-gen.mjs — the first promo — predates this lib and stays self-contained;
// promos #2/#3 build on this.)
//
// SEEDING (changed 2026-08-01 — see docs/DECISIONS.md, "SFX seed epoch")
//
// The noise generator used to be ONE module-level `makeRng(1337)` shared by
// every synth in the process. That made a bed's noise depend on how many synth
// calls had already run — so `node promo/x-audio.mjs` and `npm run promo`,
// which imports ~29 audio modules that each build at import time, produced
// DIFFERENT beds for the same promo. A clean-clone test caught it: identical
// video frames, different audio.
//
// Now each promo seeds its own stream from its stable name, using the same
// salting philosophy as the visual variant axes (src/variants.ts): FNV-1a of
// `name + "|sfx"` into mulberry32. A promo's bed is therefore a pure function
// of its name and its arrangement — identical regardless of entry point,
// import order, or which other promos are in the same process.
//
// Seeding happens in the Mixer constructor, which every arrangement builds
// before its first synth call, so there is no separate step to forget. Calling
// a noise-using synth with no Mixer constructed is a hard error rather than
// silent nondeterminism.
export const SR = 44100;

export const makeRng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
// FNV-1a, mirrored from src/variants.ts so the audio and visual lanes salt
// their seeds the same way.
export const fnv1a = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

let rng = null;
let seededAs = null;

// Start a promo's noise stream. Idempotent for a given name, so re-seeding the
// same promo mid-arrangement is a no-op rather than a rewind.
export const seedSfx = (name) => {
  if (!name || typeof name !== "string") {
    throw new Error("seedSfx(name): a stable promo name is required — it IS the seed.");
  }
  rng = makeRng(fnv1a(name + "|sfx"));
  seededAs = name;
  return name;
};

export const currentSfxSeed = () => seededAs;

const noise = () => {
  if (rng === null) {
    throw new Error(
      "audio-lib: a noise synth ran before any Mixer was constructed, so its " +
        "stream is unseeded. Construct `new Mixer(name, …)` first — the name is the seed.",
    );
  }
  return rng() * 2 - 1;
};
const buf = (dur) => new Float32Array(Math.floor(SR * dur));

export const kick = () => {
  const o = buf(0.22);
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const f = 130 * Math.exp(-t * 38) + 45;
    ph += (2 * Math.PI * f) / SR;
    const click = t < 0.004 ? noise() * Math.exp(-t * 600) * 0.5 : 0;
    o[i] = (Math.sin(ph) * Math.exp(-t * 24) + click) * 0.95;
  }
  return o;
};

export const sub = (freq, dur) => {
  const o = buf(dur);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.006) * Math.exp(-t * (1.6 / dur));
    o[i] = (Math.sin(2 * Math.PI * freq * t) + Math.sin(2 * Math.PI * freq * 2 * t) * 0.15) * env * 0.8;
  }
  return o;
};

export const bass = (freq, dur) => {
  const o = buf(dur);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.005) * Math.exp(-t * (3.0 / dur));
    const s = Math.sin(2 * Math.PI * freq * t) * 0.7 + Math.sin(2 * Math.PI * freq * 2 * t) * 0.24 + Math.sin(2 * Math.PI * freq * 3 * t) * 0.12;
    o[i] = s * env * 0.5;
  }
  return o;
};

export const pluck = (freq, dur = 0.19) => {
  const o = buf(dur);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const s = Math.sin(2 * Math.PI * freq * t) + 0.4 * Math.sin(2 * Math.PI * 2 * freq * t) + 0.2 * Math.sin(2 * Math.PI * 3 * freq * t);
    o[i] = s * Math.exp(-t * 17) * 0.32;
  }
  return o;
};

export const hat = (open = false) => {
  const o = buf(open ? 0.14 : 0.045);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    o[i] = noise() * Math.exp(-t * (open ? 40 : 200)) * 0.26;
  }
  return o;
};

export const clap = () => {
  const o = buf(0.18);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    // three quick noise bursts then a body
    const bursts = (t < 0.01 ? 1 : 0) + (t > 0.012 && t < 0.02 ? 1 : 0) + (t > 0.022 && t < 0.03 ? 1 : 0);
    const body = Math.exp(-t * 30);
    o[i] = noise() * (bursts * 0.6 + body) * 0.4;
  }
  return o;
};

export const impact = () => {
  const o = buf(0.3);
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

export const whoosh = (dur = 0.4) => {
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

export const riser = (dur) => {
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

export const stinger = (root, dur = 1.1) => {
  const o = buf(dur);
  const parts = [root, root * 1.26, root * 1.5, root * 2, root * 2.52];
  const amps = [0.42, 0.3, 0.28, 0.18, 0.1];
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    let s = 0;
    for (let j = 0; j < parts.length; j++) s += Math.sin(2 * Math.PI * parts[j] * t) * amps[j];
    const env = Math.min(1, t / 0.005) * Math.exp(-t * (2.6 / (dur / 1.1)));
    o[i] = (s + noise() * Math.exp(-t * 26) * 0.06) * env * 0.5;
  }
  return o;
};

export const crash = () => {
  const o = buf(0.9);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    o[i] = noise() * Math.exp(-t * 5) * 0.4;
  }
  return o;
};

export const blip = (freq, dur = 0.08) => {
  const o = buf(dur);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    o[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 40) * 0.4;
  }
  return o;
};

// dry clock tick (quiz-show clock)
export const tick = () => {
  const o = buf(0.02);
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * 1800) / SR;
    o[i] = (Math.sin(ph) * 0.6 + noise() * 0.4) * Math.exp(-t * 260) * 0.6;
  }
  return o;
};

// bright two-note "correct" ding
export const ding = () => {
  const o = buf(0.35);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const f = t < 0.08 ? 880 : 1318; // A5 → E6
    o[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 8) * 0.4;
  }
  return o;
};

// dissonant "wrong" buzz
export const buzz = (dur = 0.4) => {
  const o = buf(dur);
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const s = Math.sign(Math.sin(2 * Math.PI * 110 * t)) * 0.4 + Math.sign(Math.sin(2 * Math.PI * 116 * t)) * 0.4; // beating square
    o[i] = s * Math.min(1, t / 0.005) * Math.exp(-t * (2.4 / dur)) * 0.45;
  }
  return o;
};

export const encodeWav = (samples) => {
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

// A master-buffer mixer that maps frames→samples at a given fps.
export class Mixer {
  // `name` is first and required: it is this promo's SFX seed, and putting it
  // first makes it impossible to add a Mixer without choosing one.
  constructor(name, totalFrames, fps = 30, tailSec = 1.2) {
    seedSfx(name);
    this.name = name;
    this.fps = fps;
    this.buf = new Float32Array(Math.round((totalFrames / fps) * SR) + Math.floor(SR * tailSec));
  }
  add(src, atFrame, gain = 1) {
    const off = Math.round((atFrame / this.fps) * SR);
    for (let i = 0; i < src.length; i++) {
      const j = off + i;
      if (j >= 0 && j < this.buf.length) this.buf[j] += src[i] * gain;
    }
  }
  finalize(peakTarget = 0.82, drive = 1.1) {
    let peak = 0;
    for (let i = 0; i < this.buf.length; i++) peak = Math.max(peak, Math.abs(this.buf[i]));
    const norm = peak > 0 ? peakTarget / peak : 1;
    for (let i = 0; i < this.buf.length; i++) this.buf[i] = Math.tanh(this.buf[i] * norm * drive);
    return this.buf;
  }
}
