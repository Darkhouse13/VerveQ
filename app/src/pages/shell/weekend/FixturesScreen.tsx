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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

  const stateBadge =
    kind === "live" ? (
      <Badge tone="action">{t("weekend.fixtureLive", { defaultValue: "Live" })}</Badge>
    ) : kind === "played" ? (
      <Badge tone="muted">{t("weekend.fixtureFt", { defaultValue: "FT" })}</Badge>
    ) : kind === "void" ? (
      <Badge tone="muted">
        {fixture.status === "postponed"
          ? t("weekend.fixturePostponed", { defaultValue: "Postponed" })
          : fixture.status === "cancelled"
            ? t("weekend.fixtureCancelled", { defaultValue: "Cancelled" })
            : t("weekend.fixtureAbandoned", { defaultValue: "Abandoned" })}
      </Badge>
    ) : null;

  return (
    <Card padding="sm" data-testid="fixture-card">
      {/* Home · (score | v) · Away. The centre holds only the scoreline or a
          "v", so club names get the width: a long name wraps to a second
          line (clamped at two) instead of truncating, and two clubs never
          read as one run-on name. The kickoff time moves to the meta line. */}
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 break-words text-right font-heading text-body-sm font-bold leading-tight line-clamp-2">
          {fixture.homeName ?? fixture.homeClubId}
        </p>
        <div className="flex min-w-8 shrink-0 flex-col items-center">
          {score !== null ? (
            <span className="font-mono text-body font-bold tabular-nums" data-testid="fixture-score">
              {score.home}–{score.away}
            </span>
          ) : (
            <span className="font-mono text-body-sm text-muted-foreground" aria-hidden>
              v
            </span>
          )}
        </div>
        <p className="min-w-0 flex-1 break-words font-heading text-body-sm font-bold leading-tight line-clamp-2">
          {fixture.awayName ?? fixture.awayClubId}
        </p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
        {score === null && (
          <span
            className={`font-mono text-eyebrow font-bold tabular-nums ${
              kind === "upcoming" ? "text-foreground" : "text-muted-foreground"
            }`}
            data-testid="fixture-kickoff"
          >
            {kind === "void" ? t("weekend.fixtureVoid", { defaultValue: "OFF" }) : kickoffLabel}
          </span>
        )}
        {score === null && <span className="text-eyebrow text-muted-foreground" aria-hidden>·</span>}
        <span className="font-mono text-eyebrow uppercase text-muted-foreground">
          {leagueName(fixture.leagueId)}
        </span>
        {locked && (
          <Lock
            size={12}
            strokeWidth={2.5}
            className="text-muted-foreground"
            aria-label={t("weekend.fixtureLocked", { defaultValue: "Locked" })}
            data-testid="fixture-lock"
          />
        )}
        {stateBadge}
        {fixture.scored && (
          <span
            className="flex items-center gap-0.5 font-mono text-eyebrow uppercase text-verdict-right"
            data-testid="fixture-points-in"
          >
            <Check size={12} strokeWidth={3} aria-hidden />
            {t("weekend.fixturePointsIn", { defaultValue: "points in" })}
          </span>
        )}
      </div>
    </Card>
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
            className="mb-2 font-mono text-eyebrow font-bold uppercase text-muted-foreground"
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
          <div className="flex flex-col gap-2" aria-busy="true">
            <span className="sr-only">{t("common.loading", { defaultValue: "Loading…" })}</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : gate.state === "closed" ? (
          <Card className="py-6 text-center">
            <p className="font-heading font-bold">
              {t("weekend.noBoard", { defaultValue: "No board is open right now." })}
            </p>
            <p className="mt-1 text-body-sm text-muted-foreground">
              {t("weekend.noBoardBody", {
                defaultValue: "A fresh board opens for each weekend. Check back soon.",
              })}
            </p>
          </Card>
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
