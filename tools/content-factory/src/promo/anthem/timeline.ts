// "ANTHEM" — the kinetic-typography brand manifesto. Fastest cut in the set:
// 150 BPM (12 frames per beat), one word per beat, full-ground colour flips —
// then a dead-silent cream pattern-interrupt before the payoff. Ground flips
// stay at ≤2.5 per second between mid-luminance accents (photosensitivity
// headroom — never strobe ink/white at this rate).
// promo/anthem-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 150;
export const BEAT = 12;
export const BAR = 48;

export type AKey = "chant" | "same" | "strobe" | "deadpan" | "cta";

export const SCENES: { key: AKey; dur: number }[] = [
  { key: "chant", dur: 96 }, // EVERY PUB. EVERY OFFICE. — word per beat
  { key: "same", dur: 72 }, // SAME ARGUMENT. / who actually knows ball?
  { key: "strobe", dur: 60 }, // five modes, one per beat
  { key: "deadpan", dur: 72 }, // silence: "there's a website for this now."
  { key: "cta", dur: 96 }, // TALK IS CHEAP. → verveq.com
];

export const START: Record<AKey, number> = (() => {
  const o = {} as Record<AKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
