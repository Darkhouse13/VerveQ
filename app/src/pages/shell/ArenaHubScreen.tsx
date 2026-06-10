/**
 * v2 Arena entry — the group-challenge-room flow, distinct from Duels.
 *
 * Hosts create a room (1v1 / 2v2 / FFA) and get a shareable code; friends join
 * with that code. Reuses the proven Create/Join modals and the existing
 * `challengeArenas` backend; play happens on `/v2/arena/:code`
 * (ArenaPlayScreen), which preserves the code through inline onboarding.
 *
 * Mounted behind UsernameOnlyRoute: the server admits any user with a username
 * (anonymous or full — `assertUsernameRequiredUser`), so the gate mirrors the
 * backend exactly and logged-out visitors onboard with `?next=` back here.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Hash, Users } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import CreateArenaModal from "@/pages/arena/CreateArenaModal";
import JoinArenaModal from "@/pages/arena/JoinArenaModal";

export default function ArenaHubScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  return (
    <ShellLayout
      title={t("modes.arena.name", { defaultValue: "Arena" })}
      subtitle={t("modes.arena.desc", {
        defaultValue: "Group challenge rooms — play live with friends.",
      })}
      back
      onBack={() => navigate(SHELL_ROUTES.compete)}
    >
      <div className="flex flex-col gap-4 md:h-full md:justify-center md:max-w-md md:mx-auto md:w-full">
        <NeoCard color="pink" shadow="lg" className="flex flex-col gap-3">
          <div className="neo-border rounded-xl bg-background w-fit p-2.5">
            <Users size={24} strokeWidth={2.5} className="text-foreground" />
          </div>
          <div>
            <p className="font-heading font-bold text-lg leading-tight">
              Live rooms, one code
            </p>
            <p className="text-sm opacity-80 mt-1">
              Host a room (1v1, 2v2, or free-for-all), share the code, and
              everyone answers the same questions in real time.
            </p>
          </div>
        </NeoCard>

        <NeoButton
          variant="primary"
          size="full"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={18} strokeWidth={3} className="mr-1.5" />
          Create arena
        </NeoButton>
        <NeoButton
          variant="secondary"
          size="full"
          onClick={() => setShowJoin(true)}
        >
          <Hash size={18} strokeWidth={3} className="mr-1.5" />
          Join with code
        </NeoButton>
      </div>

      {showCreate && (
        <CreateArenaModal
          onClose={() => setShowCreate(false)}
          onCreated={(code) => {
            setShowCreate(false);
            navigate(SHELL_ROUTES.arenaPlay(code));
          }}
        />
      )}
      {showJoin && (
        <JoinArenaModal
          onClose={() => setShowJoin(false)}
          onJoin={(code) => {
            setShowJoin(false);
            navigate(SHELL_ROUTES.arenaPlay(code));
          }}
        />
      )}
    </ShellLayout>
  );
}
