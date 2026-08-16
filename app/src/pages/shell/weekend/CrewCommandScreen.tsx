/** Creator-only administration for a Weekend crew. */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
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
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoInput } from "@/components/neo/NeoInput";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { friendlyError } from "@/lib/errors";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

const ROOM_STATUS: Record<string, { label: string; color: "yellow" | "destructive" | "success" | "muted" }> = {
  lobby: { label: "Lobby open", color: "yellow" },
  order_reveal: { label: "Drafting", color: "destructive" },
  drafting: { label: "Drafting", color: "destructive" },
  completed: { label: "Drafted", color: "success" },
};

export default function CrewCommandScreen() {
  const navigate = useNavigate();
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
        await navigator.share({ title: "VerveQ", text: "Join my Weekend crew on VerveQ.", url });
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
      toast.error("Could not copy the code.");
    }
  };

  const handleCreateRoom = async () => {
    if (busy || crew == null) return;
    setBusy(true);
    try {
      const { roomId } = await createRoom({ crewId: crew.crewId });
      navigate(SHELL_ROUTES.weekendDraft(roomId));
    } catch (error) {
      toast.error(friendlyError(error, "Could not open the draft room."));
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

  const handleLeaveCrew = async () => {
    if (busy || crew == null) return;
    setBusy(true);
    try {
      await leaveCrew({ crewId: crew.crewId });
      navigate(SHELL_ROUTES.weekendCrews, { replace: true });
    } catch (error) {
      toast.error(friendlyError(error, "Could not leave the crew."));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteCrew = async () => {
    if (busy || crew == null) return;
    setBusy(true);
    try {
      await deleteCrew({ crewId: crew.crewId });
      toast.success("Crew deleted.");
      navigate(SHELL_ROUTES.weekendCrews, { replace: true });
    } catch (error) {
      toast.error(friendlyError(error, "Could not delete the crew."));
      setDeleteOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (crew === undefined) {
    return (
      <ShellLayout theme="theme-weekend" title="Crew Command" back scroll>
        <NeoCard className="py-6 text-center md:mx-auto md:max-w-md">Loading…</NeoCard>
      </ShellLayout>
    );
  }

  if (crew === null || crew.createdBy !== crew.isMe) {
    return (
      <ShellLayout theme="theme-weekend" title="Crew Command" back onBack={() => navigate(SHELL_ROUTES.weekendCrew(code))} scroll>
        <NeoCard color="destructive" className="py-6 text-center md:mx-auto md:max-w-md">
          <p className="font-heading font-bold">Creator access only</p>
          <p className="mt-1 text-sm opacity-80">Only the person running this crew can open Crew Command.</p>
          <NeoButton className="mt-3" variant="secondary" size="md" onClick={() => navigate(SHELL_ROUTES.weekendCrew(code))}>Back to crew</NeoButton>
        </NeoCard>
      </ShellLayout>
    );
  }

  const liveRoom = crew.rooms.find((room) => room.status !== "completed");

  return (
    <ShellLayout
      theme="theme-weekend"
      title="Crew Command"
      subtitle={crew.name}
      back
      onBack={() => navigate(SHELL_ROUTES.weekendCrew(code))}
      headerRight={(
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          aria-label="How Crew Command works"
          className="neo-border neo-shadow rounded-lg bg-card p-2 active:neo-shadow-pressed"
        >
          <Info size={19} strokeWidth={2.5} />
        </button>
      )}
      scroll
    >
      <div className="flex w-full flex-col gap-4 md:mx-auto md:max-w-md">
        <section>
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">This weekend</p>
          {liveRoom === undefined ? (
            <NeoButton variant="primary" size="full" disabled={busy} onClick={() => void handleCreateRoom()}>
              <Swords size={18} strokeWidth={3} className="mr-1.5" />Open the draft room
            </NeoButton>
          ) : (
            <NeoCard color="yellow" shadow="lg" className="py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-heading font-bold">{liveRoom.status === "lobby" ? "Lobby is open" : "Draft in progress"}</p>
                  <p className="text-[11px] opacity-75">{liveRoom.seatCount} of 8 seats claimed</p>
                </div>
                <NeoButton variant="danger" size="sm" onClick={() => navigate(SHELL_ROUTES.weekendDraft(liveRoom.roomId))}>
                  Manage
                </NeoButton>
              </div>
            </NeoCard>
          )}
        </section>

        <section>
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Invite</p>
          <NeoCard className="py-3 text-center">
            <p className="font-mono text-3xl font-bold tracking-[0.32em]">{crew.code}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <NeoButton variant="blue" size="md" onClick={() => void handleShare()}><Share2 size={14} className="mr-1.5" />Share link</NeoButton>
              <NeoButton variant="secondary" size="md" onClick={() => void handleCopyCode()}>
                {copied ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
                {copied ? "Copied" : "Copy code"}
              </NeoButton>
            </div>
          </NeoCard>
        </section>

        <section>
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Members · {crew.members.length}</p>
          <NeoCard className="divide-y-2 divide-border p-0">
            {crew.members.map((member) => (
              <div key={member.userId} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Users size={14} className="shrink-0 text-muted-foreground" />
                  <span className="truncate font-heading text-sm font-bold">{member.name}</span>
                  {member.userId === crew.isMe && <NeoBadge color="primary">Creator</NeoBadge>}
                </div>
                {member.userId !== crew.isMe && (
                  <button type="button" aria-label={`Remove ${member.name}`} onClick={() => setMemberToRemove(member)} className="rounded p-1.5 text-muted-foreground active:opacity-60">
                    <UserMinus size={15} />
                  </button>
                )}
              </div>
            ))}
          </NeoCard>
          <p className="mt-1.5 text-[10px] text-muted-foreground">Membership is unlimited. Each weekend has eight draft seats.</p>
        </section>

        {alerts !== undefined && alerts !== null && alerts.alerts.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground"><Bell size={12} className="mr-1 inline" />Activity</p>
              {alerts.unread > 0 && <button type="button" className="font-mono text-[10px] font-bold uppercase text-muted-foreground" onClick={() => void markCrewAlertsRead({ crewId: crew.crewId })}>Mark read · {alerts.unread}</button>}
            </div>
            <NeoCard className="py-2">
              {alerts.alerts.slice(0, 5).map((alert) => (
                <button key={alert.alertId} type="button" className="block w-full py-1.5 text-left" onClick={() => alert.roomId !== null && navigate(SHELL_ROUTES.weekendDraft(alert.roomId))}>
                  <p className="text-xs font-heading font-bold">{alert.title}</p>
                  <p className="text-[10px] text-muted-foreground">{alert.body}</p>
                </button>
              ))}
            </NeoCard>
          </section>
        )}

        {crew.rooms.length > 0 && (
          <section>
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Draft rooms</p>
            <div className="flex flex-col gap-2">
              {crew.rooms.map((room) => {
                const status = ROOM_STATUS[room.status] ?? { label: room.status, color: "muted" as const };
                return (
                  <NeoCard key={room.roomId} onClick={() => navigate(SHELL_ROUTES.weekendDraft(room.roomId))} className="flex items-center justify-between py-2.5 text-left">
                    <div>
                      <p className="font-heading text-sm font-bold">{room.gameweek === null ? "Gameweek" : `GW ${room.gameweek.gwNumber} · ${room.gameweek.season}`}</p>
                      <p className="text-[10px] text-muted-foreground">{room.seatCount} drafters</p>
                    </div>
                    <NeoBadge color={status.color}>{status.label}</NeoBadge>
                  </NeoCard>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Ownership</p>
          <NeoCard className="flex flex-col gap-2 py-3">
            <button type="button" disabled={busy} onClick={() => void handleLeaveCrew()} className="flex items-center justify-center gap-1.5 py-1 font-mono text-[11px] font-bold uppercase text-muted-foreground active:opacity-60">
              <LogOut size={13} />Leave & transfer ownership
            </button>
            {crew.canDelete && (
              <button type="button" data-testid="crew-delete-open" onClick={() => { setDeleteConfirmText(""); setDeleteOpen(true); }} className="flex items-center justify-center gap-1.5 py-1 font-mono text-[11px] font-bold uppercase text-destructive active:opacity-60">
                <Trash2 size={13} />Delete crew
              </button>
            )}
          </NeoCard>
        </section>
      </div>

      <DialogPrimitive.Root open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <DialogPrimitive.Content className="theme-weekend fixed bottom-0 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 rounded-t-xl border-b-0 bg-background p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] neo-border neo-shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <DialogPrimitive.Title className="font-heading text-lg font-bold">How Crew Command works</DialogPrimitive.Title>
              <DialogPrimitive.Close aria-label="Close" className="rounded bg-card p-1 neo-border"><X size={14} /></DialogPrimitive.Close>
            </div>
            <div className="mt-3 flex flex-col gap-3 text-sm text-muted-foreground">
              <p><strong className="text-foreground">Draft:</strong> open the weekly room, then manage its time and eight seats in the lobby.</p>
              <p><strong className="text-foreground">Invite:</strong> share the permanent crew link or code.</p>
              <p><strong className="text-foreground">Members:</strong> remove inactive people without erasing past results.</p>
              <p><strong className="text-foreground">Ownership:</strong> leaving transfers control; deletion is available only before the first completed draft.</p>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={memberToRemove !== null} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <DialogPrimitive.Content className="theme-weekend fixed bottom-0 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 rounded-t-xl border-b-0 bg-background p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] neo-border neo-shadow-lg">
            <DialogPrimitive.Title className="font-heading text-lg font-bold">Remove {memberToRemove?.name}?</DialogPrimitive.Title>
            <p className="mt-2 text-sm text-muted-foreground">They leave the crew and any unstarted lobby seat. Their past results remain.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <NeoButton variant="outline" size="md" onClick={() => setMemberToRemove(null)}>Cancel</NeoButton>
              <NeoButton variant="danger" size="md" disabled={busy} onClick={() => void handleRemoveMember()}>Remove</NeoButton>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <DialogPrimitive.Content data-testid="crew-delete-sheet" className="theme-weekend fixed bottom-0 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 rounded-t-xl border-b-0 bg-background p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] neo-border neo-shadow-lg">
            <DialogPrimitive.Title className="font-heading text-lg font-bold">Delete this crew?</DialogPrimitive.Title>
            <p className="mt-2 text-sm text-muted-foreground">This removes the crew for everyone. It cannot be undone.</p>
            <label htmlFor="crew-delete-confirm" className="mb-1.5 mt-4 block font-mono text-[11px] font-bold uppercase text-muted-foreground">Type DELETE to confirm</label>
            <NeoInput id="crew-delete-confirm" data-testid="crew-delete-confirm-input" value={deleteConfirmText} onChange={(event) => setDeleteConfirmText(event.target.value)} placeholder="DELETE" />
            <NeoButton variant="danger" size="full" className="mt-4" data-testid="crew-delete-confirm" disabled={busy || deleteConfirmText.trim() !== "DELETE"} onClick={() => void handleDeleteCrew()}>
              <Trash2 size={16} className="mr-1.5" />Delete crew forever
            </NeoButton>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ShellLayout>
  );
}
