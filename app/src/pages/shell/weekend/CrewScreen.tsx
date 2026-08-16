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
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
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
      toast.error(friendlyError(error, "Could not leave the crew."));
    } finally {
      setBusy(false);
    }
  };

  if (crew === undefined || (crew === null && joinFailed === null)) {
    return (
      <ShellLayout theme="theme-weekend" title="Crew" back scroll>
        <NeoCard className="py-6 text-center md:mx-auto md:max-w-md">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </NeoCard>
      </ShellLayout>
    );
  }

  if (crew === null) {
    return (
      <ShellLayout theme="theme-weekend" title="Crew" back scroll>
        <NeoCard color="destructive" className="py-6 text-center md:mx-auto md:max-w-md">
          <p className="font-heading font-bold">{joinFailed}</p>
          <NeoButton variant="secondary" size="md" className="mt-3" onClick={() => navigate(SHELL_ROUTES.weekendCrews)}>
            Back to crews
          </NeoButton>
        </NeoCard>
      </ShellLayout>
    );
  }

  const isCreator = crew.createdBy === crew.isMe;
  const liveRoom = crew.rooms.find((room) => room.status !== "completed");

  return (
    <ShellLayout
      theme="theme-weekend"
      title={crew.name}
      subtitle="Crew competition"
      back
      onBack={() => navigate(SHELL_ROUTES.weekendCrews)}
      headerRight={isCreator ? (
        <NeoButton
          variant="secondary"
          size="sm"
          onClick={() => navigate(SHELL_ROUTES.weekendCrewCommand(code))}
          aria-label="Open Crew Command"
        >
          <Settings2 size={15} className="mr-1" />Command
        </NeoButton>
      ) : undefined}
      scroll
    >
      <div className="flex w-full flex-col gap-4 md:mx-auto md:max-w-md">
        {liveRoom !== undefined ? (
          <NeoButton variant="danger" size="full" onClick={() => navigate(SHELL_ROUTES.weekendDraft(liveRoom.roomId))}>
            <Swords size={18} strokeWidth={3} className="mr-1.5" />
            {liveRoom.status === "lobby" ? "Enter the lobby" : "Enter the live draft"}
          </NeoButton>
        ) : (
          <NeoCard className="py-3 text-center">
            <p className="font-heading text-sm font-bold">No draft is open</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {isCreator ? "Open the next one from Crew Command." : "The crew creator will open the next weekend."}
            </p>
          </NeoCard>
        )}

        {alerts !== undefined && alerts !== null && alerts.alerts.length > 0 && (
          <NeoCard className="py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-heading text-sm font-bold"><Bell size={14} className="mr-1.5 inline" />Latest activity</p>
              {alerts.unread > 0 && (
                <button
                  type="button"
                  className="font-mono text-[10px] font-bold uppercase text-muted-foreground"
                  onClick={() => void markCrewAlertsRead({ crewId: crew.crewId })}
                >
                  Mark read · {alerts.unread}
                </button>
              )}
            </div>
            <button
              type="button"
              className="mt-2 w-full text-left"
              onClick={() => alerts.alerts[0]?.roomId !== null && alerts.alerts[0]?.roomId !== undefined
                && navigate(SHELL_ROUTES.weekendDraft(alerts.alerts[0].roomId))}
            >
              <p className="text-xs font-heading font-bold">{alerts.alerts[0]?.title}</p>
              <p className="text-[10px] text-muted-foreground">{alerts.alerts[0]?.body}</p>
            </button>
          </NeoCard>
        )}

        <CrewCompetitionPanel dashboard={dashboard} />

        {!isCreator && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleLeaveCrew()}
            className="flex items-center justify-center gap-1.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground active:opacity-60"
          >
            <LogOut size={13} strokeWidth={3} />Leave crew
          </button>
        )}
      </div>
    </ShellLayout>
  );
}
