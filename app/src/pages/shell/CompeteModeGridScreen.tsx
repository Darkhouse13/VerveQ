import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { usePreferredDailySport } from "@/hooks/usePreferredDailySport";
import {
  COMPETE_MODE_TILES,
  COMPETE_KNOWLEDGE_TILES,
  RANKED_MODE_TILES,
  type ModeTile,
} from "./competeModeTiles";

const LIVE_SPORTS = new Set(["football"]);

// The flat 9-tile grid read as a wall of same-looking games. Group modes by how
// they affect the player: RANKED modes (move your ELO) lead, then social, then
// casual. SOLO_KEYS is the full solo set; the CASUAL section is DERIVED as SOLO
// minus any ranked tile, so it stays correct (and Quiz stays out of it) if the
// `ranked` flag changes — no ranked key is hardcoded here. Keys reference
// COMPETE_MODE_TILES so the routing contract (tile targets) stays asserted in
// one place.
const SOLO_KEYS = ["quiz", "survival", "blitz", "higherLower", "verveGrid", "whoAmI"];
const FRIEND_KEYS = ["arena", "duel"];

function tilesByKeys(keys: string[]): ModeTile[] {
  return keys
    .map((k) => COMPETE_MODE_TILES.find((t) => t.key === k))
    .filter((t): t is ModeTile => !!t);
}

function SectionLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {children}
      </p>
      {hint && (
        <p className="text-[11px] leading-tight text-muted-foreground/80">{hint}</p>
      )}
    </div>
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
  // Daily is subject-agnostic (not tied to this grid's football scope): launch
  // the user's preferred subject, matching the Home daily card. Declared before
  // the early return below to satisfy the rules of hooks.
  const dailySport = usePreferredDailySport();

  // Only football is live; anything else falls back to the compete landing
  // (which defaults to football). Param-less /compete never hits this.
  if (!LIVE_SPORTS.has(sport)) {
    return <Navigate to={SHELL_ROUTES.compete} replace />;
  }

  const daily = COMPETE_MODE_TILES.find((m) => m.key === "daily");
  const ranked = RANKED_MODE_TILES;
  const friends = tilesByKeys(FRIEND_KEYS);
  // Casual = the solo set MINUS anything ranked — derived from the flag so it
  // stays correct (and Quiz drops out of here) if `ranked` ever changes.
  const casual = tilesByKeys(SOLO_KEYS).filter((m) => !m.ranked);

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
      {/* Top-aligned under the heading — no auto-margin centering (it opened a
          dead band on tall screens). The valve below scrolls only if the
          sections overflow a short viewport. */}
      <div className="flex flex-col h-full min-h-0 overflow-y-auto overflow-x-hidden scrollbar-none">
        <div className="flex flex-col gap-3 md:gap-4 pt-1 pb-1">
          {/* RANKED leads — the ONLY modes that move your ELO. Derived from the
              tile `ranked` flag (single source of truth) and emphasized, so a
              player can tell at a glance which games count. */}
          {ranked.length > 0 && (
            <>
              <SectionLabel>{t("compete.sections.ranked")}</SectionLabel>
              <div className="grid grid-cols-1 gap-3">
                {ranked.map((m) => (
                  <RankedModeCard key={m.key} tile={m} sport={sport} onPick={navigate} />
                ))}
              </div>
            </>
          )}

          {/* Arena & Duels — the "play with friends" surface. */}
          <SectionLabel>{t("compete.sections.friends")}</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {friends.map((m) => (
              <ModeTileCard key={m.key} tile={m} sport={sport} onPick={navigate} />
            ))}
          </div>

          {/* Today's hook — one wide strip, same target as the Home card. */}
          {daily && (
            <NeoCard
              color={daily.color}
              shadow="lg"
              className="flex items-center gap-3 cursor-pointer py-2.5 md:py-3.5"
              onClick={() => navigate(daily.to(dailySport))}
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

          {/* Casual = solo modes that DON'T touch your rank. Quiz now lives in
              RANKED above, so the derived list keeps it out — no duplication. */}
          <SectionLabel hint={t("compete.casualHint")}>
            {t("compete.sections.casual")}
          </SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {casual.map((m) => (
              <ModeTileCard key={m.key} tile={m} sport={sport} onPick={navigate} />
            ))}
          </div>

          {/* General knowledge: same server-authoritative Quiz flow, sport
              pinned to "knowledge". Its own section so it reads as a distinct
              category rather than a football mode. */}
          <SectionLabel>{t("compete.sections.knowledge")}</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {COMPETE_KNOWLEDGE_TILES.map((m) => (
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

/**
 * The emphasized ranked tile: a wide strip carrying the "counts toward your
 * ELO" badge, so ranked modes read as visibly distinct from the casual grid.
 */
function RankedModeCard({
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
      className="flex items-center gap-3 cursor-pointer py-3.5 md:py-4"
      onClick={() => onPick(tile.to(sport))}
    >
      <div className="neo-border rounded-xl bg-background w-fit p-2.5 md:p-3 shrink-0">
        <tile.icon size={26} strokeWidth={2.5} className="text-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Neo pill, text only — uppercase/mono treatment comes from NeoBadge;
            no emoji or icon (off-brand for the neo-brutalist system). */}
        <NeoBadge color="yellow" className="mb-1 whitespace-nowrap">
          {t("compete.rankedBadge")}
        </NeoBadge>
        <p className="font-heading font-bold text-base md:text-lg leading-tight">
          {t(`modes.${tile.key}.name`)}
        </p>
        <p className="text-[11px] md:text-xs opacity-80 leading-tight mt-0.5">
          {t(`modes.${tile.key}.desc`)}
        </p>
      </div>
      <ChevronRight size={20} strokeWidth={2.5} className="opacity-60 shrink-0" />
    </NeoCard>
  );
}
