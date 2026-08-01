// "WRAPPED" — the year-in-review stats parody. Your season in football
// arguments, as absurd personal stats. Brightest and fastest of the set:
// ~164 BPM (11 frames per beat), pop-major soundtrack, full accent rotation.
// promo/wrapped-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 164; // ≈ 30*60/11
export const BEAT = 11;
export const BAR = 44;

export type WKey = "intro" | "stat1" | "stat2" | "stat3" | "turn" | "cta";

export const SCENES: { key: WKey; dur: number }[] = [
  { key: "intro", dur: 66 }, // your argument season, wrapped.
  { key: "stat1", dur: 55 }, // arguments started: 147
  { key: "stat2", dur: 55 }, // arguments won: 0 (self-reported: 147)
  { key: "stat3", dur: 55 }, // hours spent arguing: 312
  { key: "turn", dur: 66 }, // new season. new stat: PROOF.
  { key: "cta", dur: 88 }, // change your stats.
];

export const START: Record<WKey, number> = (() => {
  const o = {} as Record<WKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
