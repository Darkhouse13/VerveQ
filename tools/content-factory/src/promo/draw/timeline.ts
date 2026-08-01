// "THE DECISION" — THE DRAW launch promo v2. Not a story about the mode: one
// run of today's board where the VIEWER makes the BANK-or-PUSH call live. The
// research behind the shape (Monid/TikTok sweep, 2026-07-23): play-along
// formats own the niche (Guess-The-Imposter 2.1M views, 1.4–2.5% share rate),
// pride bait ("99% fail") drives shares, and product-first promos die (a
// literal "play my quiz site" post was the dataset's worst performer at 113
// views). So the reel IS a round: run → fork → countdown the viewer answers →
// his fate → "would YOU have banked?".
// Every number on screen is engine-exact from configs/c13v1.ts: thresholds
// 350/443/560/708/1076, bust keeps 15% (0.1501), 2,431 × 0.1501 = 365.
// 120 BPM (15 frames per beat) — tension tempo. promo/draw-audio.mjs mirrors
// this table.
export const FPS = 30;
export const BPM = 120;
export const BEAT = 15;
export const BAR = 60;

export type DKey = "hook" | "run" | "gauntlet" | "fork" | "count" | "reveal" | "cta";

export const SCENES: { key: DKey; dur: number }[] = [
  { key: "hook", dur: 60 }, // 2,431 PTS. ONE TAP FROM GLORY.
  { key: "run", dur: 105 }, // the draft, compressed — pick 1 of 3, chain lights
  { key: "gauntlet", dur: 90 }, // F1-F3 cleared, the counter climbs
  { key: "fork", dur: 120 }, // BANK 2,431 vs PUSH — F4 clears at 708
  { key: "count", dur: 90 }, // 3-2-1 — the viewer locks a call
  { key: "reveal", dur: 105 }, // HE PUSHED. → BUSTED. KEPT 365.
  { key: "cta", dur: 150 }, // WOULD YOU HAVE BANKED? → verveq.com/draw
];

export const START: Record<DKey, number> = (() => {
  const o = {} as Record<DKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0); // 720 = 24.0s
