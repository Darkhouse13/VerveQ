import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { Compass, ArrowRight, Clock, Lock } from "lucide-react";
import { listGeographyNodeSummaries } from "../../convex/learnLadderBuilder";

// PROTOTYPE ONLY — Learn node picker. Lists the Geography skill nodes from the
// graph, each marked PLAYABLE or COMING SOON. Not wired into home, nav, or any
// scored mode. Tapping a playable node plays a ladder built for it.

export default function LearnNodePickerScreen() {
  const navigate = useNavigate();
  const nodes = useMemo(() => listGeographyNodeSummaries(), []);

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col">
      <div className="flex justify-center mb-5">
        <NeoBadge color="blue" rotated size="md" className="animate-badge-land">
          <Compass size={14} className="mr-1.5" /> Learn · Geography
        </NeoBadge>
      </div>

      <p className="text-sm text-muted-foreground mb-6 leading-snug text-center">
        Pick a skill to learn. Playable skills have teaching reveals; the rest are
        still being built.
      </p>

      <div className="space-y-3">
        {nodes.map((summary) => {
          const playable = summary.playable;
          return (
            <NeoCard
              key={summary.nodeId}
              shadow={playable ? "lg" : "default"}
              color="default"
              className={playable ? "" : "opacity-70"}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="font-heading font-bold text-lg leading-tight">
                  {summary.node.name}
                </p>
                {playable ? (
                  <NeoBadge color="success" size="sm">
                    Playable
                  </NeoBadge>
                ) : (
                  <NeoBadge color="muted" size="sm">
                    <Clock size={12} className="mr-1" /> Coming soon
                  </NeoBadge>
                )}
              </div>

              <p className="text-sm text-muted-foreground leading-snug mb-3">
                {summary.node.description}
              </p>

              {playable ? (
                <NeoButton
                  size="full"
                  variant="primary"
                  onClick={() => navigate(`/learn/geography/${summary.nodeId}`)}
                >
                  Learn ({summary.rungCount} rungs)
                  <ArrowRight size={16} strokeWidth={3} />
                </NeoButton>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-heading font-bold uppercase tracking-wide">
                  <Lock size={12} />
                  {summary.taggedCount} tagged · no teaching reveals yet
                </div>
              )}
            </NeoCard>
          );
        })}
      </div>

      <div className="flex-1" />

      <div className="pt-6">
        <NeoButton size="full" variant="secondary" onClick={() => navigate("/home")}>
          Back
        </NeoButton>
      </div>
    </div>
  );
}
