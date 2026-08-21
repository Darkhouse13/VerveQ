/**
 * THE WEEKEND — player detail sheet (FW-SCOUT): stats for strategists.
 *
 * Opens from any player render (picker rows, pitch slot sheet, draft board,
 * crew sheets) and turns a name into facts: pool provenance, this weekend's
 * matchup, last-season per 90, ownership, VerveQ history.
 *
 * PRODUCT LAW, enforced by what this component is ABLE to render:
 *  - stats, never a recommendation — no rating, rank or composite reaches
 *    the payload (fantasyPlayerCard serves none), and none is derived here
 *    beyond per-90 division of the served totals;
 *  - a stat we do not hold renders ABSENT, never 0 — every section
 *    null-checks and says what is missing in words instead ("not enough
 *    football on record"), the FW-4 vocabulary.
 *
 * Quick to open, quick to dismiss (draft-clock rule): one query, no
 * staged reveals, Escape/overlay/X all close; `clockLine` lets the draft
 * board echo the bank inside the sheet so the clock is never hidden while
 * it runs.
 */
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "../../../convex/_generated/api";
import { formatPoints } from "../../../convex/lib/fantasyScoring";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { WeekendSheet } from "@/components/weekend/WeekendSheet";
import { track } from "@/lib/analytics";
import {
  availabilityBadgeLabel,
  availabilityColor,
  availabilityLine,
} from "@/lib/weekendAvailability";

/** Below this many current-season minutes the sheet shows apps/minutes only —
 *  early-season honesty: last season stays the primary read (FW-SCOUT L3). */
export const CURRENT_SEASON_MINUTES_THRESHOLD = 180;

type Card = NonNullable<ReturnType<typeof usePlayerCard>>;
type SeasonEntry = Card["seasons"][number];

function usePlayerCard(playerId: string | null) {
  return useQuery(
    api.fantasyPlayerCard.getPlayerCard,
    playerId === null ? "skip" : { playerId },
  );
}

/** Per-90 display: total × 90 / minutes, 2 dp with trailing zeros kept —
 *  a fixed-width column reads calmer than ragged precision. */
function per90(total: number, minutes: number): string {
  return ((total * 90) / minutes).toFixed(2);
}

function poolLine(pool: string | null, lastSeasonLabel: string | null, translate: TFunction): string | null {
  switch (pool) {
    case "topfive":
      return lastSeasonLabel !== null
        ? translate("weekend.poolPricedForm", { season: lastSeasonLabel })
        : translate("weekend.poolTopFive", { defaultValue: "Priced from 2025-26 top-five form" });
    case "promoted":
      return lastSeasonLabel !== null
        ? translate("weekend.poolPromotedForm", { season: lastSeasonLabel })
        : translate("weekend.poolSecondDivision", { defaultValue: "Promoted club — priced from 2025-26 second-division form" });
    case "eredivisie":
    case "ligaportugal":
    case "championship":
      return lastSeasonLabel !== null
        ? translate("weekend.poolPricedForm", { season: lastSeasonLabel })
        : translate("weekend.poolLeague", { defaultValue: "Priced from 2025-26 league form" });
    case "flagged":
      return translate("weekend.poolFlagged", { defaultValue: "No usable 2025-26 season data — floor priced" });
    default:
      return null;
  }
}

