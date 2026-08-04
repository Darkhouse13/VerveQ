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
import { WeekendHeroCard, DrawHeroCard } from "./CompeteHeroCards";
import {
  COMPETE_MODE_TILES,
  COMPETE_KNOWLEDGE_TILES,
  RANKED_MODE_TILES,
  type ModeTile,
} from "./competeModeTiles";

const LIVE_SPORTS = new Set(["football"]);

// Section membership. RANKED and JUST-FOR-FUN are DERIVED from the tile
// `ranked` flag, never hardcoded: SOLO_KEYS is the full solo set and the
// just-for-fun list is SOLO minus anything ranked, so flipping a mode's flag
// (as CR-1 did for Survival) moves it between sections with no edit here.
const SOLO_KEYS = ["quiz", "survival", "blitz", "higherLower", "verveGrid", "careerPath"];
const FRIEND_KEYS = ["arena", "duel"];
// TODAY's two dailies. Both are casual server-side (convex/games.ts rejects
// ranked completion for `dailyDate` runs), so neither can drift into RANKED.
const TODAY_KEYS = ["daily", "dailySurvival"];

// ONE tile spec for every 2-col grid cell (CR-1). Content, not this floor, used
// to set the height, which made rows of unequal height across sections; the
// floor now clears the tallest cell (2-line title + 2-line description) so
// every grid tile on the surface is exactly this tall.
const TILE_MIN_H = "min-h-[150px]";

