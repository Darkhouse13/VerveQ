/**
 * `/onboarding` — the short welcome after sign-up or "Play as guest".
 *
 * VerveQ ONE P3.4: a shell screen in two steps — what VerveQ is, then a
 * self-rated level — with one lime Next and a quiet Skip. The old middle step
 * offered tennis and basketball, which VerveQ does not have (football only),
 * so it is gone. Nothing here is saved; both ways out land on Home.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Gamepad2, Star, Trophy } from "lucide-react";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Trophy, key: "elo" },
  { icon: Gamepad2, key: "modes" },
  { icon: Star, key: "achievements" },
] as const;

const LEVELS = ["beginner", "intermediate", "expert"] as const;
type Level = (typeof LEVELS)[number];

const STEPS = ["welcomeTitle", "skillLevelTitle"] as const;

export default function OnboardingScreen() {
  const { t } = useTranslation("screens");
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<Level | null>(null);
  const last = step === STEPS.length - 1;

  const handleNext = () => {
    if (!last) setStep(step + 1);
    else navigate("/home");
  };

  return (
    <ShellLayout hideNav>
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-5 pt-8" data-testid="onboarding-screen">
        <div className="flex items-center justify-between">
          <BrandMark variant="lockup" size="sm" />
          <Eyebrow as="span" data-testid="onboarding-step">
            {step + 1} / {STEPS.length}
          </Eyebrow>
        </div>

        <h1 className="font-heading text-title-lg font-bold">{t(`onboarding.${STEPS[step]}`)}</h1>

        {step === 0 && (
          <ul className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <li key={f.key}>
                <Card padding="md" className="flex items-center gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-muted" aria-hidden="true">
                    <f.icon size={22} strokeWidth={2.5} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-heading text-body font-bold">{t(`onboarding.feature_${f.key}_label`)}</span>
                    <span className="block text-body-sm text-muted-foreground">{t(`onboarding.feature_${f.key}_desc`)}</span>
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3" role="radiogroup" aria-label={t("onboarding.skillLevelTitle")}>
            {LEVELS.map((l) => {
              const selected = level === l;
              return (
                <Card
                  key={l}
                  interactive
                  role="radio"
                  aria-checked={selected}
                  padding="md"
                  onClick={() => setLevel(l)}
                  className={cn("flex items-center gap-4", selected ? "bg-muted" : "hover:bg-muted")}
                  data-testid={`onboarding-level-${l}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-body font-bold">{t(`onboarding.level_${l}_name`)}</span>
                    <span className="block text-body-sm text-muted-foreground">{t(`onboarding.level_${l}_desc`)}</span>
                  </span>
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-border",
                      selected && "bg-foreground text-background",
                    )}
                    aria-hidden="true"
                  >
                    {selected && <Check size={14} strokeWidth={3} />}
                  </span>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-4 pb-2">
          <Button variant="ghost" size="md" onClick={() => navigate("/home")} data-testid="onboarding-skip">
            {t("onboarding.skip")}
          </Button>
          <Button variant="primary" size="lg" className="flex-1" onClick={handleNext} data-testid="onboarding-next">
            {last ? t("onboarding.letsGo") : t("onboarding.next")}
          </Button>
        </div>
      </div>
    </ShellLayout>
  );
}
