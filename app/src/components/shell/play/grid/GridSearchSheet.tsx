/**
 * GridSearchSheet — the cell search/select sheet for VerveGrid.
 *
 * ANTI-LEAK:
 *  - The header shows ONLY the criteria (column × row) — the prompt, never an answer.
 *  - Results are rendered AS-IS from `verveGrid.searchPlayers`; no client-side
 *    correctness hints, no re-filtering, no "this one is right" markers.
 *  - Correctness is known only after the server validates the locked-in pick.
 *
 * Bottom-sheet on mobile, centered modal on desktop (matches the prototype):
 * ui/sheet with `mdCenter`, so it traps focus and closes on Escape.
 */
import { useRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Sheet, SheetClose, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
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

  if (!criteria) return null;

  const trimmed = query.trim();
  const showResults = trimmed.length >= minChars;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      mdCenter
      // Sections own their padding and borders; the results list scrolls.
      // Bottom sheet on mobile, so it keeps the home-indicator inset.
      className="max-w-none max-h-[85dvh] gap-0 overflow-hidden p-0 pb-[env(safe-area-inset-bottom)] md:pb-0"
      // Straight to the search field, not the close target.
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        inputRef.current?.focus();
      }}
      header={
        // header — criteria only (the prompt)
        <div className="shrink-0 p-4 border-b-[3px] border-border">
          <div className="flex items-center justify-between">
            <p className="font-mono text-eyebrow font-bold uppercase text-muted-foreground">
              {t("grid.fillThisSquare")}
            </p>
            <SheetClose label={t("grid.close")} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="neo-border rounded-md bg-muted text-foreground grid place-items-center font-mono font-bold w-7 h-7 text-eyebrow tracking-normal shrink-0" aria-hidden="true">
              {monogram(criteria.colLabel)}
            </span>
            <SheetTitle className="text-body md:text-title-sm leading-tight">
              {criteria.colLabel} <span className="text-muted-foreground">×</span> {criteria.rowLabel}
            </SheetTitle>
          </div>
        </div>
      }
    >
      {/* search input */}
      <div className="shrink-0 px-4 py-3 bg-muted border-b-[3px] border-border">
        <div className="flex items-center gap-2 neo-border rounded-lg bg-background px-3 py-2.5">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("grid.searchPlaceholder")}
            className="flex-1 min-w-0 bg-transparent outline-none font-body font-semibold text-body-sm text-foreground placeholder:text-muted-foreground"
          />
          <span className="neo-border rounded-full bg-foreground text-background px-2 py-0.5 font-mono font-bold text-meta tracking-wide shrink-0">
            {t("grid.guessesLeft", { count: guessesLeft })}
          </span>
        </div>
      </div>

      {/* results — rendered AS-IS; no correctness hints */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none p-3 space-y-2">
        {!showResults && (
          <p className="font-mono text-meta text-muted-foreground text-center py-6">
            {t("grid.minCharsHint", { count: minChars })}
          </p>
        )}
        {showResults && results === undefined && (
          <p className="font-mono text-meta text-muted-foreground text-center py-6 animate-pulse">
            {t("grid.searching")}
          </p>
        )}
        {showResults && results?.length === 0 && (
          <p className="font-mono text-meta text-muted-foreground text-center py-6">{t("grid.noPlayersFound")}</p>
        )}
        {results?.map((player) => (
          <Card
            key={player.externalId}
            interactive
            elevation="flat"
            padding="none"
            disabled={submitting}
            onClick={() => onSelect({ externalId: player.externalId, name: player.name })}
            className="enabled:hover:bg-muted p-2.5 flex items-center gap-3 disabled:is-dimmed"
          >
            {player.photo ? (
              <img
                src={player.photo}
                alt={player.name}
                className="neo-border rounded-md w-9 h-9 object-cover shrink-0"
              />
            ) : (
              <div className="neo-border rounded-md bg-background w-9 h-9 grid place-items-center font-heading font-bold text-meta shrink-0">
                {monogram(player.name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-body-sm truncate">{player.name}</p>
              {(player.position || player.nationality) && (
                <p className="font-mono text-meta text-muted-foreground truncate">
                  {[player.position, player.nationality].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <span className="font-heading font-bold text-title-sm text-muted-foreground shrink-0">+</span>
          </Card>
        ))}
      </div>

      {/* no-leak reassurance */}
      <div className="shrink-0 px-4 py-3 border-t-[3px] border-border bg-muted">
        <p className="font-mono text-meta leading-relaxed text-muted-foreground">
          <Trans
            i18nKey="grid.lockInReassurance"
            ns="play"
            components={{ strong: <b className="text-foreground" /> }}
          />
        </p>
      </div>
    </Sheet>
  );
}
