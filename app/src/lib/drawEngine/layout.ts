/**
 * D7 — static layout eligibility check against the 390×844 single-screen
 * budget. The pixel model lives in LAYOUT_SPEC.md (this file mirrors its
 * constants). A config that violates any cap or overflows either view is
 * layout-INELIGIBLE: the sweep excludes it and draw:layoutcheck fails it.
 */

import type { EngineConfig } from "./types";

export const LAYOUT = {
  viewportW: 390,
  viewportH: 844,
  pagePaddingX: 16,
  pagePaddingY: 16,
  sectionGap: 12,

  topBarH: 48,

  // Fixture strip: one chip per fixture, horizontal.
  fixtureChipMinW: 56,
  fixtureChipGap: 8,
  fixtureStripH: 64,

  // Synergy meters: one row per family.
  synergyMeterH: 24,
  synergyMeterGap: 8,

  // Draft: active row of offer cards.
  offerCardMinW: 100,
  offerCardGap: 12,
  offerCardAspect: 1.4, // height = width * aspect
  offerCardMaxH: 190,

  // Row progress dots.
  rowDotsH: 24,

  scoreBarH: 44,

  // Round view.
  fixtureCardH: 140,
  squadChipMinW: 44,
  squadChipGap: 6,
  /**
   * Ticket 0.2 D2: the squad strip is now the tap-to-bench control — all 6
   * squad chips shown, one selected as benched per round. Taller than the old
   * passive strip: 64px tappable chip + 20px bench-state label + 8px padding.
   */
  benchStripH: 92,
  thresholdBarH: 56,
  bankPushButtonsH: 56,

  // Hard caps (also enforced independently of pixel math).
  maxRows: 6,
  maxOffersPerRow: 3,
  maxSynergyFamilies: 3,
  maxFixtures: 5,
} as const;

export interface LayoutCheckResult {
  eligible: boolean;
  violations: string[];
  metrics: {
    contentW: number;
    fixtureChipW: number;
    offerCardW: number;
    offerCardH: number;
    squadChipW: number;
    draftViewH: number;
    roundViewH: number;
    budgetH: number;
  };
}

export function checkLayout(config: EngineConfig): LayoutCheckResult {
  const L = LAYOUT;
  const violations: string[] = [];
  const contentW = L.viewportW - 2 * L.pagePaddingX;
  const budgetH = L.viewportH - 2 * L.pagePaddingY;

  if (config.rows > L.maxRows) violations.push(`slots ${config.rows} > cap ${L.maxRows}`);
  if (config.offersPerRow > L.maxOffersPerRow) {
    violations.push(`offers per row ${config.offersPerRow} > cap ${L.maxOffersPerRow}`);
  }
  if (config.maxSynergyFamilies > L.maxSynergyFamilies) {
    violations.push(`synergy families ${config.maxSynergyFamilies} > cap ${L.maxSynergyFamilies}`);
  }
  if (config.fixtureCount > L.maxFixtures) {
    violations.push(`fixtures ${config.fixtureCount} > cap ${L.maxFixtures}`);
  }

  const fixtureChipW = (contentW - (config.fixtureCount - 1) * L.fixtureChipGap) / config.fixtureCount;
  if (fixtureChipW < L.fixtureChipMinW) {
    violations.push(
      `fixture chip ${fixtureChipW.toFixed(1)}px < min ${L.fixtureChipMinW}px at ${config.fixtureCount} fixtures`,
    );
  }

  const offerCardW = (contentW - (config.offersPerRow - 1) * L.offerCardGap) / config.offersPerRow;
  const offerCardH = Math.min(offerCardW * L.offerCardAspect, L.offerCardMaxH);
  if (offerCardW < L.offerCardMinW) {
    violations.push(
      `offer card ${offerCardW.toFixed(1)}px < min ${L.offerCardMinW}px at ${config.offersPerRow} offers`,
    );
  }

  const squadChipW = (contentW - (config.rows - 1) * L.squadChipGap) / config.rows;
  if (squadChipW < L.squadChipMinW) {
    violations.push(`squad chip ${squadChipW.toFixed(1)}px < min ${L.squadChipMinW}px at ${config.rows} slots`);
  }

  const familiesShown = Math.min(config.maxSynergyFamilies, L.maxSynergyFamilies);
  const synergyMetersH = familiesShown * L.synergyMeterH + (familiesShown - 1) * L.synergyMeterGap;

  // Draft view: top bar / fixture strip / synergy meters / active row / dots / score.
  const draftSections = [L.topBarH, L.fixtureStripH, synergyMetersH, offerCardH, L.rowDotsH, L.scoreBarH];
  const draftViewH = draftSections.reduce((a, b) => a + b, 0) + (draftSections.length - 1) * L.sectionGap;
  if (draftViewH > budgetH) {
    violations.push(`draft view ${draftViewH.toFixed(0)}px > budget ${budgetH}px`);
  }

  // Round view: top bar / fixture card / tap-to-bench squad strip /
  // synergy meters / threshold bar / bank-push.
  const roundSections = [
    L.topBarH,
    L.fixtureCardH,
    L.benchStripH,
    synergyMetersH,
    L.thresholdBarH,
    L.bankPushButtonsH,
  ];
  const roundViewH = roundSections.reduce((a, b) => a + b, 0) + (roundSections.length - 1) * L.sectionGap;
  if (roundViewH > budgetH) {
    violations.push(`round view ${roundViewH.toFixed(0)}px > budget ${budgetH}px`);
  }

  return {
    eligible: violations.length === 0,
    violations,
    metrics: { contentW, fixtureChipW, offerCardW, offerCardH, squadChipW, draftViewH, roundViewH, budgetH },
  };
}
