/**
 * VerveGrid (solo) on the v2 shell — a bespoke `GridStage` over the EXISTING,
 * untouched `verveGrid` backend. Server-authoritative throughout: the screen
 * holds only a `sessionId` and renders the sanitized view-model from
 * `useVerveGrid`. Flag-gated by the shell (ShellGate) and additive — the live
 * `/verve-grid` route is unaffected.
 */
import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { GridStage } from "@/components/shell/play/grid/GridStage";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useVerveGrid } from "@/hooks/useVerveGrid";
import { parseDifficulty, type Difficulty } from "@/lib/difficulty";
import { TierControl } from "@/components/shell/play/TierControl";

export default function VerveGridPlayScreen() {
  const { t } = useTranslation("play");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const sport = params.get("sport") || "football";
  // Tier lives in the URL; a direct deep link (no param) falls back to easy.
  // The in-screen TierControl writes here, and useVerveGrid keys its auto-start
  // on it, so the URL stays the one place the run's tier is decided.
  const difficulty = parseDifficulty(params.get("difficulty"));

  const pickTier = useCallback(
    (tier: Difficulty) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set("difficulty", tier);
      // replace: Back should leave the mode, not walk the player through every
      // tier they auditioned.
      setParams(nextParams, { replace: true });
    },
    [params, setParams],
  );

  const vm = useVerveGrid(sport, difficulty);
  // Board untouched — no cell locked in yet, so re-tiering is still free.
  const preRun = !vm.gameOver && vm.emptyCount === vm.totalCells;

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
          <p className="font-heading font-bold text-2xl">
            {vm.startupState === "unsupported"
              ? t("verveGrid.unsupportedTitle")
              : t("verveGrid.startFailedTitle")}
          </p>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {vm.startupState === "unsupported"
              ? t("verveGrid.unsupportedMessage")
              : t("verveGrid.startFailedMessage")}
          </p>
          <div className="grid grid-cols-1 gap-3 mt-6">
            {vm.startupState === "unsupported" ? (
              <NeoButton
                variant="primary"
                size="lg"
                onClick={() => navigate("/difficulty?sport=football&mode=verve-grid")}
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
      /* Pre-run only: once a cell is locked in the tier is fixed for the run
         (the server already dealt this board at that ceiling). */
      header={
        preRun ? (
          <TierControl value={difficulty} onChange={pickTier} className="mb-2" />
        ) : undefined
      }
    />
  );
}
