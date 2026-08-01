// "VERSUS" — the head-to-head taunt promo. Heavier, slower half-time feel
// (90 BPM → 20 frames per beat) so it lands nothing like the driving #1.
// promo/versus-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 90;
export const BEAT = 20;
export const BAR = 80;

export type VKey = "hook" | "vs" | "duel" | "arena" | "rivalry" | "cta";

export const SCENES: { key: VKey; dur: number }[] = [
  { key: "hook", dur: 100 }, // "your mate thinks he knows ball. he doesn't."
  { key: "vs", dur: 80 }, // split-screen VS clash
  { key: "duel", dur: 100 }, // send a link
  { key: "arena", dur: 80 }, // or go live
  { key: "rivalry", dur: 80 }, // keep the receipts
  { key: "cta", dur: 100 }, // stop arguing. settle it.
];

export const START: Record<VKey, number> = (() => {
  const o = {} as Record<VKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