export function PlayerSheet({
  playerId,
  onClose,
  surface,
  clockLine,
}: {
  /** A fantasyPlayers id as the read models serve it (string); the query
   *  normalizes and answers null for a hand-made one. */
  playerId: string | null;
  onClose: () => void;
  /** Analytics dimension only — never rendered. */
  surface: "picker" | "pitch" | "draft";
  /** Draft board: the bank echo, so an open sheet never hides a running clock. */
  clockLine?: ReactNode;
}) {
  const { t } = useTranslation();
  const card = usePlayerCard(playerId);

  useEffect(() => {
    if (playerId !== null) track("weekend_player_opened", { surface });
  }, [playerId, surface]);

  const lastSeason = useMemo(
    () => card?.seasons.find((s) => s.season === "2025-26") ?? null,
    [card],
  );
  const thisSeason = useMemo(
    () => card?.seasons.find((s) => s.season === "2026-27") ?? null,
    [card],
  );

  const open = playerId !== null;
  const loading = open && card === undefined;

  return (
    <WeekendSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      testId="player-sheet"
      eyebrow={
        card == null
          ? undefined
          : `${t(`weekend.position_${card.position}`, { defaultValue: card.position })} · ${card.clubName ?? card.clubId}`
      }
      title={card == null ? "…" : card.name}
      badge={
        card == null ? undefined : card.price === null ? (
          <NeoBadge color="yellow" size="sm">
            {t("weekend.unpriced", { defaultValue: "No price yet" })}
          </NeoBadge>
        ) : (
          <span className="neo-border rounded bg-card font-mono font-bold text-lg px-2 py-0.5 tabular-nums">
            {card.price.toFixed(1)}
          </span>
        )
      }
    >
      {clockLine}
      {loading && (
        <p className="text-[11px] text-muted-foreground" data-testid="player-sheet-loading">
          {t("weekend.loading", { defaultValue: "Loading…" })}
        </p>
      )}
      {card === null && (
        <p className="text-[11px] text-muted-foreground">
          {t("weekend.playerGone", { defaultValue: "This player is no longer on record." })}
        </p>
      )}
      {card != null && (
        <>
          {(() => {
            const provenance = poolLine(
              card.pool,
              lastSeason?.line != null ? lastSeason.leagueLabel : null,
              t,
            );
            return provenance === null ? null : (
              <p
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
                data-testid="player-sheet-pool"
              >
                {provenance}
              </p>
            );
          })()}

          <AvailabilityBlock card={card} />
          <WeekendBlock card={card} />
          {thisSeason !== null && <SeasonBlock entry={thisSeason} position={card.position} current />}
          <SeasonBlock entry={lastSeason} position={card.position} />
          <OwnershipLine card={card} />
          <HistoryBlock card={card} />
        </>
      )}
    </WeekendSheet>
  );
}

// ── availability (FW-AVAIL) ──

/**
 * What the feed says about him for the open weekend, and — when it says
 * nothing — whether that is silence or an absent report.
 *
 * The three states are distinct on purpose:
 *   flagged      → the status, the feed's own reason, and when it was read;
 *   clear        → "no availability concern reported", which is a statement
 *                  about the REPORT, not a medical opinion;
 *   no report    → his league files none, so we say exactly that.
 *
 * The third state is the one this block exists for. Rendering "available" for
 * a Bundesliga player whose league returned zero rows would be inventing a
 * fact, and the sheet's standing law is that a thing we do not hold renders
 * absent rather than optimistic.
 */
function AvailabilityBlock({ card }: { card: Card }) {
  const { t } = useTranslation();
  const label = t("weekend.availability", { defaultValue: "Availability" });

  if (card.availability != null) {
    const stamped = new Date(card.availability.updatedAt).toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <Section label={label}>
        <div
          className="flex items-start justify-between gap-2"
          data-testid="player-sheet-availability"
        >
          <p className="text-[11px] font-bold">
            {availabilityLine(card.availability, t)}
          </p>
          <NeoBadge color={availabilityColor(card.availability.status)} size="sm">
            {availabilityBadgeLabel(card.availability.status, t)}
          </NeoBadge>
        </div>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {t("weekend.availabilityRead", {
            defaultValue: "Feed read {{when}}",
            when: stamped,
          })}
        </p>
      </Section>
    );
  }

  return (
    <Section label={label}>
      <p
        className="text-[11px] text-muted-foreground"
        data-testid="player-sheet-availability"
      >
        {card.availabilityReported
          ? t("weekend.availabilityClear", {
              defaultValue: "No availability concern reported for this weekend.",
            })
          : t("weekend.availabilityNoReport", {
              defaultValue:
                "His league files no availability report — we do not know either way.",
            })}
      </p>
    </Section>
  );
}

// ── this weekend ──

