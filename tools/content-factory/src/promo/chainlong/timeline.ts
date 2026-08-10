// "CHAIN-LONG" — the experiment lane's first occupant (CHAIN-LONG-B1,
// 2026-08-10): the relay mechanic wearing the ladder-long winner spec.
//
// WHY THIS EXISTS. `chain` (11.0s) is the highest comment-per-view mechanic in
// the library — a category, a few examples, a hand-over ("I'll start, your
// turn") — but it was cut before the two studies that produced `ladder-long`.
// The batch-2 cadence A/B has now reported and 7.00s is the standing pace
// (docs/DECISIONS.md, 2026-08-10), so the experiment lane re-cuts the relay on
// exactly that grid: ten slots, one club pair, every slot a player who played
// for BOTH clubs. Nine are answered on the beat; slot 10 is never filled — the
// comment box is slot 10, same law as `chain`'s fifth box.
//
// TWO WITHHOLDS, not one — and that is the format's whole engine:
//   1. SLOT 10 stays empty ("YOUR TURN"). Any dataset qualifier answers it.
//   2. THE OMISSION: the single most famous qualifying player for the pair is
//      deliberately left out of the cast, and the closing voice says so out
//      loud ("And we left out the obvious one."). Being the one to point out
//      the obvious omission is the cheapest possible reason to comment.
//      WITHHOLD DISCIPLINE: that player is never named — not in VO, not in
//      captions, not on a card, and not in any file, THIS ONE INCLUDED. His
//      path is never shown, so he is NOT spent in ledger.json (the `chain`
//      precedent, chain/timeline.ts). The nine SLOTS arrays below being nine
//      long is the discipline enforced by construction.
//
// EVERY FACT IS THE DATASET'S. A slot is castable iff both pair clubs appear
// in that player's path in football_career_paths.json — loans flattened to the
// bare club, same as every other lane. No honours, no counts, no "only man
// to…". Paths are never drawn in this format (the rail carries NAMES, the
// header carries the pair), so the club-count cap and the consecutive-duplicate
// (Gullit) pattern have no surface to bite here; the all-caps rail still obeys
// the McTominay principle — no name that renders like a typo.
//
// FRAME 0 (spec #8/#9, all four winners): the rule and BOTH club plates are
// readable, the full ten-slot gauntlet is visible, slot 1's drain is already
// moving and slot 10's caret is already blinking. Deliberately a RAIL of wide
// slots under two club plates — not the ladder's card-over-rail stack — so the
// two formats are distinguishable at a glance in a feed.
export const FPS = 30;
export const BEAT = 15; // the same 120 BPM house clock as every lane
export const SLOTS_N = 10;

// ---- the grid ----
// One grid, on purpose. The cadence question is settled (DECISIONS.md
// 2026-08-10) and a first read of a new format carries zero extra variables.
// Shared numbers are ladder-long's GRID_7 to the frame — count-in budget
// (tickAt[0] = 2.50s) and answer budget (step - answerAt = 2.00s) MUST match
// it, because the cached carrier lines this format reuses were measured
// against those windows (promo/chainlong-vo.mjs).
export type Grid = {
  step: number; // frames per answered slot (slots 1-9)
  last: number; // slot 10 in full — the empty beat is the payload
  cta: number; // the closing card
  thinkAt: number; // drain + guess bed start (slot 1 drains from frame 0)
  tickAt: number[]; // the 3-2-1
  answerAt: number; // the name stamps (slot 10: the demand + the omission line)
};

// 9×210 + 240 + 60 + 90 = 2280f = 76.00s (152 beats). Slot 10 runs 240f, not
// the ladder's 300f: there is no path to build and no answer to withhold-tease,
// so the demand lands at the answer beat and holds 3.00s — which is also the
// omission line's slot budget. The follow card and CTA are batch-2 surfaces,
// reused whole.
export const GRID_C7: Grid = {
  step: 210, // 7.00s (14 beats) — the standing pace
  last: 240, // 8.00s (16 beats) — TURN_AT 150f + a 90f/3.00s hold
  cta: 90, // 3.00s (6 beats)
  thinkAt: 10, // 0.33s — the slot lights, then the window is open
  tickAt: [75, 105, 135], // one per second (2.50 / 3.50 / 4.50s), = GRID_7
  answerAt: 150, // 5.00s, holds 2.00s, = GRID_7
};

export const FOLLOW_CARD = 60; // 2.00s — batch 2's card, reused whole
export const totalOf = (ed: Edition): number => ed.grid.step * 9 + ed.grid.last + FOLLOW_CARD + ed.grid.cta;
export const followAt = (ed: Edition): number => ed.grid.step * 9 + ed.grid.last;
export const ctaAt = (ed: Edition): number => followAt(ed) + FOLLOW_CARD;

export type Tier = "EASY" | "MEDIUM" | "HARD" | "IMPOSSIBLE";

export type Slot = {
  id: string; // football_career_paths.json id — goes to ledger.json after render
  answer: string; // the rail stamp. Ambiguous surnames carry the first name
  //               (LASSANA DIARRA, DAVID JAMES) — same law as DAVID SILVA.
  tier: Tier;
};

