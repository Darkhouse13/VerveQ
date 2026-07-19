/**
 * Fixture effect legibility (Ticket F, F1).
 *
 * The gauntlet was visible from board start but its MODIFIERS were not: a chip
 * read "WALL 350" and nothing on screen said WALL doubles defenders and guts
 * attackers. A player could not tell why a round scored what it scored, so the
 * draft was a guess. This module turns the modifier data into the two things
 * the UI shows — a compact ▲/▼ line and a plain-language sentence.
 *
 * DERIVED, NEVER HAND-WRITTEN. Every label, direction and multiplier here is
 * computed from the Fixture's own `modifiers` array at render time, so the
 * chips describe whatever config the board was actually generated under. Retune
 * a multiplier or swap an archetype's rule in c13v1 and the chips, the sheet
 * copy and the mini-gauntlet all follow with zero code edits — which is what
 * drawLegibilityContract.test.ts pins by mutating a config and re-rendering.
 *
 * Era bounds go through the engine's own `eraTag`, so the decade labels can't
 * drift from the buckets the cards are actually generated into.
 */

import { eraTag, fixtureMultFor } from "@/lib/drawEngine";
import type { Card, Fixture, FixtureModifier, PositionId } from "@/lib/drawEngine";
import { formatMult, shortTag } from "./meta";
import { tagName } from "./tags";

/** Which way a multiplier pushes. `flat` = the card is untouched (×1). */
export type EffectDir = "up" | "down" | "flat";

export interface EffectToken {
  /** Compact label, e.g. "DEF", "≤80s", "CLUB D". */
  label: string;
  dir: EffectDir;
  mult: number;
}

export const DIR_ARROW: Record<EffectDir, string> = {
  up: "▲",
  down: "▼",
  flat: "–",
};

function dirOf(mult: number): EffectDir {
  if (mult > 1) return "up";
  if (mult < 1) return "down";
  return "flat";
}

/**
 * Compact label for one modifier's SUBJECT (no multiplier — the arrow carries
 * the direction and the sheet carries the number).
 *
 * Era bounds read as an inclusive range rather than borrowing one suffix for
 * both rules: `eraBefore 3` covers the 80s and older, `eraAtLeast 3` the 90s
 * and newer, so they render "≤80s" and "90s+". Giving both a bare "+" would
 * make one chip's suffix mean "and older" and the next chip's mean "and
 * newer" — an ambiguity a legibility pass should not ship.
 */
export function modifierSubject(mod: FixtureModifier): string {
  switch (mod.kind) {
    case "eraBefore":
      // Highest bucket the rule still includes: eraIndex < value.
      return `≤${shortTag(eraTag((mod.value as number) - 1))}`;
    case "eraAtLeast":
      return `${shortTag(eraTag(mod.value as number))}+`;
    case "position":
      return String(mod.value);
    default:
      return shortTag(String(mod.value));
  }
}

/** One token per modifier, in config order. */
export function effectTokens(fixture: Fixture): EffectToken[] {
  return fixture.modifiers.map((mod) => ({
    label: modifierSubject(mod),
    dir: dirOf(mod.mult),
    mult: mod.mult,
  }));
}

/** The compact chip line, e.g. "DEF▲ ATT▼" (WALL) or "≤80s▲" (THROWBACK). */
export function effectLine(fixture: Fixture): string {
  return effectTokens(fixture)
    .map((t) => `${t.label}${DIR_ARROW[t.dir]}`)
    .join(" ");
}

/** Position → the plural noun the sheet copy uses. */
const POSITION_NOUN: Record<PositionId, string> = {
  GK: "Keepers",
  DEF: "Defenders",
  MID: "Midfielders",
  ATT: "Attackers",
};

/**
 * The subject of one plain-language sentence, e.g. "Defenders",
 * "Cards from the 80s and earlier", "CLUB D cards". House voice: sentence
 * case, no jargon, the multiplier stated as a number the player can act on.
 */
