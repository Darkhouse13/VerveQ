/**
 * "This weekend: …" — which leagues actually play the open window (D4),
 * always derived from fantasyMarket.getWeekendLeagues upstream, never
 * hardcoded here.
 *
 * FW-POLISH-3 O4: up to 3 leagues render inline ("This weekend: A + B");
 * at 4+ the line collapses to "This weekend: N leagues ▾" with tap-to-expand
 * listing all — an eight-league window would wrap the joined line into four
 * rows of noise at 380px. Lives on the hub and as a compact squad-screen
 * strip; deliberately NOT in the picker any more (the picker filters by
 * league instead of announcing them).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { leagueListLine } from "@/lib/leagueNames";

const INLINE_MAX = 3;

export function WeekendLeaguesLine({
  leagueIds,
  testid,
  className = "",
}: {
  leagueIds: ReadonlyArray<number>;
  testid?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (leagueIds.length === 0) return null;

  const base =
    "font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground";
  const fullLine = t("weekend.thisWeekend", {
    defaultValue: "This weekend: {{leagues}}",
    leagues: leagueListLine(leagueIds),
  });

  if (leagueIds.length <= INLINE_MAX) {
    return (
      <p className={`${base} ${className}`} data-testid={testid}>
        {fullLine}
      </p>
    );
  }

  return (
    <button
      type="button"
      data-testid={testid}
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
      className={`${base} ${className} text-left active:opacity-60`}
    >
      {expanded ? (
        <>
          {fullLine}
          <ChevronUp size={12} strokeWidth={3} className="inline ml-1 -mt-0.5" aria-hidden />
        </>
      ) : (
        <>
          {t("weekend.thisWeekendMany", {
            defaultValue: "This weekend: {{n}} leagues",
            n: leagueIds.length,
          })}
          <ChevronDown size={12} strokeWidth={3} className="inline ml-1 -mt-0.5" aria-hidden />
        </>
      )}
    </button>
  );
}
