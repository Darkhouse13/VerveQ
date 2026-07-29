/**
 * THE WEEKEND — crew hub (FW-3): the crews you draft with, plus create/join.
 *
 * Arena-hub shaped: a crew is the persistent thing (same code, same people,
 * every weekend — DRAFT_ROOM §Founding shape), so this screen lists crews and
 * hands off to the crew page, never to a room directly.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Hash, Plus, Users } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoInput } from "@/components/neo/NeoInput";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { friendlyError } from "@/lib/errors";

export default function WeekendCrewsScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const crews = useQuery(api.fantasyDraftRooms.listMyCrews, {});
  const createCrew = useMutation(api.fantasyDraftRooms.createCrew);
  const joinCrew = useMutation(api.fantasyDraftRooms.joinCrew);

  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { code: newCode } = await createCrew({ name });
      navigate(SHELL_ROUTES.weekendCrew(newCode));
    } catch (e) {
      toast.error(friendlyError(e, t("weekend.crewCreateFailed", { defaultValue: "Could not create the crew." })));
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { code: joinedCode } = await joinCrew({ code });
      navigate(SHELL_ROUTES.weekendCrew(joinedCode));
    } catch (e) {
      toast.error(friendlyError(e, t("weekend.crewJoinFailed", { defaultValue: "Could not join that crew." })));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ShellLayout
      title={t("weekend.crewsTitle", { defaultValue: "Crews" })}
      subtitle={t("weekend.crewsSubtitle", {
        defaultValue: "Draft a team for THE weekend with your crew.",
      })}
      back
      onBack={() => navigate(SHELL_ROUTES.compete)}
      scroll
    >
      <div className="flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full">
        {crews === undefined ? (
          <NeoCard className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </p>
          </NeoCard>
        ) : crews.length === 0 ? (
          <NeoCard color="pink" shadow="lg" className="flex flex-col gap-3">
            <div className="neo-border rounded-xl bg-background w-fit p-2.5">
              <Users size={24} strokeWidth={2.5} className="text-foreground" />
            </div>
            <div>
              <p className="font-heading font-bold text-lg leading-tight">
                {t("weekend.noCrewsTitle", { defaultValue: "One code, one crew, 13 picks" })}
              </p>
              <p className="text-sm opacity-80 mt-1">
                {t("weekend.noCrewsBody", {
                  defaultValue:
                    "Start a crew, share the code, and draft a fresh squad every weekend. Unique picks — when a player's gone, he's gone.",
                })}
              </p>
            </div>
          </NeoCard>
        ) : (
          crews.map((crew) => (
            <NeoCard
              key={crew.crewId}
              onClick={() => navigate(SHELL_ROUTES.weekendCrew(crew.code))}
              className="flex items-center justify-between py-3 text-left"
            >
              <div>
                <p className="font-heading font-bold leading-tight">{crew.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground tracking-[0.16em] uppercase">
                  {crew.code} · {crew.memberCount}{" "}
                  {t("weekend.members", { defaultValue: "members" })}
                </p>
              </div>
              {crew.liveRoomStatus !== null && (
                <NeoBadge color={crew.liveRoomStatus === "drafting" ? "destructive" : "yellow"}>
                  {crew.liveRoomStatus === "drafting"
                    ? t("weekend.liveDrafting", { defaultValue: "Drafting" })
                    : t("weekend.lobbyOpen", { defaultValue: "Lobby open" })}
                </NeoBadge>
              )}
            </NeoCard>
          ))
        )}

        {creating ? (
          <NeoCard shadow="lg" className="flex flex-col gap-3">
            <p className="font-heading font-bold text-sm uppercase tracking-wide">
              {t("weekend.nameYourCrew", { defaultValue: "Name your crew" })}
            </p>
            <NeoInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              placeholder={t("weekend.crewNamePlaceholder", { defaultValue: "Sunday League Legends" })}
            />
            <div className="grid grid-cols-2 gap-2">
              <NeoButton variant="ghost" size="md" onClick={() => setCreating(false)}>
                {t("common.cancel", { defaultValue: "Cancel" })}
              </NeoButton>
              <NeoButton
                variant="primary"
                size="md"
                disabled={name.trim().length < 2 || busy}
                onClick={() => void handleCreate()}
              >
                {t("weekend.create", { defaultValue: "Create" })}
              </NeoButton>
            </div>
          </NeoCard>
        ) : joining ? (
          <NeoCard shadow="lg" className="flex flex-col gap-3">
            <p className="font-heading font-bold text-sm uppercase tracking-wide">
              {t("weekend.enterCode", { defaultValue: "Enter the crew code" })}
            </p>
            <NeoInput
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="font-mono tracking-[0.3em] text-center"
              placeholder="ABC123"
            />
            <div className="grid grid-cols-2 gap-2">
              <NeoButton variant="ghost" size="md" onClick={() => setJoining(false)}>
                {t("common.cancel", { defaultValue: "Cancel" })}
              </NeoButton>
              <NeoButton
                variant="primary"
                size="md"
                disabled={code.trim().length < 4 || busy}
                onClick={() => void handleJoin()}
              >
                {t("weekend.join", { defaultValue: "Join" })}
              </NeoButton>
            </div>
          </NeoCard>
        ) : (
          <>
            <NeoButton variant="primary" size="full" onClick={() => setCreating(true)}>
              <Plus size={18} strokeWidth={3} className="mr-1.5" />
              {t("weekend.createCrew", { defaultValue: "Create crew" })}
            </NeoButton>
            <NeoButton variant="secondary" size="full" onClick={() => setJoining(true)}>
              <Hash size={18} strokeWidth={3} className="mr-1.5" />
              {t("weekend.joinCrew", { defaultValue: "Join with code" })}
            </NeoButton>
          </>
        )}
      </div>
    </ShellLayout>
  );
}
