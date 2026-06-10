import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NeoCard } from "@/components/neo/NeoCard";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { COMPETE_MODE_TILES } from "./competeModeTiles";

const LIVE_SPORTS = new Set(["football"]);

/**
 * The Compete landing: the mode grid, directly. With Sport the only live
 * category and Football the only live sport, the category and sport steps are
 * collapsed — the COMPETE tab / Home pillar lands here in one step. Those
 * steps' screens stay in pages/shell/ (unrouted; old URLs redirect here) so a
 * second sport/category later just re-inserts them. Every tile routes to an
 * EXISTING mode deep link — the shell never reimplements a mode.
 */
export default function CompeteModeGridScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { sport = "football" } = useParams<{ sport: string }>();

  // Only football is live; anything else falls back to the compete landing
  // (which defaults to football). Param-less /compete never hits this.
  if (!LIVE_SPORTS.has(sport)) {
    return <Navigate to={SHELL_ROUTES.compete} replace />;
  }

  return (
    <ShellLayout
      title={t("compete.title")}
      subtitle={t("compete.modeGridHint", {
        sport: t(`compete.sports.${sport}`, { defaultValue: sport }),
      })}
      back
      // As a top-level nav destination, back goes home deterministically —
      // history-back could leave the shell (or the app) on a direct visit.
      onBack={() => navigate(SHELL_ROUTES.home)}
    >
      {/* Auto margins center on tall screens but collapse (instead of clipping
          the top row, like justify-center did) when the grid overflows. */}
      <div className="flex flex-col md:h-full md:min-h-0 md:overflow-y-auto">
        <div className="flex flex-col gap-4 md:my-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {COMPETE_MODE_TILES.map((m) => (
            <NeoCard
              key={m.key}
              color={m.color}
              shadow="lg"
              className="flex flex-col gap-2 cursor-pointer min-h-[120px] md:min-h-[150px]"
              onClick={() => navigate(m.to(sport))}
            >
              <div className="neo-border rounded-xl bg-background w-fit p-2.5">
                <m.icon size={24} strokeWidth={2.5} className="text-foreground" />
              </div>
              <div className="mt-auto">
                <p className="font-heading font-bold text-base leading-tight">
                  {t(`modes.${m.key}.name`)}
                </p>
                <p className="text-xs opacity-80 leading-tight mt-0.5">
                  {t(`modes.${m.key}.desc`)}
                </p>
              </div>
            </NeoCard>
          ))}
        </div>
        {/* The collapsed category step's pointer keeps its home here. */}
          <p className="text-xs text-muted-foreground text-center px-4">
            {t("compete.categoryHint")}
          </p>
        </div>
      </div>
    </ShellLayout>
  );
}
