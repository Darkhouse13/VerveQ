// "THE LONG CHAIN" — the H3 test: is our 11-16s house length the thing that
// caps our comment count?
//
// RESEARCH_DIGEST.md §3/H3, from 112 swept reels >=5k views: comment rate
// climbs monotonically with length and peaks at 90-120s, then falls away.
//   0-15s   0.07 /1k      60-90s   0.57 /1k
//   15-30s  0.26 /1k      90-120s  1.04 /1k   <- this cut lives here
//   30-60s  0.48 /1k      120s+    0.42 /1k
// Our entire library (CHAIN 11.0s, WALL 13.1s, LADDER 16.0s, THE DECISION
// 24.0s) sits in the two worst bands. So this holds CHAIN's mechanism EXACTLY
// — a chain of club pairs, the last one never answered — and moves only the
// length. If it wins, length was the constraint all along.
//
// Six pairs, escalating. Five resolve. The sixth never does.
//
// GREEN LAW: green is this batch's resolution signal. Each answer stamps in
// green; pair six never turns green and never will. The absence of the colour
// is how the viewer knows it is unresolved — no caption needed to say so.
//
// FACTS: every answer below is sourced in SCRIPTS_PHASE2.md's fact-check log.
// R9 Ronaldo was CUT from the Milan pair — widely believed, but no source came
// back confirming the AC Milan spell, so he does not enter a frame. Seedorf
// replaces him and is explicitly sourced. Do not put Ronaldo back without
// pulling a source first.
export const FPS = 30;
export const TOTAL = 3000; // 100.0s — 200 beats at 120 BPM (15f), closes exactly
export const BEAT = 15;

// ---- act boundaries ----
export const HOOK_CUT = 60; // 2.0s of b-roll, then a hard cut to cream. No dissolve, ever.
export const PAIRS_AT = 300; // 10.0s — the contract is stated, the chain starts
export const PAIR_DUR = 390; // 13.0s each × 6 = 2340f
export const CLOSE_AT = 2640; // 88.0s
export const LOCKUP_AT = 2820; // 94.0s — pair six returns, still unanswered
export const FADE_FROM = 2960;

// ---- the internal grid every pair runs ----
export const P_SLOT = 45; // +1.5s  open slot + caret appear
export const P_TICK = [135, 165, 195]; // +4.5/5.5/6.5s  3-2-1
export const P_ANSWER = 225; // +7.5s  the answer stamps in — GREEN
export const P_FACT = 270; // +9.0s  one sourced line
export const CARET_PERIOD = 15;

export type Pair = {
  a: string;
  b: string;
  answer: string | null; // null = never resolved, and never will be
  fact: string;
};

export const PAIRS: Pair[] = [
  {
    a: "REAL MADRID",
    b: "MANCHESTER UNITED",
    answer: "BECKHAM",
    fact: "ROUGHLY 12 MEN QUALIFY. HE'S THE EASY ONE.",
  },
  {
    a: "TOTTENHAM",
    b: "ARSENAL",
    answer: "SOL CAMPBELL",
    fact: "LEFT ON A FREE. 2001. NEVER FORGIVEN.",
  },
  {
    a: "BARCELONA",
    b: "REAL MADRID",
    answer: "LUÍS FIGO",
    fact: "WORLD RECORD FEE. 2000.",
  },
  {
    a: "INTER",
    b: "AC MILAN",
    answer: "CLARENCE SEEDORF",
    fact: "WON THE CHAMPIONS LEAGUE AT BOTH ENDS OF MILAN.",
  },
  {
    a: "LIVERPOOL",
    b: "CHELSEA",
    answer: "FERNANDO TORRES",
    fact: "BRITISH RECORD FEE AT THE TIME.",
  },
  {
    // 14 men have done it (FBref + Goal), so the comment box has deep fuel:
    // Tevez is the obvious one and the pedants still have Cole and Schmeichel.
    a: "MANCHESTER UNITED",
    b: "MANCHESTER CITY",
    answer: null,
    fact: "NO. WE'RE NOT ANSWERING THIS ONE.",
  },
];

export const pairStart = (i: number) => PAIRS_AT + i * PAIR_DUR;

// arena-ui.mp4 (30fps/250f) — UI chrome only, per .ops edl_arena.json.
// src 5.65-6.65s = the lobby / arena-code beat => frame 169.
// product-arena-gameplay.mp4 is NEVER used: it contains the 2024-25 PL title
// question whose on-screen answer is wrong (Liverpool won it).
export const LOBBY_START_FRAME = 169;
export const LOBBY_MOTION = 30;
