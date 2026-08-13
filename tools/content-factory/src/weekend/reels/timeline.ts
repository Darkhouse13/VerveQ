// CF-WEEKEND — three promo reels that ARE the game (post-flop ruling: anything
// that looks like an ad dies; native trivia first, product as the payoff frame,
// never the subject). Timing lives in grid.json — the ONE source of truth the
// audio beds and the VO runner also read. Re-time grid.json, everything follows.
//
// EVERY football fact in this file is fact-checked against two agreeing
// sources, annotated inline. Opening weekend = Eredivisie speelronde 1 +
// Liga Portugal jornada 1, Aug 7–10 2026, all FT before any of this renders.
// Prices are the LIVE prod market (fantasyMarket:getMarket on
// different-lynx-153, pulled 2026-08-12) — the product's own numbers, shown
// as the product shows them. Sources shorthand:
//   NLW  = nl.wikipedia.org Eredivisie 2026/27 wedstrijden
//   ESPN = espn.com scoreboard/match pages (per-date URLs in REELS_CFWEEKEND.md)
//   VSP  = vsports.pt i-liga round page / match story
//   OJ   = ojogo.pt match reports · NAM = noticiasaominuto.com
//   VZ   = voetbalzone.nl · AJX = english.ajax.nl · VI = vi.nl
//   SD   = stedendriehoek.nl · VAV = vavel.com · MF = maisfutebol.iol.pt
//   BEIN = beinsports.com · PG = portugoal.net · ABL = abola.pt · DN = dn.pt
// Full URLs + quotes: tools/content-factory/weekend/REELS_CFWEEKEND.md.
import grid from "./grid.json";

export const FPS: number = grid.fps;

export type Scene = { key: string; dur: number };
export type Cue = { key: string; at: number; budget: number };

type ReelGrid = { scenes: Scene[]; cues: Cue[]; rowStep?: number; starStep?: number };

const reel = (name: "settleit" | "referee" | "squad"): ReelGrid => grid[name] as ReelGrid;

export const startsOf = (scenes: Scene[]): Record<string, number> => {
  const out: Record<string, number> = {};
  let f = 0;
  for (const s of scenes) {
    out[s.key] = f;
    f += s.dur;
  }
  return out;
};
export const totalOf = (scenes: Scene[]): number => scenes.reduce((a, s) => a + s.dur, 0);

export const SETTLEIT = reel("settleit");
export const REFEREE = reel("referee");
export const SQUAD = reel("squad");

// ─────────────────────────────────────────────────────────── R1 · SETTLE IT
// The group chat is canon (DAVE / JAMIE / MO — fifteen promos deep). The
// argument is real: player of the opening weekend, and the receipts are FT
// facts. It does not resolve — that is the format's law AND the product's
// pitch. Bubble cadence: `at` frames are LOCAL to their scene.
export type ChatMsg = {
  at: number; // local frame within its scene
  side: "left" | "right";
  sender?: string; // omitted for consecutive same-sender bubbles
  text: string;
  kind?: "text" | "system" | "voicenote" | "typing";
};

// Receipt cards — the stat slams between bubbles. Facts:
//   Paciência 19' 21', Santa Clara 2–2 Nacional ..... ESPN 20260810 + VSP
//   Naujoks 31' 69', Cambuur 0–4 Excelsior .......... NLW + ESPN 20260807
//   André Silva 9' pen + Gabri Veiga 44' pen, both VAR,
//     Porto 2–0 Alverca ............................. ESPN + VSP (mins) + OJ + NAM (VAR/pens)
//   Liziero 36' + Baeza 45' pulled it to 2–2 by HT ... ESPN 20260810 + VSP
//   Cambuur promoted, at home ....................... NLW + NOS ("gepromoveerd Cambuur")
//   Prices Paciência 6.0 / Naujoks 6.5 .............. prod getMarket 2026-08-12
export const SETTLEIT_CHAT: { scene: string; msgs: ChatMsg[] }[] = [
  {
    scene: "open",
    msgs: [{ at: 0, side: "left", sender: "JAMIE", text: "player of the weekend. go." }],
  },
  {
    scene: "claimA",
    msgs: [
      { at: 8, side: "left", sender: "MO", text: "Paciência. two goals in THREE minutes." },
      { at: 150, side: "left", text: "19th and 21st. blink and you missed the argument" },
    ],
  },
  {
    scene: "claimB",
    msgs: [
      { at: 8, side: "right", sender: "JAMIE", text: "Naujoks. two AWAY from home. four nil." },
      { at: 150, side: "right", text: "a brace in a 0-4. that's a statement not a cameo" },
    ],
  },
  {
    scene: "dave",
    msgs: [
      { at: 8, side: "left", sender: "DAVE", text: "andré silva got two as well??" },
      { at: 120, side: "left", sender: "MO", text: "penalties dave" },
      { at: 170, side: "right", sender: "JAMIE", text: "both of them" },
      { at: 220, side: "left", sender: "MO", text: "VAR gave both. the ref walked to the screen twice" },
      { at: 285, side: "left", sender: "DAVE", text: "still count???" },
    ],
  },
  {
    scene: "escalate",
    msgs: [
      { at: 8, side: "left", sender: "MO", text: "paciência is 6.0 on the board btw" },
      { at: 75, side: "right", sender: "JAMIE", text: "naujoks is 6.5. the board agrees with ME" },
      { at: 150, side: "left", sender: "MO", text: "santa clara were 2-0 up in 21 minutes" },
      { at: 220, side: "right", sender: "JAMIE", text: "and it finished 2-2. they blew it by HALF TIME" },
      { at: 290, side: "left", sender: "MO", text: "excelsior beat up a promoted side. congrats" },
      { at: 355, side: "right", sender: "JAMIE", text: "IN THEIR OWN GROUND. four nil AWAY" },
      { at: 420, side: "left", sender: "MO", kind: "voicenote", text: "0:47" },
      { at: 455, side: "left", sender: "DAVE", text: "lads it's 1am" },
    ],
  },
  {
    scene: "exit",
    msgs: [
      { at: 30, side: "left", kind: "system", text: "DAVE LEFT THE GROUP" },
      { at: 120, side: "right", sender: "JAMIE", text: "coward" },
      { at: 170, side: "left", sender: "MO", text: "he'll be back by breakfast" },
    ],
  },
];

