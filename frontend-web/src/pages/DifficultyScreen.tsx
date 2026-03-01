import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { ArrowLeft } from "lucide-react";

const difficulties = [
  { name: "Easy", apiValue: "easy", desc: "Casual fun, relaxed pace", emoji: "\uD83D\uDE0A", color: "success" as const },
  { name: "Medium", apiValue: "intermediate", desc: "Balanced challenge", emoji: "\uD83D\uDCAA", color: "primary" as const },
  { name: "Hard", apiValue: "hard", desc: "Expert level, no mercy", emoji: "\uD83D\uDD25", color: "destructive" as const },
];

export default function DifficultyScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const mode = params.get("mode") || "quiz";

  const handleStart = () => {
    if (!selected) return;
    const diff = difficulties.find((d) => d.name === selected)!.apiValue;
    if (mode === "survival") {
      navigate(`/survival?sport=${sport}`);
    } else {
      navigate(`/quiz?sport=${sport}&difficulty=${diff}`);
    }
  };

  return (
    <div className="min-h-screen bg-background px-5 py-6">
      <button
        onClick={() => navigate(-1)}
        className="neo-border neo-shadow rounded-lg p-2 bg-background mb-6 cursor-pointer active:neo-shadow-pressed transition-all"
      >
        <ArrowLeft size={20} strokeWidth={2.5} />
      </button>

      <h1 className="text-3xl font-heading font-bold mb-6">Choose Difficulty</h1>

      <div className="space-y-3">
        {difficulties.map((d) => (
          <NeoCard
            key={d.name}
            color={d.color}
            active={selected === d.name}
            shadow={selected === d.name ? "lg" : "default"}
            className="flex items-center gap-4 cursor-pointer py-6"
            onClick={() => setSelected(d.name)}
          >
            <span className="text-4xl">{d.emoji}</span>
            <div>
              <p className="font-heading font-bold text-xl uppercase">{d.name}</p>
              <p className="text-sm opacity-80">{d.desc}</p>
            </div>
          </NeoCard>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">You can always change this later</p>

      <div className="mt-6">
        <NeoButton variant="primary" size="full" disabled={!selected} onClick={handleStart}>
          Start Game
        </NeoButton>
      </div>
    </div>
  );
}
