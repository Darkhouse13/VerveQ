/**
 * Language preference — the "has the user explicitly chosen a UI language" flag.
 *
 * i18next's LanguageDetector already persists the *active* language to
 * localStorage (`i18nextLng`), but that is set even by silent browser detection,
 * so it can't tell an explicit choice from a default. This separate flag
 * (mirroring the `verveq_` key convention used elsewhere, e.g. lib/duel.ts)
 * records that the language is settled: by the Settings switcher, a French or
 * Spanish SEO page, or — on a first visit — the browser's own language.
 *
 * There is no language prompt (it covered the landing on phones): a first
 * visit is settled silently by `settleFirstVisitLanguage`, and the switch
 * lives in Settings.
 */
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { staticPageLanguage } from "@/lib/seoPages";

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
 * funnel for every language decision (Settings switcher, FR/ES SEO pages, the
 * first-visit default).
 */
export async function chooseLanguage(lng: string): Promise<void> {
  await i18n.changeLanguage(lng);
  markLanguageChosen();
}

/** A supported language for a tag like `fr-CA` (primary subtag), or null. */
function supported(tag: string | null | undefined): SupportedLanguage | null {
  const primary = tag?.toLowerCase().split(/[-_]/)[0] ?? "";
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(primary)
    ? (primary as SupportedLanguage)
    : null;
}

/**
 * The language a first visit should get: an explicit `?lng=` in the URL, then
 * the page's own language (a French or Spanish SEO page), then the first of the
 * browser's languages we support, else English.
 */
export function firstVisitLanguage(
  search: string,
  browserLanguages: readonly string[],
  pageLanguage: SupportedLanguage | null,
): SupportedLanguage {
  const fromQuery = supported(new URLSearchParams(search).get("lng"));
  if (fromQuery) return fromQuery;
  if (pageLanguage) return pageLanguage;
  for (const tag of browserLanguages) {
    const lang = supported(tag);
    if (lang) return lang;
  }
  return "en";
}

/** On a visit with no settled language, settle it now — no prompt. */
export function settleFirstVisitLanguage(): void {
  if (hasChosenLanguage()) return;
  const browser =
    typeof navigator === "undefined"
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
  const lang = firstVisitLanguage(window.location.search, browser, staticPageLanguage());
  void chooseLanguage(lang);
}
