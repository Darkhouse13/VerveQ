import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import { Trophy, Gamepad2, Star, Check } from "lucide-react";

const steps = [
  {
    titleKey: "welcomeTitle",
    features: [
      { icon: Trophy, key: "elo", color: "primary" as const },
      { icon: Gamepad2, key: "modes", color: "accent" as const },
      { icon: Star, key: "achievements", color: "blue" as const },
    ],
  },
  {
    titleKey: "pickSportTitle",
    sports: [
      { emoji: "⚽", name: "Football", key: "football", color: "success" as const },
      { emoji: "🎾", name: "Tennis", key: "tennis", color: "accent" as const },
      { emoji: "🏀", name: "Basketball", key: "basketball", color: "primary" as const },
      { emoji: "🏈", name: "More Coming", key: "moreComing", color: "default" as const },
    ],
  },
  {
    titleKey: "skillLevelTitle",
    levels: [
      { name: "Beginner", key: "beginner", color: "success" as const, emoji: "🌱" },
      { name: "Intermediate", key: "intermediate", color: "primary" as const, emoji: "⚡" },
      { name: "Expert", key: "expert", color: "destructive" as const, emoji: "🔥" },
    ],
  },
];

export default function OnboardingScreen() {
  const { t } = useTranslation("screens");
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

      <h2 className="text-2xl font-heading font-bold text-center mb-6">{t(`onboarding.${current.titleKey}`)}</h2>

      <div className="flex-1 space-y-3">
        {step === 0 &&
          current.features?.map((f) => (
            <NeoCard key={f.key} color={f.color} className="flex items-center gap-4">
              <div className="neo-border rounded-lg bg-background p-2.5">
                <f.icon size={24} strokeWidth={2.5} className="text-foreground" />
              </div>
              <div>
                <p className="font-heading font-bold text-sm">{t(`onboarding.feature_${f.key}_label`)}</p>
                <p className="text-xs opacity-80">{t(`onboarding.feature_${f.key}_desc`)}</p>
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
                <p className="font-heading font-bold text-sm">{t(`onboarding.sport_${s.key}`)}</p>
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
                <p className="font-heading font-bold uppercase">{t(`onboarding.level_${l.key}_name`)}</p>
                <p className="text-xs opacity-80">{t(`onboarding.level_${l.key}_desc`)}</p>
              </div>
            </NeoCard>
          ))}
      </div>

      <div className="flex items-center justify-between mt-8 gap-4">
        <button
          className="text-sm text-muted-foreground font-heading underline underline-offset-4 cursor-pointer"
          onClick={() => navigate("/home")}
        >
          {t("onboarding.skip")}
        </button>
        <NeoButton variant="primary" size="lg" onClick={handleNext}>
          {step === 2 ? t("onboarding.letsGo") : t("onboarding.next")}
        </NeoButton>
      </div>
    </div>
  );
}
