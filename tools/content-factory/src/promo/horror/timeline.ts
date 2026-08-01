// "HORROR" — the trailer parody. Every fan has a fear; it isn't relegation
// or penalties, it's the words "PROVE IT." Dread builds on a ~69 BPM
// heartbeat (26 frames per pulse), then the CTA flips the genre for the gag.
// promo/horror-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 69; // ≈ 30*60/26
export const BEAT = 26; // one heartbeat
export const BAR = 104;

export type HKey = "cold" | "denial" | "reveal" | "poster" | "cta";

export const SCENES: { key: HKey; dur: number }[] = [
  { key: "cold", dur: 66 }, // THIS SUMMER… every fan has a fear
  { key: "denial", dur: 80 }, // it's not relegation. it's not penalties.
  { key: "reveal", dur: 70 }, // it's two words: PROVE IT.
  { key: "poster", dur: 86 }, // the movie poster: THE SCOREBOARD
  { key: "cta", dur: 100 }, // genre flip: FACE YOUR FEAR.
];

export const START: Record<HKey, number> = (() => {
  const o = {} as Record<HKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
