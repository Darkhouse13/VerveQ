// "SPEEDRUN" — the gaming-HUD hijack. An argument, speedrun any%: opinion
// dropped, "source?", duel link sent, 9–4, chat goes silent — NEW WORLD
// RECORD 0:09.94. Chiptune drive at 150 BPM (12 frames per beat).
// promo/speedrun-audio.mjs mirrors this table (and SPLITS below).
export const FPS = 30;
export const BPM = 150;
export const BEAT = 12;
export const BAR = 48;

export type SKey = "title" | "run" | "wr" | "cta";

export const SCENES: { key: SKey; dur: number }[] = [
  { key: "title", dur: 64 }, // ARGUMENT SPEEDRUN — WR ATTEMPT
  { key: "run", dur: 150 }, // the splits land one by one
  { key: "wr", dur: 72 }, // timer freezes: NEW WORLD RECORD
  { key: "cta", dur: 100 }, // SETTLE IT. FAST.
];

// LiveSplit rows — local frame within "run", displayed split time, gold flag.
// The Dave Cinematic Universe score stays 9–4.
export const SPLITS = [
  { name: "opinion dropped", at: 14, time: "0:01.2", gold: false },
  { name: '"source?"', at: 40, time: "0:02.9", gold: false },
  { name: "duel link sent", at: 66, time: "0:04.1", gold: true },
  { name: "score: 9–4", at: 98, time: "0:07.8", gold: false },
  { name: "chat goes silent", at: 124, time: "0:09.9", gold: true },
];

export const WR_TIME = "0:09.94";

export const START: Record<SKey, number> = (() => {
  const o = {} as Record<SKey, number>;
  let f = 0;
  for (const s of SCENES) {
    o[s.key] = f;
    f += s.dur;
  }
  return o;
})();

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);
