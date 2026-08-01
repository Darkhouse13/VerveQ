// "REMATCH" — the revenge-arc promo. A story told in DAY chips: the loss,
// the reps, the callout, the rematch, the payoff. First narrative structure
// in the set. 100 BPM (18 frames per beat) — driving but readable.
// promo/rematch-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 100;
export const BEAT = 18;
export const BAR = 72;

export type RKey = "loss" | "grind" | "callout" | "rematch" | "glory" | "cta";

export const SCENES: { key: RKey; dur: number }[] = [
  { key: "loss", dur: 72 }, // day 1 — i lost 9-4 to dave
  { key: "grind", dur: 90 }, // day 2-29 — the reps
  { key: "callout", dur: 72 }, // day 30 — rematch requested
  { key: "rematch", dur: 90 }, // the scoreboard flips
  { key: "glory", dur: 54 }, // REVENGE.
  { key: "cta", dur: 90 }, // your turn.
];

export const START: Record<RKey, number> = (() => {
  const o = {} as Record<RKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