export type Edition = {
  slug: string;
  title: string; // bookkeeping only, never on screen
  clubA: string; // the pair, exactly as the dataset spells the clubs
  clubB: string;
  // Always GRID_C7 today — the cadence question is settled — but carried
  // per-edition anyway, so the day an owner ticket reopens pace this table
  // grows a value instead of the whole lane growing a mechanism.
  grid: Grid;
  slots: Slot[]; // exactly NINE. Slot 10 has no entry, by construction.
};

// CASTING (CHAIN-LONG-B1). Tier here = how deep into the pair's qualifier pool
// the name sits — the relay escalates from "everyone's second answer" to "no
// chance you had this" — which is a different axis from the ladder's
// path-difficulty tiers. Shape is 2 EASY / 3 MEDIUM / 3 HARD / 1 IMPOSSIBLE
// across the answered nine; slot 10 is the second IMPOSSIBLE, and it's yours.
//
// Every cast id was checked unspent against ledger.json, checked against the
// dataset's duplicate-id alias families, and checked for all-caps rail safety.
// One qualifier per edition is deliberately NOT cast so slot 10 always has
// dataset-verifiable ammunition beyond the omission.
export const EDITIONS: Edition[] = [
  {
    slug: "liverpool-city",
    title: "THE M62",
    clubA: "LIVERPOOL",
    clubB: "MANCHESTER CITY",
    grid: GRID_C7,
    slots: [
      { id: "cp-james-milner", tier: "EASY", answer: "MILNER" },
      { id: "cp-balotelli", tier: "EASY", answer: "BALOTELLI" },
      { id: "cp-daniel-sturridge", tier: "MEDIUM", answer: "STURRIDGE" },
      { id: "cp-robbie-fowler", tier: "MEDIUM", answer: "FOWLER" },
      { id: "cp-kolo-toure", tier: "MEDIUM", answer: "KOLO TOURÉ" },
      { id: "cp-anelka", tier: "HARD", answer: "ANELKA" },
      { id: "cp-bellamy", tier: "HARD", answer: "BELLAMY" },
      { id: "cp-dietmar-hamann", tier: "HARD", answer: "HAMANN" },
      { id: "cp-david-james", tier: "IMPOSSIBLE", answer: "DAVID JAMES" },
    ],
  },
  {
    slug: "chelsea-marseille",
    title: "THE CHANNEL",
    clubA: "CHELSEA",
    clubB: "MARSEILLE",
    grid: GRID_C7,
    slots: [
      { id: "cp-pierre-emerick-aubameyang", tier: "EASY", answer: "AUBAMEYANG" },
      { id: "cp-azpilicueta", tier: "EASY", answer: "AZPILICUETA" },
      { id: "cp-michy-batshuayi", tier: "MEDIUM", answer: "BATSHUAYI" },
      { id: "cp-makelele", tier: "MEDIUM", answer: "MAKÉLÉLÉ" },
      { id: "cp-william-gallas", tier: "MEDIUM", answer: "GALLAS" },
      { id: "cp-frank-leboeuf", tier: "HARD", answer: "LEBOEUF" },
      { id: "cp-lassana-diarra", tier: "HARD", answer: "LASSANA DIARRA" },
      { id: "cp-weah", tier: "HARD", answer: "GEORGE WEAH" },
      { id: "cp-didier-deschamps", tier: "IMPOSSIBLE", answer: "DESCHAMPS" },
    ],
  },
];

export const editionBySlug = (slug: string): Edition => {
  const e = EDITIONS.find((x) => x.slug === slug);
  if (!e) throw new Error(`unknown chain-long edition "${slug}"`);
  return e;
};

// Which slot is live, how far into it we are, and which terminal card (if
// either) is up. Same contract as ladderlong's locate().
export const locate = (
  frame: number,
  ed: Edition,
): { i: number; phase: number; dur: number; follow: boolean; cta: boolean } => {
  const g = ed.grid;
  const fAt = followAt(ed);
  const cAt = ctaAt(ed);
  if (frame >= cAt) return { i: 9, phase: g.last, dur: g.last, follow: false, cta: true };
  if (frame >= fAt) return { i: 9, phase: g.last, dur: g.last, follow: true, cta: false };
  const i = Math.min(9, Math.floor(frame / g.step));
  return { i, phase: frame - i * g.step, dur: i === 9 ? g.last : g.step, follow: false, cta: false };
};

// Every VO-bearing frame. promo/chainlong-vo.mjs re-derives the same layout
// from the parsed grid; a disagreement fails the render verification loudly.
export const cueFrames = (ed: Edition): { counts: number[]; answers: number[]; turn: number; omission: number; follow: number; cta: number } => ({
  counts: Array.from({ length: 8 }, (_, k) => (k + 1) * ed.grid.step), // n2…n9
  answers: Array.from({ length: 9 }, (_, k) => k * ed.grid.step + ed.grid.answerAt), // a1…a9
  turn: 9 * ed.grid.step, // slot 10's boundary — the hand-over
  omission: 9 * ed.grid.step + ed.grid.answerAt, // the confession
  follow: followAt(ed),
  cta: ctaAt(ed),
});
