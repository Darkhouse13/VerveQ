import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, Footprints, Timer, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
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
      mode="career-path"
      title={t("careerPath.title")}
      subtitle={t("careerPath.modePickerSubtitle")}
      onExit={() => navigate(SHELL_ROUTES.home)}
      exitLabel={t("careerPath.quit")}
      wide
    >
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center py-4">
        <div className="mb-5 text-center">
          <Eyebrow>{t("careerPath.chooseModeEyebrow")}</Eyebrow>
          <h1 className="mt-2 font-heading text-title-lg font-bold md:text-display">
            {t("careerPath.chooseModeTitle")}
          </h1>
          <p className="mx-auto mt-2 max-w-lg font-body text-body-sm text-muted-foreground">
            {t("careerPath.chooseModeDescription")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ModeCard
            icon={<Footprints size={24} strokeWidth={2.5} />}
            title={t("careerPath.classicModeTitle")}
            description={t("careerPath.classicModeDescription")}
            meta={t("careerPath.classicModeMeta")}
            onClick={() => setMode("classic")}
            testId="career-path-mode-classic"
          />
          <ModeCard
            icon={<Trophy size={24} strokeWidth={2.5} />}
            title={t("careerPath.ladderModeTitle")}
            description={t("careerPath.ladderModeDescription")}
            meta={
              <>
                <Timer size={14} aria-hidden="true" /> {t("careerPath.ladderModeMeta")}
              </>
            }
            badge={t("careerPath.advertisedBadge")}
            onClick={() => setMode("ladder")}
            testId="career-path-mode-ladder"
          />
        </div>
      </div>
    </PlayStage>
  );
}

/** A mode choice: a neutral card; the Career Path accent marks its icon tile. */
function ModeCard({
  icon,
  title,
  description,
  meta,
  badge,
  onClick,
  testId,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  meta: ReactNode;
  badge?: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <Card interactive padding="lg" className="group relative flex min-h-52 flex-col" onClick={onClick} data-testid={testId}>
      {badge && (
        <Badge tone="mode" className="absolute right-4 top-4">
          {badge}
        </Badge>
      )}
      <span className="grid h-11 w-11 place-items-center rounded-md neo-border bg-mode-accent text-ink" aria-hidden="true">
        {icon}
      </span>
      <span className="mt-4 block font-heading text-title-sm font-bold">{title}</span>
      <span className="mt-1 block font-body text-body-sm leading-relaxed text-muted-foreground">{description}</span>
      <span className="mt-auto flex items-center justify-between pt-5">
        <span className="inline-flex items-center gap-1.5 font-mono text-eyebrow font-bold uppercase">{meta}</span>
        <ArrowRight className="transition-transform duration-ui group-hover:translate-x-1 motion-reduce:transition-none" size={20} aria-hidden="true" />
      </span>
    </Card>
  );
}
