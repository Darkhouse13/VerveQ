import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { Compass, ArrowRight, Clock, Lock, RotateCcw } from "lucide-react";
import { listSubjectNodeSummaries } from "../../convex/learnLadderBuilder";
import { DEFAULT_LEARN_SUBJECT } from "../../convex/learnSkillGraph";

// PROTOTYPE ONLY — Learn node picker. Mastery state, review-due flags, and the
// subject progression bar are SERVER-AUTHORITATIVE (getLearnNodes). Static graph
// metadata (description, tagged/rung counts) is merged in for display only. Not
// wired into home, nav, or any scored mode.

const SUBJECT = DEFAULT_LEARN_SUBJECT;

type MasteryState = "untouched" | "learning" | "proficient" | "mastered";

const STATE_BADGE: Record<
  MasteryState,
  { label: string; color: "muted" | "blue" | "accent" | "success" }
> = {
  untouched: { label: "New", color: "muted" },
  learning: { label: "Learning", color: "blue" },
  proficient: { label: "Proficient", color: "accent" },
  mastered: { label: "Mastered", color: "success" },
};

export default function LearnNodePickerScreen() {
  const navigate = useNavigate();
  // Static graph metadata (descriptions + counts) — no answers, display only.
  const summaries = useMemo(() => listSubjectNodeSummaries(SUBJECT), []);
  const summaryByNode = useMemo(
    () => new Map(summaries.map((s) => [s.nodeId, s])),
    [summaries],
  );

  // Server-authoritative mastery + progression.
  const learn = useQuery(api.learn.getLearnNodes, { subject: SUBJECT });
  const progressPct = learn?.progressPct ?? 0;

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col">
      <div className="flex justify-center mb-5">
        <NeoBadge color="blue" rotated size="md" className="animate-badge-land">
          <Compass size={14} className="mr-1.5" /> Learn · Geography
        </NeoBadge>
      </div>

      {/* Subject progression bar — server-driven. */}
      <NeoCard className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-heading font-bold uppercase tracking-wide text-xs text-muted-foreground">
            Subject progress
          </span>
          <span className="font-heading font-bold text-sm">{progressPct}%</span>
        </div>
        <div className="h-3 rounded-full neo-border bg-muted overflow-hidden">
          <div
            className="h-full bg-success transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </NeoCard>

      <p className="text-sm text-muted-foreground mb-6 leading-snug text-center">
        Pick a skill to learn. Playable skills have teaching reveals; the rest are
        still being built.
      </p>

      <div className="space-y-3">
        {(learn?.nodes ?? []).map((node) => {
          const summary = summaryByNode.get(node.nodeId);
          const playable = node.playable;
          const stateBadge = STATE_BADGE[node.state as MasteryState];
          return (
            <NeoCard
              key={node.nodeId}
              shadow={playable ? "lg" : "default"}
              color="default"
              className={playable ? "" : "opacity-70"}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="font-heading font-bold text-lg leading-tight">
                  {node.name}
                </p>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {playable ? (
                    <NeoBadge color={stateBadge.color} size="sm">
                      {stateBadge.label}
                    </NeoBadge>
                  ) : (
                    <NeoBadge color="muted" size="sm">
                      <Clock size={12} className="mr-1" /> Coming soon
                    </NeoBadge>
                  )}
                  {node.reviewDue && (
                    <NeoBadge color="pink" size="sm">
                      <RotateCcw size={12} className="mr-1" /> Review due
                    </NeoBadge>
                  )}
                </div>
              </div>

              {summary && (
                <p className="text-sm text-muted-foreground leading-snug mb-3">
                  {summary.node.description}
                </p>
              )}

              {playable ? (
                <NeoButton
                  size="full"
                  variant="primary"
                  onClick={() => navigate(`/learn/geography/${node.nodeId}`)}
                >
                  {node.state === "untouched"
                    ? `Learn${summary ? ` (${summary.rungCount} rungs)` : ""}`
                    : node.reviewDue
                      ? "Review now"
                      : "Practice again"}
                  <ArrowRight size={16} strokeWidth={3} />
                </NeoButton>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-heading font-bold uppercase tracking-wide">
                  <Lock size={12} />
                  {summary?.taggedCount ?? 0} tagged · no teaching reveals yet
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
