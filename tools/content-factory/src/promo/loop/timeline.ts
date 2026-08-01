// "LOOP" — the circular argument, engineered as a perfect seamless loop.
// Six chat bubbles orbit a ring; every 2 seconds the ring advances one slot
// and the next message takes the top. After six steps the ring has done
// exactly 360° and the state at frame 360 is IDENTICAL to frame 0 — the
// video restarts invisibly, the argument literally never ends (that's the
// joke, and replays officially count as views on IG/YT). LOOP RULES: no
// one-shot springs, every animation is a function of (frame % STEP) or has
// a period dividing TOTAL. promo/loop-audio.mjs obeys the same law (no
// audio tails across the seam; the frame-0 kick masks the cut).
export const FPS = 30;
export const TOTAL = 360; // exactly 12.0s — 6 steps × 60f
export const STEP = 60;
export const BEAT = 15; // 120 BPM: 24 beats in 360f, closes exactly

// the argument, in the order it orbits (A/B alternate speakers). Message i
// is at the top of the ring during step i.
export type LMsg = { text: string; side: "a" | "b" };
export const MESSAGES: LMsg[] = [
  { text: "he's the GOAT.", side: "a" },
  { text: "source?", side: "b" },
  { text: "trust me bro", side: "a" },
  { text: "that's not a source", side: "b" },
  { text: "you're just young", side: "a" },
  { text: "blocked.", side: "b" },
];

export const ROTATE_WINDOW = 15; // ring eases one slot in the last 15f of each step
export const TYPING_FROM = 42; // "typing…" chip within each step
export const TYPING_TO = 58;
