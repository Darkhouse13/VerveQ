// "BREAKING" — the transfer-news parody promo. Football fans are Pavlovian
// about BREAKING chyrons, LIVE badges and tickers, so the news format itself
// is the frame-0 hook. Driving 112.5 BPM (16 frames per beat) newsroom pulse.
// promo/breaking-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 112.5; // 30*60/16
export const BEAT = 16;
export const BAR = 64;

export type BKey = "alert" | "stats" | "official" | "deal" | "cta";

export const SCENES: { key: BKey; dur: number }[] = [
  { key: "alert", dur: 80 }, // BREAKING: local man loses same argument. again.
  { key: "stats", dur: 64 }, // sources confirm: wins 0, evidence none
  { key: "official", dur: 64 }, // OFFICIAL: there's a way to settle it. here we go.
  { key: "deal", dur: 64 }, // the terms
  { key: "cta", dur: 96 }, // DONE DEAL.
];

export const START: Record<BKey, number> = (() => {
  const o = {} as Record<BKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
