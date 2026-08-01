// "PICK A SIDE" — the H1 test: does an UNANSWERABLE question out-comment an
// answerable one, on our own account?
//
// This is a controlled A/B against src/promo/chain/. Same board, same length
// band, same two-door bait, and deliberately the SAME FOUR PLAYERS. The only
// variable that moves is that the question stops having a right answer:
// CHAIN asks "name a player who played for both" (checkable, so the comment
// section is a spelling contest); this asks which of them both sets of fans
// still claim (not checkable, so the comment box is the only place it lands).
//
// The sweep behind it (RESEARCH_DIGEST.md §3/H1): at >=20k views, captions
// posing an opinion question ran 1.05 comments/1k against 0.31 for knowledge
// questions — 3.4x, at within-30% the same median reach. The single best reel
// in the whole sweep was fanfrenzyhub_'s "Arsenal or Liverpool? Which club has
// fans in more countries?", 201,754 views / 2,458 comments = 12.18/1k.
//
// Because it is a controlled test there is NO b-roll open: adding a human face
// would move two variables at once and the result would be unreadable. The
// board is the hook, which CHAIN already proved carries.
//
// All four names are on screen at frame 0 — unlike CHAIN, where they stamp in.
// You cannot pick from a ballot you cannot see, and the pick is the whole ask.
export const FPS = 30;
export const TOTAL = 450; // 15.0s — 30 beats at 120 BPM (15f), closes exactly
export const BEAT = 15;

export const CLUB_A = "REAL MADRID";
export const CLUB_B = "MANCHESTER UNITED";

// Verified both-clubs players, two sources (FBref + United In Focus), and
// cross-checked against app/convex/data/football_career_paths.json:
//   cp-beckham · cp-van-nistelrooy · cp-di-maria · cp-casemiro
// Same set as chain/timeline.ts on purpose — see the A/B note above. Ronaldo
// stays omitted: he is the reason door (b) works.
//
// Heinze was the fourth name in both cuts until the S-tier casting pass
// (2026-07-26) replaced him with Casemiro in chain/. This array is a MIRROR,
// not an independent choice: if the two ever disagree, the H1 result stops
// being readable because subject tier moves alongside question type. Change
// chain's LINKS and change this in the same commit, then re-render BOTH.
export const NAMES = ["BECKHAM", "VAN NISTELROOY", "DI MARÍA", "CASEMIRO"];

// our pick. Declarative, contrarian, and impossible to prove — which is the point.
export const VERDICT = "BECKHAM";

export const TURN_AT = 90; // 3.0s — knowledge flips to allegiance
export const VERDICT_AT = 180; // 6.0s — the only green frame before the product act
export const SIDE_AT = 270; // 9.0s — "PICK A SIDE"
export const PROD_AT = 345; // 11.5s — cut to the real recording
export const PROD_MOTION = 32; // frames of live video before the standings freeze
export const FADE_FROM = 425; // board clears so the loop reads as a new round
export const CARET_PERIOD = 15;

// arena-ui.mp4 is 30fps/250f. The champion + final standings beat is src
// 7.25-8.33s per .ops edl_arena.json => frame 218 onward. UI chrome only, no
// question text: product-arena-gameplay.mp4 is NEVER used, it contains the
// 2024-25 PL title question whose answer on screen is wrong (Liverpool won it).
export const PROD_START_FRAME = 218;
