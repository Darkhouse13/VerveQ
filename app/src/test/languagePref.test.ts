import { describe, it, expect, beforeEach, vi } from "vitest";

// Stub the i18n singleton so the unit test doesn't boot the full i18next
// instance / lazy namespace backend — we only care that chooseLanguage forwards
// the language and records the explicit-choice flag.
vi.mock("@/i18n", () => ({
  default: { changeLanguage: vi.fn().mockResolvedValue(undefined) },
  SUPPORTED_LANGUAGES: ["en", "fr", "es"],
}));

import i18n from "@/i18n";
import {
  hasChosenLanguage,
  markLanguageChosen,
  chooseLanguage,
  firstVisitLanguage,
  settleFirstVisitLanguage,
} from "@/lib/languagePref";

describe("languagePref", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("reports no choice before anything is set", () => {
    expect(hasChosenLanguage()).toBe(false);
  });

  it("persists an explicit choice and reads it back", () => {
    markLanguageChosen();
    expect(localStorage.getItem("verveq_lang_chosen")).toBe("1");
    expect(hasChosenLanguage()).toBe(true);
  });

  it("chooseLanguage switches the language AND marks the choice explicit", async () => {
    expect(hasChosenLanguage()).toBe(false);
    await chooseLanguage("fr");
    expect(i18n.changeLanguage).toHaveBeenCalledWith("fr");
    expect(hasChosenLanguage()).toBe(true);
  });

  // No language prompt: a first visit is settled from the URL, the page, or the
  // browser — in that order — and English is the fallback.
  it.each([
    ["", ["fr-FR", "en"], null, "fr"],
    ["", ["es-419"], null, "es"],
    ["", ["de-DE", "es-ES", "fr"], null, "es"],
    ["", ["de-DE", "ja"], null, "en"],
    ["", [], null, "en"],
    ["?lng=es", ["fr-FR"], null, "es"],
    ["?lng=de", ["fr-FR"], null, "fr"],
    ["", ["en-GB"], "fr", "fr"],
  ] as const)("first visit %s with browser %j on a %s page gets %s", (search, browser, page, want) => {
    expect(firstVisitLanguage(search, browser, page)).toBe(want);
  });

  it("settles a first visit once and leaves a settled one alone", async () => {
    settleFirstVisitLanguage();
    await Promise.resolve();
    expect(i18n.changeLanguage).toHaveBeenCalledTimes(1);
    expect(hasChosenLanguage()).toBe(true);
    settleFirstVisitLanguage();
    expect(i18n.changeLanguage).toHaveBeenCalledTimes(1);
  });
});
