/**
 * Compete hero tier (CR-1) — the two flagship cards above the mode sections.
 *
 * Both are full-width, near-black, lime-typed cards in the Profile rank-card /
 * HomeWeekendTeaser family, so the top of Compete reads as "the big things"
 * before the mode catalogue starts. Neither carries a section label — the tier
 * IS the label.
 *
 * THE WEEKEND has no route of its own: the pre-launch surface is the Home
 * teaser component (components/weekend/HomeWeekendTeaser), which is a card, not
 * a screen. So the tile opens that exact component inside a dialog rather than
 * navigating — one waitlist implementation, one set of analytics events, no
 * fork.
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
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarRange, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoBadge } from "@/components/neo/NeoBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DRAW_ENABLED } from "@/lib/flags";
import { HomeWeekendTeaser } from "@/components/weekend/HomeWeekendTeaser";

/**
 * The shared flagship shell. `bg-foreground` + `text-accent` is the ranked-card
 * palette one step louder; the title uses the HomeWeekendTeaser display ramp
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
 * THE WEEKEND — opens the Home waitlist teaser in a dialog.
 *
 * The teaser owns its identity split (one-tap for signed-in users, email
 * capture for anonymous ones), its analytics, and its failure behaviour; this
 * component only provides the container.
 */
export function WeekendHeroCard() {
  const [open, setOpen] = useState(false);

  // Radix puts pointer-events:none on <body> while a dialog is open; an abrupt
  // teardown mid-open can strand it and eat every click for the session. Same
  // insurance as FirstRunLanguagePrompt.
  useEffect(
    () => () => {
      document.body.style.removeProperty("pointer-events");
    },
    [],
  );

  return (
    <>
      <HeroCard
        icon={CalendarRange}
        eyebrow="New mode"
        title="The Weekend"
        sub="Draft the whole European football weekend."
        badge={
          <NeoBadge color="accent" className="border-background shrink-0">
            Late August
          </NeoBadge>
        }
        onClick={() => setOpen(true)}
        testId="compete-hero-weekend"
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="neo-border neo-shadow-lg bg-card max-w-lg p-4 md:p-5">
          <DialogHeader className="sr-only">
            <DialogTitle>The Weekend</DialogTitle>
            <DialogDescription>
              Join the waitlist for THE WEEKEND, the upcoming fantasy football
              mode.
            </DialogDescription>
          </DialogHeader>
          <WeekendSheetBody />
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Dialog body: the real teaser, plus a fallback for the case where it renders
 * nothing.
 *
 * The teaser is runtime-gated and fails silent — it returns null until
 * `fantasyWaitlist.getTeaserStatus` answers, and forever if the waitlist
 * backend is undeployed. On Home that is invisible (the card just isn't
 * there); in a dialog the user has explicitly asked for it, so an empty sheet
 * would be a dead end.
 *
 * The teaser exposes no "I am visible" signal, so the fallback is hidden
 * declaratively instead: the sibling combinator below hides anything following
 * the teaser's root once that root exists. No polling, no timing race.
 */
function WeekendSheetBody() {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="[&>[data-testid=home-weekend-teaser]~*]:hidden">
      <HomeWeekendTeaser />
      <div data-testid="weekend-sheet-fallback">
        <p className="font-heading font-black uppercase text-2xl leading-none">
          The Weekend
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {waited
            ? "The waitlist isn't open yet. It kicks off with the season — late August."
            : "Loading the waitlist…"}
        </p>
      </div>
    </div>
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
