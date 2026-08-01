// "THE ANSWER ISN'T IN THIS VIDEO" — the H2 test, taken to its limit.
//
// The nearest thing to VerveQ in the sweep is footylinksapp, and it captions
// its own reels "can you find the connection BEFORE THE ANSWER APPEARS?".
// Nine reels pulled, 154-1,180 views each, and the comment counts were:
//   0, 0, 0, 0, 0, 0, 0, 0, 0.
// They hand the answer over for free, so there is nothing left to type.
// the_footballingbrain does the same at ~10x the reach (median 11,226 views)
// and lands a median of 0 comments too.
//
// So this is the exact inverse, said out loud as brand voice rather than
// smuggled in as a tease: the puzzle is real, the answer exists, and the video
// flatly refuses to give it up.
//
// GREEN LAW, and this one is the purest of the three: green NEVER APPEARS in
// this video. Not once. Nothing on screen resolves, so nothing earns the
// resolution colour — the first and only green is inside the product frame,
// because the app is the only place the answer exists. The colour does the
// positioning work that the copy would otherwise have to.
//
// FACTS: Michael Owen's path and his 2001 Ballon d'Or are sourced two ways
// (Wikipedia + National Football Museum) — see SCRIPTS_PHASE2.md. He is also
// a quiet callback: he is one of the genuine "you missed him" answers to
// CHAIN's Real Madrid + Manchester United board.
export const FPS = 30;
export const TOTAL = 1050; // 35.0s — 70 beats at 120 BPM (15f), closes exactly
export const BEAT = 15;

// Liverpool -> Real Madrid -> Newcastle -> Manchester United -> Stoke.
// The answer is Michael Owen and it is never written anywhere in this file's
// output. Filename discipline: the composition is "NotTelling", not the name.
export const CLUBS = ["LIVERPOOL", "REAL MADRID", "NEWCASTLE", "MANCHESTER UNITED", "STOKE CITY"];
export const CLUB_AT = [0, 90, 180, 270, 360]; // club 1 is on screen at frame 0

export const BALLON_AT = 450; // 15.0s — one sourced fact reframes the whole path
export const WHO_AT = 540; // 18.0s — "WHO IS HE?"
export const REFUSE_AT = 630; // 21.0s — the thesis
export const POSITION_AT = 720; // 24.0s — why we refuse
export const PROD_AT = 810; // 27.0s — the ONLY green in the piece
export const CTA_AT = 930; // 31.0s
export const FADE_FROM = 1020;
export const CARET_PERIOD = 15;

// arena-ui.mp4 (30fps/250f), champion + final standings from .ops
// edl_arena.json src 7.25-8.33s => frame 218. UI chrome, no question text.
// product-arena-gameplay.mp4 is NEVER used — it contains the 2024-25 PL title
// question whose on-screen answer is wrong (Liverpool won it).
//
// ⚠ KNOWN GAP: there is no Career Path screen recording in the asset library,
// so this shows the arena scoreboard instead of the mode the puzzle is
// actually posing. Swap PROD_SRC/PROD_HOLD for a real Career Path capture when
// one exists — that is the only change needed.
export const PROD_SRC = "product/arena-ui.mp4";
export const PROD_HOLD = "product/standings-hold.png";
export const PROD_START_FRAME = 218;
export const PROD_MOTION = 32;
