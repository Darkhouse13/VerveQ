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

type ReelGrid = { scenes: Scene[]; cues: Cue[]; rowStep?: number; starStep?: number; cardStep?: number; shirtStep?: number };

const reel = (name: "settleit" | "referee" | "squad" | "boost" | "dilemma1" | "dilemma2"): ReelGrid => grid[name] as ReelGrid;

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
// CF-42H — the paid-boost conversion reel; facts live in boost-facts.json
// (re-verified against prod on every render by weekend/boost-live.mjs) and
// the volatile countdown in boost-live.json (stamped at render time).
export const BOOST = reel("boost");

// ── DILEMMA-B1 — the experiment lane's second occupant (chain-long killed,
// 2026-08-14). One real draft decision per edition; both sides cost the same;
// the reel NEVER says which side is right, in VO, caption or card. Casting +
// prices live in dilemma-facts.json and are re-verified against prod by
// weekend/dilemma-live.mjs on every render (drift throws). Both editions run
// the SAME grid — the spine is the format, only the casting changes.
export type DilemmaPlayer = {
  board: string; // the prod board's own name string — what the gate matches on
  display: string; // what the card shows
  club: string;
  chip: string;
  pos: string;
  price: number;
  opponent: string;
  oppChip: string;
  isHome: boolean;
  day: string;
  atIso: string;
};
export type DilemmaSide = { key: string; total: number; note: string; players: DilemmaPlayer[] };
export type DilemmaEdition = {
  slug: string;
  id: string;
  stake: number;
  kicker: string;
  question: string[];
  claim: { kind: string; board: string; tag: string } | null;
  sides: DilemmaSide[];
};
export const DILEMMA_GRID: Record<string, ReelGrid> = { d1: reel("dilemma1"), d2: reel("dilemma2") };

// ── DILEMMA-WEEKLY v2 (MONID-SWEEP-2 amendments, 2026-08-14) — the amended
// spine for editions posted from Tue 2026-08-19 on: 13.4s (the 12–40s dead
// zone exited downward), no a/b side reads (cards + subtitles carry the
// sides), the question spoken first-person WITH the deadline day, and one
// gated receipt row per card. v1 above is FROZEN — it backs the post-as-built
// paid-vs-organic twin. Facts: dilemma-v2-facts.json, gated by
// weekend/dilemma-v2-live.mjs (which also recomputes every receipt from the
// live board — an uncitable receipt throws).
export type DilemmaV2Side = DilemmaSide & { receipt: { kind: string; tag: string } };
export type DilemmaV2Edition = {
  slug: string;
  id: string;
  grid: string; // grid.json key — dilemmaS for the smoke; a real edition copies that block and swaps the q cue key
  proof?: boolean; // mechanism-proof edition: NOT FOR POSTING, relaxed spoken/caption deadline checks only
  stake: number;
  deadlineDay: string; // GATED: UTC day tag of the earliest kickoff among named players
  deadlineWord: string; // the spoken/written form the question + caption must carry
  qKey: string; // the question's VO cue key (a real edition owns its dN-q; the smoke reuses d2-q's cached take)
  question: string[];
  sides: DilemmaV2Side[];
};
export const dilemmaV2Grid = (gridKey: string): ReelGrid => {
  const g = (grid as Record<string, unknown>)[gridKey] as ReelGrid | undefined;
  if (!g) throw new Error(`timeline: no grid "${gridKey}" for a v2 dilemma edition`);
  return g;
};

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

