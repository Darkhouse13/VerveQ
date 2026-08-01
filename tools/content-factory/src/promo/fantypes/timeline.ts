// "FAN TYPES" — the taxonomy promo. Five types of football fan, one roast
// each, the villain last — taxonomy content is a tag-your-mates engine, and
// "WHICH ONE ARE YOU?" is the comment section writing itself. Swaggering
// ~106 BPM strut (17 frames per beat), unlike anything else in the set.
// promo/fantypes-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 106; // ≈ 30*60/17
export const BEAT = 17;
export const BAR = 68;

export type FKey = "hook" | "t1" | "t2" | "t3" | "t4" | "t5" | "verdict" | "cta";

export const SCENES: { key: FKey; dur: number }[] = [
  { key: "hook", dur: 68 }, // the 5 types of football fans
  { key: "t1", dur: 51 }, // the stats nerd
  { key: "t2", dur: 51 }, // the glory hunter
  { key: "t3", dur: 51 }, // the 'knew him first' guy
  { key: "t4", dur: 51 }, // the one-club martyr
  { key: "t5", dur: 68 }, // the all talk (villain — extra beat)
  { key: "verdict", dur: 68 }, // one quiz exposes everyone
  { key: "cta", dur: 85 }, // which one are you?
];

export const START: Record<FKey, number> = (() => {
  const o = {} as Record<FKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
