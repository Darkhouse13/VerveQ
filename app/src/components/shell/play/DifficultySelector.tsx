/**
 * DifficultySelector — a compact neo segmented control (Easy / Intermediate /
 * Hard) for the curated solo modes. Self-contained styling (own light pill +
 * electric-blue active segment) so it reads on both the dark VerveGrid broadcast
 * bar and the light Higher or Lower column. Changing the tier restarts the run,
 * so it's disabled while a change is mid-flight.
 */
import { useTranslation } from "react-i18next";
import { DIFFICULTIES, type Difficulty } from "@/lib/difficulty";

interface DifficultySelectorProps {
  value: Difficulty;
  onChange: (next: Difficulty) => void;
  /** Hide the leading "Difficulty" label (e.g. in a tight header). */
  hideLabel?: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}

export function DifficultySelector({
  value,
  onChange,
  hideLabel = false,
  size = "sm",
  disabled = false,
  className = "",
}: DifficultySelectorProps) {
  const { t } = useTranslation("play");
  const pad = size === "md" ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[10px]";

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {!hideLabel && (
        <span className="font-heading font-bold uppercase tracking-wide text-[10px] text-muted-foreground">
          {t("difficulty.label")}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={t("difficulty.label")}
        className="inline-flex neo-border rounded-lg overflow-hidden bg-background"
      >
        {DIFFICULTIES.map((level) => {
          const active = level === value;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => !active && onChange(level)}
              className={`${pad} font-heading font-bold uppercase tracking-wide transition-colors disabled:opacity-60 ${
                active
                  ? "bg-electric-blue text-electric-blue-foreground"
                  : "bg-background text-foreground hover:bg-muted cursor-pointer"
              }`}
            >
              {t(`difficulty.${level}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
