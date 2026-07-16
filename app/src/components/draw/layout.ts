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

/** Draft view stack, top to bottom (LAYOUT_SPEC "Draft view"). */
export const DRAFT_SECTIONS = [
  LAYOUT.topBarH,
  LAYOUT.fixtureStripH,
  SYNERGY_METERS_H,
  LAYOUT.offerCardMaxH,
  LAYOUT.rowDotsH,
  LAYOUT.scoreBarH,
] as const;

/** Round view stack, top to bottom (LAYOUT_SPEC "Round view"). */
export const ROUND_SECTIONS = [
  LAYOUT.topBarH,
  LAYOUT.fixtureCardH,
  LAYOUT.benchStripH,
  SYNERGY_METERS_H,
  LAYOUT.thresholdBarH,
  LAYOUT.bankPushButtonsH,
] as const;

/** Stacked height of a view: sections + the 12px gaps between them. */
export function stackedHeight(sections: readonly number[]): number {
  return sections.reduce((a, b) => a + b, 0) + (sections.length - 1) * LAYOUT.sectionGap;
}

/** Vertical budget: viewport minus the 16px page padding top and bottom. */
export const HEIGHT_BUDGET = LAYOUT.viewportH - 2 * LAYOUT.pagePaddingY;
