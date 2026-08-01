// "ASMR" — the sound-on satisfier. No shouting: a streak counter ticking up,
// letter boxes clicking into place, the double-ding of being right. Drums
// don't enter until the CTA — the clicks ARE the track. Event-driven, with a
// gentle 112.5 BPM (16 frames per beat) groove only at the end.
// promo/asmr-audio.mjs mirrors this table (and the EVENTS below).
export const FPS = 30;
export const BPM = 112.5;
export const BEAT = 16;
export const BAR = 64;

export type AKey = "hook" | "streak" | "letters" | "ten" | "cta";

export const SCENES: { key: AKey; dur: number }[] = [
  { key: "hook", dur: 64 }, // 🔊 sound on — the most satisfying sound in football…
  { key: "streak", dur: 96 }, // streak counter 1→8, a thock per tick
  { key: "letters", dur: 84 }, // Z I D A N E clicking in letter by letter
  { key: "ten", dur: 66 }, // 10/10 — the double-ding — "…is being right."
  { key: "cta", dur: 96 }, // GET YOUR FIX.
];

// event grids shared by scenes.tsx and asmr-audio.mjs
export const STREAK_STEP = 10; // one streak tick every 10f, first at +8
export const STREAK_COUNT = 8;
export const LETTER_STEP = 11; // one letter every 11f, first at +8
export const WORD = "ZIDANE";

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
