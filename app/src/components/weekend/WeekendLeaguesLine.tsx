/**
 * "This gameweek: …" — which leagues actually play the open window (D4),
 * always derived from fantasyMarket.getWeekendLeagues upstream, never
 * hardcoded here.
 *
 * FW-POLISH-3 O4: up to 3 leagues render inline ("This weekend: A + B");
 * at 4+ the line collapses to "This weekend: N leagues ▾" with tap-to-expand
 * listing all — an eight-league window would wrap the joined line into four
 * rows of noise at 380px. Lives in the hub's fixtures-rail header (FW-RECEIPT
 * P1: the rail title IS this line — one "This weekend", not two) and as a
 * compact squad-screen strip; deliberately NOT in the picker any more (the
 * picker filters by league instead of announcing them).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leagueListLine } from "@/lib/leagueNames";
import { cn } from "@/lib/utils";

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

  const base = "font-mono text-eyebrow font-bold uppercase text-muted-foreground";
  const fullLine = t("weekend.thisWeekendLine", {
    defaultValue: "This gameweek: {{leagues}}",
    leagues: leagueListLine(leagueIds),
  });

  if (leagueIds.length <= INLINE_MAX) {
    return (
      <p className={cn(base, className)} data-testid={testid}>
        {fullLine}
      </p>
    );
  }

  return (
    // A 44px tap row that still reads as the eyebrow line it is.
    <Button
      variant="ghost"
      size="sm"
      data-testid={testid}
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
      // min-w-0 + a truncating label: one line beside "All fixtures" in
      // every language; expanded, the full list wraps instead.
      className={cn(base, "-ml-2 h-auto min-w-0 max-w-full justify-start gap-1 px-2 text-left", className)}
    >
      {expanded ? (
        <>
          <span className="min-w-0">{fullLine}</span>
          <ChevronUp size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
        </>
      ) : (
        <>
          <span className="min-w-0 truncate">
            {t("weekend.thisWeekendMany", {
              defaultValue: "This gameweek: {{n}} leagues",
              n: leagueIds.length,
            })}
          </span>
          <ChevronDown size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
        </>
      )}
    </Button>
  );
}