export type Receipt = { scene: string; at: number; title: string; lines: string[] };
export const SETTLEIT_RECEIPTS: Receipt[] = [
  { scene: "claimA", at: 70, title: "SANTA CLARA 2-2 NACIONAL", lines: ["PACIÊNCIA 19' 21'"] },
  { scene: "claimB", at: 70, title: "CAMBUUR 0-4 EXCELSIOR", lines: ["NAUJOKS 31' 69'"] },
  { scene: "dave", at: 235, title: "PORTO 2-0 ALVERCA", lines: ["9' PEN · 44' PEN"] },
];

// ──────────────────────────────────────────────────────────── R2 · REFEREE
// Same topline, six tie-breaker rows, none of them breaks the tie. Facts:
//   Prestianni goal 58' + assist (for Pavlidis 10') .. ESPN match 401885485 + MF/VAV + slbenfica.pt
//   Meulensteen goal 61' + assist (for Tengstedt) .... NLW + ESPN (goal) · VI + SD (assist)
//   Benfica 2-2 Académico de Viseu (home) ............ ESPN + VSP + OJ
//   Go Ahead 4-1 Willem II (home) .................... NLW + ESPN
//   Both opponents promoted .......................... VAV/MF (Viseu, "first top-flight in 37y") · VI/omroepbrabant (Willem II)
//   Luz behind closed doors .......................... VAV + ABL/DN
//   Prices 7.5 / 5.0 ................................. prod getMarket 2026-08-12
export type VsRow = { label: string; a: string; b: string };
export const REFEREE_CAST = {
  a: { name: "PRESTIANNI", club: "BENFICA", league: "LIGA PORTUGAL" },
  b: { name: "MEULENSTEEN", club: "GO AHEAD EAGLES", league: "EREDIVISIE" },
};
export const REFEREE_ROWS: VsRow[] = [
  { label: "GOALS", a: "1  (58')", b: "1  (61')" },
  { label: "ASSISTS", a: "1", b: "1" },
  { label: "RESULT", a: "DREW 2-2 AT HOME", b: "WON 4-1 AT HOME" },
  { label: "OPPONENT", a: "PROMOTED", b: "PROMOTED" },
  { label: "STAGE", a: "THE LUZ, CLOSED DOORS", b: "DEVENTER, OPENING DAY" },
  { label: "PRICE ON THE BOARD", a: "7.5", b: "5.0" },
];

// ─────────────────────────────────────────────────────────────── R3 · SQUAD
// The board's own arithmetic, played straight. Prices: prod getMarket
// 2026-08-12 (scale 4.0–13.0 in 0.5 steps, SQUAD_BUDGET 91.0, 13 slots —
// LOCKED product shapes, BUDGET_MODE_SPEC v1.1.1). Math checked in-file:
//   91.0 − (13.0+13.0+12.5+12.0 = 50.5) = 40.5 over 9 shirts = 4.5/shirt.
//   Drop Kane: 91.0 − 38.0 = 53.0 over 10 shirts = 5.3/shirt.
// Bin receipts (all FT, double-sourced):
//   Brandt debut goal 90+5' for Ajax ................. VZ + AJX (+NLW/ESPN minute)
//   Michut 90+2' equaliser at champions PSV .......... NLW + ESPN 20260808
//   André Silva 2 goals, both pens ................... ESPN + VSP + OJ/NAM
export const SQUAD_BUDGET = 91.0;
export const SQUAD_SLOTS = 13;
export type StarPick = { name: string; club: string; price: number };
export const SQUAD_STARS: StarPick[] = [
  { name: "LAMINE YAMAL", club: "BARCELONA", price: 13.0 },
  { name: "OLISE", club: "BAYERN", price: 13.0 },
  { name: "KANE", club: "BAYERN", price: 12.5 },
  { name: "MBAPPÉ", club: "REAL MADRID", price: 12.0 },
];
export const SQUAD_GEMS: { name: string; club: string; price: number; receipt: string }[] = [
  { name: "BRANDT", club: "AJAX", price: 4.0, receipt: "DEBUT GOAL, 90+5'" },
  { name: "MICHUT", club: "FORTUNA", price: 4.5, receipt: "90+2' AT THE CHAMPIONS" },
  { name: "ANDRÉ SILVA", club: "PORTO", price: 4.0, receipt: "2 GOALS (BOTH PENS)" },
];
