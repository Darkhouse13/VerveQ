/**
 * In-screen difficulty tier picker for the curated solo modes.
 *
 * FR-1A moved these modes onto direct deep links, which dropped the shared
 * `/difficulty` picker step and left the tier stuck at the `?difficulty=`
 * default with no way to change it. This puts the control back where it now
 * belongs — inside the mode, next to the board it changes — instead of
 * restoring a route in front of it.
 *
 * PRE-RUN ONLY, by contract. The tier is a ceiling the SERVER applies when it
 * provisions the run (`verveGrid.startSession` / `higherLower.startSession`),
 * so changing it mid-run cannot re-tier the board or stat pool already dealt —
 * it can only start a different run. Callers therefore unmount this once the
 * player has committed a guess, which keeps `lib/difficulty.ts`'s "the choice
 * holds for the run" contract literally true.
 *
 * Changing the tier rewrites `?difficulty=` rather than calling startGame:
 * both hooks key their auto-start on `sport|difficulty`, so the URL is the
 * single source of truth and a re-tier is naturally one new session — no
 * second code path that could race the first.
 */
import { useTranslation } from "react-i18next";
import { DIFFICULTIES, type Difficulty } from "@/lib/difficulty";

interface TierControlProps {
  value: Difficulty;
  onChange: (tier: Difficulty) => void;
  /** True while a run is being provisioned — avoids queuing a second start. */
  disabled?: boolean;
  className?: string;
}

export function TierControl({
  value,
  onChange,
  disabled,
  className,
}: TierControlProps) {
  const { t } = useTranslation("play");

  return (
    <div className={className}>
      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1 text-center">
        {t("tier.label", { defaultValue: "Difficulty" })}
      </p>
      <div
        role="group"
        aria-label={t("tier.label", { defaultValue: "Difficulty" })}
        className="flex gap-1.5 justify-center"
      >
        {DIFFICULTIES.map((tier) => {
          const active = tier === value;
          return (
            <button
              key={tier}
              type="button"
              aria-pressed={active}
              disabled={disabled || active}
              onClick={() => onChange(tier)}
              className={`neo-border rounded-full px-3 py-1 text-[11px] font-heading font-bold uppercase transition-all disabled:cursor-default ${
                active
                  ? "bg-primary text-primary-foreground neo-shadow-sm"
                  : "bg-background text-foreground cursor-pointer disabled:opacity-50"
              }`}
            >
              {t(`tier.${tier}`, {
                defaultValue:
                  tier === "easy"
                    ? "Easy"
                    : tier === "intermediate"
                      ? "Medium"
                      : "Hard",
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
