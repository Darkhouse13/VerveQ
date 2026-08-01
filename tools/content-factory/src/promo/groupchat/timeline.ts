// "GROUP CHAT" — the argument-that-never-ends promo. Urgent, skittering
// ~138 BPM (13 frames per beat) so it sits between nothing else in the set:
// faster than all three existing promos, built on message-pop percussion.
// promo/groupchat-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 138; // ≈ 30*60/13
export const BEAT = 13;
export const BAR = 52;

export type GKey = "hook" | "pileon" | "snap" | "score" | "cta";

export const SCENES: { key: GKey; dur: number }[] = [
  { key: "hook", dur: 78 }, // the hot take lands, replies start
  { key: "pileon", dur: 78 }, // bubbles rain, chat melts down
  { key: "snap", dur: 52 }, // 4,000 messages. zero answers.
  { key: "score", dur: 78 }, // one quiz settles it — the receipt
  { key: "cta", dur: 91 }, // end the argument.
];

export const START: Record<GKey, number> = (() => {
  const o = {} as Record<GKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
