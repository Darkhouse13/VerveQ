import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Hash, Plus, Users } from "lucide-react";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import CreateArenaModal from "@/pages/arena/CreateArenaModal";
import JoinArenaModal from "@/pages/arena/JoinArenaModal";

export default function ArenaHubScreen() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  return (
    <ShellLayout title="Arena" subtitle="Live rooms for friends, teams, and FFA." back>
      <div className="space-y-4">
        <NeoCard color="accent" shadow="lg" className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-heading text-xl font-bold inline-flex items-center gap-2">
                <Gamepad2 size={20} strokeWidth={3} /> Challenge Arena
              </p>
              <p className="mt-1 text-sm opacity-90">
                Create or join a live 5-round room. Same backend, shell-native surface.
              </p>
            </div>
            <NeoBadge color="primary" size="sm">Live</NeoBadge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NeoButton variant="primary" size="md" onClick={() => setShowCreate(true)}>
              <Plus size={16} strokeWidth={3} /> Create
            </NeoButton>
            <NeoButton variant="secondary" size="md" onClick={() => setShowJoin(true)}>
              <Hash size={16} strokeWidth={3} /> Join code
            </NeoButton>
          </div>
        </NeoCard>
        <NeoCard shadow="sm" className="p-4">
          <p className="font-heading text-sm font-bold inline-flex items-center gap-2">
            <Users size={16} strokeWidth={3} /> Looking for async head-to-head?
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Duels live separately under the Duels tile. Arena is for simultaneous multiplayer rooms.
          </p>
          <button
            type="button"
            onClick={() => navigate(SHELL_ROUTES.duels)}
            className="mt-3 text-xs font-heading font-bold uppercase underline underline-offset-4"
          >
            Go to Duels
          </button>
        </NeoCard>
      </div>
      <CreateArenaModal open={showCreate} onOpenChange={setShowCreate} />
      <JoinArenaModal open={showJoin} onOpenChange={setShowJoin} />
    </ShellLayout>
  );
}
