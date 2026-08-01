// CT-1 "WKND-MANIFESTO" — the campaign flagship. Kinetic-type manifesto in
// THE WEEKEND's world (ink ground, lime lead, cream support): the season-long
// pains struck through one by one, the flip ("WE DELETED THE LOT."), the creed
// ("IT'S NOT A SEASON. IT'S A WEEKEND."), five mechanic shapes, the silent
// pattern interrupt ("the waitlist is open."), payoff. ~128 BPM (14 frames per
// beat), a line per 2 beats — Anthem's grammar at a readable pace.
// weekend/manifesto-audio.mjs mirrors this table.
//
// Copy law (CT-1): mechanic shapes only, never sim-tunable constants — no
// clock seconds, multipliers, clamps or cooldowns on screen. A2: no
// competitor named in rendered evergreen video — the pains are "season-long
// fantasy", generic. All claims trace to the LOCKED specs; date stays
// "LATE AUGUST".
export const FPS = 30;
export const BEAT = 14; // ~128.6 BPM
export const LINE = BEAT * 2; // one readable line per 2 beats

export type MKey = "grind" | "flip" | "creed" | "shapes" | "deadpan" | "cta";

export const SCENES: { key: MKey; dur: number }[] = [
  { key: "grind", dur: 112 }, // 4 pains × 28f, each struck through
  { key: "flip", dur: 56 }, // WE DELETED / THE LOT.
  { key: "creed", dur: 84 }, // IT'S NOT A SEASON. / IT'S A WEEKEND.
  { key: "shapes", dur: 140 }, // 5 mechanic shapes × 28f
  { key: "deadpan", dur: 66 }, // TRUE SILENCE: "the waitlist is open."
  { key: "cta", dur: 100 }, // lockup → LATE AUGUST → verveq.com
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

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0); // 558 = 18.6s