function sentenceSubject(mod: FixtureModifier): string {
  switch (mod.kind) {
    case "position":
      return POSITION_NOUN[mod.value as PositionId] ?? `${String(mod.value)} cards`;
    case "eraBefore":
      return `Cards from the ${shortTag(eraTag((mod.value as number) - 1))} and earlier`;
    case "eraAtLeast":
      return `Cards from the ${shortTag(eraTag(mod.value as number))} and later`;
    case "era":
      return `Cards from the ${shortTag(String(mod.value))}`;
    default:
      // club / nation — the tag's full name once the real set lands.
      return `${tagName(String(mod.value))} cards`;
  }
}

/** One sentence per modifier, e.g. "Defenders score ×2.69." */
export function effectSentences(fixture: Fixture): string[] {
  return fixture.modifiers.map(
    (mod) => `${sentenceSubject(mod)} score ${formatMult(mod.mult)}.`,
  );
}

/** Position → the lowercase plural the entry-tile descriptor uses (D4). */
const DESCRIPTOR_NOUN: Record<PositionId, string> = {
  GK: "keepers",
  DEF: "defenders",
  MID: "midfielders",
  ATT: "attackers",
};

/**
 * D4 — a modifier shape the descriptor mapping cannot express. Thrown, never
 * guessed around: wrong plain words on the entry screen are worse than no
 * line, so the caller renders nothing and the shape gets reported.
 */
export class DescriptorShapeError extends Error {
  constructor(fixture: Fixture, reason: string) {
    super(`descriptorLine: ${fixture.archetypeId} — ${reason}`);
    this.name = "DescriptorShapeError";
  }
}

/**
 * D4 — the entry-tile plain-words line, e.g. "defenders shine · attackers
 * fade" (WALL) or "90s and later shine" (NEW WAVE). GENERATED from the
 * fixture's own modifiers — same derivation law as the rest of this module —
 * so a config retune can never desync the words from the numbers.
 *
 * Expressible shapes (everything in c13-1/c13-2): exactly one boost (a
 * position or an era bound) plus at most one position cut. Anything else —
 * era cuts, tag modifiers, ×1 modifiers, multiple boosts — throws
 * DescriptorShapeError rather than rendering wrong words.
 */
export function descriptorLine(fixture: Fixture): string {
  const boosts: FixtureModifier[] = [];
  const cuts: FixtureModifier[] = [];
  for (const mod of fixture.modifiers) {
    if (mod.mult > 1) boosts.push(mod);
    else if (mod.mult < 1) cuts.push(mod);
    else throw new DescriptorShapeError(fixture, `flat ×1 modifier (${mod.kind})`);
  }
  if (boosts.length !== 1)
    throw new DescriptorShapeError(fixture, `${boosts.length} boosts (need exactly 1)`);
  if (cuts.length > 1)
    throw new DescriptorShapeError(fixture, `${cuts.length} cuts (at most 1)`);

  const boost = boosts[0];
  let line: string;
  if (boost.kind === "position") {
    const noun = DESCRIPTOR_NOUN[boost.value as PositionId];
    if (!noun) throw new DescriptorShapeError(fixture, `unknown position ${String(boost.value)}`);
    line = `${noun} shine`;
  } else if (boost.kind === "eraBefore") {
    line = `${shortTag(eraTag((boost.value as number) - 1))} and earlier shine`;
  } else if (boost.kind === "eraAtLeast") {
    line = `${shortTag(eraTag(boost.value as number))} and later shine`;
  } else {
    throw new DescriptorShapeError(fixture, `boost kind ${boost.kind} has no mapping`);
  }

  const cut = cuts[0];
  if (cut) {
    if (cut.kind !== "position")
      throw new DescriptorShapeError(fixture, `cut kind ${cut.kind} has no mapping`);
    const noun = DESCRIPTOR_NOUN[cut.value as PositionId];
    if (!noun) throw new DescriptorShapeError(fixture, `unknown position ${String(cut.value)}`);
    line += ` · ${noun} fade`;
  }
  return line;
}

/**
 * How this fixture treats ONE card — the mini-gauntlet cell (F2b) and the
 * per-card row in the sheet. Delegates the matching rules to the engine's
 * `fixtureMultFor` rather than re-reading `kind` here: the UI must not become
 * a second implementation of what a modifier matches.
 */
export function cardEffect(card: Card, fixture: Fixture): { dir: EffectDir; mult: number } {
  const mult = fixtureMultFor(card, fixture);
  return { dir: dirOf(mult), mult };
}
