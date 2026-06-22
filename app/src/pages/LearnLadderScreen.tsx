import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { Clock } from "lucide-react";
import { LearnLadderHost } from "./LearnPrototypeScreen";
import { getLearnNodeSummary } from "../../convex/learnLadderBuilder";
import { skillNodeIds, type SkillNodeId } from "../../convex/learnSkillGraph";

// Dev/preview route wrapper. Resolves a skill node from the URL and decides what
// to show: a playable node hands off to LearnLadderHost, which starts a SERVER
// session and plays it server-side (no client-side answer checking). Non-playable
// or unknown nodes get a "coming soon" / "not found" card. The graph summary used
// here is display metadata only (name + tagged count) — it carries no answers.

const PICKER_PATH = "/learn/geography";

function isSkillNodeId(value: string | undefined): value is SkillNodeId {
  return !!value && (skillNodeIds as readonly string[]).includes(value);
}

export default function LearnLadderScreen() {
  const navigate = useNavigate();
  const { nodeId } = useParams<{ nodeId: string }>();

  const summary = useMemo(
    () => (isSkillNodeId(nodeId) ? getLearnNodeSummary(nodeId) : null),
    [nodeId],
  );

  if (summary?.playable) {
    return <LearnLadderHost nodeId={summary.nodeId} backTo={PICKER_PATH} />;
  }

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col">
      <div className="flex justify-center mb-6">
        <NeoBadge color="muted" rotated size="md">
          <Clock size={14} className="mr-1.5" />
          {summary ? "Coming soon" : "Not found"}
        </NeoBadge>
      </div>

      <NeoCard shadow="lg" className="mb-6">
        <p className="font-heading font-bold text-xl leading-snug">
          {summary
            ? `${summary.node.name} isn't ready to learn yet.`
            : "That skill node doesn't exist."}
        </p>
        {summary && (
          <p className="text-sm text-muted-foreground mt-2 leading-snug">
            It only has {summary.taggedCount} tagged question
            {summary.taggedCount === 1 ? "" : "s"} — not enough to build a session
            yet.
          </p>
        )}
      </NeoCard>

      <div className="flex-1" />

      <NeoButton size="full" variant="secondary" onClick={() => navigate(PICKER_PATH)}>
        Back to nodes
      </NeoButton>
    </div>
  );
}
