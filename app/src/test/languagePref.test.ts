import { describe, it, expect, beforeEach, vi } from "vitest";

// Stub the i18n singleton so the unit test doesn't boot the full i18next
// instance / lazy namespace backend — we only care that chooseLanguage forwards
// the language and records the explicit-choice flag.
vi.mock("@/i18n", () => ({
  default: { changeLanguage: vi.fn().mockResolvedValue(undefined) },
}));

import i18n from "@/i18n";
import {
  hasChosenLanguage,
  markLanguageChosen,
  chooseLanguage,
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
});
