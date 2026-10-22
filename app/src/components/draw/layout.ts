/**
 * THE DRAW — screen layout tokens, mirroring LAYOUT_SPEC.md via the frozen
 * engine's LAYOUT constants (single source of truth). The stage components
 * consume THESE section heights, and the layout-budget test sums the same
 * arrays against the 390×844 budget — so what the test asserts is what the
 * screens actually render.
 */

import { LAYOUT } from "@/lib/drawEngine";

export { LAYOUT };

/** 3 meters + 2 gaps = 88px (LAYOUT_SPEC "Synergy meters"). */
export const SYNERGY_METERS_H =
  LAYOUT.maxSynergyFamilies * LAYOUT.synergyMeterH +
  (LAYOUT.maxSynergyFamilies - 1) * LAYOUT.synergyMeterGap;

/**
 * Ticket F sections. These are UI-LOCAL and deliberately not in the engine's
 * LAYOUT: that module is frozen at CONTRACT v1.0 and its `checkLayout` gates
 * CONFIG eligibility (draw:layoutcheck) — a different question from what these
 * screens render. The layout-budget test asserts against THESE arrays — what
 * the screens actually render — so a future config retune that eats the
 * remaining headroom fails in the gate rather than on a phone.
 */

/** F1c — the next unplayed fixture's effect line, persistent on the draft. */
export const NEXT_FIXTURE_H = 36;

/** F2b — mini-gauntlet + synergy impact of the selected offer. */
export const PICK_IMPACT_H = 40;

/**
 * D5 — the "ON PAPER" book-value projection panel. VerveQ ONE P4.2 re-laid it
 * as one header line over five columns (one per fixture, on the gauntlet
 * strip's grid) so its numbers could rise to the 12px floor: five stacked rows
 * at 12px no longer fit the old 112px, and five columns at 12px fit in 68.
 */
export const PROJECTION_H = 68;

/** F3b — projected band for the next fixture + banked / bust-keeps. */
export const DECISION_INFO_H = 76;

/**
 * The StageFrame chrome a stage sits in (VerveQ ONE P4.2 moved THE DRAW onto
 * the shared game frame): the 58px header (44px Quit + 2×6px padding + its
 * 2px rule), main's 12px top padding and the column's 16px bottom padding.
 * It replaces the old 48px top bar + 16px page padding top and bottom.
 */
export const STAGE_CHROME_H = 58 + 12 + 16;

/**
 * Draft view stack, top to bottom (LAYOUT_SPEC "Draft view" + Ticket F + D5),
 * now below the StageFrame header instead of the old in-stage top bar:
 * 64+36+88+190+40+68+24+44 + 7×12 = 638 of the 758px stage budget.
 */
export const DRAFT_SECTIONS = [
  LAYOUT.fixtureStripH,
  NEXT_FIXTURE_H,
  SYNERGY_METERS_H,
  LAYOUT.offerCardMaxH,
  PICK_IMPACT_H,
  PROJECTION_H,
  LAYOUT.rowDotsH,
  LAYOUT.scoreBarH,
] as const;

/**
 * Round view stack while benching, top to bottom (LAYOUT_SPEC "Round view" +
 * Ticket F): 140+92+88+56+76+56 + 5×12 = 568.
 *
 * DECISION_INFO_H is RESERVED, not conditional: it only has content in the
 * decision phase, but the slot is held open from the first frame so BANK and
 * PUSH do not slide under a thumb at the exact moment the reveal lands and the
 * player reaches for them.
 *
 * Once a round resolves, the synergy meters (88 + 12) give their slot to the
 * ResolutionLedger, which itemises the very chains they showed. At the 12px
 * floor the ledger's card rows take two lines (name → points, then the
 * equation), so its worst case (3 granted chains) can run the stack ~18px
 * past the 390×844 budget: the stage scrolls, and the decision panel is
 * sticky so BANK / PUSH stay on screen.
 */
export const ROUND_SECTIONS = [
  LAYOUT.fixtureCardH,
  LAYOUT.benchStripH,
  SYNERGY_METERS_H,
  LAYOUT.thresholdBarH,
  DECISION_INFO_H,
  LAYOUT.bankPushButtonsH,
] as const;

/** Stacked height of a view: sections + the 12px gaps between them. */
export function stackedHeight(sections: readonly number[]): number {
  return sections.reduce((a, b) => a + b, 0) + (sections.length - 1) * LAYOUT.sectionGap;
}

/** Vertical budget for a stage: the 390×844 viewport minus the frame chrome. */
export const HEIGHT_BUDGET = LAYOUT.viewportH - STAGE_CHROME_H;
