/**
 * GridSearchSheet — the cell search/select sheet for VerveGrid.
 *
 * ANTI-LEAK:
 *  - The header shows ONLY the criteria (column × row) — the prompt, never an answer.
 *  - Results are rendered AS-IS from `verveGrid.searchPlayers`; no client-side
 *    correctness hints, no re-filtering, no "this one is right" markers.
 *  - Correctness is known only after the server validates the locked-in pick.
 *
 * Bottom-sheet on mobile, centered modal on desktop (matches the prototype).
 */
import { useEffect, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { monogram } from "./difficulty";
import type { GridSearchResult } from "@/hooks/useVerveGrid";

interface GridSearchSheetProps {
  open: boolean;
  criteria: { colLabel: string; rowLabel: string } | null;
  query: string;
  setQuery: (q: string) => void;
  results: GridSearchResult[] | undefined;
  minChars: number;
  guessesLeft: number;
  submitting: boolean;
  onSelect: (player: { externalId: string; name: string }) => void;
  onClose: () => void;
}

export function GridSearchSheet({
  open,
  criteria,
  query,
  setQuery,
  results,
  minChars,
  guessesLeft,
  submitting,
  onSelect,
  onClose,
}: GridSearchSheetProps) {
  const { t } = useTranslation("play");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  if (!open || !criteria) return null;

  const trimmed = query.trim();
  const showResults = trimmed.length >= minChars;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-foreground/55 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-md bg-background neo-border neo-shadow-lg md:rounded-xl rounded-t-xl flex flex-col max-h-[85dvh] min-h-0 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header — criteria only (the prompt) */}
        <div className="shrink-0 p-4 border-b-[3px] border-border">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-heading font-bold uppercase tracking-wide text-muted-foreground">
              {t("grid.fillThisSquare")}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="neo-border rounded-lg px-2 py-1 bg-background cursor-pointer active:neo-shadow-pressed"
              aria-label={t("grid.close")}
            >
              <X size={14} strokeWidth={3} />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="neo-border rounded-md bg-electric-blue text-electric-blue-foreground grid place-items-center font-heading font-bold w-7 h-7 text-[10px] -rotate-3 shrink-0">
              {monogram(criteria.colLabel)}
            </span>
            <p className="font-heading font-bold text-base md:text-lg leading-tight">
              {criteria.colLabel} <span className="text-muted-foreground">×</span> {criteria.rowLabel}
            </p>
          </div>
        </div>

        {/* search input */}
        <div className="shrink-0 px-4 py-3 bg-muted border-b-[3px] border-border">
          <div className="flex items-center gap-2 neo-border rounded-lg bg-background px-3 py-2.5">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("grid.searchPlaceholder")}
              className="flex-1 min-w-0 bg-transparent outline-none font-body font-semibold text-sm text-foreground placeholder:text-muted-foreground"
            />
            <span className="neo-border rounded-full bg-foreground text-background px-2 py-0.5 font-mono font-bold text-[8px] tracking-wide shrink-0">
              {t("grid.guessesLeft", { count: guessesLeft })}
            </span>
          </div>
        </div>

        {/* results — rendered AS-IS; no correctness hints */}
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none p-3 space-y-2">
          {!showResults && (
            <p className="font-mono text-xs text-muted-foreground text-center py-6">
              {t("grid.minCharsHint", { count: minChars })}
            </p>
          )}
          {showResults && results === undefined && (
            <p className="font-mono text-xs text-muted-foreground text-center py-6 animate-pulse">
              {t("grid.searching")}
            </p>
          )}
          {showResults && results?.length === 0 && (
            <p className="font-mono text-xs text-muted-foreground text-center py-6">{t("grid.noPlayersFound")}</p>
          )}
          {results?.map((player) => (
            <button
              key={player.externalId}
              type="button"
              disabled={submitting}
              onClick={() => onSelect({ externalId: player.externalId, name: player.name })}
              className="w-full text-left neo-border rounded-lg bg-card hover:bg-muted p-2.5 flex items-center gap-3 cursor-pointer active:neo-shadow-pressed transition-colors disabled:opacity-60"
            >
              {player.photo ? (
                <img
                  src={player.photo}
                  alt={player.name}
                  className="neo-border rounded-md w-9 h-9 object-cover shrink-0"
                />
              ) : (
                <div className="neo-border rounded-md bg-background w-9 h-9 grid place-items-center font-heading font-bold text-xs shrink-0">
                  {monogram(player.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-heading font-bold text-sm truncate">{player.name}</p>
                {(player.position || player.nationality) && (
                  <p className="font-mono text-[10px] text-muted-foreground truncate">
                    {[player.position, player.nationality].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <span className="font-heading font-bold text-lg text-muted-foreground shrink-0">+</span>
            </button>
          ))}
        </div>

        {/* no-leak reassurance */}
        <div className="shrink-0 px-4 py-3 border-t-[3px] border-border bg-muted">
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            <Trans
              i18nKey="grid.lockInReassurance"
              ns="play"
              components={{ strong: <b className="text-foreground" /> }}
            />
          </p>
        </div>
      </div>
    </div>
  );
}
