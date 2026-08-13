/**
 * THE WEEKEND — fixtures (FW-IMMERSE A3): the weekend laid out as matchdays.
 *
 * Read-only over fantasyMarket.getWeekendFixtures: grouped by local calendar
 * day, league-tagged, kickoffs in the device's locale and timezone, lock
 * state once a ball is kicked, scorelines exactly when the feed carries them
 * (weekendFixtures.ts owns those rules — no football fact is computed here),
 * and the quiet "points in" tick once the scoring pipeline has landed a
 * fixture.
 *
 * Availability gating follows the FW-P1 teaser pattern (BudgetSquadScreen):
 * the entry query runs imperatively and any rejection — a prod backend that
 * predates the query, a network failure — renders the quiet "no board" card.
 * Public like the hub: fixtures are the weekend's public face, no username.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, Lock } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { leagueName } from "@/lib/leagueNames";
import {
  fixtureDisplayKind,
  fixtureLocked,
  fixtureScoreline,
  groupFixturesByDay,
} from "@/lib/weekendFixtures";

export type WeekendFixturesPayload = NonNullable<
  FunctionReturnType<typeof api.fantasyMarket.getWeekendFixtures>
>;
export type WeekendFixtureRow = WeekendFixturesPayload["fixtures"][number];

/** Re-render cadence for clock-derived greys (lock glyphs, started state). */
const CLOCK_TICK_MS = 30_000;

export function FixtureCard({ fixture, now }: { fixture: WeekendFixtureRow; now: number }) {
  const { t, i18n } = useTranslation();
  const kind = fixtureDisplayKind(fixture, now);
  const locked = fixtureLocked(fixture, now);
  const score = fixtureScoreline(fixture, now);

  const kickoffLabel = new Date(fixture.kickoffAt).toLocaleTimeString(i18n.language, {
    hour: "numeric",
    minute: "2-digit",
  });

  // Centre column: the one number (or time) the row is about.
  const centre =
    score !== null ? (
      <span className="font-mono font-bold text-base tabular-nums" data-testid="fixture-score">
        {score.home}–{score.away}
      </span>
    ) : (
      <span
        className={`font-mono font-bold text-sm tabular-nums whitespace-nowrap ${
          kind === "upcoming" ? "" : "text-muted-foreground"
        }`}
        data-testid="fixture-kickoff"
      >
        {kind === "void"
          ? t("weekend.fixtureVoid", { defaultValue: "OFF" })
          : kickoffLabel}
      </span>
    );

  const stateBadge =
    kind === "live" ? (
      <NeoBadge color="accent" size="sm">
        {t("weekend.fixtureLive", { defaultValue: "Live" })}
      </NeoBadge>
    ) : kind === "played" ? (
      <NeoBadge color="muted" size="sm">
        {t("weekend.fixtureFt", { defaultValue: "FT" })}
      </NeoBadge>
    ) : kind === "void" ? (
      <NeoBadge color="muted" size="sm">
        {fixture.status === "postponed"
          ? t("weekend.fixturePostponed", { defaultValue: "Postponed" })
          : fixture.status === "cancelled"
            ? t("weekend.fixtureCancelled", { defaultValue: "Cancelled" })
            : t("weekend.fixtureAbandoned", { defaultValue: "Abandoned" })}
      </NeoBadge>
    ) : null;

  return (
    <NeoCard className="py-2.5 px-3" data-testid="fixture-card">
      <div className="flex items-center gap-2">
        {/* FW-RECEIPT P3: the card has vertical room, so a long club name
            wraps to a second line before it truncates — "Sparta Rott…" was
            an ellipsis with space to spare. line-clamp-2 keeps the ceiling. */}
        <p className="flex-1 min-w-0 text-right font-heading font-bold text-sm leading-tight line-clamp-2 break-words">
          {fixture.homeName ?? fixture.homeClubId}
        </p>
        {/* min-w, not w: the time is one non-wrapping unit and the column
            grows to its intrinsic width — long club names wrap instead
            of squeezing the time onto two lines (FW-NIT1). */}
        <div className="shrink-0 min-w-[64px] flex flex-col items-center gap-0.5">{centre}</div>
        <p className="flex-1 min-w-0 font-heading font-bold text-sm leading-tight line-clamp-2 break-words">
          {fixture.awayName ?? fixture.awayClubId}
        </p>
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {leagueName(fixture.leagueId)}
        </span>
        {locked && (
          <Lock
            size={10}
            strokeWidth={3}
            className="text-muted-foreground"
            aria-label={t("weekend.fixtureLocked", { defaultValue: "Locked" })}
            data-testid="fixture-lock"
          />
        )}
        {stateBadge}
        {fixture.scored && (
          <span
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary flex items-center gap-0.5"
            data-testid="fixture-points-in"
          >
            <Check size={10} strokeWidth={3} aria-hidden />
            {t("weekend.fixturePointsIn", { defaultValue: "points in" })}
          </span>
        )}
      </div>
    </NeoCard>
  );
}

