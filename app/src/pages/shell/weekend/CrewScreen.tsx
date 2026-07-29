/**
 * THE WEEKEND — a crew's page (FW-3): code card, members, and the crew table.
 *
 * Deep-link friendly the way ArenaPlayScreen is: landing here with a code you
 * are not yet a member of attempts ONE idempotent join (ref latch), so a
 * shared crew link is itself the invite. The crew table lists every weekend's
 * room; standings numbers wait for the scoring pipeline and are explicitly
 * placeholders until then — no invented values.
 */
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, Copy, Share2, Swords } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { friendlyError } from "@/lib/errors";

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
  const joinCrew = useMutation(api.fantasyDraftRooms.joinCrew);
  const createRoom = useMutation(api.fantasyDraftRooms.createRoom);

  const joinAttempted = useRef(false);
  const [joinFailed, setJoinFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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

  if (crew === undefined || (crew === null && joinFailed === null)) {
    return (
      <ShellLayout title={t("weekend.crewTitle", { defaultValue: "Crew" })} back scroll>
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
      <ShellLayout title={t("weekend.crewTitle", { defaultValue: "Crew" })} back scroll>
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
      title={crew.name}
      back
      onBack={() => navigate(SHELL_ROUTES.weekendCrews)}
      scroll
    >
      <div className="flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full">
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
            {t("weekend.members", { defaultValue: "Members" })} · {crew.members.length}/8
          </p>
          <div className="flex flex-wrap gap-2">
            {crew.members.map((member) => (
              <NeoBadge key={member.userId} color={member.userId === crew.isMe ? "primary" : "muted"} size="md">
                {member.name}
              </NeoBadge>
            ))}
          </div>
        </div>

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

        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
            {t("weekend.crewTable", { defaultValue: "Crew table" })}
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
                        {/* Cumulative squad points land with the scoring
                            pipeline; until then this column says so instead
                            of inventing numbers. */}
                        {t("weekend.pointsPending", { defaultValue: "points: awaits scoring pipeline" })}
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
    </ShellLayout>
  );
}
