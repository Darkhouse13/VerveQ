// "RECEIPT" — the group chat's season, itemized on a till receipt that
// prints line by line, gets torn off, and stamped "KEEP THE RECEIPTS."
// One continuous shot, no scene cuts: the printing IS the pacing (something
// changes every few frames — the research-verified retention rule), the CTA
// is printed ON the receipt, and the payoff (tear + stamp) lands at ~85% of
// runtime. promo/receipt-audio.mjs mirrors every constant here.
export const FPS = 30;
export const BPM = 120;
export const BEAT = 15;
export const TOTAL = 400;

// Receipt body — printed top to bottom. `at` = frame the line starts
// printing; kind drives styling. ~30 mono chars per line.
export type RLine = { text: string; at: number; kind: "meta" | "rule" | "item" | "total" | "cta" };
export const LINES: RLine[] = [
  { text: "VERVEQ · TILL 09 · FT 90:00+", at: 8, kind: "meta" },
  { text: "THE GROUP CHAT'S SEASON", at: 22, kind: "meta" },
  { text: "------------------------------", at: 36, kind: "rule" },
  { text: "HOT TAKES ............. x 147", at: 48, kind: "item" },
  { text: "CORRECT ............... x   3", at: 76, kind: "item" },
  { text: "SOURCES CITED ......... x   0", at: 104, kind: "item" },
  { text: '"TRUST ME BRO" ........ x  38', at: 132, kind: "item" },
  { text: "VAR COMPLAINTS ........ x  61", at: 160, kind: "item" },
  { text: "APOLOGIES ISSUED ...... x   0", at: 188, kind: "item" },
  { text: "------------------------------", at: 214, kind: "rule" },
  { text: "TOTAL OWED ....... ONE APOLOGY", at: 226, kind: "total" },
  { text: "------------------------------", at: 252, kind: "rule" },
  { text: "CUSTOMER: DAVE · REFUNDS: NEVER", at: 262, kind: "meta" },
  { text: "SETTLE UP: VERVEQ.COM/PLAY", at: 280, kind: "cta" },
];
export const PRINT_FRAMES = 14; // a line sweeps in over this many frames

export const BARCODE_AT = 298;
export const TEAR_AT = 322; // the receipt rips off the printer
export const STAMP_AT = 344; // KEEP THE RECEIPTS.
