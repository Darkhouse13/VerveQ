/**
 * `/difficulty` — the difficulty step before a solo run (Quiz, Knowledge Quiz,
 * Which Came First, and the curated modes VerveGrid / Higher or Lower).
 *
 * PURE CLIENT STATE: it reads query params and navigates; it calls no Convex
 * function and needs no identity (see App.tsx). The mode route it hands off to
 * carries the real gate.
 *
 * VerveQ ONE P3.4: a shell screen — the mode's name in the header, a
 * Segmented for the tier, a card describing that tier, and one lime Start.
 */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Segmented } from "@/components/ui/segmented";
import { DEFAULT_DIFFICULTY, type Difficulty } from "@/lib/difficulty";

/** The three tiers: the locale key and the value the play routes take. */
const DIFFICULTIES: ReadonlyArray<{ key: "easy" | "medium" | "hard"; apiValue: Difficulty }> = [
  { key: "easy", apiValue: "easy" },
  { key: "medium", apiValue: "intermediate" },
  { key: "hard", apiValue: "hard" },
];

// Curated solo modes (VerveGrid, Higher or Lower) reuse this picker as their
// single difficulty source: the tier is chosen here and deep-linked into the v2
// play screen via `?difficulty=`. Unlike Quiz, there is no in-game tier changer,
// so the chosen tier holds for the run and changing it means coming back here.
const CURATED_MODE_DESTINATIONS: Record<string, string> = {
  "verve-grid": "/v2/verve-grid",
  "higher-lower": "/v2/higher-lower",
};

/** The shell `modes.*` key that names the mode this picker is starting. */
function modeKeyFor(sport: string, mode: string): string {
  if (mode === "verve-grid") return "verveGrid";
  if (mode === "higher-lower") return "higherLower";
  if (mode === "came_first") return "cameFirst";
  return sport === "knowledge" ? "knowledgeQuiz" : "quiz";
}

export default function DifficultyScreen() {
  const { t } = useTranslation("screens");
  const { t: tShell } = useTranslation("shell");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sport = params.get("sport") || "football";
  const mode = params.get("mode") || "quiz";
  // `target=v2` routes the chosen difficulty into the v2 shell's Quiz prototype
  // layout instead of the legacy `/quiz` screen. Additive: without it the legacy
  // flow is unchanged, so the picker is the single difficulty source for both.
  const target = params.get("target");
  const curatedDest = CURATED_MODE_DESTINATIONS[mode];
  const isCurated = !!curatedDest;
  const [selected, setSelected] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const tier = DIFFICULTIES.find((d) => d.apiValue === selected) ?? DIFFICULTIES[0];

  const handleStart = () => {
    const diff = selected;
    // Curated solo modes deep-link straight into their v2 play screen at the
    // chosen tier — no `mode` param (each route is the mode).
    if (curatedDest) {
      navigate(`${curatedDest}?sport=${sport}&difficulty=${diff}`);
      return;
    }
    const resolvedMode = mode === "came_first" ? "came_first" : "quiz";
    const dest = target === "v2" ? "/v2/quiz" : "/quiz";
    navigate(`${dest}?sport=${sport}&difficulty=${diff}&mode=${resolvedMode}`);
  };

  return (
    <ShellLayout
      title={tShell(`modes.${modeKeyFor(sport, mode)}.name`)}
      subtitle={t("difficulty.title")}
      back
      // A cold deep link has no in-app history to go back to: land on Compete.
      onBack={() => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate("/compete"))}
      hideNav
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col gap-4 pt-2" data-testid="difficulty-screen">
        {mode === "came_first" && <p className="text-body-sm text-muted-foreground">{t("difficulty.cameFirstHint")}</p>}

        <Segmented<Difficulty>
          aria-label={t("difficulty.title")}
          block
          value={selected}
          onChange={setSelected}
          options={DIFFICULTIES.map((d) => ({ value: d.apiValue, label: t(`difficulty.${d.key}_name`) }))}
        />

        <Card padding="lg" data-testid="difficulty-tier">
          <Eyebrow>{t(`difficulty.${tier.key}_name`)}</Eyebrow>
          <p className="mt-1 font-heading text-title-sm font-bold">
            {isCurated ? t(`difficulty.curated.${tier.key}_desc`) : t(`difficulty.${tier.key}_desc`)}
          </p>
          {/* Quiz keeps an in-game difficulty changer; the curated solo modes
              don't, so the "change later" reassurance would mislead there. */}
          {!isCurated && <p className="mt-3 text-meta text-muted-foreground">{t("difficulty.changeLater")}</p>}
        </Card>

        <div className="mt-auto pb-2">
          <Button variant="primary" size="lg" block onClick={handleStart} data-testid="difficulty-start">
            <Play aria-hidden="true" className="h-5 w-5" />
            {t("difficulty.startGame")}
          </Button>
        </div>
      </div>
    </ShellLayout>
  );
}
