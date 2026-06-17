/**
 * VerveGrid (solo) on the v2 shell — a bespoke `GridStage` over the EXISTING,
 * untouched `verveGrid` backend. Server-authoritative throughout: the screen
 * holds only a `sessionId` and renders the sanitized view-model from
 * `useVerveGrid`. Flag-gated by the shell (ShellGate) and additive — the live
 * `/verve-grid` route is unaffected.
 */
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { GridStage } from "@/components/shell/play/grid/GridStage";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useVerveGrid } from "@/hooks/useVerveGrid";

export default function VerveGridPlayScreen() {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";

  const vm = useVerveGrid(sport);

  const goCompete = () => navigate(SHELL_ROUTES.competeSportGrid(sport));
  const goHome = () => navigate(SHELL_ROUTES.home);

  if (vm.loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <p className="font-heading font-bold text-lg animate-pulse">{t("verveGrid.building")}</p>
      </div>
    );
  }

  if (vm.startupState) {
    return (
      <div className="min-h-[100dvh] bg-background px-4 py-6 flex items-center justify-center">
        <NeoCard color="blue" shadow="lg" className="w-full max-w-md text-center py-8 px-6">
          <p className="font-heading font-bold text-2xl">{vm.startupState.title}</p>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {vm.startupState.message}
          </p>
          <div className="grid grid-cols-1 gap-3 mt-6">
            {vm.startupState.kind === "unsupported" ? (
              <NeoButton
                variant="primary"
                size="lg"
                onClick={() => navigate(`${SHELL_ROUTES.verveGridPlay}?sport=football`)}
              >
                {t("verveGrid.playFootball")}
              </NeoButton>
            ) : (
              <NeoButton variant="primary" size="lg" onClick={vm.startGame}>
                {t("verveGrid.tryAgain")}
              </NeoButton>
            )}
            <NeoButton variant="secondary" size="lg" onClick={goCompete}>
              {t("verveGrid.backToCompete")}
            </NeoButton>
          </div>
        </NeoCard>
      </div>
    );
  }

  return (
    <GridStage
      vm={vm}
      subtitle={t("verveGrid.subtitle", { count: vm.totalCells })}
      onExit={goCompete}
      onHome={goHome}
    />
  );
}
