import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { Trophy, Gamepad2, Star, Check } from "lucide-react";

const steps = [
  {
    title: "Welcome to VerveQ!",
    features: [
      { icon: Trophy, label: "ELO Rankings", desc: "Climb the competitive ladder", color: "primary" as const },
      { icon: Gamepad2, label: "Quiz & Survival Modes", desc: "Two ways to play", color: "accent" as const },
      { icon: Star, label: "Achievements", desc: "Unlock badges and rewards", color: "blue" as const },
    ],
  },
  {
    title: "Pick Your Sport",
    sports: [
      { emoji: "⚽", name: "Football", color: "success" as const },
      { emoji: "🎾", name: "Tennis", color: "accent" as const },
      { emoji: "🏀", name: "Basketball", color: "primary" as const },
      { emoji: "🏈", name: "More Coming", color: "default" as const },
    ],
  },
  {
    title: "Your Skill Level",
    levels: [
      { name: "Beginner", desc: "Just getting started", color: "success" as const, emoji: "🌱" },
      { name: "Intermediate", desc: "I know my stuff", color: "primary" as const, emoji: "⚡" },
      { name: "Expert", desc: "Bring it on!", color: "destructive" as const, emoji: "🔥" },
    ],
  },
];

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const navigate = useNavigate();

  const current = steps[step];

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
    else navigate("/home");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-8">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-9 h-9 neo-border rounded-full flex items-center justify-center font-heading font-bold text-sm transition-all ${
                i < step
                  ? "bg-success text-success-foreground"
                  : i === step
                  ? "bg-primary text-primary-foreground neo-shadow"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check size={16} strokeWidth={3} /> : i + 1}
            </div>
            {i < 2 && <div className="w-8 border-t-2 border-dashed border-border" />}
          </div>
        ))}
      </div>

      <h2 className="text-2xl font-heading font-bold text-center mb-6">{current.title}</h2>

      <div className="flex-1 space-y-3">
        {step === 0 &&
          current.features?.map((f) => (
            <NeoCard key={f.label} color={f.color} className="flex items-center gap-4">
              <div className="neo-border rounded-lg bg-background p-2.5">
                <f.icon size={24} strokeWidth={2.5} className="text-foreground" />
              </div>
              <div>
                <p className="font-heading font-bold text-sm">{f.label}</p>
                <p className="text-xs opacity-80">{f.desc}</p>
              </div>
            </NeoCard>
          ))}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {current.sports?.map((s) => (
              <NeoCard
                key={s.name}
                color={s.color}
                active={selectedSport === s.name}
                className="flex flex-col items-center gap-2 py-6 cursor-pointer"
                onClick={() => setSelectedSport(s.name)}
              >
                <span className="text-4xl">{s.emoji}</span>
                <p className="font-heading font-bold text-sm">{s.name}</p>
              </NeoCard>
            ))}
          </div>
        )}

        {step === 2 &&
          current.levels?.map((l) => (
            <NeoCard
              key={l.name}
              color={l.color}
              active={selectedLevel === l.name}
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => setSelectedLevel(l.name)}
            >
              <span className="text-3xl">{l.emoji}</span>
              <div>
                <p className="font-heading font-bold uppercase">{l.name}</p>
                <p className="text-xs opacity-80">{l.desc}</p>
              </div>
            </NeoCard>
          ))}
      </div>

      <div className="flex items-center justify-between mt-8 gap-4">
        <button
          className="text-sm text-muted-foreground font-heading underline underline-offset-4 cursor-pointer"
          onClick={() => navigate("/home")}
        >
          Skip
        </button>
        <NeoButton variant="primary" size="lg" onClick={handleNext}>
          {step === 2 ? "Let's Go!" : "Next"}
        </NeoButton>
      </div>
    </div>
  );
}
