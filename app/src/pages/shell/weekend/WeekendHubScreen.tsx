/**
 * THE WEEKEND — the hub (FW-GO): the mode's public front door.
 *
 * One screen, four doors: the budget squad, the crew draft, the crowd vote and
 * the reclamation court. The hub itself is PUBLIC (ShellGate only, no session
 * guard) so a short-link visitor sees what the mode is before being asked for
 * anything — the doors' own routes keep the username tier, and the `?next=`
 * flow returns the visitor here after onboarding.
 *
 * The open-gameweek line is informational and fail-open: if the board query
 * has no answer (or the backend is unreachable) the hub still renders every
 * door, because the SURFACES are the ones that gate fail-closed ("no board is
 * open right now") — the hub advertising a door that says so honestly beats a
 * hub that goes blank.
 */
import type { ComponentProps } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "convex/react";
import { CalendarRange, Gavel, Users, Vote, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { leagueListLine } from "@/lib/leagueNames";

type NeoColor = NonNullable<ComponentProps<typeof NeoCard>["color"]>;

function HubDoor({
  icon: Icon,
  color,
  title,
  body,
  onClick,
  testId,
}: {
  icon: LucideIcon;
  color: NeoColor;
  title: string;
  body: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <NeoCard
      color={color}
      shadow="lg"
      onClick={onClick}
      className="flex items-start gap-3 text-left"
      data-testid={testId}
    >
      <div className="neo-border rounded-xl bg-background p-2.5 shrink-0">
        <Icon size={22} strokeWidth={2.5} className="text-foreground" />
      </div>
      <div className="min-w-0">
        <p className="font-heading font-bold text-lg leading-tight">{title}</p>
        <p className="text-sm opacity-80 mt-1">{body}</p>
      </div>
    </NeoCard>
  );
}

export default function WeekendHubScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Informational only — see the header. `undefined` = still loading, `null` =
  // no open board; both render the hub in full.
  const gameweek = useQuery(api.fantasyMarket.getOpenGameweek, {});
  // D4: say which leagues actually play this window — a partial gameweek is a
  // feature, not emptiness. Fixture-derived, renders only with data in hand.
  const weekendLeagues = useQuery(api.fantasyMarket.getWeekendLeagues, {});

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.hubTitle", { defaultValue: "The Weekend" })}
      subtitle={t("weekend.hubSubtitle", {
        defaultValue: "Eight leagues, one squad.",
      })}
      back
      onBack={() => navigate(SHELL_ROUTES.compete)}
      scroll
    >
      <div className="flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full pb-4">
        <div className="flex items-center gap-2" data-testid="weekend-hub-board-line">
          <CalendarRange size={14} strokeWidth={3} className="text-muted-foreground shrink-0" />
          {gameweek ? (
            <>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {t("weekend.boardOpen", {
                  defaultValue: "Gameweek {{gw}} board is open",
                  gw: gameweek.gwNumber,
                })}
              </p>
              <NeoBadge color="accent">
                {t("weekend.live", { defaultValue: "Live" })}
              </NeoBadge>
            </>
          ) : (
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {t("weekend.boardBetween", {
                defaultValue: "Fresh board opens for each weekend",
              })}
            </p>
          )}
        </div>
        {weekendLeagues != null && weekendLeagues.leagues.length > 0 && (
          <p
            className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground -mt-2"
            data-testid="weekend-hub-leagues-line"
          >
            {t("weekend.thisWeekend", {
              defaultValue: "This weekend: {{leagues}}",
              leagues: leagueListLine(weekendLeagues.leagues.map((l) => l.leagueId)),
            })}
          </p>
        )}

        <HubDoor
          icon={Wallet}
          color="accent"
          title={t("weekend.doorSquadTitle", { defaultValue: "Budget squad" })}
          body={t("weekend.doorSquadBody", {
            defaultValue:
              "Build a fresh 13 under budget. Every player locks at his own kickoff.",
          })}
          onClick={() => navigate(SHELL_ROUTES.weekendSquad)}
          testId="weekend-door-squad"
        />
        <HubDoor
          icon={Users}
          color="pink"
          title={t("weekend.doorCrewsTitle", { defaultValue: "Crew draft" })}
          body={t("weekend.doorCrewsBody", {
            defaultValue:
              "One code, one crew, 13 picks each. Unique players — when he's gone, he's gone.",
          })}
          onClick={() => navigate(SHELL_ROUTES.weekendCrews)}
          testId="weekend-door-crews"
        />
        <HubDoor
          icon={Vote}
          color="yellow"
          title={t("weekend.doorVoteTitle", { defaultValue: "Rate the weekend" })}
          body={t("weekend.doorVoteBody", {
            defaultValue:
              "Who was better? The crowd's verdict moves every score — no algorithm.",
          })}
          onClick={() => navigate(SHELL_ROUTES.weekendVote)}
          testId="weekend-door-vote"
        />
        <HubDoor
          icon={Gavel}
          color="blue"
          title={t("weekend.doorCourtTitle", { defaultValue: "Reclamation court" })}
          body={t("weekend.doorCourtBody", {
            defaultValue:
              "Played out of position? File a claim, argue it, let the jury re-score him.",
          })}
          onClick={() => navigate(SHELL_ROUTES.weekendCourt)}
          testId="weekend-door-court"
        />
      </div>
    </ShellLayout>
  );
}
