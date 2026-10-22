import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, LANGUAGE_AUTONYMS } from "@/i18n";
import { chooseLanguage } from "@/lib/languagePref";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
      <span className="font-mono text-eyebrow font-bold uppercase text-muted-foreground flex items-center gap-1.5">
        <Globe size={13} strokeWidth={2.5} />
        {label}
      </span>
      <div className="flex gap-2" role="group" aria-label={label}>
        {SUPPORTED_LANGUAGES.map((lng) => {
          const selected = active === lng;
          return (
            <Button
              key={lng}
              variant={selected ? "primary" : "secondary"}
              size="sm"
              aria-pressed={selected}
              onClick={() => void chooseLanguage(lng)}
              className="flex-1 px-2"
            >
              {LANGUAGE_AUTONYMS[lng]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
