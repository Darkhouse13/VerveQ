/**
 * THE WEEKEND — a crew's shared competition page.
 *
 * Administration deliberately lives on CrewCommandScreen. This screen gives
 * every member one job at a time: enter the live draft, check the table, view
 * their own record, or revisit weekend results.
 */
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { Bell, LogOut, Settings2, Swords } from "lucide-react";
import { notify } from "@/lib/notify";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { friendlyError } from "@/lib/errors";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { CrewCompetitionPanel } from "./CrewCompetitionPanel";

export default function CrewScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { code = "" } = useParams();
  const crew = useQuery(api.fantasyDraftRooms.getCrew, { code });
  const dashboard = useQuery(
    api.fantasyCrewDashboard.getDashboard,
    crew == null ? "skip" : { code },
  );
  const alerts = useQuery(
    api.fantasyDraftRooms.getCrewAlerts,
    crew == null ? "skip" : { crewId: crew.crewId },
  );
  const joinCrew = useMutation(api.fantasyDraftRooms.joinCrew);
  const leaveCrew = useMutation(api.fantasyDraftRooms.leaveCrew);
  const markCrewAlertsRead = useMutation(api.fantasyDraftRooms.markCrewAlertsRead);

  const joinAttempted = useRef(false);
  const [joinFailed, setJoinFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A shared crew link is still an invite. Attempt the idempotent join once,
  // then let the normal member queries take over.
  if (crew === null && !joinAttempted.current) {
    joinAttempted.current = true;
    void joinCrew({ code }).catch((error: unknown) => {
      setJoinFailed(
        friendlyError(error, t("weekend.crewJoinFailed", { defaultValue: "Could not join that crew." })),
      );
    });
  }

  const handleLeaveCrew = async () => {
    if (busy || crew == null) return;
    setBusy(true);
    try {
      joinAttempted.current = true;
      await leaveCrew({ crewId: crew.crewId });
      navigate(SHELL_ROUTES.weekendCrews, { replace: true });
    } catch (error) {
      notify.error(friendlyError(error, t("weekend.leaveCrewFailed", { defaultValue: "Could not leave the crew." })));
    } finally {
      setBusy(false);
    }
  };

  if (crew === undefined || (crew === null && joinFailed === null)) {
    return (
      <ShellLayout theme="theme-weekend" title={t("weekend.crewTitle", { defaultValue: "Crew" })} back scroll>
        <Card className="py-6 text-center md:mx-auto md:max-w-md">
          <p className="text-body-sm text-muted-foreground">{t("common.loading", { defaultValue: "Loading…" })}</p>
        </Card>
      </ShellLayout>
    );
  }

  if (crew === null) {
    return (
      <ShellLayout theme="theme-weekend" title={t("weekend.crewTitle", { defaultValue: "Crew" })} back scroll>
        <Card className="py-6 text-center md:mx-auto md:max-w-md">
          <p className="font-heading font-bold text-verdict-wrong">{joinFailed}</p>
          <Button variant="secondary" className="mt-3" onClick={() => navigate(SHELL_ROUTES.weekendCrews)}>
            {t("weekend.backToCrews", { defaultValue: "Back to crews" })}
          </Button>
        </Card>
      </ShellLayout>
    );
  }

  const isCreator = crew.createdBy === crew.isMe;
  const liveRoom = crew.rooms.find((room) => room.status !== "completed");

  return (
    <ShellLayout
      theme="theme-weekend"
      title={crew.name}
      subtitle={t("weekend.crewCompetition", { defaultValue: "Crew competition" })}
      back
      onBack={() => navigate(SHELL_ROUTES.weekendCrews)}
      headerRight={isCreator ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(SHELL_ROUTES.weekendCrewCommand(code))}
          aria-label={t("weekend.openCrewCommand", { defaultValue: "Open Crew Command" })}
        >
          <Settings2 size={16} aria-hidden />{t("weekend.command", { defaultValue: "Command" })}
        </Button>
      ) : undefined}
      scroll
    >
      <div className="flex w-full flex-col gap-4 md:mx-auto md:max-w-md">
        {liveRoom !== undefined ? (
          <Button size="lg" block onClick={() => navigate(SHELL_ROUTES.weekendDraft(liveRoom.roomId))}>
            <Swords size={18} strokeWidth={3} aria-hidden />
            {liveRoom.status === "lobby" ? t("weekend.enterLobby", { defaultValue: "Enter the lobby" }) : t("weekend.enterLiveDraft", { defaultValue: "Enter the live draft" })}
          </Button>
        ) : (
          <Card padding="sm" className="text-center">
            <p className="font-heading text-body-sm font-bold">{t("weekend.noDraftOpen", { defaultValue: "No draft is open" })}</p>
            <p className="mt-0.5 text-meta text-muted-foreground">
              {isCreator ? t("weekend.openNextFromCommand", { defaultValue: "Open the next one from Crew Command." }) : t("weekend.creatorOpensNext", { defaultValue: "The crew creator will open the next weekend." })}
            </p>
          </Card>
        )}

        {alerts !== undefined && alerts !== null && alerts.alerts.length > 0 && (
          <Card padding="sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-heading text-body-sm font-bold"><Bell size={14} className="mr-1.5 inline" aria-hidden />{t("weekend.latestActivity", { defaultValue: "Latest activity" })}</p>
              {alerts.unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 text-meta text-muted-foreground"
                  onClick={() => void markCrewAlertsRead({ crewId: crew.crewId })}
                >
                  {t("weekend.markRead", { defaultValue: "Mark read · {{count}}", count: alerts.unread })}
                </Button>
              )}
            </div>
            <Button
              variant="ghost"
              block
              className="mt-1 h-auto flex-col items-start justify-start gap-0 px-0 py-1 text-left font-normal"
              onClick={() => alerts.alerts[0]?.roomId !== null && alerts.alerts[0]?.roomId !== undefined
                && navigate(SHELL_ROUTES.weekendDraft(alerts.alerts[0].roomId))}
            >
              <span className="block font-heading text-body-sm font-bold">{alerts.alerts[0]?.title}</span>
              <span className="block text-meta text-muted-foreground">{alerts.alerts[0]?.body}</span>
            </Button>
          </Card>
        )}

        <CrewCompetitionPanel dashboard={dashboard} />

        {!isCreator && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void handleLeaveCrew()}
            className="self-center text-muted-foreground"
          >
            <LogOut size={16} strokeWidth={2.5} aria-hidden />
            {t("weekend.leaveCrew", { defaultValue: "Leave crew" })}
          </Button>
        )}
      </div>
    </ShellLayout>
  );
}
