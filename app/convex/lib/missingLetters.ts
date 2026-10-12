/**
 * MISSING LETTERS — pure round generation (no server import, no ambient clock).
 *
 * The app twin of the Missing Letters reels: a footballer's name on a board of
 * letter tiles with some tiles blank, a nation clue, fill the gaps. Ten rounds,
 * EASY → IMPOSSIBLE exactly as the reel ramps them: more letters go missing per
 * tier, the names get less famous, and the IMPOSSIBLE round hides the initials
 * too. Every name and clue comes from convex/data/missing_letters_players.json
 * (scripts/buildMissingLettersPool.mjs: spelling = Wikidata label = enwiki
 * title, nation = Wikidata P1532).
 *
 * Only plain A–Z letters are ever hidden. Accented letters (É, Ö, Ć …), spaces,
 * hyphens and apostrophes always stay on the board, so the answer is always
 * typeable on a 26-key keyboard and spelling variants never decide a round.
 *
 * The daily is deterministic per UTC date — everyone gets the same ten boards —
 * and is FROZEN into the session row when a player starts it. Names rotate
 * through each fame band without repeats until the band is used up, then the
 * band reshuffles. Endless draws fresh boards with Math.random.
 */

import { midnightUTCTimestamp } from "./daily";
import { seededRandom } from "./whosOlder";

export type MissingLettersPlayer = { id: string; name: string; nation: string; fame: number };
export type LettersTier = "easy" | "medium" | "hard" | "impossible";
export type LettersBoard = {
  id: string;
  name: string;
  nation: string;
  tier: LettersTier;
  /** Indices into the UPPER-CASED name of the tiles that start blank. */
  hidden: number[];
};

export const MISSING_LETTERS_DAILY_ROUNDS = 10;

/** The reel's ramp: three EASY, three MEDIUM, three HARD, one IMPOSSIBLE. */
export const DAILY_TIERS: ReadonlyArray<LettersTier> = [
  "easy", "easy", "easy",
  "medium", "medium", "medium",
  "hard", "hard", "hard",
  "impossible",
];

type Band = "famous" | "known" | "deep";

/**
 * Per tier: which fame band the name comes from, what share of its letters go
 * missing, and whether each word's first letter stays on the board. IMPOSSIBLE
 * takes a KNOWN name — an obscure name with no initials is unsolvable, not hard.
 */
export const TIER_RULES: Record<LettersTier, { band: Band; share: number; initials: boolean }> = {
  easy: { band: "famous", share: 0.34, initials: true },
  medium: { band: "known", share: 0.48, initials: true },
  hard: { band: "deep", share: 0.6, initials: true },
  impossible: { band: "known", share: 0.72, initials: false },
};

/** fameRank cut-offs (THE DRAW's ranking, 1 = most famous). */
export function bandOf(fame: number): Band {
  if (fame <= 90) return "famous";
  if (fame <= 180) return "known";
  return "deep";
}

/**
 * The UTC day edition #1 goes live on. The number is in every share
 * ("Missing Letters #12"), so moving this after launch renumbers every result
 * already posted.
 */
export const MISSING_LETTERS_EPOCH_DATE_KEY = "2026-10-12";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function lettersEditionForDate(dateKey: string): number {
  return (
    Math.round(
      (midnightUTCTimestamp(dateKey) - midnightUTCTimestamp(MISSING_LETTERS_EPOCH_DATE_KEY)) /
        MS_PER_DAY,
    ) + 1
  );
}

const HIDEABLE = /^[A-Z]$/;

/** The board's text: the name upper-cased, one tile per character. */
export function boardText(name: string): string[] {
  return [...name.toUpperCase()];
}

/** Tile indices that may go blank: plain A–Z letters only. */
export function hideableIndices(name: string): number[] {
  return boardText(name).flatMap((c, i) => (HIDEABLE.test(c) ? [i] : []));
}

/** First letter of each word (after a space or a hyphen). */
function wordStarts(chars: string[]): Set<number> {
  const starts = new Set<number>();
  chars.forEach((c, i) => {
    if (/\p{L}/u.test(c) && (i === 0 || /[\s-]/.test(chars[i - 1]))) starts.add(i);
  });
  return starts;
}

/**
 * Which tiles start blank for `name` at `tier`: share × the name's letters,
 * at least two, never a kept initial, never a non-A–Z letter, and always at
 * least two letters left showing so the board is still a name.
 */
export function pickHidden(name: string, tier: LettersTier, rand: () => number): number[] {
  const chars = boardText(name);
  const { share, initials } = TIER_RULES[tier];
  const letterCount = chars.filter((c) => /\p{L}/u.test(c)).length;
  const keep = initials ? wordStarts(chars) : new Set<number>();
  const pool = hideableIndices(name).filter((i) => !keep.has(i));
  const want = Math.max(2, Math.round(letterCount * share));
  const n = Math.max(1, Math.min(want, pool.length, letterCount - 2));
  return shuffle(pool, rand).slice(0, n).sort((a, b) => a - b);
}

