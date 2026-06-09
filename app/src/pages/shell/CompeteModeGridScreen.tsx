import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Brain, Heart, Zap, TrendingUp, Grid3X3, HelpCircle, Timer, Radio, Swords,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

type NeoColor = "primary" | "accent" | "blue" | "pink" | "yellow" | "success";

interface ModeTile {
  key: string;
  icon: LucideIcon;
  color: NeoColor;
  /** Builds the EXISTING, proven deep link for the chosen sport. */
  to: (sport: string) => string;
}

// These targets are exactly what the existing sport-select produces for a sport,
// so the grid skips the redundant sport re-pick and lands directly in each mode.
const MODES: ModeTile[] = [
  // Quiz is migrated to the v2 shell's centered-column "prototype layout". It
  // routes through the existing difficulty picker (target=v2) so the player
  // chooses a difficulty rather than defaulting to intermediate.
  { key: "quiz", icon: Brain, color: "accent", to: (s) => `/difficulty?sport=${s}&mode=quiz&target=v2` },
  // Arena routes through the Challenge hub (create/join) embedded in the shell
  // (v2 nav retained); creating/joining lands in the shell Arena prototype layout.
  { key: "arena", icon: Swords, color: "pink", to: () => SHELL_ROUTES.duels },
  // Survival + Blitz are migrated to the shell prototype layout (solo).
  { key: "survival", icon: Heart, color: "primary", to: (s) => `/v2/survival?sport=${s}` },
  { key: "blitz", icon: Zap, color: "pink", to: (s) => `/v2/blitz?sport=${s}` },
  // Higher/Lower + Who Am I are migrated to the shell prototype layout (solo).
  { key: "higherLower", icon: TrendingUp, color: "success", to: (s) => `/v2/higher-lower?sport=${s}` },
  // VerveGrid is migrated to the bespoke v2 GridStage (solo) over the existing backend.
  { key: "verveGrid", icon: Grid3X3, color: "blue", to: (s) => `/v2/verve-grid?sport=${s}` },
  { key: "whoAmI", icon: HelpCircle, color: "yellow", to: (s) => `/v2/who-am-i?sport=${s}` },
  // Daily is migrated to the shell — reuses the Quiz prototype layout via the DAILY session.
  { key: "daily", icon: Timer, color: "primary", to: (s) => `/v2/daily?sport=${s}` },
  // Live Match (1v1 realtime) is migrated to the shell prototype layout (Arena
  // pattern) over the existing backend. The screen resolves the active match
  // (created via the untouched Challenge matchmaking flow) or guides there.
  { key: "liveMatch", icon: Radio, color: "blue", to: () => `/v2/live-match` },
];

const LIVE_SPORTS = new Set(["football"]);

/**
 * Compete → sport → mode grid. Football only for this pass. Every tile routes to
 * an EXISTING mode deep link — the shell never reimplements a mode.
 */
export default function CompeteModeGridScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { sport = "football" } = useParams<{ sport: string }>();

  // Only football is live; anything else falls back to the sport step.
  if (!LIVE_SPORTS.has(sport)) {
    return <Navigate to={SHELL_ROUTES.competeSport} replace />;
  }

  return (
    <ShellLayout
      title={t(`compete.sports.${sport}`, { defaultValue: sport })}
      subtitle={t("compete.modeGridHint", {
        sport: t(`compete.sports.${sport}`, { defaultValue: sport }),
      })}
      back
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:h-full md:content-center">
        {MODES.map((m) => (
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
    </ShellLayout>
  );
}
