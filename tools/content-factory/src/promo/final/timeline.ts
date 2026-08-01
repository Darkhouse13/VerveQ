// "FINAL" — the matchday countdown. The World Cup final is July 19; the
// players are warming up and so should you. Stadium four-on-the-floor at
// ~129 BPM (14 frames per beat). promo/final-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 129; // ≈ 30*60/14
export const BEAT = 14;
export const BAR = 56;

export type FKey = "date" | "debates" | "prep" | "drills" | "cta";

export const SCENES: { key: FKey; dur: number }[] = [
  { key: "date", dur: 70 }, // JULY 19. — the fixture card
  { key: "debates", dur: 76 }, // the arguments have already started
  { key: "prep", dur: 70 }, // players are warming up / you should too
  { key: "drills", dur: 92 }, // matchday prep checklist (the modes as drills)
  { key: "cta", dur: 108 }, // BE MATCH FIT.
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
