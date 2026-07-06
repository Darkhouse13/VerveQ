import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { ArrowLeft, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const topicMeta: Record<string, { label: string; emoji: string; color: "success" | "accent" | "primary" }> = {
  football:   { label: "Football", emoji: "\u26BD", color: "success" },
  tennis:     { label: "Tennis", emoji: "\uD83C\uDFBE", color: "accent" },
  basketball: { label: "Basketball", emoji: "\uD83C\uDFC0", color: "primary" },
  knowledge:  { label: "Knowledge", emoji: "\uD83E\uDDE0", color: "primary" },
};

export default function SportSelectScreen() {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const [params] = useSearchParams();
  const mode = params.get("mode") || "quiz";
  const isHigherLowerMode = mode === "higher-lower";
  const isVerveGridMode = mode === "verve-grid";
  const isSurvivalMode = mode === "survival";
  const isFootballOnlyMode = isHigherLowerMode || isVerveGridMode;
  const availableTopics = isFootballOnlyMode
    ? ["football"]
    : isSurvivalMode
      ? ["football", "tennis", "basketball"]
      : Object.keys(topicMeta);
  const [selected, setSelected] = useState<string | null>(
    isFootballOnlyMode ? "football" : null,
  );

  const subtitle = isHigherLowerMode
    ? "Higher or Lower is currently available for football only"
    : isVerveGridMode
      ? "VerveGrid is currently available for football only"
      : isSurvivalMode
        ? "Choose your sport"
        : "Choose a topic";

  if (isGuest) {
    return (
      <div className="min-h-screen bg-background px-5 py-6">
        <button
          onClick={() => navigate(-1)}
          className="neo-border neo-shadow rounded-lg p-2 bg-background mb-6 cursor-pointer active:neo-shadow-pressed transition-all"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <div className="neo-border neo-shadow rounded-2xl bg-card p-6 text-center mt-12">
          <Lock size={34} strokeWidth={2.5} className="mx-auto mb-3" />
          <h1 className="text-2xl font-heading font-bold mb-2">Username required</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Guest play is temporary and tab-local. Create a username account before entering modes that write sessions, ELO, daily attempts, challenges, or Forge progress.
          </p>
          <NeoButton variant="primary" size="full" onClick={() => navigate("/?mode=signup&from=guest")}>
            Create Account
          </NeoButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-5 py-6">
      <button
        onClick={() => navigate(-1)}
        className="neo-border neo-shadow rounded-lg p-2 bg-background mb-6 cursor-pointer active:neo-shadow-pressed transition-all"
      >
        <ArrowLeft size={20} strokeWidth={2.5} />
      </button>

      <h1 className="text-3xl font-heading font-bold mb-1">{isSurvivalMode || isFootballOnlyMode ? "Pick a Sport" : "Pick a Topic"}</h1>
      <p className="text-muted-foreground font-body mb-6">{subtitle}</p>

      <div className="grid grid-cols-2 gap-3">
        {availableTopics.map((sport) => {
          const meta = topicMeta[sport] || { label: sport, emoji: "\uD83C\uDFC6", color: "primary" as const };
          return (
            <NeoCard
              key={sport}
              color={meta.color}
              active={selected === sport}
              className="flex flex-col items-center gap-3 py-8 cursor-pointer transition-all"
              shadow={selected === sport ? "lg" : "default"}
              onClick={() => setSelected(sport)}
            >
              <span className="text-5xl">{meta.emoji}</span>
              <p className="font-heading font-bold">{meta.label}</p>
            </NeoCard>
          );
        })}
      </div>

      <div className="mt-8">
        <NeoButton
          variant="primary"
          size="full"
          disabled={!selected}
          onClick={() => {
            if (mode === "daily-quiz") {
              navigate(`/daily-quiz?sport=${selected}`);
            } else if (mode === "blitz") {
              navigate(`/blitz?sport=${selected}`);
            } else if (mode === "survival") {
              navigate(`/survival?sport=${selected}`);
            } else if (mode === "higher-lower") {
              navigate(`/higher-lower?sport=${selected}`);
            } else if (mode === "verve-grid") {
              navigate(`/verve-grid?sport=${selected}`);
            } else {
              navigate(`/difficulty?sport=${selected}&mode=${mode}`);
            }
          }}
        >
          Continue
        </NeoButton>
      </div>
    </div>
  );
}
