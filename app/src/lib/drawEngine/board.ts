/**
 * Board generation: (boardSeed, cardSet, config) ⇒ BoardSpec. Deterministic.
 * The full gauntlet — archetypes, modifiers, thresholds — is part of the
 * returned spec and therefore visible from board start.
 */

import { rngFromString, rngInt, rngShuffle } from "./rng";
import type { BoardSpec, Card, EngineConfig, Fixture } from "./types";

export function generateBoard(boardSeed: string, cardSet: Card[], config: EngineConfig): BoardSpec {
  const slots = config.rows * config.offersPerRow;
  if (cardSet.length < slots) {
    throw new Error(`Card set too small: need ${slots}, got ${cardSet.length}`);
  }

  const rng = rngFromString(`${boardSeed}|board`);

  // Sample `slots` distinct cards via a partial Fisher-Yates over indices.
  const indices = Array.from({ length: cardSet.length }, (_, i) => i);
  const rows: Card[][] = [];
  let cursor = cardSet.length;
  for (let r = 0; r < config.rows; r++) {
    const row: Card[] = [];
    for (let o = 0; o < config.offersPerRow; o++) {
      const pick = rngInt(rng, cursor);
      row.push(cardSet[indices[pick]]);
      cursor--;
      indices[pick] = indices[cursor];
    }
    rows.push(row);
  }

  // Deal fixtures: shuffle the archetype table, cycle if it is shorter than
  // the gauntlet. Thresholds follow the configured curve; last fixture = boss.
  const order = rngShuffle(
    rng,
    Array.from({ length: config.archetypes.length }, (_, i) => i),
  );
  const fixtures: Fixture[] = [];
  const { base, growth, bossMult, thresholdShape } = config.thresholds;
  for (let i = 0; i < config.fixtureCount; i++) {
    const archetype = config.archetypes[order[i % order.length]];
    const isBoss = i === config.fixtureCount - 1;
    const threshold = Math.round(
      base * Math.pow(growth, i) * (isBoss ? bossMult : 1) * (thresholdShape?.[i] ?? 1),
    );
    fixtures.push({
      index: i,
      archetypeId: archetype.id,
      modifiers: archetype.modifiers,
      threshold,
      isBoss,
    });
  }

  return { seed: boardSeed, rows, fixtures };
}
