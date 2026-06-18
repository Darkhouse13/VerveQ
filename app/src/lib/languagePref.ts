/**
 * Language preference — the "has the user explicitly chosen a UI language" flag.
 *
 * i18next's LanguageDetector already persists the *active* language to
 * localStorage (`i18nextLng`), but that is set even by silent browser detection,
 * so it can't tell an explicit choice from a default. This separate flag
 * (mirroring the `verveq_` key convention used elsewhere, e.g. lib/duel.ts) is
 * what gates the one-time first-run language prompt: it is set the first time
 * the user picks a language anywhere (the prompt OR the Settings switcher), so
 * the prompt never reappears.
 */
import i18n from "@/i18n";

const LANG_CHOSEN_KEY = "verveq_lang_chosen";

export function hasChosenLanguage(): boolean {
  try {
    return localStorage.getItem(LANG_CHOSEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markLanguageChosen(): void {
  try {
    localStorage.setItem(LANG_CHOSEN_KEY, "1");
  } catch {
    // Private mode / storage disabled — the prompt may show again, which is
    // acceptable; it must never throw.
  }
}

/**
 * Switch the UI language AND record that the choice was explicit. The single
 * funnel for every deliberate language pick (first-run prompt + Settings
 * switcher), so any pick stops future first-run prompts.
 */
export async function chooseLanguage(lng: string): Promise<void> {
  await i18n.changeLanguage(lng);
  markLanguageChosen();
}
