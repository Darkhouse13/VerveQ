/**
 * THE WEEKEND — the live ledger view (FW-RECEIPT Part 2).
 *
 * Renders `fantasyLedger.getSquadLedger`'s structured facts as the squad's
 * story, newest first, in the product's register: match language, never
 * database language ("Clean sheet · +5", not "CS_BONUS applied"). Every line
 * is composed from a fact the server derived from a stored row; nothing is
 * invented here — an entry whose terms could not be re-derived exactly renders
 * its points movement and no term story (the server sent `terms: null`).
 *
 * Static timeline, no motion: reduced-motion safe by construction.
 */
import { useTranslation } from "react-i18next";
import { Landmark, Lock, Receipt as ReceiptIcon } from "lucide-react";
import { formatPoints } from "../../../convex/lib/fantasyScoring";
import type {
  SquadLedger,
  SquadLedgerEvent,
  LedgerTermChange,
} from "../../../convex/fantasyLedger";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";

function signed(points: number): string {
  return points >= 0 ? `+${formatPoints(points)}` : formatPoints(points);
}

function crowdPct(factor: number): string {
  const pct = Math.round(factor * 100);
  return `${pct >= 0 ? "+" : ""}${pct}%`;
}

/** "key passes 3→4, +0.8" — the mission's own example, from the engine's label. */
function changeLine(change: LedgerTermChange): string {
  const label = change.label.toLowerCase();
  const movement =
    change.fromCount !== null && change.toCount !== null && change.fromCount !== change.toCount
      ? `${label} ${change.fromCount}→${change.toCount}`
      : label;
  return `${movement}, ${signed(change.pointsDelta)}`;
}

