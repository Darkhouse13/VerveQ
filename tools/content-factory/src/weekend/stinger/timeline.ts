// CT-1 "WKND-STINGER" — the campaign ident. ~8s, loop-friendly: ink ground
// throughout (THE WEEKEND's world is the teaser card's inverted scheme — ink
// ground, lime lead, cream support — deliberately NOT the cream quiz brand),
// readable on frame 0 with motion underway, dead-still tail for a clean cut.
// 120 BPM (15 frames per beat). weekend/stinger-audio.mjs mirrors this table.
//
// Copy law (CT-1): mechanic shapes only, no sim-tunable constants; product
// claims are the LOCKED specs / live FW-P1 teaser copy verbatim; date is
// "LATE AUGUST", never a day.
export const FPS = 30;
export const BEAT = 15; // 120 BPM

export type SKey = "drum" | "lock" | "date" | "cta";

export const SCENES: { key: SKey; dur: number }[] = [
  { key: "drum", dur: 60 }, // FIVE LEAGUES. / ONE SQUAD. — a line per 2 beats
  { key: "lock", dur: 75 }, // THE WEEKEND lockup + live teaser subline
  { key: "date", dur: 60 }, // LATE AUGUST + JOIN THE WAITLIST
  { key: "cta", dur: 45 }, // verveq.com button, then a still tail
];

export const START: Record<SKey, number> = (() => {
  const o = {} as Record<SKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0); // 240 = 8.0s