function shuffle<T>(items: ReadonlyArray<T>, rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function bandPlayers(pool: ReadonlyArray<MissingLettersPlayer>, band: Band) {
  return pool.filter((p) => bandOf(p.fame) === band).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * `perDay` names from `players` for day `dayIndex`, walking a seeded
 * permutation of the band so no name repeats until the whole band has been
 * dealt; then the band reshuffles. The cycle length is a multiple of
 * `perDay`, so one day's names always come from one permutation — never a
 * duplicate within a day.
 */
function rotation(
  players: ReadonlyArray<MissingLettersPlayer>,
  perDay: number,
  dayIndex: number,
  salt: string,
): MissingLettersPlayer[] {
  const cycleLen = Math.floor(players.length / perDay) * perDay;
  if (cycleLen === 0) return [];
  const picks: MissingLettersPlayer[] = [];
  for (let j = 0; j < perDay; j++) {
    const i = dayIndex * perDay + j;
    const cycle = Math.floor(i / cycleLen);
    const pos = ((i % cycleLen) + cycleLen) % cycleLen;
    picks.push(shuffle(players, seededRandom(`missing-letters:${salt}:${cycle}`))[pos]);
  }
  return picks;
}

/** Today's ten boards — identical for every player on the same UTC date. */
export function buildDailyBoards(
  pool: ReadonlyArray<MissingLettersPlayer>,
  dateKey: string,
): LettersBoard[] {
  const day = lettersEditionForDate(dateKey) - 1;
  const queues: Record<Band, MissingLettersPlayer[]> = { famous: [], known: [], deep: [] };
  for (const band of Object.keys(queues) as Band[]) {
    const perDay = DAILY_TIERS.filter((t) => TIER_RULES[t].band === band).length;
    queues[band] = rotation(bandPlayers(pool, band), perDay, day, band);
  }
  const rand = seededRandom(`missing-letters:${dateKey}`);
  const boards: LettersBoard[] = [];
  for (const tier of DAILY_TIERS) {
    const player = queues[TIER_RULES[tier].band].shift();
    if (!player) break;
    boards.push(boardFor(player, tier, rand));
  }
  return boards;
}

export function boardFor(player: MissingLettersPlayer, tier: LettersTier, rand: () => number): LettersBoard {
  return {
    id: player.id,
    name: player.name,
    nation: player.nation,
    tier,
    hidden: pickHidden(player.name, tier, rand),
  };
}

/**
 * Tier for endless round `streak` (0-based): the daily's ramp for the first
 * ten, then a hard mix — mostly HARD, with MEDIUM breathers and IMPOSSIBLE
 * spikes — so a long run is not a string of the same board.
 */
export function endlessTierFor(streak: number, rand: () => number): LettersTier {
  if (streak < DAILY_TIERS.length) return DAILY_TIERS[streak];
  const mix: LettersTier[] = ["medium", "hard", "hard", "impossible"];
  return mix[Math.floor(rand() * mix.length)];
}

/**
 * One endless board at `tier`, from a player not yet `used` in this run. An
 * exhausted band falls back to any unused player; null when none are left.
 */
export function pickEndlessBoard(
  pool: ReadonlyArray<MissingLettersPlayer>,
  tier: LettersTier,
  used: ReadonlySet<string>,
  rand: () => number,
): LettersBoard | null {
  const free = pool.filter((p) => !used.has(p.id));
  if (free.length === 0) return null;
  const inBand = free.filter((p) => bandOf(p.fame) === TIER_RULES[tier].band);
  const from = inBand.length > 0 ? inBand : free;
  return boardFor(from[Math.floor(rand() * from.length)], tier, rand);
}

/** Upper-cased A–Z only: what a guess is compared as. */
export function normalizeGuess(letters: string): string {
  return letters.toUpperCase().replace(/[^A-Z]/g, "");
}

/** A guess is right only when every blank tile holds its letter. */
export function isCorrectGuess(board: Pick<LettersBoard, "name" | "hidden">, letters: string): boolean {
  const chars = boardText(board.name);
  const guess = normalizeGuess(letters);
  return guess.length === board.hidden.length && board.hidden.every((idx, i) => chars[idx] === guess[i]);
}

/** What the client sees before it answers: every tile, blanks as null. */
export function publicTiles(board: Pick<LettersBoard, "name" | "hidden">): Array<string | null> {
  const blank = new Set(board.hidden);
  return boardText(board.name).map((c, i) => (blank.has(i) ? null : c));
}
