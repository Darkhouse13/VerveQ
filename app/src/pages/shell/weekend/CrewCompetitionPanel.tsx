import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { FunctionReturnType } from "convex/server";
import { CalendarRange, ChevronDown, ChevronUp, Medal, Share2, Sparkles, Swords, Trophy } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { formatPoints } from "../../../../convex/lib/fantasyScoring";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";

type Dashboard = NonNullable<FunctionReturnType<typeof api.fantasyCrewDashboard.getDashboard>>;
type Scope = Dashboard["season"];

function movementLabel(movement: number | null): string | null {
  if (movement === null || movement === 0) return null;
  return movement > 0 ? `↑ ${movement}` : `↓ ${Math.abs(movement)}`;
}

function RaceCard({ scope }: { scope: Scope }) {
  const { t } = useTranslation("shell");
  const me = scope.me;
  if (me === null || me.total === null) return null;
  return (
    <NeoCard color="primary" shadow="lg" className="py-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">{t("weekend.yourCrewRace", { defaultValue: "Your crew race" })}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="font-heading font-bold text-2xl">#{me.rank}</p>
          <p className="text-[10px] opacity-70">{t("weekend.position", { defaultValue: "position" })}</p>
        </div>
        <div>
          <p className="font-mono font-bold text-lg">{me.gapAbove === null ? "—" : formatPoints(me.gapAbove)}</p>
          <p className="text-[10px] opacity-70">{t("weekend.nextPlace", { defaultValue: "to next" })}</p>
        </div>
        <div>
          <p className="font-mono font-bold text-lg">{movementLabel(me.movement) ?? "—"}</p>
          <p className="text-[10px] opacity-70">{t("weekend.movement", { defaultValue: "movement" })}</p>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] opacity-75">
        {t("weekend.appearancesAverage", { defaultValue: "{{appearances}} appearances · {{average}} average", appearances: me.appearances, average: me.average === null ? "—" : formatPoints(me.average) })}
        {me.gapBelow === null ? "" : ` · ${t("weekend.ahead", { defaultValue: "{{points}} ahead", points: formatPoints(me.gapBelow) })}`}
      </p>
    </NeoCard>
  );
}

function Standings({ scope }: { scope: Scope }) {
  const { t } = useTranslation("shell");
  if (scope.rows.length === 0) {
    return <NeoCard className="py-4 text-center text-sm text-muted-foreground">{t("weekend.standingsEmpty", { defaultValue: "Standings appear once a weekend has been drafted and scored." })}</NeoCard>;
  }
  return (
    <NeoCard className="p-0 overflow-hidden">
      {scope.rows.map((row, index) => (
        <div key={row.userId} className={`px-3 py-2.5 ${index > 0 ? "border-t-2 border-border" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 shrink-0 font-mono text-xs font-bold text-muted-foreground">
                {row.tied ? `T${row.rank}` : row.rank}
              </span>
              <span className="font-heading font-bold text-sm truncate">{row.name}</span>
              {movementLabel(row.movement) !== null && (
                <span className={`font-mono text-[10px] ${row.movement! > 0 ? "text-success" : "text-destructive"}`}>
                  {movementLabel(row.movement)}
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              {row.total === null ? (
                <p className="text-[11px] text-muted-foreground">{row.provisional ? t("weekend.awaitingData", { defaultValue: "awaiting data" }) : t("weekend.noDraftsYet", { defaultValue: "no drafts yet" })}</p>
              ) : (
                <>
                  <p className="font-mono font-bold">{formatPoints(row.total)}</p>
                  <p className="text-[9px] text-muted-foreground">{t("weekend.appsAverage", { defaultValue: "{{apps}} apps · {{average}} avg", apps: row.appearances, average: row.average === null ? "—" : formatPoints(row.average) })}</p>
                </>
              )}
            </div>
          </div>
          {row.provisional && (
            <p className="ml-10 text-[9px] uppercase font-mono text-muted-foreground">
              {t("weekend.provisional", { defaultValue: "provisional" })}
            </p>
          )}
        </div>
      ))}
    </NeoCard>
  );
}

function TrophyCabinet({ scope }: { scope: Scope }) {
  const { t } = useTranslation("shell");
  const mine = scope.rows.find((row) => row.isYou);
  if (mine === undefined) return null;
  const items = [
    { label: t("weekend.weeklyWins", { defaultValue: "Weekly wins" }), value: mine.weeklyWins },
    { label: t("weekend.podiums", { defaultValue: "Podiums" }), value: mine.podiums },
    { label: t("weekend.bestFinishLabel", { defaultValue: "Best finish" }), value: mine.bestFinish === null ? "—" : `#${mine.bestFinish}` },
    { label: t("weekend.topHalfLabel", { defaultValue: "Top-half streak" }), value: mine.topHalfStreak },
    { label: t("weekend.seasonTitles", { defaultValue: "Season titles" }), value: mine.seasonTitles },
  ];
  return (
    <div>
      <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("weekend.trophyCabinet", { defaultValue: "Trophy cabinet" })}</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <NeoCard key={item.label} className="py-2.5 text-center">
            <p className="font-heading font-bold text-xl">{item.value}</p>
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
          </NeoCard>
        ))}
      </div>
    </div>
  );
}

