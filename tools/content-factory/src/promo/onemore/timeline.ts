// "ONE MORE" — the 1AM can't-stop promo. Hypnotic ~129 BPM (14 frames per
// beat), nocturnal ink-and-lime, and a soundtrack that literally adds one more
// layer every bar. The joke structure: spiral → dead-quiet gag → relapse.
// promo/onemore-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 129; // ≈ 30*60/14
export const BEAT = 14;
export const BAR = 56;

export type OKey = "hook" | "spiral" | "busted" | "cta";

export const SCENES: { key: OKey; dur: number }[] = [
  { key: "hook", dur: 84 }, // 00:41 — "you said one game."
  { key: "spiral", dur: 140 }, // clock lurches, ONE MORE stamps pile up
  { key: "busted", dur: 70 }, // quiet: "you have work in six hours." … relapse
  { key: "cta", dur: 98 }, // it's never just one.
];

export const START: Record<OKey, number> = (() => {
  const o = {} as Record<OKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
