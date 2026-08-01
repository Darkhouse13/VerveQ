// "HOW GOOD ARE YOU REALLY?" — the play-along quiz tease. A ticking-clock
// quiz-show feel (100 BPM → 18 frames per beat) and full-colour question grounds
// that flip per scene — nothing like #1's cream montage or #2's ink versus.
// promo/quiztease-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 100;
export const BEAT = 18;

export type QKey = "hook" | "q1" | "q2" | "rapid" | "stat" | "modes" | "cta";

export const SCENES: { key: QKey; dur: number }[] = [
  { key: "hook", dur: 90 }, // how good are you really?
  { key: "q1", dur: 108 }, // question 1 — play along
  { key: "q2", dur: 90 }, // question 2 — faster
  { key: "rapid", dur: 72 }, // overwhelm montage
  { key: "stat", dur: 72 }, // most fans get under half
  { key: "modes", dur: 72 }, // where you prove it
  { key: "cta", dur: 90 }, // find out
];

export const START: Record<QKey, number> = (() => {
  const o = {} as Record<QKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
