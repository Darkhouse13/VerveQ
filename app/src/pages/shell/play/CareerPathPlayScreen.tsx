import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Footprints, Timer, Trophy } from "lucide-react";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoCard } from "@/components/neo/NeoCard";
import { PlayStage } from "@/components/shell/play/PlayStage";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import CareerPathClassicGame from "./CareerPathClassicGame";
import CareerPathLadderGame from "./CareerPathLadderGame";

export type CareerPathMode = "classic" | "ladder";

/**
 * One shared entry for /play and in-app navigation. Nothing gameplay-related
 * is provisioned until the visitor deliberately selects one of the two modes;
 * on a first visit, the global language prompt naturally sits above this
 * choice, so language -> mode -> game is the actual order.
 */
export default function CareerPathPlayScreen() {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const [mode, setMode] = useState<CareerPathMode | null>(null);

  if (mode === "classic") return <CareerPathClassicGame />;
  if (mode === "ladder") return <CareerPathLadderGame onChooseMode={() => setMode(null)} />;

  return (
    <PlayStage
      title="Career Path"
      subtitle={t("careerPath.modePickerSubtitle")}
      onExit={() => navigate(SHELL_ROUTES.home)}
      exitLabel={t("careerPath.home")}
      wide
    >
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center py-4">
        <div className="mb-5 text-center">
          <NeoBadge color="accent" size="md">{t("careerPath.chooseModeEyebrow")}</NeoBadge>
          <h1 className="mt-3 font-heading text-3xl font-bold md:text-4xl">
            {t("careerPath.chooseModeTitle")}
          </h1>
          <p className="mx-auto mt-2 max-w-lg font-body text-sm text-muted-foreground">
            {t("careerPath.chooseModeDescription")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <NeoCard
            color="blue"
            className="group flex min-h-56 flex-col p-5"
            onClick={() => setMode("classic")}
          >
            <span className="neo-border w-fit rounded-full bg-background p-2.5 text-foreground">
              <Footprints size={24} strokeWidth={2.5} />
            </span>
            <p className="mt-4 font-heading text-xl font-bold">
              {t("careerPath.classicModeTitle")}
            </p>
            <p className="mt-1 font-body text-sm leading-relaxed opacity-85">
              {t("careerPath.classicModeDescription")}
            </p>
            <div className="mt-auto flex items-center justify-between pt-5">
              <span className="font-mono text-xs font-bold uppercase">
                {t("careerPath.classicModeMeta")}
              </span>
              <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} />
            </div>
          </NeoCard>

          <NeoCard
            color="primary"
            className="group relative flex min-h-56 flex-col overflow-hidden p-5"
            onClick={() => setMode("ladder")}
          >
            <NeoBadge color="yellow" size="sm" className="absolute right-4 top-4">
              {t("careerPath.advertisedBadge")}
            </NeoBadge>
            <span className="neo-border w-fit rounded-full bg-background p-2.5 text-foreground">
              <Trophy size={24} strokeWidth={2.5} />
            </span>
            <p className="mt-4 font-heading text-xl font-bold">
              {t("careerPath.ladderModeTitle")}
            </p>
            <p className="mt-1 font-body text-sm leading-relaxed opacity-85">
              {t("careerPath.ladderModeDescription")}
            </p>
            <div className="mt-auto flex items-center justify-between pt-5">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase">
                <Timer size={14} /> {t("careerPath.ladderModeMeta")}
              </span>
              <ArrowRight className="transition-transform group-hover:translate-x-1" size={20} />
            </div>
          </NeoCard>
        </div>
      </div>
    </PlayStage>
  );
}
