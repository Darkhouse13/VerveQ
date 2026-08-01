// "LICENSE" — the bureaucracy parody. Football opinions now require a
// license: the card, the qualifying requirements (real modes), Dave's DENIED
// stamp, earn yours. ~95 BPM (19 frames per beat) dry rubber-stamp march.
// promo/license-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 95; // ≈ 30*60/19
export const BEAT = 19;
export const BAR = 76;

export type LKey = "decree" | "card" | "reqs" | "denied" | "cta";

export const SCENES: { key: LKey; dur: number }[] = [
  { key: "decree", dur: 76 }, // public notice: opinions require a license
  { key: "card", dur: 95 }, // the license itself, fields typing in
  { key: "reqs", dur: 95 }, // to qualify: the checklist
  { key: "denied", dur: 76 }, // dave's application: DENIED (vibes only)
  { key: "cta", dur: 114 }, // earn yours.
];

export const START: Record<LKey, number> = (() => {
  const o = {} as Record<LKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
