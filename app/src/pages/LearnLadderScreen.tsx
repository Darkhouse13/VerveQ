import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { Clock } from "lucide-react";
import { LearnLoop } from "./LearnPrototypeScreen";
import {
  buildLadder,
  getLearnNodeSummary,
} from "../../convex/learnLadderBuilder";
import { skillNodeIds, type SkillNodeId } from "../../convex/learnSkillGraph";

// Dev/preview wrapper: resolve a skill node from the route, build its ladder
// (node -> builder -> loop), and either play it or show a "coming soon" card.

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
  const ladder = useMemo(
    () => (summary?.playable ? buildLadder(summary.nodeId) : null),
    [summary],
  );

  if (ladder && summary?.playable) {
    return <LearnLoop ladder={ladder} backTo={PICKER_PATH} />;
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
            It has {summary.taggedCount} tagged question
            {summary.taggedCount === 1 ? "" : "s"}, but they don't carry teaching
            reveals yet — so we won't ship it as a learning loop.
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
