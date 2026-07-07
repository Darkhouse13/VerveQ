import { useNavigate, useParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { usePreferredDailySport } from "@/hooks/usePreferredDailySport";
import { getTodayUTC, isWorldCupEditionActive } from "../../../convex/lib/daily";
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
const SOLO_KEYS = ["quiz", "survival", "blitz", "higherLower", "verveGrid", "careerPath"];
const FRIEND_KEYS = ["arena", "duel"];

function tilesByKeys(keys: string[]): ModeTile[] {
  return keys
    .map((k) => COMPETE_MODE_TILES.find((t) => t.key === k))
    .filter((t): t is ModeTile => !!t);
}

// Uppercase mono eyebrow, near-black — the section rhythm the mockup leads with.
function SectionLabel({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
        {children}
      </p>
      {hint && (
        <p className="text-[11px] leading-tight text-muted-foreground">{hint}</p>
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
  const dailySurvival = COMPETE_MODE_TILES.find((m) => m.key === "dailySurvival");
  // Window shared with the backend's themed question pool (lib/daily.ts).
  const dailyIsWorldCup = isWorldCupEditionActive(dailySport, getTodayUTC());
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
        {/* Sections carry the vertical rhythm: `space-y-2.5` hugs each label to
            its grid, the outer `gap-5` opens air BETWEEN sections. */}
        <div className="flex flex-col gap-5 pt-1 pb-1">
          {/* RANKED leads — the ONLY modes that move your ELO. Derived from the
              tile `ranked` flag (single source of truth) and rendered as the
              dark hero, so a player can tell at a glance which games count. */}
          {ranked.length > 0 && (
            <section className="space-y-2.5">
              <SectionLabel>{t("compete.sections.ranked")}</SectionLabel>
              <div className="grid grid-cols-1 gap-3">
                {ranked.map((m) => (
                  <RankedModeCard key={m.key} tile={m} sport={sport} onPick={navigate} />
                ))}
              </div>
            </section>
          )}

          {/* Arena & Duels — the "play with friends" surface (larger tiles). */}
          <section className="space-y-2.5">
            <SectionLabel>{t("compete.sections.friends")}</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {friends.map((m) => (
                <ModeTileCard key={m.key} tile={m} sport={sport} onPick={navigate} large />
              ))}
            </div>
          </section>

          {/* Today's hooks — wide strips, same targets as the Home card. Both
              dailies sit together: the quiz and the shared Survival run. */}
          {daily && (
            <NeoCard
              color={daily.color}
              shadow="default"
              className="flex items-center gap-3.5 cursor-pointer rounded-2xl py-3.5"
              onClick={() => navigate(daily.to(dailySport))}
            >
              <div className="neo-border rounded-xl bg-background w-fit p-2.5 shrink-0">
                <daily.icon size={24} strokeWidth={2.5} className="text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-base md:text-lg leading-tight">
                  {dailyIsWorldCup
                    ? t("modes.daily.worldCupName")
                    : t("modes.daily.name")}
                </p>
                <p className="text-[11px] md:text-xs opacity-80 leading-tight mt-0.5">
                  {dailyIsWorldCup
                    ? t("modes.daily.worldCupDesc")
                    : t("modes.daily.desc")}
                </p>
              </div>
              <ChevronRight size={20} strokeWidth={2.5} className="opacity-70 shrink-0" />
            </NeoCard>
          )}
          {dailySurvival && (
            <NeoCard
              color={dailySurvival.color}
              shadow="default"
              className="flex items-center gap-3.5 cursor-pointer rounded-2xl py-3.5 -mt-2"
              onClick={() => navigate(dailySurvival.to(sport))}
            >
              <div className="neo-border rounded-xl bg-background w-fit p-2.5 shrink-0">
                <dailySurvival.icon size={24} strokeWidth={2.5} className="text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-base md:text-lg leading-tight">
                  {t("modes.dailySurvival.name")}
                </p>
                <p className="text-[11px] md:text-xs opacity-80 leading-tight mt-0.5">
                  {t("modes.dailySurvival.desc")}
                </p>
              </div>
              <ChevronRight size={20} strokeWidth={2.5} className="opacity-70 shrink-0" />
            </NeoCard>
          )}

          {/* Casual = solo modes that DON'T touch your rank. Quiz now lives in
              RANKED above, so the derived list keeps it out — no duplication. */}
          <section className="space-y-2.5">
            <SectionLabel hint={t("compete.casualHint")}>
              {t("compete.sections.casual")}
            </SectionLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {casual.map((m) => (
                <ModeTileCard key={m.key} tile={m} sport={sport} onPick={navigate} />
              ))}
            </div>
          </section>

          {/* General knowledge: same server-authoritative Quiz flow, sport
              pinned to "knowledge". Its own section so it reads as a distinct
              category rather than a football mode. */}
          <section className="space-y-2.5">
            <SectionLabel>{t("compete.sections.knowledge")}</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {COMPETE_KNOWLEDGE_TILES.map((m) => (
                <ModeTileCard key={m.key} tile={m} sport={sport} onPick={navigate} />
              ))}
            </div>
          </section>

          {/* The collapsed category step's pointer keeps its home here. */}
          <p className="text-xs text-muted-foreground text-center px-4">
            {t("compete.categoryHint")}
          </p>
        </div>
      </div>
    </ShellLayout>
  );
}

/**
 * A flat mode tile: icon chip top-left (cream, black border), Anton-scale title
 * + one-line subtitle bottom-left. NeoCard's colorMap picks the readable text
 * colour per token (dark on the light yellow tile, white on the rest). `large`
 * gives the "with friends" row its taller hero-ish footprint; the compact
 * default is for casual + general knowledge. Equal heights within a grid row
 * come for free from the grid's default stretch.
 */
function ModeTileCard({
  tile,
  sport,
  onPick,
  large = false,
}: {
  tile: ModeTile;
  sport: string;
  onPick: (to: string) => void;
  large?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <NeoCard
      color={tile.color}
      shadow="default"
      className={cn(
        "flex flex-col cursor-pointer rounded-2xl",
        large ? "min-h-[176px]" : "min-h-[118px]",
      )}
      onClick={() => onPick(tile.to(sport))}
    >
      <div className="neo-border rounded-xl bg-background w-fit p-2 md:p-2.5">
        <tile.icon size={24} strokeWidth={2.5} className="text-foreground" />
      </div>
      <div className="mt-auto pt-3">
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
 * The ranked hero: a dark "prestige" strip in the Profile rank-card family
 * (`bg-foreground` + gold accents), carrying the "counts toward your ELO" pill,
 * so ranked modes read as visibly distinct from — and above — the casual grid.
 * Its offset shadow is one step larger than the tiles' (`lg` vs `default`) to
 * sit it forward in the hierarchy.
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
      shadow="lg"
      className="bg-foreground text-background flex items-center gap-3.5 cursor-pointer rounded-2xl"
      onClick={() => onPick(tile.to(sport))}
    >
      {/* Gold icon chip with a light border — the same treatment as the Profile
          rank card's tier chip, so the two ranked surfaces read as one family. */}
      <div className="neo-border border-background rounded-xl bg-yellow w-fit p-2.5 md:p-3 shrink-0">
        <tile.icon size={26} strokeWidth={2.5} className="text-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        {/* Neo pill, text only — uppercase/mono treatment comes from NeoBadge;
            no emoji or icon (off-brand for the neo-brutalist system). */}
        <NeoBadge color="yellow" className="border-background mb-1.5 whitespace-nowrap">
          {t("compete.rankedBadge")}
        </NeoBadge>
        <p className="font-heading font-bold text-2xl leading-none text-background">
          {t(`modes.${tile.key}.name`)}
        </p>
        <p className="text-[11px] md:text-xs text-background/70 leading-tight mt-1.5">
          {t(`modes.${tile.key}.desc`)}
        </p>
      </div>
      <ChevronRight size={22} strokeWidth={2.5} className="text-yellow shrink-0" />
    </NeoCard>
  );
}
