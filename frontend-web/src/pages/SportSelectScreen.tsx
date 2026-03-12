import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { ArrowLeft } from "lucide-react";

const sportMeta: Record<string, { emoji: string; color: "success" | "accent" | "primary" }> = {
  football:   { emoji: "\u26BD", color: "success" },
  tennis:     { emoji: "\uD83C\uDFBE", color: "accent" },
  basketball: { emoji: "\uD83C\uDFC0", color: "primary" },
};

export default function SportSelectScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("mode") || "quiz";

  const availableSports = Object.keys(sportMeta);

  return (
    <div className="min-h-screen bg-background px-5 py-6">
      <button
        onClick={() => navigate(-1)}
        className="neo-border neo-shadow rounded-lg p-2 bg-background mb-6 cursor-pointer active:neo-shadow-pressed transition-all"
      >
        <ArrowLeft size={20} strokeWidth={2.5} />
      </button>

      <h1 className="text-3xl font-heading font-bold mb-1">Pick a Sport</h1>
      <p className="text-muted-foreground font-body mb-6">Choose your arena</p>

      <div className="grid grid-cols-2 gap-3">
        {availableSports.map((sport) => {
          const meta = sportMeta[sport] || { emoji: "\uD83C\uDFC6", color: "primary" as const };
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
              <p className="font-heading font-bold capitalize">{sport}</p>
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
            if (mode === "blitz") {
              navigate(`/blitz?sport=${selected}`);
            } else if (mode === "survival") {
              navigate(`/survival?sport=${selected}`);
            } else if (mode === "higher-lower") {
              navigate(`/higher-lower?sport=${selected}`);
            } else if (mode === "verve-grid") {
              navigate(`/verve-grid?sport=${selected}`);
            } else if (mode === "who-am-i") {
              navigate(`/who-am-i?sport=${selected}`);
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