// v2 (owner note, 2026-08-13): FAMOUS NAMES ONLY. The argument is the eternal
// one — best on earth, right now — and the receipts are the LIVE BOARD's own
// prices (product facts, zero sourcing risk) plus exactly two verified
// football facts:
//   Ballon d'Or 2025 = Dembélé ....... verified in-repo 2026-07-16 (dave
//     films fact-check) + ballondor.com / L'Équipe
//   Yamal is 19 ...................... born 13 Jul 2007 (FCB official +
//     transfermarkt) → 19 as of Aug 2026
//   Prices Yamal 13.0 / Mbappé 12.0 / Olise 13.0 / Kane 12.5 /
//     Bellingham (Real Madrid) 11.0 / Dembélé 11.5 .. prod getMarket 2026-08-13
// Bubble slots (counts + frames) are FROZEN — the bed mirrors them.
export const SETTLEIT_CHAT: { scene: string; msgs: ChatMsg[] }[] = [
  {
    scene: "open",
    msgs: [{ at: 0, side: "left", sender: "JAMIE", text: "best player on earth. right now. go." }],
  },
  {
    scene: "claimA",
    msgs: [
      { at: 8, side: "left", sender: "MO", text: "Mbappé. next question." },
      { at: 150, side: "left", text: "he's still the answer. don't overthink it" },
    ],
  },
  {
    scene: "claimB",
    msgs: [
      { at: 8, side: "right", sender: "JAMIE", text: "Yamal. it stopped being close last season." },
      { at: 150, side: "right", text: "he's NINETEEN. it's not fair" },
    ],
  },
  {
    scene: "dave",
    msgs: [
      { at: 8, side: "left", sender: "DAVE", text: "dembélé won the ballon d'or tho??" },
      { at: 120, side: "left", sender: "MO", text: "that was last season dave" },
      { at: 170, side: "right", sender: "JAMIE", text: "we're talking about NOW" },
      { at: 220, side: "left", sender: "MO", text: "board's got him at 11.5 anyway" },
      { at: 285, side: "left", sender: "DAVE", text: "third??? behind a teenager???" },
    ],
  },
  {
    scene: "escalate",
    msgs: [
      { at: 8, side: "left", sender: "MO", text: "olise is on 13.0. same as yamal" },
      { at: 75, side: "right", sender: "JAMIE", text: "OLISE?? above mbappé???" },
      { at: 150, side: "left", sender: "MO", text: "kane's 12.5. also above him" },
      { at: 220, side: "right", sender: "JAMIE", text: "the board is drunk" },
      { at: 290, side: "left", sender: "MO", text: "or you are" },
      { at: 355, side: "right", sender: "JAMIE", text: "bellingham at 11 is criminal btw" },
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

export type Receipt = { scene: string; at: number; kicker: string; title: string; lines: string[] };
export const SETTLEIT_RECEIPTS: Receipt[] = [
  { scene: "claimA", at: 70, kicker: "THE LIVE BOARD", title: "MBAPPÉ · REAL MADRID", lines: ["12.0"] },
  { scene: "claimB", at: 70, kicker: "THE LIVE BOARD", title: "YAMAL · BARCELONA", lines: ["13.0"] },
  { scene: "dave", at: 235, kicker: "FACT CHECK", title: "BALLON D'OR 2025", lines: ["DEMBÉLÉ"] },
];

// ──────────────────────────────────────────────────────────── R2 · REFEREE
// v2 (owner note, 2026-08-13): the duel is now THE BOARD vs YOUR EYES — six
// of the live board's most argue-able price calls, superstars only, verdict
// withheld. Every number is the prod market's own (getMarket 2026-08-13);
// club chips disambiguate on screen (two J. Bellinghams exist in the pool —
// Jude/Real Madrid 11.0 is the one shown, Jobe/Dortmund 6.5 is not). The one
// football fact: Dembélé holds the 2025 Ballon d'Or (verified in-repo
// 2026-07-16 + ballondor.com), still holder until Sept 2026.
export type VsCard = { name: string; club: string; price: number };
export type VsRow = { label: string; a: VsCard; b: VsCard };
export const REFEREE_ROWS: VsRow[] = [
  { label: "THE HEADLINE", a: { name: "OLISE", club: "BAYERN", price: 13.0 }, b: { name: "MBAPPÉ", club: "REAL MADRID", price: 12.0 } },
  { label: "AGREE?", a: { name: "KANE", club: "BAYERN", price: 12.5 }, b: { name: "BELLINGHAM", club: "REAL MADRID", price: 11.0 } },
  { label: "SAME DRESSING ROOM", a: { name: "CHERKI", club: "MAN CITY", price: 10.0 }, b: { name: "FODEN", club: "MAN CITY", price: 9.5 } },
  { label: "READ IT AGAIN", a: { name: "NICO PAZ", club: "COMO", price: 10.0 }, b: { name: "GYÖKERES", club: "ARSENAL", price: 5.5 } },
  { label: "THE BALLON D'OR GAP", a: { name: "DEMBÉLÉ", club: "PSG", price: 11.5 }, b: { name: "YAMAL", club: "BARCELONA", price: 13.0 } },
  { label: "SAME PRICE", a: { name: "LEE KANG-IN", club: "ATLÉTICO", price: 10.5 }, b: { name: "BRUNO", club: "MAN UTD", price: 10.5 } },
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
// v2: famous names at shock prices — the receipt line is the price itself
// (board facts only, no match claims to source).
export const SQUAD_GEMS: { name: string; club: string; price: number; receipt: string }[] = [
  { name: "GYÖKERES", club: "ARSENAL", price: 5.5, receipt: "YES. REALLY." },
  { name: "CHIESA", club: "LIVERPOOL", price: 5.0, receipt: "FIVE. FLAT." },
  { name: "SZCZĘSNY", club: "BARCELONA", price: 4.0, receipt: "THE FLOOR." },
];
