// One place for the frame math — Root's calculateMetadata and the component
// must agree on phase boundaries or the video cuts off mid-reveal.
export const FPS = 30;

export const HOOK_FRAMES = 60; // title card before the first club
export const CLUB_STEP = 42; // one club lands every 1.4s
export const COUNTDOWN_FRAMES = 90; // WHO IS HE? 3-2-1
export const REVEAL_FRAMES = 80;
export const CTA_FRAMES = 80;

export type Phases = {
  hookEnd: number;
  clubsEnd: number;
  countdownEnd: number;
  revealEnd: number;
  total: number;
};

export const phases = (clubCount: number): Phases => {
  const hookEnd = HOOK_FRAMES;
  const clubsEnd = hookEnd + clubCount * CLUB_STEP;
  const countdownEnd = clubsEnd + COUNTDOWN_FRAMES;
  const revealEnd = countdownEnd + REVEAL_FRAMES;
  return { hookEnd, clubsEnd, countdownEnd, revealEnd, total: revealEnd + CTA_FRAMES };
};
