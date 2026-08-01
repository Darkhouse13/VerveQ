// "SEMI-FINAL" — the matchday one-off. England v Argentina, 15 Jul 2026,
// posted an hour before kickoff. 120 BPM (15 frames per beat), 29.5s.
//
// The only narrated promo in the set, and the timeline is built the other way
// round because of it: every `dur` below is the line's MEASURED speech length
// (promo/vo-cache/manifest.json) quantised UP to the next beat, so the voice
// never gets clipped and every scene cut still lands on a beat. If you change
// a VO line, re-run `node promo/semifinal-vo.mjs`, read the printed durations,
// and re-quantise here — don't eyeball it.
// promo/semifinal-audio.mjs mirrors this table.
export const FPS = 30;
export const BPM = 120;
export const BEAT = 15;
export const BAR = 60;

export type SKey = "never" | "notonce" | "susp" | "red" | "ban" | "days" | "hist" | "tonight" | "ask" | "cta";

// dur = speech quantised up to a beat boundary; `speech` is the raw measurement
// kept alongside so the gap (the breath after the line) is visible at a glance.
export const SCENES: { key: SKey; dur: number; speech: number }[] = [
  { key: "never", dur: 90, speech: 84 }, // MESSI HAS NEVER PLAYED ENGLAND — the hook
  { key: "notonce", dur: 30, speech: 24 }, // "Not once." — ink flash, 1s punch
  { key: "susp", dur: 90, speech: 82 }, // 12 NOV 2005 → SUSPENDED
  { key: "red", dur: 135, speech: 118 }, // the red card — AGAINST HUNGARY, said out loud
  { key: "ban", dur: 180, speech: 166 }, // the mechanism, and the punchline: England
  { key: "days", dur: 120, speech: 110 }, // 7,550 counts up on the spoken words
  { key: "hist", dur: 150, speech: 132 }, // 1986 / 1998 / 2002
  { key: "tonight", dur: 45, speech: 26 }, // UNTIL TONIGHT. — the turn
  { key: "ask", dur: 75, speech: 58 }, // how much of that did you know?
  { key: "cta", dur: 90, speech: 24 }, // PROVE IT. → verveq.com
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

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0); // 1005 = 33.5s

// Music ducks under the voice. Broadcast habit: the score is loud in the gaps
// and gets out of the way of the words. These are the windows where a line is
// actually being spoken (scene start → start+speech), used by SemiFinal.tsx as
// a frame→volume function on the music track.
export const VO_WINDOWS: [number, number][] = SCENES.map((s) => [START[s.key], START[s.key] + s.speech]);
