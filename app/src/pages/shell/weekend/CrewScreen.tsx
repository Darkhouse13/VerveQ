/**
 * THE WEEKEND — a crew's page (FW-3 + FW-4): code card, members, crew table.
 *
 * Deep-link friendly the way ArenaPlayScreen is: landing here with a code you
 * are not yet a member of attempts ONE idempotent join (ref latch), so a
 * shared crew link is itself the invite.
 *
 * ── The standings column (FW-4 P6) ──
 *
 * It used to read "points: awaits scoring pipeline". The pipeline exists now, so
 * it carries real cumulative points — and where a weekend has no scores yet it
 * SAYS SO rather than showing a zero. That distinction is a ruling (FW-4 R7): an
 * honest zero and missing data must never render alike, so `points === null`
 * renders as "awaiting", never as 0.0, and a total drawn from a gameweek that has
 * not settled is labelled provisional (R3).
 *
 * Tie-breaks (FW-LAUNCH O4, DRAFT_ROOM ledger 5): the server applies the
 * ladders — equal cumulative points break by head-to-head weekend wins,
 * each weekend by points → top single player → fewest auto-picks — and
 * `tieBreaksApplied: true` comes down in the payload. A row still marked
 * `tied` means the ladder EXHAUSTED, and the tie is displayed as a tie.
 */
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { Bell, Check, Copy, LogOut, Share2, Swords, Trash2, UserMinus, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
// The engine's own display rule (SCORING_SPEC §Rounding: 1 dp, ties away from
// zero). Imported rather than reimplemented so the screen cannot round a score
// differently from the ledger it came from.
import { formatPoints } from "../../../../convex/lib/fantasyScoring";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoInput } from "@/components/neo/NeoInput";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { friendlyError } from "@/lib/errors";
import { CrewCompetitionPanel } from "./CrewCompetitionPanel";

const ROOM_STATUS_LABELS: Record<string, { label: string; color: "yellow" | "destructive" | "success" | "muted" }> = {
  lobby: { label: "Lobby open", color: "yellow" },
  order_reveal: { label: "Drafting", color: "destructive" },
  drafting: { label: "Drafting", color: "destructive" },
  completed: { label: "Drafted", color: "success" },
};

