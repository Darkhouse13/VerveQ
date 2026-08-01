// One place for the frame math — Root's calculateMetadata and the component
// must agree on phase boundaries or the video cuts off mid-reveal.
export const FPS = 30;

// Retention: 70% of viewers bailed inside 3s when the video opened on a 2s
// static title card. The heading is now readable on frame 0 and the first
// club lands at 0.33s — the game starts before a swipe decision is made.
export const HOOK_FRAMES = 10; // heading visible from frame 0; club 01 lands here
export const CLUB_STEP = 42; // steady cadence once the game is on (1.4s)
const EARLY_STEPS = [26, 36]; // clubs 02/03 land faster so the open never sits still
export const LAST_CLUB_HOLD = 48; // beat to absorb the final club before the countdown
export const COUNTDOWN_FRAMES = 72; // WHO IS HE? 3-2-1, 0.8s per digit
export const REVEAL_FRAMES = 80;
export const CTA_FRAMES = 80;

export const clubAppearAt = (i: number): number => {
  let f = HOOK_FRAMES;
  for (let k = 0; k < i; k++) f += EARLY_STEPS[k] ?? CLUB_STEP;
  return f;
};

export type Phases = {
  hookEnd: number;
  clubsEnd: number;
  countdownEnd: number;
  revealEnd: number;
  total: number;
};

export const phases = (clubCount: number): Phases => {
  const hookEnd = HOOK_FRAMES;
  const clubsEnd = clubAppearAt(clubCount - 1) + LAST_CLUB_HOLD;
  const countdownEnd = clubsEnd + COUNTDOWN_FRAMES;
  const revealEnd = countdownEnd + REVEAL_FRAMES;
  return { hookEnd, clubsEnd, countdownEnd, revealEnd, total: revealEnd + CTA_FRAMES };
};
