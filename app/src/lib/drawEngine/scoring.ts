/**
 * Round scoring: form, fixture modifiers, synergy chains.
 * Pure functions of (boardSeed, cards, fixture, config) — nothing else.
 */

import { unitFromString } from "./rng";
import type {
  Card,
  CardRoundBreakdown,
  EngineConfig,
  Fixture,
  RoundBreakdown,
  SynergyBreakdown,
  SynergyFamily,
} from "./types";
import { SYNERGY_FAMILIES } from "./types";

/**
 * Per-(card, round) form multiplier, uniform in [1-spread, 1+spread].
 * Seeded from (boardSeed, cardId, roundIndex) ONLY — never user identity or
 * choices, so every user sees the same form for the same card on the same
 * board (leaderboard fairness; see DECISIONS.md).
 */
export function formFor(boardSeed: string, cardId: string, roundIndex: number, spread: number): number {
  const u = unitFromString(`${boardSeed}|form|${cardId}|${roundIndex}`);
  return 1 - spread + 2 * spread * u;
}

/** Product of all fixture modifiers the card matches (1 if none). */
export function fixtureMultFor(card: Card, fixture: Fixture): number {
  let mult = 1;
  for (const mod of fixture.modifiers) {
    switch (mod.kind) {
      case "position":
        if (card.position === mod.value) mult *= mod.mult;
        break;
      case "club":
        if (card.clubs.includes(mod.value as string)) mult *= mod.mult;
        break;
      case "nation":
        if (card.nation === mod.value) mult *= mod.mult;
        break;
      case "era":
        if (card.era === mod.value) mult *= mod.mult;
        break;
      case "eraBefore":
        if (card.eraIndex < (mod.value as number)) mult *= mod.mult;
        break;
      case "eraAtLeast":
        if (card.eraIndex >= (mod.value as number)) mult *= mod.mult;
        break;
    }
  }
  return mult;
}

function tagsOf(card: Card, family: SynergyFamily): string[] {
  switch (family) {
    case "club":
      return card.clubs;
    case "nation":
      return [card.nation];
    case "era":
      return [card.era];
  }
}

/** Multiplier for a chain of the given length per the config table (clamped). */
export function chainMult(chain: number, config: EngineConfig): number {
  const table = config.synergyTable;
  if (table.length === 0) return 1;
  const idx = Math.min(chain, table.length - 1);
  return table[idx] ?? 1;
}

/** Largest shared-tag chain in one family: (tag, count of squad cards carrying it). */
export function largestChain(cards: Card[], family: SynergyFamily): { tag: string; chain: number } {
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const tag of tagsOf(card, family)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  let bestTag = "";
  let bestChain = 0;
  for (const [tag, count] of counts) {
    if (count > bestChain || (count === bestChain && tag < bestTag)) {
      bestTag = tag;
      bestChain = count;
    }
  }
  return { tag: bestTag, chain: bestChain };
}

/**
 * Granted synergies for a squad: per family the largest chain, kept only when
 * its table multiplier exceeds ×1, capped at maxSynergyFamilies (top
 * multipliers win; family order club→nation→era breaks ties).
 */
export function squadSynergies(cards: Card[], config: EngineConfig): SynergyBreakdown[] {
  const granted: SynergyBreakdown[] = [];
  for (const family of SYNERGY_FAMILIES) {
    const { tag, chain } = largestChain(cards, family);
    const mult = chainMult(chain, config);
    if (mult > 1) granted.push({ family, tag, chain, mult });
  }
  granted.sort((a, b) => b.mult - a.mult || SYNERGY_FAMILIES.indexOf(a.family) - SYNERGY_FAMILIES.indexOf(b.family));
  return granted.slice(0, config.maxSynergyFamilies);
}

/** Full round score with breakdown. Pure; identical inputs ⇒ identical floats. */
export function scoreRound(
  boardSeed: string,
  squad: Card[],
  fixture: Fixture,
  config: EngineConfig,
): RoundBreakdown {
  const cards: CardRoundBreakdown[] = squad.map((card) => {
    const form = formFor(boardSeed, card.id, fixture.index, config.formSpread);
    const fixtureMult = fixtureMultFor(card, fixture);
    return {
      cardId: card.id,
      rating: card.rating,
      form,
      fixtureMult,
      contribution: card.rating * form * fixtureMult,
    };
  });
  let baseSum = 0;
  for (const c of cards) baseSum += c.contribution;
  const synergies = squadSynergies(squad, config);
  let synergyMult = 1;
  for (const s of synergies) synergyMult *= s.mult;
  const score = baseSum * synergyMult;
  return {
    fixtureIndex: fixture.index,
    threshold: fixture.threshold,
    baseSum,
    synergies,
    synergyMult,
    score,
    cleared: score >= fixture.threshold,
    cards,
  };
}
