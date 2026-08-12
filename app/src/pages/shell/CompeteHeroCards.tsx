/**
 * Compete hero tier (CR-1) — the two flagship cards above the mode sections.
 *
 * Both are full-width, near-black, lime-typed cards in the Profile rank-card /
 * HomeWeekendCard family, so the top of Compete reads as "the big things"
 * before the mode catalogue starts. Neither carries a section label — the tier
 * IS the label.
 *
 * THE WEEKEND is LIVE (FW-GO): the card navigates straight to the mode's hub.
 * The pre-launch waitlist dialog this card used to open shipped with FW-P1 and
 * was retired at launch along with the `waitlist_*` events.
 *
 * THE DRAW reuses HomeDrawCard's build-flag gate verbatim: with DRAW_ENABLED
 * off the inner component never mounts — no hooks, no layout slot — so the tile
 * is absent from prod, where `VITE_DRAW_ENABLED` is deliberately not exported
 * (docs/DEPLOYMENT.md). The mode's second gate (drawSettings.enabled /
 * requireDrawUser) continues to guard /draw itself; this card only decides
 * whether an entry point is advertised.
 *
 * Copy is English-only, matching the Draw and Weekend surfaces it fronts.
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarRange, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { DRAW_ENABLED } from "@/lib/flags";
import { track } from "@/lib/analytics";
import { SHELL_ROUTES } from "@/lib/shellRoutes";

/**
 * The shared flagship shell. `bg-foreground` + `text-accent` is the ranked-card
 * palette one step louder; the title uses the HomeWeekendCard display ramp
 * (34px → 42px) so the Compete tile and the surface it opens read as one thing.
 */
function HeroCard({
  icon: Icon,
  eyebrow,
  title,
  sub,
  badge,
  onClick,
  testId,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  sub: string;
  /** Optional right-aligned pill. Only THE WEEKEND carries one (its ship window). */
  badge?: ReactNode;
  onClick: () => void;
  testId: string;
}) {
  return (
    <NeoCard
      shadow="lg"
      className="bg-foreground text-background flex flex-col cursor-pointer"
      onClick={onClick}
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-accent flex items-center gap-1.5 min-w-0">
          <Icon size={12} strokeWidth={3} className="shrink-0" />
          <span className="truncate">{eyebrow}</span>
        </p>
        {badge}
      </div>
      <p className="font-heading font-black uppercase leading-[0.95] text-[34px] md:text-[42px] text-accent mt-2">
        {title}
      </p>
      <p className="font-heading font-bold text-base md:text-lg leading-tight mt-2">
        {sub}
      </p>
    </NeoCard>
  );
}

/**
 * THE WEEKEND — navigates to the mode's hub (FW-GO: launched).
 *
 * `weekend_entry_clicked` is the entry-funnel event (a real tap, per
 * ANALYTICS.md — landing on the hub route itself fires nothing).
 */
export function WeekendHeroCard() {
  const navigate = useNavigate();
  return (
    <HeroCard
      icon={CalendarRange}
      eyebrow="New mode"
      title="The Weekend"
      sub="Eight leagues, one squad."
      badge={
        <NeoBadge color="accent" className="border-background shrink-0">
          Live
        </NeoBadge>
      }
      onClick={() => {
        track("weekend_entry_clicked", { source: "compete_hero", placement: "compete_hero" });
        navigate(SHELL_ROUTES.weekend);
      }}
      testId="compete-hero-weekend"
    />
  );
}

/** Build-flag half of the Draw gate — mirrors HomeDrawCard's outer shell. */
export function DrawHeroCard() {
  if (!DRAW_ENABLED) return null;
  return <DrawHeroCardInner />;
}

function DrawHeroCardInner() {
  const navigate = useNavigate();
  return (
    <HeroCard
      icon={Layers}
      eyebrow="New mode"
      title="The Draw"
      sub="Today's live draft — one board, everyone."
      onClick={() => navigate("/draw")}
      testId="compete-hero-draw"
    />
  );
}