function WeekendBlock({ card }: { card: Card }) {
  const { t } = useTranslation();
  if (card.weekend === null) {
    return (
      <Section label={t("weekend.thisWeekend", { defaultValue: "This weekend" })}>
        <p className="text-[11px] text-muted-foreground">
          {t("weekend.noFixtureLong", { defaultValue: "No fixture this weekend." })}
        </p>
      </Section>
    );
  }
  const { opponentName, isHome, kickoffAt, fixtureStatus } = card.weekend;
  const started = kickoffAt <= Date.now();
  const kickoff = new Date(kickoffAt).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <Section label={t("weekend.thisWeekend", { defaultValue: "This weekend" })}>
      <div className="flex items-center justify-between gap-2" data-testid="player-sheet-weekend">
        <p className="font-heading font-bold text-sm truncate">
          {isHome ? "vs " : "at "}
          {opponentName ?? t("weekend.unknownClub", { defaultValue: "(unnamed club)" })}
          <span className="ml-1.5 font-mono text-[10px] text-muted-foreground uppercase">
            {isHome ? "(H)" : "(A)"}
          </span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{kickoff}</span>
          {started ? (
            <NeoBadge color="muted" size="sm">
              {fixtureStatus === "finished"
                ? t("weekend.finished", { defaultValue: "FT" })
                : t("weekend.lockedBadge", { defaultValue: "Locked" })}
            </NeoBadge>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

// ── season blocks ──

function SeasonBlock({
  entry,
  position,
  current = false,
}: {
  entry: SeasonEntry | null;
  position: string;
  current?: boolean;
}) {
  const { t } = useTranslation();
  const season = current ? "2026-27" : "2025-26";
  const label = current
    ? t("weekend.thisSeason", { defaultValue: "This season" })
    : t("weekend.lastSeason", { defaultValue: "Last season" });

  if (entry === null || entry.line === null) {
    // Absence in words, never zeros. Out-of-scope minutes (cups, playoff-only)
    // are named for what they are rather than dressed as a season line.
    if (current) return null; // no current-season row yet — say nothing, not "0"
    return (
      <Section label={`${label} · ${season}`}>
        <p className="text-[11px] text-muted-foreground" data-testid="player-sheet-no-season">
          {entry?.partial != null
            ? t("weekend.partialSeason", {
                defaultValue:
                  "Not enough league football on record — {{minutes}}′ outside covered league play.",
                minutes: entry.partial.minutes,
              })
            : t("weekend.noSeason", {
                defaultValue: "Not enough football on record for 2025-26.",
              })}
        </p>
      </Section>
    );
  }

  const line = entry.line;
  // Early-season honesty (L3): below the minutes threshold, apps/minutes only.
  if (current && line.minutes < CURRENT_SEASON_MINUTES_THRESHOLD) {
    return (
      <Section label={`${label} · ${season}${entry.leagueLabel ? ` — ${entry.leagueLabel}` : ""}`}>
        <p className="text-[11px] text-muted-foreground" data-testid="player-sheet-early-season">
          {t("weekend.earlySeason", {
            defaultValue: "Early season — {{apps}} apps, {{minutes}}′. Per-90 unlocks at {{threshold}}′.",
            apps: line.apps,
            minutes: line.minutes,
            threshold: CURRENT_SEASON_MINUTES_THRESHOLD,
          })}
        </p>
      </Section>
    );
  }

  const stats: { key: string; label: string; value: string }[] = [];
  if (position === "GK") {
    stats.push({ key: "saves", label: t("weekend.statSaves", { defaultValue: "Saves" }), value: per90(line.saves, line.minutes) });
  } else {
    stats.push(
      { key: "goals", label: t("weekend.statGoals", { defaultValue: "Goals" }), value: per90(line.goals, line.minutes) },
      { key: "assists", label: t("weekend.statAssists", { defaultValue: "Assists" }), value: per90(line.assists, line.minutes) },
      { key: "keyPasses", label: t("weekend.statKeyPasses", { defaultValue: "Key passes" }), value: per90(line.keyPasses, line.minutes) },
      { key: "tacklesInt", label: t("weekend.statTacklesInt", { defaultValue: "Tackles + int." }), value: per90(line.tackles + line.interceptions, line.minutes) },
      { key: "shotsOn", label: t("weekend.statShotsOn", { defaultValue: "Shots on target" }), value: per90(line.shotsOn, line.minutes) },
    );
  }
  // Clean-sheet/concession exposure by position: the defensive positions the
  // scoring template pays for them. CLUB rates, and labelled as such.
  let hasClubRates = false;
  if (position === "GK" || position === "DEF") {
    if (line.csRate !== null) {
      hasClubRates = true;
      // The unit lives in the footer note ("club rates per match") — a
      // longer label truncates at 380px and hides the unit entirely.
      stats.push({ key: "cs", label: t("weekend.statCsRate", { defaultValue: "Club clean sheets" }), value: line.csRate.toFixed(2) });
    }
    if (line.gaPerMatch !== null) {
      hasClubRates = true;
      stats.push({ key: "ga", label: t("weekend.statGaRate", { defaultValue: "Club conceded" }), value: line.gaPerMatch.toFixed(2) });
    }
  }

  return (
    <Section
      label={`${label} · ${season}${entry.leagueLabel ? ` — ${entry.leagueLabel}` : ""}`}
      aside={t("weekend.seasonScale", {
        defaultValue: "{{apps}} apps · {{minutes}}′",
        apps: line.apps,
        minutes: line.minutes,
      })}
    >
      <div
        className="grid grid-cols-2 gap-x-4 gap-y-1"
        data-testid={current ? "player-sheet-this-season" : "player-sheet-last-season"}
      >
        {stats.map((stat) => (
          <div key={stat.key} className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-muted-foreground truncate">{stat.label}</span>
            <span className="font-mono font-bold text-sm tabular-nums">{stat.value}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-[0.16em]">
        {hasClubRates
          ? t("weekend.per90ClubNote", { defaultValue: "per 90 · club rates per match" })
          : t("weekend.per90Note", { defaultValue: "per 90 minutes" })}
      </p>
    </Section>
  );
}

// ── ownership ──

function OwnershipLine({ card }: { card: Card }) {
  const { t } = useTranslation();
  // Hidden below the floor / above the live-count guard — noise and cost both
  // render as NOTHING, not as a number.
  if (card.ownership === null || card.ownership.inSquads === null) return null;
  const { inSquads, totalSquads } = card.ownership;
  const pct = Math.round((inSquads / totalSquads) * 100);
  return (
    <p className="text-[11px] text-muted-foreground" data-testid="player-sheet-ownership">
      {t("weekend.ownership", {
        defaultValue: "In {{pct}}% of this gameweek's squads ({{inSquads}}/{{totalSquads}})",
        pct,
        inSquads,
        totalSquads,
      })}
    </p>
  );
}

// ── VerveQ history ──

const HISTORY_ROW_CAP = 12;

function HistoryBlock({ card }: { card: Card }) {
  const { t } = useTranslation();
  return (
    <Section label={t("weekend.verveqPoints", { defaultValue: "VerveQ points" })}>
      {card.history.length === 0 ? (
        <p className="text-[11px] text-muted-foreground" data-testid="player-sheet-no-history">
          {t("weekend.noHistory", {
            defaultValue: "No VerveQ gameweeks on record yet — history builds as weekends settle.",
          })}
        </p>
      ) : (
        <div className="flex flex-col gap-1" data-testid="player-sheet-history">
          {card.history.slice(0, HISTORY_ROW_CAP).map((row) => (
            <div
              key={`${row.season}-${row.gwNumber}`}
              className="flex items-center justify-between gap-2"
            >
              <span className="font-mono text-[11px] text-muted-foreground uppercase">
                GW {row.gwNumber}
              </span>
              <div className="flex items-center gap-2">
                {row.state === "provisional" && (
                  <NeoBadge color="muted" size="sm">
                    {t("weekend.provisional", { defaultValue: "Provisional" })}
                  </NeoBadge>
                )}
                {/* Crowd factor per FW-4: the signed fraction, visible. Null
                    on a double gameweek — absent beats misattributed. */}
                {row.crowdFactor !== null && row.crowdFactor !== 0 && (
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {t("weekend.crowdShort", { defaultValue: "crowd" })}{" "}
                    {row.crowdFactor > 0 ? "+" : ""}
                    {Math.round(row.crowdFactor * 100)}%
                  </span>
                )}
                {row.appearances > 1 && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ×{row.appearances}
                  </span>
                )}
                <span className="font-mono font-bold text-sm tabular-nums">
                  {formatPoints(row.points)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ── section chrome ──

function Section({
  label,
  aside,
  children,
}: {
  label: string;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t-2 border-border pt-2.5">
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        {aside !== undefined && (
          <p className="font-mono text-[10px] text-muted-foreground tabular-nums shrink-0">{aside}</p>
        )}
      </div>
      {children}
    </div>
  );
}
