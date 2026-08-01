// "DEPARTURES" — the group chat as an airport: a Solari split-flap board
// clatters through the banter (DAVE'S EXCUSES — ON TIME · HIS FIRST WIN —
// CANCELLED) and ends with VERVEQ.COM/PLAY — BOARDING. One continuous shot;
// the mechanical flips are both the motion and the soundtrack. The Solari
// aesthetic is having a moment (JFK's record board, viral Frankfurt reels)
// and nobody owns it in football short-form — this is the signature bet.
// promo/departures-audio.mjs mirrors every constant here.
export const FPS = 30;
export const TOTAL = 390;
export const BEAT = 15; // 120 BPM — groove only under the boarding call

// One row = 15 destination cells + 1 gap + 9 status cells = 25 flap cells.
export const DEST_LEN = 15;
export const STATUS_LEN = 9;

export type DRow = { dest: string; status: string; color: "green" | "orange" | "red" | "blue" | "lime"; at: number };
export const ROWS: DRow[] = [
  { dest: "DAVE'S EXCUSES ", status: "  ON TIME", color: "green", at: 10 },
  { dest: "YOUR PATIENCE  ", status: "  DELAYED", color: "orange", at: 62 },
  { dest: "HIS FIRST WIN  ", status: "CANCELLED", color: "red", at: 114 },
  { dest: "THE GOAT DEBATE", status: " DIVERTED", color: "blue", at: 166 },
  { dest: "THE REMATCH    ", status: " BOARDING", color: "lime", at: 216 },
  { dest: "VERVEQ.COM/PLAY", status: " BOARDING", color: "lime", at: 268 },
];

// per-cell flip: starts at row.at + col * STAGGER, spins then settles
export const STAGGER = 1.6;
export const SPIN_FRAMES = 26; // base spin length; +col jitter in the comp
export const CHIME_AT = 2; // PA two-tone on open
export const BOARDING_AT = 268; // triple chime + groove from here
