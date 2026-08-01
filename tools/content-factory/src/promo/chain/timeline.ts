// "THE CHAIN" — a relay the viewer is expected to finish in the comments.
//
// The highest comment-per-view format observed in the wild is not a quiz at
// all: it names a category, gives one example, and hands over ("I'll start —
// your turn"). It never resolves, so the video's last slot is an empty box
// with a caret in it. Two deliberate choices do the work:
//   1. the fifth slot is never filled — the comment box is the fifth slot;
//   2. the MOST famous qualifying player is left out on purpose (Cristiano
//      Ronaldo). Being the one to point out the obvious omission is the
//      cheapest possible reason to comment, and it is irresistible.
//
// Frame 0 shows the RULE plus the first link already filled — the format's
// whole premise ("I'll start, your turn") has to be legible before the viewer
// decides to scroll, and an empty list communicates nothing. The remaining
// three stamp in on the beat, then a clearing sweep resets the board before
// the video restarts, so the loop reads as a new round rather than a glitch.
export const FPS = 30;
export const TOTAL = 330; // 11.0s — 22 beats at 120 BPM (15f), closes exactly
export const BEAT = 15;

export const CLUB_A = "REAL MADRID";
export const CLUB_B = "MANCHESTER UNITED";

// All four verified both-clubs players, sourced from
// app/convex/data/football_career_paths.json:
//   cp-beckham          Manchester United → Real Madrid
//   cp-van-nistelrooy   Manchester United → Real Madrid
//   cp-di-maria         Real Madrid → Manchester United
//   cp-casemiro         Real Madrid → Manchester United
// Ronaldo (cp-cristiano-ronaldo) is omitted on purpose — see the header. His
// path is never shown, so he is NOT spent in ledger.json.
//
// CASTING: Heinze (cp-gabriel-heinze) was the fourth link in the first cut and
// he is the exact filler this lane can no longer afford — factually perfect,
// recognised by nobody scrolling. Casemiro replaces him: Real Madrid → United
// is recent enough that a casual fan has an opinion about it.
//
// ⚠ This desynchronises the H1 A/B with src/promo/pickaside/, which pins the
// SAME FOUR NAMES on purpose so that question-type is the only moving variable.
// Mirror this array into pickaside/timeline.ts NAMES and re-render it before
// reading the two against each other again.
export const LINKS = ["BECKHAM", "VAN NISTELROOY", "DI MARÍA", "CASEMIRO"];

export const NAME_AT = [0, 45, 90, 135]; // link 1 is on screen at frame 0
export const FADE_FROM = 300; // names clear before the seam so the loop closes
export const CARET_PERIOD = 15; // divides TOTAL
