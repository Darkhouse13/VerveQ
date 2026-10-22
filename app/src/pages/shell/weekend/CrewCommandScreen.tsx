/** Creator-only administration for a Weekend crew. */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import {
  Bell,
  Check,
  Copy,
  Info,
  LogOut,
  Share2,
  Swords,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";
import { notify } from "@/lib/notify";
import { api } from "../../../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Sheet } from "@/components/ui/sheet";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { friendlyError } from "@/lib/errors";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

const ROOM_STATUS: Record<string, { key: string; fallback: string; color: "yellow" | "destructive" | "success" | "muted" }> = {
  lobby: { key: "weekend.lobbyOpen", fallback: "Lobby open", color: "yellow" },
  order_reveal: { key: "weekend.liveDrafting", fallback: "Drafting", color: "destructive" },
  drafting: { key: "weekend.liveDrafting", fallback: "Drafting", color: "destructive" },
  completed: { key: "weekend.drafted", fallback: "Drafted", color: "success" },
};

export default function CrewCommandScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation("shell");
  const { code = "" } = useParams();
  const crew = useQuery(api.fantasyDraftRooms.getCrew, { code });
  const alerts = useQuery(
    api.fantasyDraftRooms.getCrewAlerts,
    crew == null || crew.createdBy !== crew.isMe ? "skip" : { crewId: crew.crewId },
  );
  const createRoom = useMutation(api.fantasyDraftRooms.createRoom);
  const deleteCrew = useMutation(api.fantasyDraftRooms.deleteCrew);
  const leaveCrew = useMutation(api.fantasyDraftRooms.leaveCrew);
  const removeCrewMember = useMutation(api.fantasyDraftRooms.removeCrewMember);
  const markCrewAlertsRead = useMutation(api.fantasyDraftRooms.markCrewAlertsRead);

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string } | null>(null);

  const handleShare = async () => {
    const url = `${window.location.origin}${SHELL_ROUTES.weekendCrew(code)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "VerveQ", text: t("weekend.shareJoinText", { defaultValue: "Join my Weekend crew on VerveQ." }), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Closing the native share sheet is not an error.
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error(t("weekend.copyCodeFailed", { defaultValue: "Could not copy the code." }));
    }
  };

  const handleCreateRoom = async () => {
    if (busy || crew == null) return;
    setBusy(true);
    try {
      const { roomId } = await createRoom({ crewId: crew.crewId });
      navigate(SHELL_ROUTES.weekendDraft(roomId));
    } catch (error) {
      notify.error(friendlyError(error, t("weekend.openDraftFailed", { defaultValue: "Could not open the draft room." })));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async () => {
    if (busy || crew == null || memberToRemove === null) return;
    setBusy(true);
    try {
      await removeCrewMember({
        crewId: crew.crewId,
        memberUserId: memberToRemove.userId as typeof crew.isMe,
      });
      notify.success(t("weekend.memberRemoved", { defaultValue: "{{name}} was removed.", name: memberToRemove.name }));
      setMemberToRemove(null);
    } catch (error) {
      notify.error(friendlyError(error, t("weekend.removeMemberFailed", { defaultValue: "Could not remove that member." })));
    } finally {
      setBusy(false);
    }
  };

  const handleLeaveCrew = async () => {
    if (busy || crew == null) return;
    setBusy(true);
    try {
      await leaveCrew({ crewId: crew.crewId });
      navigate(SHELL_ROUTES.weekendCrews, { replace: true });
    } catch (error) {
      notify.error(friendlyError(error, t("weekend.leaveCrewFailed", { defaultValue: "Could not leave the crew." })));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCrew = async () => {
    if (busy || crew == null) return;
    setBusy(true);
    try {
      await deleteCrew({ crewId: crew.crewId });
      notify.success(t("weekend.crewDeleted", { defaultValue: "Crew deleted." }));
      navigate(SHELL_ROUTES.weekendCrews, { replace: true });
    } catch (error) {
      notify.error(friendlyError(error, t("weekend.deleteCrewFailed", { defaultValue: "Could not delete the crew." })));
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (crew === undefined) {
    return (
      <ShellLayout theme="theme-weekend" title={t("weekend.crewCommandTitle", { defaultValue: "Crew Command" })} back scroll>
        <Card className="py-6 text-center md:mx-auto md:max-w-md">{t("common.loading", { defaultValue: "Loading…" })}</Card>
      </ShellLayout>
    );
  }

  if (crew === null || crew.createdBy !== crew.isMe) {
    return (
      <ShellLayout theme="theme-weekend" title={t("weekend.crewCommandTitle", { defaultValue: "Crew Command" })} back onBack={() => navigate(SHELL_ROUTES.weekendCrew(code))} scroll>
        <Card className="bg-destructive text-ink on-fill py-6 text-center md:mx-auto md:max-w-md">
          <p className="font-heading font-bold">{t("weekend.creatorOnly", { defaultValue: "Creator access only" })}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("weekend.creatorOnlyBody", { defaultValue: "Only the person running this crew can open Crew Command." })}</p>
          <Button className="mt-3" variant="secondary" size="md" onClick={() => navigate(SHELL_ROUTES.weekendCrew(code))}>{t("weekend.backToCrew", { defaultValue: "Back to crew" })}</Button>
        </Card>
      </ShellLayout>
    );
  }

  const liveRoom = crew.rooms.find((room) => room.status !== "completed");

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.crewCommandTitle", { defaultValue: "Crew Command" })}
      subtitle={crew.name}
      back
      onBack={() => navigate(SHELL_ROUTES.weekendCrew(code))}
      headerRight={(
        <IconButton
          variant="secondary"
          onClick={() => setInfoOpen(true)}
          aria-label={t("weekend.crewCommandInfoAria", { defaultValue: "How Crew Command works" })}
        >
          <Info aria-hidden />
        </IconButton>
      )}
      scroll
    >
      <div className="flex w-full flex-col gap-4 md:mx-auto md:max-w-md">
        <section>
          <p className="mb-2 font-mono text-eyebrow font-bold uppercase text-muted-foreground">{t("weekend.thisWeekend", { defaultValue: "This gameweek" })}</p>
          {liveRoom === undefined ? (
            <Button variant="primary" size="lg" block disabled={busy} onClick={() => void handleCreateRoom()}>
              <Swords size={18} strokeWidth={3} className="mr-1.5" />{t("weekend.openDraftRoom", { defaultValue: "Open the draft room" })}
            </Button>
          ) : (
            <Card elevation="lifted" className="bg-yellow text-ink on-fill py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-heading font-bold">{liveRoom.status === "lobby" ? t("weekend.lobbyIsOpen", { defaultValue: "Lobby is open" }) : t("weekend.draftInProgress", { defaultValue: "Draft in progress" })}</p>
                  <p className="text-meta text-muted-foreground">{t("weekend.seatsClaimed", { defaultValue: "{{count}} of 8 seats claimed", count: liveRoom.seatCount })}</p>
                </div>
                <Button variant="danger" size="sm" onClick={() => navigate(SHELL_ROUTES.weekendDraft(liveRoom.roomId))}>
                  {t("weekend.manage", { defaultValue: "Manage" })}
                </Button>
              </div>
            </Card>
          )}
        </section>

        <section>
          <p className="mb-2 font-mono text-eyebrow font-bold uppercase text-muted-foreground">{t("weekend.invite", { defaultValue: "Invite" })}</p>
          <Card className="py-3 text-center">
            <p className="font-mono text-3xl font-bold">{crew.code}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="md" onClick={() => void handleShare()}><Share2 size={14} className="mr-1.5" />{t("weekend.shareLink", { defaultValue: "Share link" })}</Button>
              <Button variant="secondary" size="md" onClick={() => void handleCopyCode()}>
                {copied ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
                {copied ? t("common.copied", { defaultValue: "Copied" }) : t("weekend.copyCode", { defaultValue: "Copy code" })}
              </Button>
            </div>
          </Card>
        </section>

        <section>
          <p className="mb-2 font-mono text-eyebrow font-bold uppercase text-muted-foreground">
            {t("weekend.membersWithCount", {
              defaultValue: `Members · ${crew.members.length}`,
              count: crew.members.length,
            })}
          </p>
          <Card className="divide-y-2 divide-border p-0">
            {crew.members.map((member) => (
              <div key={member.userId} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Users size={14} className="shrink-0 text-muted-foreground" />
                  <span className="truncate font-heading text-sm font-bold">{member.name}</span>
                  {member.userId === crew.isMe && <Badge tone="primary">{t("weekend.creator", { defaultValue: "Creator" })}</Badge>}
                </div>
                {member.userId !== crew.isMe && (
                  <IconButton aria-label={t("weekend.removeMemberAria", { defaultValue: "Remove {{name}}", name: member.name })} onClick={() => setMemberToRemove(member)} className="-mr-2 text-muted-foreground">
                    <UserMinus aria-hidden />
                  </IconButton>
                )}
              </div>
            ))}
          </Card>
          <p className="mt-1.5 text-meta text-muted-foreground">{t("weekend.membershipNote", { defaultValue: "Membership is unlimited. Each weekend has eight draft seats." })}</p>
        </section>

        {alerts !== undefined && alerts !== null && alerts.alerts.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-mono text-eyebrow font-bold uppercase text-muted-foreground"><Bell size={12} className="mr-1 inline" aria-hidden />{t("weekend.activity", { defaultValue: "Activity" })}</p>
              {alerts.unread > 0 && <Button variant="ghost" size="sm" className="-mr-2 px-2 text-muted-foreground" onClick={() => void markCrewAlertsRead({ crewId: crew.crewId })}>{t("weekend.markRead", { defaultValue: "Mark read · {{count}}", count: alerts.unread })}</Button>}
            </div>
            <Card className="py-2">
              {alerts.alerts.slice(0, 5).map((alert) => (
                <Button key={alert.alertId} variant="ghost" block className="h-auto flex-col items-start gap-0 px-2 py-1.5 text-left" onClick={() => alert.roomId !== null && navigate(SHELL_ROUTES.weekendDraft(alert.roomId))}>
                  <span className="text-body-sm font-heading font-bold">{alert.title}</span>
                  <span className="font-body text-meta font-normal text-muted-foreground">{alert.body}</span>
                </Button>
              ))}
            </Card>
          </section>
        )}

        {crew.rooms.length > 0 && (
          <section>
            <p className="mb-2 font-mono text-eyebrow font-bold uppercase text-muted-foreground">{t("weekend.draftRooms", { defaultValue: "Draft rooms" })}</p>
            <div className="flex flex-col gap-2">
              {crew.rooms.map((room) => {
                const status = ROOM_STATUS[room.status] ?? { key: "weekend.roomStatus", fallback: room.status, color: "muted" as const };
                return (
                  <Card interactive key={room.roomId} onClick={() => navigate(SHELL_ROUTES.weekendDraft(room.roomId))} className="flex items-center justify-between py-2.5 text-left">
                    <div>
                  <p className="font-heading text-sm font-bold">{room.gameweek === null ? t("weekend.gameweek", { defaultValue: "Gameweek" }) : `GW ${room.gameweek.gwNumber} · ${room.gameweek.season}`}</p>
                  <p className="text-meta text-muted-foreground">{t("weekend.drafters", { defaultValue: "{{count}} drafters", count: room.seatCount })}</p>
                    </div>
                    <Badge tone={status.color}>{t(status.key, { defaultValue: status.fallback })}</Badge>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <p className="mb-2 font-mono text-eyebrow font-bold uppercase text-muted-foreground">{t("weekend.ownershipTitle", { defaultValue: "Ownership" })}</p>
          <Card className="flex flex-col gap-2 py-3">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void handleLeaveCrew()} className="text-muted-foreground">
              <LogOut size={16} aria-hidden />{t("weekend.leaveTransfer", { defaultValue: "Leave & transfer ownership" })}
            </Button>
            {crew.canDelete && (
              <Button variant="ghost" size="sm" data-testid="crew-delete-open" onClick={() => { setDeleteConfirmText(""); setDeleteOpen(true); }} className="text-destructive">
                <Trash2 size={16} aria-hidden />{t("weekend.deleteCrew", { defaultValue: "Delete crew" })}
              </Button>
            )}
          </Card>
        </section>
      </div>

      <Sheet open={infoOpen} onOpenChange={setInfoOpen} title={t("weekend.crewCommandHowTitle", { defaultValue: "How Crew Command works" })}>
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p><strong className="text-foreground">{t("weekend.draftLabel", { defaultValue: "Draft:" })}</strong> {t("weekend.crewCommandDraftBody", { defaultValue: "open the weekly room, then manage its time and eight seats in the lobby." })}</p>
          <p><strong className="text-foreground">{t("weekend.inviteLabel", { defaultValue: "Invite:" })}</strong> {t("weekend.crewCommandInviteBody", { defaultValue: "share the permanent crew link or code." })}</p>
          <p><strong className="text-foreground">{t("weekend.membersLabel", { defaultValue: "Members:" })}</strong> {t("weekend.crewCommandMembersBody", { defaultValue: "remove inactive people without erasing past results." })}</p>
          <p><strong className="text-foreground">{t("weekend.ownershipLabel", { defaultValue: "Ownership:" })}</strong> {t("weekend.crewCommandOwnershipBody", { defaultValue: "leaving transfers control; deletion is available only before the first completed draft." })}</p>
        </div>
      </Sheet>

      <ConfirmDialog
        presentation="sheet"
        open={memberToRemove !== null}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title={t("weekend.removeMemberTitle", { defaultValue: "Remove {{name}}?", name: memberToRemove?.name ?? "" })}
        description={t("weekend.removeMemberBody", { defaultValue: "They leave the crew and any unstarted lobby seat. Their past results remain." })}
        cancelLabel={t("common.cancel", { defaultValue: "Cancel" })}
        confirmLabel={t("weekend.remove", { defaultValue: "Remove" })}
        danger
        busy={busy}
        onConfirm={() => void handleRemoveMember()}
      />

      <Sheet
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        testId="crew-delete-sheet"
        title={t("weekend.deleteCrewTitle", { defaultValue: "Delete this crew?" })}
        description={t("weekend.deleteCrewBody", { defaultValue: "This removes the crew for everyone. It cannot be undone." })}
      >
        <div>
          <label htmlFor="crew-delete-confirm" className="mb-1.5 block font-mono text-eyebrow font-bold uppercase text-muted-foreground">{t("weekend.deleteCrewConfirmLabel", { defaultValue: "Type DELETE to confirm" })}</label>
          <Input id="crew-delete-confirm" data-testid="crew-delete-confirm-input" value={deleteConfirmText} onChange={(event) => setDeleteConfirmText(event.target.value)} placeholder="DELETE" />
        </div>
        <Button variant="danger" size="lg" block data-testid="crew-delete-confirm" disabled={busy || deleteConfirmText.trim() !== "DELETE"} onClick={() => void handleDeleteCrew()}>
          <Trash2 size={16} className="mr-1.5" />{t("weekend.deleteCrewForever", { defaultValue: "Delete crew forever" })}
        </Button>
      </Sheet>
    </ShellLayout>
  );
}
