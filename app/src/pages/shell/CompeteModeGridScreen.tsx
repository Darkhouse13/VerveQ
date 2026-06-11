import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { COMPETE_MODE_TILES, type ModeTile } from "./competeModeTiles";

const LIVE_SPORTS = new Set(["football"]);

// The flat 9-tile grid read as a wall of same-looking games; group the modes
// by how you actually play them. Keys reference COMPETE_MODE_TILES so the
// routing contract (tile targets) stays asserted in one place.
const SOLO_KEYS = ["quiz", "survival", "blitz", "higherLower", "verveGrid", "whoAmI"];
const FRIEND_KEYS = ["arena", "duel"];

function tilesByKeys(keys: string[]): ModeTile[] {
  return keys
    .map((k) => COMPETE_MODE_TILES.find((t) => t.key === k))
    .filter((t): t is ModeTile => !!t);
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * The Compete landing: mode tiles bundled into categories — the daily hook,
 * solo modes, and friend modes. With Sport the only live category and Football
 * the only live sport, the category and sport steps stay collapsed — the
 * COMPETE tab / Home pillar lands here in one step. Every tile routes to an
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

  const daily = COMPETE_MODE_TILES.find((m) => m.key === "daily");
  const solo = tilesByKeys(SOLO_KEYS);
  const friends = tilesByKeys(FRIEND_KEYS);

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
          the top row, like justify-center did) when the sections overflow. */}
      <div className="flex flex-col h-full min-h-0 overflow-y-auto overflow-x-hidden scrollbar-none">
        <div className="flex flex-col gap-3 md:gap-4 my-auto pb-1">
          {/* Today's hook — one wide strip, same target as the Home card. */}
          {daily && (
            <NeoCard
              color={daily.color}
              shadow="lg"
              className="flex items-center gap-3 cursor-pointer py-2.5 md:py-3.5"
              onClick={() => navigate(daily.to(sport))}
            >
              <div className="neo-border rounded-xl bg-background w-fit p-2 md:p-2.5">
                <daily.icon size={22} strokeWidth={2.5} className="text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-sm md:text-base leading-tight">
                  {t("modes.daily.name")}
                </p>
                <p className="text-[11px] md:text-xs opacity-80 leading-tight">
                  {t("modes.daily.desc")}
                </p>
              </div>
              <ChevronRight size={18} strokeWidth={2.5} className="opacity-60 shrink-0" />
            </NeoCard>
          )}

          <SectionLabel>{t("compete.sections.solo")}</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {solo.map((m) => (
              <ModeTileCard key={m.key} tile={m} sport={sport} onPick={navigate} />
            ))}
          </div>

          <SectionLabel>{t("compete.sections.friends")}</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {friends.map((m) => (
              <ModeTileCard key={m.key} tile={m} sport={sport} onPick={navigate} />
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

function ModeTileCard({
  tile,
  sport,
  onPick,
}: {
  tile: ModeTile;
  sport: string;
  onPick: (to: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <NeoCard
      color={tile.color}
      shadow="lg"
      className="flex flex-col gap-2 cursor-pointer min-h-[96px] md:min-h-[118px] py-3 md:py-4"
      onClick={() => onPick(tile.to(sport))}
    >
      <div className="neo-border rounded-xl bg-background w-fit p-2 md:p-2.5">
        <tile.icon size={24} strokeWidth={2.5} className="text-foreground" />
      </div>
      <div className="mt-auto">
        <p className="font-heading font-bold text-sm md:text-base leading-tight">
          {t(`modes.${tile.key}.name`)}
        </p>
        <p className="text-[11px] md:text-xs opacity-80 leading-tight mt-0.5">
          {t(`modes.${tile.key}.desc`)}
        </p>
      </div>
    </NeoCard>
  );
}
