import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { ArrowLeft } from "lucide-react";

const difficulties = [
  { name: "Easy", key: "easy", apiValue: "easy", emoji: "😊", color: "success" as const },
  { name: "Medium", key: "medium", apiValue: "intermediate", emoji: "💪", color: "primary" as const },
  { name: "Hard", key: "hard", apiValue: "hard", emoji: "🔥", color: "destructive" as const },
];

// Curated solo modes (VerveGrid, Higher or Lower) reuse this picker as their
// single difficulty source: the tier is chosen here and deep-linked into the v2
// play screen via `?difficulty=`. Unlike Quiz, there is no in-game tier changer,
// so the chosen tier holds for the run and changing it means coming back here.
const CURATED_MODE_DESTINATIONS: Record<string, string> = {
  "verve-grid": "/v2/verve-grid",
  "higher-lower": "/v2/higher-lower",
};

export default function DifficultyScreen() {
  const { t } = useTranslation("screens");
  const [selected, setSelected] = useState<string | null>(null);
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

  const handleStart = () => {
    if (!selected) return;
    const diff = difficulties.find((d) => d.name === selected)!.apiValue;
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
    <div className="min-h-screen bg-background px-5 py-6">
      <button
        onClick={() => navigate(-1)}
        className="neo-border neo-shadow rounded-lg p-2 bg-background mb-6 cursor-pointer active:neo-shadow-pressed transition-all"
      >
        <ArrowLeft size={20} strokeWidth={2.5} />
      </button>

      <h1 className="text-3xl font-heading font-bold mb-2">{t("difficulty.title")}</h1>
      {mode === "came_first" && (
        <p className="text-sm text-muted-foreground mb-4">
          {t("difficulty.cameFirstHint")}
        </p>
      )}

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
              <p className="font-heading font-bold text-xl uppercase">{t(`difficulty.${d.key}_name`)}</p>
              <p className="text-sm opacity-80">
                {isCurated ? t(`difficulty.curated.${d.key}_desc`) : t(`difficulty.${d.key}_desc`)}
              </p>
            </div>
          </NeoCard>
        ))}
      </div>

      {/* Quiz keeps an in-game difficulty changer; the curated solo modes don't,
          so the "change later" reassurance would be misleading for them. */}
      {!isCurated && (
        <p className="text-center text-xs text-muted-foreground mt-4">{t("difficulty.changeLater")}</p>
      )}

      <div className="mt-6">
        <NeoButton variant="primary" size="full" disabled={!selected} onClick={handleStart}>
          {t("difficulty.startGame")}
        </NeoButton>
      </div>
    </div>
  );
}