function WeeklyResults({ scope }: { scope: Scope }) {
  const { t } = useTranslation("shell");
  const [open, setOpen] = useState<string | null>(scope.weeks[0]?.roomId ?? null);
  if (scope.weeks.length === 0) return null;
  return (
    <div>
      <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("weekend.weeklyResults", { defaultValue: "Weekly results" })}</p>
      <div className="flex flex-col gap-2">
        {scope.weeks.map((week) => {
          const expanded = open === week.roomId;
          return (
            <NeoCard key={week.roomId} className="py-2.5">
              <button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen(expanded ? null : week.roomId)}>
                <span>
                  <span className="font-heading font-bold">GW {week.gwNumber}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {week.state === "final"
                      ? t("weekend.final", { defaultValue: "Final" })
                      : t("weekend.provisional", { defaultValue: "Provisional" })}
                  </span>
                </span>
                {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {expanded && (
                <div className="mt-2 border-t-2 border-border pt-2">
                  {week.rows.map((row) => (
                    <div key={row.userId} className="flex items-center justify-between py-1 text-xs">
                      <span className="truncate"><span className="mr-2 font-mono text-muted-foreground">{row.rank === null ? "—" : row.tied ? `T${row.rank}` : row.rank}</span>{row.name}</span>
                      <span className="font-mono font-bold">{row.points === null ? t("weekend.awaiting", { defaultValue: "awaiting" }) : formatPoints(row.points)}</span>
                    </div>
                  ))}
                </div>
              )}
            </NeoCard>
          );
        })}
      </div>
    </div>
  );
}