// ONE icon chip spec, derived from the majority variant on the old surface
// (p-2.5 at 3 of 4 sites, size 24 at 3 of 4). `rounded-lg` is the --radius
// token: this surface no longer uses the off-token rounded-xl/2xl.
const CHIP = "neo-border rounded-lg bg-background w-fit p-2.5 shrink-0";
const CHIP_ICON = 24;

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
 * The Compete landing: a hero tier for the flagship modes, then the mode
 * catalogue grouped by what each mode does to the player — today's dailies,
 * the ranked ladder, friends, just-for-fun, and general knowledge. With Sport
 * the only live category and Football the only live sport, the category and
 * sport steps stay collapsed — the COMPETE tab / Home pillar lands here in one
 * step. Every tile routes to an EXISTING mode deep link — the shell never
 * reimplements a mode.
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

  // Window shared with the backend's themed question pool (lib/daily.ts).
  const dailyIsWorldCup = isWorldCupEditionActive(dailySport, getTodayUTC());
  const today = tilesByKeys(TODAY_KEYS);
  const ranked = RANKED_MODE_TILES;
  const friends = tilesByKeys(FRIEND_KEYS);
  // Just for fun = the solo set MINUS anything ranked — derived from the flag,
  // so Quiz and Survival stay out and the "doesn't affect your rank" sub-line
  // below stays true by construction.
  const justForFun = tilesByKeys(SOLO_KEYS).filter((m) => !m.ranked);

  // Each daily's launch target: the daily quiz follows the user's preferred
  // subject, everything else carries the grid's sport.
  const targetFor = (m: ModeTile) =>
    m.key === "daily" ? m.to(dailySport) : m.to(sport);

  const titleFor = (m: ModeTile) =>
    m.key === "daily" && dailyIsWorldCup
      ? t("modes.daily.worldCupName")
      : t(`modes.${m.key}.name`);

  const descFor = (m: ModeTile) =>
    m.key === "daily" && dailyIsWorldCup
      ? t("modes.daily.worldCupDesc")
      : t(`modes.${m.key}.desc`);

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
          sections overflow a short viewport.

          `px-2 -mx-2` is the CR-0 clip fix. A scroll container cannot have
          overflow-y:auto with overflow-x:visible (CSS computes the other axis
          to auto), so the horizontal clip is unavoidable here — the cure is to
          move the clip edge outboard of the content. The 8px padding clears the
          largest offset shadow on the surface (6px, neo-shadow-lg) and the
          equal negative margin gives the width straight back, so the content
          column is byte-identical and every card's shadow renders in full.
          8px also stays well inside `main`'s own px-5/md:px-8, which is the
          next clipping ancestor. */}
      <div className="flex flex-col h-full min-h-0 overflow-y-auto overflow-x-hidden scrollbar-none px-2 -mx-2">
        {/* Sections carry the vertical rhythm: `space-y-2.5` hugs each label to
            its grid, the outer `gap-5` opens air BETWEEN sections. `pb-2`
            leaves room for the last row's bottom shadow at full scroll. */}
        <div className="flex flex-col gap-5 pt-1 pb-2">
          {/* HERO TIER — the flagship modes, no section label. THE DRAW renders
              only under its build flag, so it is absent on prod. */}
          <div className="flex flex-col gap-3">
            <WeekendHeroCard />
            <DrawHeroCard />
          </div>

          {/* TODAY — the daily hooks, same targets as the Home cards. */}
          {today.length > 0 && (
            <section className="space-y-2.5">
              <SectionLabel>{t("compete.sections.today")}</SectionLabel>
              <div className="grid grid-cols-1 gap-3">
                {today.map((m) => (
                  <RowModeCard
                    key={m.key}
                    tile={m}
                    title={titleFor(m)}
                    desc={descFor(m)}
                    onPick={() => navigate(targetFor(m))}
                  />
                ))}
              </div>
            </section>
          )}

          {/* RANKED — the ONLY modes that move your ELO. Derived from the tile
              `ranked` flag (single source of truth) and rendered as the dark
              hero treatment, so a player can tell at a glance which games
              count. */}
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

          {/* Arena & Duels — the "play with friends" surface. */}
          <section className="space-y-2.5">
            <SectionLabel>{t("compete.sections.friends")}</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {friends.map((m) => (
                <ModeTileCard key={m.key} tile={m} sport={sport} onPick={navigate} />
              ))}
            </div>
          </section>

          {/* Just for fun = solo modes that DON'T touch your rank. Quiz and
              Survival live in RANKED above, so the derived list keeps them out
              — no duplication, and the sub-line is honest. */}
          <section className="space-y-2.5">
            <SectionLabel hint={t("compete.casualHint")}>
              {t("compete.sections.casual")}
            </SectionLabel>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {justForFun.map((m) => (
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
 * A 2-col grid tile: icon chip top-left, title + one-line description anchored
 * bottom. One spec for every grid section — the old `large` variant gave Arena
 * and Duels a 176px box whose middle was empty, so it is gone; equal heights
 * come from `TILE_MIN_H` plus the grid's default stretch.
 */
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
      shadow="default"
      className={cn("flex flex-col cursor-pointer", TILE_MIN_H)}
      onClick={() => onPick(tile.to(sport))}
    >
      <div className={CHIP}>
        <tile.icon size={CHIP_ICON} strokeWidth={2.5} className="text-foreground" />
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
 * A full-width row card — the TODAY tier. Icon chip, title + description, and a
 * chevron. Takes its copy pre-resolved because the daily quiz swaps to World
 * Cup strings inside its themed window.
 */
function RowModeCard({
  tile,
  title,
  desc,
  onPick,
}: {
  tile: ModeTile;
  title: string;
  desc: string;
  onPick: () => void;
}) {
  return (
    <NeoCard
      color={tile.color}
      shadow="default"
      className="flex items-center gap-3.5 cursor-pointer"
      onClick={onPick}
    >
      <div className={CHIP}>
        <tile.icon size={CHIP_ICON} strokeWidth={2.5} className="text-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-bold text-base md:text-lg leading-tight">
          {title}
        </p>
        <p className="text-[11px] md:text-xs opacity-80 leading-tight mt-0.5">
          {desc}
        </p>
      </div>
      <ChevronRight size={20} strokeWidth={2.5} className="opacity-70 shrink-0" />
    </NeoCard>
  );
}

/**
 * The ranked tier: a dark "prestige" row in the Profile rank-card family
 * (`bg-foreground` + gold accents), carrying the "counts toward your ELO" pill,
 * so ranked modes read as visibly distinct from — and above — the rest of the
 * catalogue. Its offset shadow is one step larger than the tiles' (`lg` vs
 * `default`) to sit it forward in the hierarchy.
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
      className="bg-foreground text-background flex items-center gap-3.5 cursor-pointer"
      onClick={() => onPick(tile.to(sport))}
    >
      {/* Gold icon chip with a light border — the same treatment as the Profile
          rank card's tier chip, so the two ranked surfaces read as one family. */}
      <div className={cn(CHIP, "border-background bg-yellow")}>
        <tile.icon size={CHIP_ICON} strokeWidth={2.5} className="text-foreground" />
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
