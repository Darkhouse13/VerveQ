// The promo's skeleton — the ONE place scene order and lengths are defined.
// promo/audio-gen.mjs mirrors this table so every musical hit lands on the
// frame it's drawn on (same duplication boundary as the theme tokens). The
// whole thing rides a 120 BPM grid: 30fps → 15 frames per beat, 60 per bar,
// so cuts and slams fall on the beat instead of drifting.
export const FPS = 30;
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM; // 15 frames
export const BAR = BEAT * 4; // 60 frames

export type SceneKey =
  | "hook"
  | "prove"
  | "logo"
  | "quiz"
  | "survival"
  | "career"
  | "blitz"
  | "arena"
  | "ranks"
  | "free"
  | "cta";

// durations in frames — must match promo/audio-gen.mjs SCENES exactly
export const SCENES: { key: SceneKey; dur: number }[] = [
  { key: "hook", dur: 75 }, // THINK YOU KNOW FOOTBALL?
  { key: "prove", dur: 60 }, // PROVE IT. (riser builds)
  { key: "logo", dur: 60 }, // VERVEQ — the drop
  { key: "quiz", dur: 45 },
  { key: "survival", dur: 45 },
  { key: "career", dur: 45 },
  { key: "blitz", dur: 45 },
  { key: "arena", dur: 45 },
  { key: "ranks", dur: 90 }, // Bronze → Platinum
  { key: "free", dur: 55 }, // Free, no sign-up
  { key: "cta", dur: 95 }, // SETTLE IT. → verveq.com
];

export const START: Record<SceneKey, number> = (() => {
  const o = {} as Record<SceneKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);

// the five mode-showcase scenes, in order
export const MODE_KEYS: SceneKey[] = ["quiz", "survival", "career", "blitz", "arena"];