function Recap({ dashboard }: { dashboard: Dashboard }) {
  const { t } = useTranslation("shell");
  const recap = dashboard.recap;
  if (recap === null) return null;
  const share = async () => {
    const podium = recap.podium.map((row) => `${row.rank}. ${row.name} ${formatPoints(row.points)}`).join("\n");
    const text = `${dashboard.name} · GW ${recap.gwNumber}\n${podium}${recap.mvp === null ? "" : `\nMVP: ${recap.mvp.playerName} (${formatPoints(recap.mvp.points)})`}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t("weekend.crewRecapTitle", {
            defaultValue: "{{name}} recap",
            name: dashboard.name,
          }),
          text,
        });
      }
      else await navigator.clipboard.writeText(text);
      toast.success(t("weekend.crewRecapReady", { defaultValue: "Crew recap ready to share." }));
    } catch {
      // Cancelling the native share sheet is not an error worth surfacing.
    }
  };
  return (
    <NeoCard color="yellow" shadow="lg" className="py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
            {t("weekend.gameweekRecap", { defaultValue: "GW {{gw}} recap", gw: recap.gwNumber })}
          </p>
          <p className="font-heading font-bold text-lg">{t("weekend.weekendWrapped", { defaultValue: "Weekend wrapped" })}</p>
        </div>
        <NeoButton variant="secondary" size="sm" onClick={() => void share()}><Share2 size={13} className="mr-1" />{t("common.share", { defaultValue: "Share" })}</NeoButton>
      </div>
      <div className="mt-2 flex flex-col gap-1 text-xs">
        {recap.podium.map((row) => <p key={`${row.rank}:${row.name}`}><Medal size={12} className="mr-1 inline" />#{row.rank} {row.name} · {formatPoints(row.points)}</p>)}
        {recap.biggestClimb !== null && (
          <p>
            <Sparkles size={12} className="mr-1 inline" />
            {t("weekend.recapClimbed", {
              defaultValue: "{{name}} climbed {{count}} places",
              name: recap.biggestClimb.name,
              count: recap.biggestClimb.places,
            })}
          </p>
        )}
        {recap.mvp !== null && (
          <p>
            <Trophy size={12} className="mr-1 inline" />
            {t("weekend.recapMvp", {
              defaultValue: "MVP: {{player}} · {{points}} ({{owner}})",
              player: recap.mvp.playerName,
              points: formatPoints(recap.mvp.points),
              owner: recap.mvp.ownerName,
            })}
          </p>
        )}
      </div>
    </NeoCard>
  );
}

export function CrewCompetitionPanel({ dashboard }: { dashboard: Dashboard | null | undefined }) {
  const { t } = useTranslation("shell");
  const [tab, setTab] = useState<"season" | "allTime">("season");
  const [section, setSection] = useState<"standings" | "record" | "results">("standings");
  if (dashboard === undefined) return <NeoCard className="py-5 text-center text-sm text-muted-foreground">{t("weekend.loadingStandings", { defaultValue: "Loading standings…" })}</NeoCard>;
  if (dashboard === null) return null;
  const scope = dashboard[tab];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label={t("weekend.crewCompetition", { defaultValue: "Crew competition" })}>
        <NeoButton variant={section === "standings" ? "primary" : "outline"} size="sm" onClick={() => setSection("standings")}>
          {t("weekend.standings", { defaultValue: "Standings" })}
        </NeoButton>
        <NeoButton variant={section === "record" ? "primary" : "outline"} size="sm" onClick={() => setSection("record")}>
          {t("weekend.myRecord", { defaultValue: "My record" })}
        </NeoButton>
        <NeoButton variant={section === "results" ? "primary" : "outline"} size="sm" onClick={() => setSection("results")}>
          {t("weekend.weekends", { defaultValue: "Weekends" })}
        </NeoButton>
      </div>

      {section === "standings" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NeoButton variant={tab === "season" ? "primary" : "outline"} size="sm" onClick={() => setTab("season")}>
              <CalendarRange size={14} className="mr-1" />{t("weekend.thisSeason", { defaultValue: "This season" })}
            </NeoButton>
            <NeoButton variant={tab === "allTime" ? "primary" : "outline"} size="sm" onClick={() => setTab("allTime")}>
              <Trophy size={14} className="mr-1" />{t("weekend.allTime", { defaultValue: "All time" })}
            </NeoButton>
          </div>
          <RaceCard scope={scope} />
          <div>
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{tab === "season" ? dashboard.currentSeason : t("weekend.allTimeStandings", { defaultValue: "All-time standings" })}</p>
            <Standings scope={scope} />
          </div>
        </>
      )}

      {section === "record" && (
        <>
          <TrophyCabinet scope={scope} />
          {dashboard.rivalries.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("weekend.yourRivalries", { defaultValue: "Your rivalries" })}</p>
              <NeoCard className="py-2">
                {dashboard.rivalries.slice(0, 5).map((rival) => (
                  <div key={rival.userId} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="font-heading font-bold"><Swords size={12} className="mr-1 inline" />{rival.name}</span>
                    <span className="font-mono">{rival.wins}–{rival.losses}–{rival.draws}{rival.streak === null ? "" : ` · ${rival.streak.result} ${rival.streak.length}`}</span>
                  </div>
                ))}
              </NeoCard>
            </div>
          )}
        </>
      )}

      {section === "results" && (
        <>
          <Recap dashboard={dashboard} />
          <WeeklyResults scope={scope} />
        </>
      )}
    </div>
  );
}
