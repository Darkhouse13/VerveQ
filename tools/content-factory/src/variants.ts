// Per-video variation. Every rendered clip derives its entire look and feel
// from ONE seed — the player's dataset id — so the same id always produces the
// identical video (safe to re-render, safe to commit to the ledger) while
// different ids get a different palette, background, header, row shape, motion
// personality, on-screen copy, and sound kit.
//
// The axes are independent and combine multiplicatively: a handful of options
// each yields hundreds of distinct-looking videos, and every one stays inside
// the VerveQ brand family — cream ground, ink, brand accents only. This is the
// answer to "stop shipping the same video with a different name on it".
import { COLORS } from "./theme";
import { COPY } from "./copy";

// ---- deterministic RNG ------------------------------------------------------
// FNV-1a hash of the id, then mulberry32. Each axis draws from its OWN salted
// RNG (id + "|axisName") so adding a new axis later never reshuffles the axes
// that already shipped — a player's past look stays frozen.
export const fnv1a = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

export const makeRng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pickBy = <T>(id: string, axis: string, arr: readonly T[]): T =>
  arr[Math.floor(makeRng(fnv1a(id + "|" + axis))() * arr.length)];

// ---- axis 1: palette (which brand accent leads) -----------------------------
// Ground stays cream and ink stays ink — always. Only the *lead* accent and
// the reveal-card colour rotate, so the frame reads unmistakably VerveQ while
// still feeling like a different edition each time.
export type Palette = {
  key: string;
  lead: string; // pills, position badges, progress bar, CTA button, underline
  leadFg: string; // text/graphics on top of `lead`
  reveal: string; // the reveal card background
  revealFg: string; // the answer text on the reveal card
};

const PALETTES: readonly Palette[] = [
  { key: "classic", lead: COLORS.orange, leadFg: COLORS.white, reveal: COLORS.lime, revealFg: COLORS.ink },
  { key: "magenta", lead: COLORS.pink, leadFg: COLORS.white, reveal: COLORS.yellow, revealFg: COLORS.ink },
  { key: "cobalt", lead: COLORS.blue, leadFg: COLORS.white, reveal: COLORS.lime, revealFg: COLORS.ink },
  { key: "forest", lead: COLORS.green, leadFg: COLORS.white, reveal: COLORS.yellow, revealFg: COLORS.ink },
  { key: "voltage", lead: COLORS.lime, leadFg: COLORS.ink, reveal: COLORS.pink, revealFg: COLORS.white },
  { key: "sunset", lead: COLORS.orange, leadFg: COLORS.white, reveal: COLORS.pink, revealFg: COLORS.white },
];

// ---- axis 2: background texture (subtle, behind everything) -----------------
export type BgKind = "plain" | "dots" | "grid" | "hatch" | "confetti";
const BGS: readonly BgKind[] = ["plain", "dots", "grid", "hatch", "confetti"];

// ---- axis 3: header layout --------------------------------------------------
export type HeaderStyle = "left" | "center" | "band";
const HEADERS: readonly HeaderStyle[] = ["left", "center", "band"];

// ---- axis 4: club-row style -------------------------------------------------
export type RowStyle = "card" | "slab" | "ticket";
const ROWS: readonly RowStyle[] = ["card", "slab", "ticket"];

// ---- axis 5: motion personality ---------------------------------------------
export type MotionKey = "snappy" | "bouncy" | "smooth" | "slam";
const MOTIONS: readonly MotionKey[] = ["snappy", "bouncy", "smooth", "slam"];

export type MotionProfile = {
  damping: number;
  // transform for an entering element given spring progress s (0..1) and the
  // row's resting tilt in degrees
  entrance: (s: number, tilt: number) => string;
};

export const motionProfile = (key: MotionKey): MotionProfile => {
  switch (key) {
    case "snappy":
      return { damping: 15, entrance: (s, t) => `scale(${0.72 + s * 0.28}) rotate(${(1 - s) * 6 + t}deg)` };
    case "bouncy":
      return { damping: 9, entrance: (s, t) => `scale(${0.6 + s * 0.4}) rotate(${(1 - s) * 10 + t}deg)` };
    case "smooth":
      return { damping: 14, entrance: (s, t) => `translateX(${(1 - s) * -70}px) scale(${0.9 + s * 0.1}) rotate(${t}deg)` };
    case "slam":
      return { damping: 13, entrance: (s, t) => `scale(${1.18 - s * 0.18}) rotate(${t * (1 - s)}deg)` };
  }
};

// ---- axis 6: sound kit ------------------------------------------------------
// Which synthesized SFX set plays (see sfx/gen.mjs). Deep/punchy, bright/clicky,
// soft/woody — so videos SOUND different even before a trending sound is added
// on top in the app.
export type SoundKit = "a" | "b" | "c";
const KITS: readonly SoundKit[] = ["a", "b", "c"];

// ---- the resolved variant ---------------------------------------------------
export type Variant = {
  palette: Palette;
  bg: BgKind;
  header: HeaderStyle;
  row: RowStyle;
  motion: MotionKey;
  kit: SoundKit;
  copy: {
    subhead: string;
    countdown: string;
    comment: string;
    revealLabel: string;
    cta: string;
  };
  seed: number; // for anything that needs its own scatter (confetti layout)
};

export const getVariant = (id: string): Variant => ({
  palette: pickBy(id, "palette", PALETTES),
  bg: pickBy(id, "bg", BGS),
  header: pickBy(id, "header", HEADERS),
  row: pickBy(id, "row", ROWS),
  motion: pickBy(id, "motion", MOTIONS),
  kit: pickBy(id, "kit", KITS),
  copy: {
    subhead: pickBy(id, "copy.subhead", COPY.subhead),
    countdown: pickBy(id, "copy.countdown", COPY.countdown),
    comment: pickBy(id, "copy.comment", COPY.comment),
    revealLabel: pickBy(id, "copy.revealLabel", COPY.revealLabel),
    cta: pickBy(id, "copy.cta", COPY.cta),
  },
  seed: fnv1a(id + "|layout"),
});
