/**
 * i18n setup (react-i18next).
 *
 * Scaffolding for the v2 shell: provider config, browser language detection,
 * and LAZY, code-split namespaces. Only the NEW shell screens are translated
 * this pass — existing screens are untouched and never load a namespace.
 *
 * Lazy namespaces: locale JSON is loaded on demand through a tiny custom
 * i18next backend backed by Vite's `import.meta.glob`. Each `locales/<lng>/<ns>.json`
 * becomes its own async chunk, fetched only when that language+namespace is first
 * needed. `en` is the fallback; `fr`/`es` are stubs that fall back to English.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

export const SUPPORTED_LANGUAGES = ["en", "fr", "es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const SHELL_NS = "shell";

// Lazy module map — loaders are NOT eager, so each locale file is a separate
// chunk pulled in only when its (language, namespace) pair is requested.
const localeModules = import.meta.glob("./locales/*/*.json") as Record<
  string,
  () => Promise<{ default: Record<string, unknown> }>
>;

const lazyBackend = {
  type: "backend" as const,
  init() {},
  read(
    language: string,
    namespace: string,
    callback: (err: unknown, data: Record<string, unknown> | null) => void,
  ) {
    const key = `./locales/${language}/${namespace}.json`;
    const loader = localeModules[key];
    if (!loader) {
      // Unknown (language, namespace) — let i18next fall back to `en`.
      callback(null, {});
      return;
    }
    loader()
      .then((mod) => callback(null, mod.default))
      .catch((err) => callback(err, null));
  },
};

void i18n
  .use(lazyBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    nonExplicitSupportedLngs: true, // map `fr-FR` -> `fr`
    ns: [SHELL_NS],
    defaultNS: SHELL_NS,
    load: "languageOnly",
    detection: {
      order: ["querystring", "localStorage", "navigator", "htmlTag"],
      lookupQuerystring: "lng",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: true },
  });

export default i18n;