function EntryTime({ at }: { at: number }) {
  const { i18n } = useTranslation();
  const date = new Date(at);
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground tabular-nums shrink-0">
      {date.toLocaleDateString(i18n.language, { weekday: "short" })}{" "}
      {date.toLocaleTimeString(i18n.language, { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

function RoleBadge({
  slotRole,
  isFinisher,
}: {
  slotRole: "GK" | "DEF" | "MID" | "ATT";
  isFinisher: boolean;
}) {
  return (
    <NeoBadge color="muted">
      {slotRole}
      {isFinisher ? " · FIN" : ""}
    </NeoBadge>
  );
}

function Entry({
  event,
  onOpenReceipt,
}: {
  event: SquadLedgerEvent;
  onOpenReceipt?: (() => void) | undefined;
}) {
  const { t } = useTranslation();

  switch (event.kind) {
    case "squad_built":
      return (
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm">
            {event.context === "crew"
              ? t("weekend.ledgerSheetDrafted", { defaultValue: "Sheet drafted — 13 on the card." })
              : t("weekend.ledgerSquadBuilt", { defaultValue: "The 13 assembled." })}
          </p>
          <EntryTime at={event.at} />
        </div>
      );

    case "locked":
      return (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm flex items-center gap-1.5 min-w-0">
            <Lock size={12} strokeWidth={3} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">
              {t("weekend.ledgerLocked", {
                defaultValue: "{{name}} locked in at kickoff.",
                name: event.playerName,
              })}
            </span>
          </p>
          <EntryTime at={event.at} />
        </div>
      );

    case "scored":
      return (
        <div>
          <div className="flex items-center justify-between gap-2">
            {/* The number never truncates — the name yields first. */}
            <p className="font-heading font-bold text-sm min-w-0 flex-1 flex items-baseline gap-2">
              <span className="truncate min-w-0">{event.playerName}</span>
              <span className="font-mono shrink-0">{signed(event.points)}</span>
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <RoleBadge slotRole={event.slotRole} isFinisher={event.isFinisher} />
              <EntryTime at={event.at} />
            </div>
          </div>
          {event.terms !== null && event.terms.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              {event.terms
                .map((term) =>
                  // ×count only where the term is per-unit (unit present) —
                  // an appearance line's count is minutes, not a multiplier.
                  term.unit !== undefined && term.count !== undefined && term.count > 1
                    ? `${term.label.toLowerCase()} ×${term.count} ${signed(term.points)}`
                    : `${term.label.toLowerCase()} ${signed(term.points)}`,
                )
                .join(" · ")}
            </p>
          )}
          {event.mismatch && (
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-1">
              {t("weekend.ledgerMismatch", {
                defaultValue: "played {{verdict}} in a {{slot}} slot — ×0.75 on the plus side",
                verdict: event.verdictPosition ?? "?",
                slot: event.slotRole,
              })}
            </p>
          )}
        </div>
      );

    case "revised": {
      const headline =
        event.cause === "crowd"
          ? t("weekend.ledgerCrowdVerdict", {
              defaultValue: "The crowd's verdict on {{name}}: {{pct}}",
              name: event.playerName,
              pct: crowdPct(event.crowdFactor),
            })
          : event.cause === "court"
            ? t("weekend.ledgerCourtRescore", {
                defaultValue: "{{name}} re-scored on the court's ruling",
                name: event.playerName,
              })
            : t("weekend.ledgerRevised", {
                defaultValue: "Revised: {{name}}",
                name: event.playerName,
              });
      return (
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="font-heading font-bold text-sm min-w-0 truncate">{headline}</p>
            <EntryTime at={event.at} />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            {event.cause === "stats" && event.changes !== null && event.changes.length > 0
              ? `${event.changes.map(changeLine).join(" · ")} — ${formatPoints(event.prevPoints)} → ${formatPoints(event.points)}`
              : t("weekend.ledgerRevisedPoints", {
                  defaultValue: "{{from}} → {{to}} pts",
                  from: formatPoints(event.prevPoints),
                  to: formatPoints(event.points),
                })}
          </p>
        </div>
      );
    }

    case "court":
      return (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm flex items-center gap-1.5 min-w-0">
            <Landmark size={12} strokeWidth={3} className="shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">
              {t("weekend.ledgerCourtRuled", {
                defaultValue: "Court ruled: {{name}} plays {{position}}.",
                name: event.playerName,
                position: event.position,
              })}
            </span>
          </p>
          <EntryTime at={event.at} />
        </div>
      );

    case "settled":
      return (
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="font-heading font-bold text-sm">
              {t("weekend.ledgerSettled", {
                defaultValue: "Gameweek settled — {{total}} pts final.",
                total: formatPoints(event.total),
              })}
            </p>
            <EntryTime at={event.at} />
          </div>
          {onOpenReceipt !== undefined && (
            <NeoButton
              variant="primary"
              size="sm"
              className="mt-2"
              data-testid="ledger-open-receipt"
              onClick={onOpenReceipt}
            >
              <ReceiptIcon size={14} strokeWidth={3} className="mr-1.5" />
              {t("weekend.ledgerOpenReceipt", { defaultValue: "The receipt" })}
            </NeoButton>
          )}
        </div>
      );
  }
}

export function SquadLedgerView({
  ledger,
  onOpenReceipt,
}: {
  ledger: SquadLedger | null | undefined;
  /** Present once the gameweek settled — rendered on the settled entry. */
  onOpenReceipt?: () => void;
}) {
  const { t } = useTranslation();

  if (ledger === undefined) {
    return (
      <NeoCard className="text-center py-6">
        <p className="text-sm text-muted-foreground">
          {t("common.loading", { defaultValue: "Loading…" })}
        </p>
      </NeoCard>
    );
  }
  if (ledger === null) return null;

  return (
    <div className="flex flex-col gap-2" data-testid="squad-ledger">
      {ledger.entries.map((event, index) => (
        <NeoCard
          key={`${event.kind}-${event.at}-${index}`}
          className="py-2.5 px-3"
          data-testid={`ledger-entry-${event.kind}`}
          color={event.kind === "settled" ? "success" : "default"}
        >
          <Entry
            event={event}
            onOpenReceipt={event.kind === "settled" ? onOpenReceipt : undefined}
          />
        </NeoCard>
      ))}
      <p className="text-[10px] leading-snug text-muted-foreground mt-0.5">
        {t("weekend.ledgerFootnote", {
          defaultValue:
            "Every line traces to a stored fact. Points can move until the gameweek settles; players whose match hasn't been scored simply aren't here yet.",
        })}
      </p>
    </div>
  );
}
