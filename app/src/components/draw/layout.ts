/**
 * THE DRAW — screen layout tokens, mirroring LAYOUT_SPEC.md via the frozen
 * engine's LAYOUT constants (single source of truth). The stage components
 * consume THESE section heights, and the layout-budget test sums the same
 * arrays against the 812px budget — so what the test asserts is what the
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
 * screens render. The consequence worth stating: checkLayout's draft/round
 * totals (518/540) now UNDERSTATE the real stacks below (618/596). Both still
 * fit the same 812px budget with room to spare, so no config that was eligible
 * became ineligible; but a future config retune that eats the remaining
 * headroom would pass checkLayout and fail here. The layout-budget test asserts
 * against THESE arrays — what the screens actually render — so that failure
 * would surface in the gate rather than on a phone.
 */

/** F1c — the next unplayed fixture's effect line, persistent on the draft. */
export const NEXT_FIXTURE_H = 36;

/** F2b — mini-gauntlet + synergy impact of the selected offer. */
export const PICK_IMPACT_H = 40;

/**
 * D5 — the "ON PAPER" book-value projection panel: a header line + one row per
 * fixture (5). Sized to hold all five rows at the draft's compact type without
 * scroll. UI-local, like the Ticket F sections above.
 */
export const PROJECTION_H = 112;

/** F3b — projected band for the next fixture + banked / bust-keeps. */
export const DECISION_INFO_H = 76;

/**
 * Draft view stack, top to bottom (LAYOUT_SPEC "Draft view" + Ticket F + D5).
 * Before D5: 48+64+36+88+190+40+24+44 + 7×12 = 618.
 * D5 adds the 112px ON PAPER projection panel (PROJECTION_H) between the fit
 * strip and the row dots:
 * 48+64+36+88+190+40+112+24+44 + 8×12 = 742, still under the 812px budget
 * (70px spare) — no existing element shrank.
 */
export const DRAFT_SECTIONS = [
  LAYOUT.topBarH,
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
 * Round view stack, top to bottom (LAYOUT_SPEC "Round view" + Ticket F).
 * 48+140+92+88+56+76+56 + 6×12 = 628.
 *
 * DECISION_INFO_H is RESERVED, not conditional: it only has content in the
 * decision phase, but the slot is held open from the first frame so BANK and
 * PUSH do not slide under a thumb at the exact moment the reveal lands and the
 * player reaches for them.
 */
export const ROUND_SECTIONS = [
  LAYOUT.topBarH,
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

/** Vertical budget: viewport minus the 16px page padding top and bottom. */
export const HEIGHT_BUDGET = LAYOUT.viewportH - 2 * LAYOUT.pagePaddingY;
