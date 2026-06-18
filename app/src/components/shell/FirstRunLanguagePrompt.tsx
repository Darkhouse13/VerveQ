/**
 * First-run language prompt — a one-time modal that asks a new visitor to pick
 * their UI language (English / Français / Español). Mounted at the app root so
 * it overlays whatever screen loads first (cold entry, login, or the shell).
 *
 * Shown once, for everyone, gated by the explicit-choice flag in lib/languagePref
 * (set on pick OR on dismiss), so it never reappears. v2-shell only — when the
 * shell flag is off the app is English-only and there is nothing to choose.
 *
 * Deliberately uses NO i18n namespace: the heading is statically tri-lingual and
 * the options are autonyms, so the prompt reads regardless of the detected
 * language AND can't suspend on a lazy namespace load (it sits above the
 * app-level <Suspense>).
 */
import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import i18n, { SUPPORTED_LANGUAGES, LANGUAGE_AUTONYMS } from "@/i18n";
import { V2_SHELL_ENABLED } from "@/lib/flags";
import { chooseLanguage, hasChosenLanguage, markLanguageChosen } from "@/lib/languagePref";

// Public legal pages render flag-independently; never cover them with the prompt.
const SUPPRESSED_PATHS = new Set(["/privacy", "/terms"]);

export function FirstRunLanguagePrompt() {
  const location = useLocation();
  const [open, setOpen] = useState(() => V2_SHELL_ENABLED && !hasChosenLanguage());

  if (!open || SUPPRESSED_PATHS.has(location.pathname)) return null;

  const active = i18n.resolvedLanguage ?? i18n.language;

  // Picking confirms the choice; dismissing (✕ / Esc / backdrop) keeps the
  // detected language. Both set the flag so the prompt is shown only once.
  const pick = (lng: string) => {
    void chooseLanguage(lng);
    setOpen(false);
  };
  const onOpenChange = (next: boolean) => {
    if (!next) {
      markLanguageChosen();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="neo-border neo-shadow-lg bg-card max-w-sm">
        <DialogHeader>
          <div className="flex justify-center">
            <span className="neo-border rounded-full bg-background p-2.5">
              <Globe size={22} strokeWidth={2.5} />
            </span>
          </div>
          <DialogTitle className="text-center">
            <span className="block font-heading font-bold text-lg">Choose your language</span>
            <span className="block font-body text-sm text-muted-foreground">Choisissez votre langue</span>
            <span className="block font-body text-sm text-muted-foreground">Elige tu idioma</span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Select your preferred language for VerveQ. You can change it later in Settings.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2" role="group" aria-label="Language">
          {SUPPORTED_LANGUAGES.map((lng) => {
            const selected = active === lng;
            return (
              <button
                key={lng}
                type="button"
                aria-pressed={selected}
                onClick={() => pick(lng)}
                className={cn(
                  "flex-1 neo-border rounded-lg px-2 py-3 font-heading font-bold text-[13px] transition-all",
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
      </DialogContent>
    </Dialog>
  );
}
