// "TUTORIAL" — the deadpan how-to. How to win any football argument, in
// three steps: stop talking, send one link, screenshot the result. That's it,
// that's the tutorial. Clean 112.5 BPM groove (16 frames per beat) that DROPS
// OUT for the deadpan frame. promo/tutorial-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 112.5;
export const BEAT = 16;
export const BAR = 64;

export type TKey = "hook" | "step1" | "step2" | "step3" | "done" | "cta";

export const SCENES: { key: TKey; dur: number }[] = [
  { key: "hook", dur: 60 }, // HOW TO WIN ANY FOOTBALL ARGUMENT.
  { key: "step1", dur: 66 }, // STEP 1 — STOP TALKING.
  { key: "step2", dur: 66 }, // STEP 2 — SEND ONE LINK.
  { key: "step3", dur: 78 }, // STEP 3 — SCREENSHOT THE RESULT. (9–4)
  { key: "done", dur: 56 }, // that's it. that's the tutorial.
  { key: "cta", dur: 90 }, // CLASS DISMISSED.
];

export const SHUTTER_AT = 38; // local frame in step3 where the photo is taken

export const START: Record<TKey, number> = (() => {
  const o = {} as Record<TKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
