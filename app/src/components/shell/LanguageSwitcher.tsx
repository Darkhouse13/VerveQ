import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, LANGUAGE_AUTONYMS } from "@/i18n";
import { chooseLanguage } from "@/lib/languagePref";
import { cn } from "@/lib/utils";

/**
 * Language picker for the v2 shell. Renders one pill per supported language,
 * labelled with its own autonym (so the control reads natively regardless of
 * the active UI language). Selecting one calls `chooseLanguage`, which switches
 * the language (i18next's LanguageDetector persists it to localStorage so it
 * survives reloads) AND records the choice as explicit so the first-run language
 * prompt never reappears. Suspense lazy-loads the target namespaces.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const active = i18n.resolvedLanguage ?? i18n.language;
  const label = t("profile.language", { defaultValue: "Language" });

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <Globe size={13} strokeWidth={2.5} />
        {label}
      </span>
      <div className="flex gap-2" role="group" aria-label={label}>
        {SUPPORTED_LANGUAGES.map((lng) => {
          const selected = active === lng;
          return (
            <button
              key={lng}
              type="button"
              aria-pressed={selected}
              onClick={() => void chooseLanguage(lng)}
              className={cn(
                "flex-1 neo-border rounded-lg px-2 py-2 font-heading font-bold text-[13px] transition-all",
                selected
                  ? "bg-foreground text-background neo-shadow"
                  : "bg-card active:neo-shadow-pressed",
              )}
            >
              {LANGUAGE_AUTONYMS[lng]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