export default function CrewScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { code = "" } = useParams();
  const crew = useQuery(api.fantasyDraftRooms.getCrew, { code });
  const dashboard = useQuery(api.fantasyCrewDashboard.getDashboard, { code });
  const alerts = useQuery(
    api.fantasyDraftRooms.getCrewAlerts,
    crew == null ? "skip" : { crewId: crew.crewId },
  );
  const joinCrew = useMutation(api.fantasyDraftRooms.joinCrew);
  const createRoom = useMutation(api.fantasyDraftRooms.createRoom);
  const deleteCrew = useMutation(api.fantasyDraftRooms.deleteCrew);
  const leaveCrew = useMutation(api.fantasyDraftRooms.leaveCrew);
  const removeCrewMember = useMutation(api.fantasyDraftRooms.removeCrewMember);
  const markCrewAlertsRead = useMutation(api.fantasyDraftRooms.markCrewAlertsRead);

  const joinAttempted = useRef(false);
  const [joinFailed, setJoinFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string } | null>(null);

  // Not a member (or crew unknown): try joining by the URL's code, once.
  if (crew === null && !joinAttempted.current) {
    joinAttempted.current = true;
    void joinCrew({ code }).catch((e: unknown) => {
      setJoinFailed(
        friendlyError(e, t("weekend.crewJoinFailed", { defaultValue: "Could not join that crew." })),
      );
    });
  }

  const handleShare = async () => {
    const url = `${window.location.origin}${SHELL_ROUTES.weekendCrew(code)}`;
    const text = t("weekend.shareText", {
      defaultValue: "Join my crew on VerveQ — we draft for the weekend.",
    });
    try {
      if (navigator.share) {
        await navigator.share({ title: "VerveQ", text, url });
        return;
      }
    } catch {
      /* fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("weekend.shareFailed", { defaultValue: "Could not share the link." }));
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("weekend.shareFailed", { defaultValue: "Could not share the link." }));
    }
  };

  const handleCreateRoom = async () => {
    if (busy || crew === null || crew === undefined) return;
    setBusy(true);
    try {
      const { roomId } = await createRoom({ crewId: crew.crewId });
      navigate(SHELL_ROUTES.weekendDraft(roomId));
    } catch (e) {
      toast.error(friendlyError(e, t("weekend.roomCreateFailed", { defaultValue: "Could not open a draft room." })));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCrew = async () => {
    if (busy || crew === null || crew === undefined) return;
    setBusy(true);
    // The crew query flips to null the moment the delete commits — latch the
    // deep-link auto-join so that null is not mistaken for a bad link (which
    // would fire a doomed joinCrew against the dead code mid-navigation).
    joinAttempted.current = true;
    try {
      await deleteCrew({ crewId: crew.crewId });
      toast.success(
        t("weekend.crewDeleted", { defaultValue: "Crew deleted." }),
      );
      navigate(SHELL_ROUTES.weekendCrews, { replace: true });
    } catch (e) {
      toast.error(
        friendlyError(e, t("weekend.crewDeleteFailed", { defaultValue: "Could not delete the crew." })),
      );
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };

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

  const handleRemoveMember = async () => {
    if (busy || crew == null || memberToRemove === null) return;
    setBusy(true);
    try {
      await removeCrewMember({
        crewId: crew.crewId,
        memberUserId: memberToRemove.userId as typeof crew.isMe,
      });
      toast.success(`${memberToRemove.name} was removed.`);
      setMemberToRemove(null);
    } catch (error) {
      toast.error(friendlyError(error, "Could not remove that member."));
    } finally {
      setBusy(false);
    }
  };

  if (crew === undefined || (crew === null && joinFailed === null)) {
    return (
      <ShellLayout theme="theme-weekend" title={t("weekend.crewTitle", { defaultValue: "Crew" })} back scroll>
        <NeoCard className="text-center py-6 md:max-w-md md:mx-auto">
          <p className="text-sm text-muted-foreground">
            {t("common.loading", { defaultValue: "Loading…" })}
          </p>
        </NeoCard>
      </ShellLayout>
    );
  }

  if (crew === null) {
    return (
      <ShellLayout theme="theme-weekend" title={t("weekend.crewTitle", { defaultValue: "Crew" })} back scroll>
        <NeoCard color="destructive" className="text-center py-6 md:max-w-md md:mx-auto">
          <p className="font-heading font-bold">{joinFailed}</p>
          <NeoButton
            variant="secondary"
            size="md"
            className="mt-3"
            onClick={() => navigate(SHELL_ROUTES.weekendCrews)}
          >
            {t("weekend.backToCrews", { defaultValue: "Back to crews" })}
          </NeoButton>
        </NeoCard>
      </ShellLayout>
    );
  }

  const liveRoom = crew.rooms.find((r) => r.status !== "completed");

  return (
    <ShellLayout
      theme="theme-weekend"
      title={crew.name}
      back
      onBack={() => navigate(SHELL_ROUTES.weekendCrews)}
      scroll
    >
      {/* B1: at xl the crew splits two-up — code/members/actions beside the
          standings and crew table (the same sections, same order on phones). */}
      <div className="flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full xl:max-w-4xl xl:grid xl:grid-cols-2 xl:gap-6 xl:items-start">
        <div className="flex flex-col gap-4 min-w-0">
        <NeoCard shadow="lg" className="text-center py-5">
          <p className="text-[10px] font-heading uppercase text-muted-foreground mb-1">
            {t("weekend.crewCode", { defaultValue: "Crew code" })}
          </p>
          <p className="font-mono font-bold text-4xl tracking-[0.4em]">{crew.code}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <NeoButton variant="blue" size="md" onClick={() => void handleShare()}>
              <Share2 size={14} strokeWidth={3} className="mr-1.5" />
              {t("common.share", { defaultValue: "Share" })}
            </NeoButton>
            <NeoButton variant="secondary" size="md" onClick={() => void handleCopyCode()}>
              {copied ? (
                <Check size={14} strokeWidth={3} className="mr-1.5" />
              ) : (
                <Copy size={14} strokeWidth={3} className="mr-1.5" />
              )}
              {copied
                ? t("common.copied", { defaultValue: "Copied" })
                : t("common.copy", { defaultValue: "Copy" })}
            </NeoButton>
          </div>
        </NeoCard>

        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
            {t("weekend.members", { defaultValue: "Members" })} · {crew.members.length} · 8 seats each weekend
          </p>
          <div className="flex flex-wrap gap-2">
            {crew.members.map((member) => (
              <span key={member.userId} className="inline-flex items-center gap-1">
                <NeoBadge color={member.userId === crew.isMe ? "primary" : "muted"} size="md">
                  {member.name}{member.isCreator ? " · host" : ""}
                </NeoBadge>
                {crew.createdBy === crew.isMe && member.userId !== crew.isMe && (
                  <button type="button" aria-label={`Remove ${member.name}`} onClick={() => setMemberToRemove(member)} className="rounded p-1 text-muted-foreground active:opacity-60">
                    <UserMinus size={13} />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>

        {alerts !== undefined && alerts !== null && alerts.alerts.length > 0 && (
          <NeoCard className="py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-heading font-bold text-sm"><Bell size={14} className="mr-1.5 inline" />Crew activity</p>
              {alerts.unread > 0 && (
                <button type="button" className="font-mono text-[10px] font-bold uppercase text-muted-foreground" onClick={() => void markCrewAlertsRead({ crewId: crew.crewId })}>
                  Mark read · {alerts.unread}
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {alerts.alerts.slice(0, 3).map((alert) => (
                <button key={alert.alertId} type="button" className="text-left" onClick={() => alert.roomId !== null && navigate(SHELL_ROUTES.weekendDraft(alert.roomId))}>
                  <p className="text-xs font-heading font-bold">{alert.title}</p>
                  <p className="text-[10px] text-muted-foreground">{alert.body}</p>
                </button>
              ))}
            </div>
          </NeoCard>
        )}

        {liveRoom ? (
          <NeoButton
            variant="danger"
            size="full"
            onClick={() => navigate(SHELL_ROUTES.weekendDraft(liveRoom.roomId))}
          >
            <Swords size={18} strokeWidth={3} className="mr-1.5" />
            {liveRoom.status === "lobby"
              ? t("weekend.enterLobby", { defaultValue: "Enter the lobby" })
              : t("weekend.enterDraft", { defaultValue: "Enter the draft" })}
          </NeoButton>
        ) : (
          <NeoButton variant="primary" size="full" disabled={busy} onClick={() => void handleCreateRoom()}>
            <Swords size={18} strokeWidth={3} className="mr-1.5" />
            {t("weekend.openRoom", { defaultValue: "Open this weekend's draft" })}
          </NeoButton>
        )}
        </div>

        <div className="flex flex-col gap-4 min-w-0">
        <CrewCompetitionPanel dashboard={dashboard} />

        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
            {t("weekend.crewTable", { defaultValue: "Draft rooms" })}
          </p>
          {crew.rooms.length === 0 ? (
            <NeoCard className="py-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t("weekend.noRooms", {
                  defaultValue: "No drafts yet — open this weekend's room and share the code.",
                })}
              </p>
            </NeoCard>
          ) : (
            <div className="flex flex-col gap-2">
              {crew.rooms.map((room) => {
                const status = ROOM_STATUS_LABELS[room.status] ?? {
                  label: room.status,
                  color: "muted" as const,
                };
                // The caller's own line for this weekend. `points === null` means
                // nothing of his sheet has been scored yet — which is a different
                // statement from "he scored nothing", and reads differently.
                const dashboardWeek = dashboard?.allTime.weeks.find((week) => week.roomId === room.roomId);
                const mine = dashboardWeek?.rows.find((row) => row.userId === crew.isMe);
                return (
                  <NeoCard
                    key={room.roomId}
                    onClick={() => navigate(SHELL_ROUTES.weekendDraft(room.roomId))}
                    className="flex items-center justify-between py-2.5 text-left"
                  >
                    <div>
                      <p className="font-heading font-bold text-sm leading-tight">
                        {room.gameweek === null
                          ? t("weekend.gameweek", { defaultValue: "Gameweek" })
                          : `GW ${room.gameweek.gwNumber} · ${room.gameweek.season}`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {room.seatCount}{" "}
                        {t("weekend.drafters", { defaultValue: "drafters" })}
                        {" · "}
                        {mine === undefined
                          ? t("weekend.notSeated", { defaultValue: "you did not draft this one" })
                          : mine.points === null
                            ? t("weekend.awaitingData", { defaultValue: "awaiting data" })
                            : `${formatPoints(mine.points)} ${t("weekend.pts", { defaultValue: "pts" })}${
                                dashboardWeek?.state === "final"
                                  ? ""
                                  : ` · ${t("weekend.provisional", { defaultValue: "provisional" })}`
                              }`}
                      </p>
                    </div>
                    <NeoBadge color={status.color}>{status.label}</NeoBadge>
                  </NeoCard>
                );
              })}
            </div>
          )}
        </div>
        </div>

        {/* Creator-only, and ONLY while the crew has no completed draft — the
            server's deleteCrew guard is the enforcement, `canDelete` merely
            mirrors it so a protected crew shows no delete path at all
            (FW-POLISH-3 O2). */}
        {crew.canDelete && (
          <button
            type="button"
            data-testid="crew-delete-open"
            onClick={() => {
              setDeleteConfirmText("");
              setDeleteOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground active:opacity-60"
          >
            <Trash2 size={13} strokeWidth={3} aria-hidden />
            {t("weekend.deleteCrew", { defaultValue: "Delete crew" })}
          </button>
        )}
        <button type="button" onClick={() => void handleLeaveCrew()} className="flex items-center justify-center gap-1.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground active:opacity-60">
          <LogOut size={13} strokeWidth={3} />Leave crew
        </button>
      </div>

      {/* Typed-confirm sheet (FormationChooser's bottom-sheet precedent). */}
      <DialogPrimitive.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            data-testid="crew-delete-sheet"
            className="theme-weekend weekend-sheet-in fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm neo-border neo-shadow-lg rounded-t-xl border-b-0 bg-background text-foreground p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-2">
              <DialogPrimitive.Title className="font-heading font-bold text-lg">
                {t("weekend.deleteCrewTitle", { defaultValue: "Delete this crew?" })}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="neo-border rounded bg-card p-1 shrink-0 active:neo-shadow-pressed"
                aria-label="Close"
              >
                <X size={14} strokeWidth={3} />
              </DialogPrimitive.Close>
            </div>
            <p className="text-sm leading-snug text-muted-foreground">
              {t("weekend.deleteCrewBody", {
                defaultValue:
                  "This cancels any open lobby and removes the crew for everyone in it. It cannot be undone.",
              })}
            </p>
            <div>
              <label
                htmlFor="crew-delete-confirm"
                className="block mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
              >
                {t("weekend.deleteCrewType", { defaultValue: "Type DELETE to confirm" })}
              </label>
              <NeoInput
                id="crew-delete-confirm"
                data-testid="crew-delete-confirm-input"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                placeholder="DELETE"
              />
            </div>
            <NeoButton
              variant="danger"
              size="full"
              data-testid="crew-delete-confirm"
              disabled={busy || deleteConfirmText.trim() !== "DELETE"}
              onClick={() => void handleDeleteCrew()}
            >
              <Trash2 size={16} strokeWidth={3} className="mr-1.5" />
              {t("weekend.deleteCrewConfirm", { defaultValue: "Delete crew forever" })}
            </NeoButton>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={memberToRemove !== null} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <DialogPrimitive.Content className="theme-weekend fixed bottom-0 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 neo-border neo-shadow-lg rounded-t-xl border-b-0 bg-background p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <DialogPrimitive.Title className="font-heading font-bold text-lg">Remove {memberToRemove?.name}?</DialogPrimitive.Title>
            <p className="mt-2 text-sm text-muted-foreground">They leave the persistent crew and any unstarted lobby seat. Past drafts and results remain intact.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <NeoButton variant="outline" size="md" onClick={() => setMemberToRemove(null)}>Cancel</NeoButton>
              <NeoButton variant="danger" size="md" disabled={busy} onClick={() => void handleRemoveMember()}>Remove</NeoButton>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ShellLayout>
  );
}
