// "REMEMBER" — the nostalgia promo. 2006, sticker albums, squad numbers you
// never forgot — warmth instead of banter, the only promo that flatters the
// viewer before it challenges them. 90 BPM (20 frames per beat) but WARM —
// soft plucks and long subs, nothing like versus's menacing half-time.
// promo/remember-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 90;
export const BEAT = 20;
export const BAR = 80;

export type MKey = "year" | "album" | "numbers" | "turn" | "cta";

export const SCENES: { key: MKey; dur: number }[] = [
  { key: "year", dur: 80 }, // 2006. you stayed up for the group stages.
  { key: "album", dur: 80 }, // you kept the sticker album
  { key: "numbers", dur: 80 }, // you still know the squad numbers
  { key: "turn", dur: 100 }, // 20 years of football live in your head
  { key: "cta", dur: 100 }, // put it to work.
];

export const START: Record<MKey, number> = (() => {
  const o = {} as Record<MKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
