/**
 * D3 — synthetic card-set generator. Seeded, pure.
 *
 * All content is generated: fake syllable names, CLUB_A.. / NATION_A.. tag
 * vocabularies, ERA_1960s-style decade buckets. Nothing here may reference a
 * real-world player, club, or manager.
 */

import { rngFromString, rngInt, rngWeighted } from "./rng";
import type { Card, CardGenConfig, PositionId } from "./types";

const POSITIONS: PositionId[] = ["GK", "DEF", "MID", "ATT"];

/** "A", "B", .. "Z", "AA", "AB", .. — stable tag suffixes for any count. */
export function tagSuffix(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function clubTag(i: number): string {
  return `CLUB_${tagSuffix(i)}`;
}

export function nationTag(i: number): string {
  return `NATION_${tagSuffix(i)}`;
}

/** Era buckets are decades starting at 1960: ERA_1960s, ERA_1970s, ... */
export function eraTag(i: number): string {
  return `ERA_${1960 + i * 10}s`;
}

// Deliberately alien syllables so generated names cannot collide with real
// footballer names.
const NAME_SYLLABLES = [
  "vor", "zek", "mal", "dro", "kip", "run", "tas", "bel",
  "nuv", "gor", "shi", "pla", "que", "fen", "lox", "arn",
];

function fakeName(rng: () => number): string {
  const syl = () => NAME_SYLLABLES[rngInt(rng, NAME_SYLLABLES.length)];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const first = cap(syl() + syl());
  const lastLen = 2 + rngInt(rng, 2);
  let last = "";
  for (let i = 0; i < lastLen; i++) last += syl();
  return `${first} ${cap(last)}`;
}

/**
 * Generate a full synthetic card set from a seed. Deterministic:
 * same (seed, config) ⇒ byte-identical set.
 */
export function generateCardSet(seed: string, cfg: CardGenConfig): Card[] {
  const rng = rngFromString(`${seed}|cardset`);
  const positionWeights = POSITIONS.map((p) => cfg.positionWeights[p]);
  const cards: Card[] = [];
  for (let i = 0; i < cfg.setSize; i++) {
    const ratingSpan = cfg.ratingMax - cfg.ratingMin;
    const rating = cfg.ratingMin + Math.round(ratingSpan * Math.pow(rng(), cfg.ratingSkew));

    const clubCount = 1 + rngWeighted(rng, cfg.clubsPerCardWeights);
    const clubPool = Array.from({ length: cfg.clubCount }, (_, c) => c);
    const clubs: string[] = [];
    for (let c = 0; c < Math.min(clubCount, cfg.clubCount); c++) {
      const pick = rngInt(rng, clubPool.length);
      clubs.push(clubTag(clubPool[pick]));
      clubPool.splice(pick, 1);
    }
    clubs.sort();

    const eraIndex = rngInt(rng, cfg.eraCount);
    cards.push({
      id: `CARD_${String(i).padStart(3, "0")}`,
      name: fakeName(rng),
      rating,
      clubs,
      nation: nationTag(rngInt(rng, cfg.nationCount)),
      era: eraTag(eraIndex),
      eraIndex,
      position: POSITIONS[rngWeighted(rng, positionWeights)],
    });
  }
  return cards;
}