export function FixturesView({
  payload,
  now,
  className = "",
}: {
  payload: WeekendFixturesPayload;
  now: number;
  /** Extra layout classes — the screen tiles day groups two-up at xl; the
   *  hub's side panel keeps the single column. */
  className?: string;
}) {
  const { i18n } = useTranslation();
  const groups = useMemo(() => groupFixturesByDay(payload.fixtures), [payload.fixtures]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {groups.map((group) => (
        <section key={group.dayStart} data-testid="fixture-day">
          <h2
            className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2"
            data-testid="fixture-day-heading"
          >
            {new Date(group.dayStart).toLocaleDateString(i18n.language, {
              weekday: "long",
              day: "numeric",
              month: "short",
            })}
          </h2>
          <div className="flex flex-col gap-2">
            {group.fixtures.map((fixture) => (
              <FixtureCard key={fixture.fixtureId} fixture={fixture} now={now} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type Gate =
  | { state: "checking" }
  | { state: "closed" }
  | { state: "open"; payload: WeekendFixturesPayload };

export default function FixturesScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const convex = useConvex();
  const [gate, setGate] = useState<Gate>({ state: "checking" });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    convex
      .query(api.fantasyMarket.getWeekendFixtures, {})
      .then((payload) => {
        if (cancelled) return;
        setGate(payload === null ? { state: "closed" } : { state: "open", payload });
      })
      .catch(() => {
        if (!cancelled) setGate({ state: "closed" });
      });
    return () => {
      cancelled = true;
    };
  }, [convex]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.fixturesTitle", { defaultValue: "Fixtures" })}
      subtitle={
        gate.state === "open"
          ? t("weekend.fixturesSubtitle", {
              defaultValue: "Gameweek {{gw}} · every kickoff in your time",
              gw: gate.payload.gwNumber,
            })
          : undefined
      }
      back
      onBack={() => navigate(SHELL_ROUTES.weekend)}
      scroll
    >
      {/* B1: the day groups tile two-up at xl — same cards, more of the
          weekend on screen at once. */}
      <div className="flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full pb-4 xl:max-w-4xl">
        {gate.state === "checking" ? (
          <NeoCard className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </p>
          </NeoCard>
        ) : gate.state === "closed" ? (
          <NeoCard className="text-center py-6">
            <p className="font-heading font-bold">
              {t("weekend.noBoard", { defaultValue: "No board is open right now." })}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("weekend.noBoardBody", {
                defaultValue: "A fresh board opens for each weekend. Check back soon.",
              })}
            </p>
          </NeoCard>
        ) : (
          <FixturesView
            payload={gate.payload}
            now={now}
            className="xl:grid xl:grid-cols-2 xl:gap-6 xl:items-start"
          />
        )}
      </div>
    </ShellLayout>
  );
}
