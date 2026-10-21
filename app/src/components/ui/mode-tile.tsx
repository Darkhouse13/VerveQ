import { forwardRef, type ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, type CardElevation } from "./card";

/**
 * The mode accents (VerveQ ONE decision 12). A mode keeps one color
 * everywhere it appears:
 *
 *   blue    Who's Older, Higher or Lower
 *   pink    Missing Letters, Duels, Arena
 *   yellow  Daily Quiz, Daily Survival, Blitz
 *   orange  Career Path, Quiz, Survival, VerveGrid
 *   outline THE WEEKEND, THE DRAW — a lime outline, no fill: their identity
 *           is the pitch and the card art, and lime stays free for the action
 *   surface anything that is not a mode (The Forge, settings-like entries)
 *
 * Fills carry ink text (white fails AA on every one of them). Lime is never a
 * fill here.
 */
export type ModeAccent = "blue" | "pink" | "yellow" | "orange" | "outline" | "surface";

const FILL: Record<ModeAccent, string> = {
  blue: "bg-electric-blue text-ink on-fill",
  pink: "bg-hot-pink text-ink on-fill",
  yellow: "bg-yellow text-ink on-fill",
  orange: "bg-orange text-ink on-fill",
  outline: "bg-card text-card-foreground !border-lime",
  surface: "bg-card text-card-foreground",
};

const FILLED: ReadonlySet<ModeAccent> = new Set(["blue", "pink", "yellow", "orange"]);

export interface ModeTileProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children" | "name"> {
  icon: LucideIcon;
  /** The mode's name. */
  name: ReactNode;
  /** One line about the mode. */
  line?: ReactNode;
  /** Today's state when known (a score, "Played", a streak); omitted otherwise. */
  status?: ReactNode;
  mode: ModeAccent;
  /** `stack`: icon over name (grid tiles). `row`: icon · name · chevron (lists). */
  layout?: "stack" | "row";
  elevation?: CardElevation;
}

/**
 * ModeTile — the one way a game mode is offered: icon, name, one line and an
 * optional status, on the mode's accent. Renders a real button.
 */
const ModeTile = forwardRef<HTMLButtonElement, ModeTileProps>(
  ({ icon: Icon, name, line, status, mode, layout = "stack", elevation = "raised", className, ...props }, ref) => {
    const filled = FILLED.has(mode);
    const statusChip =
      status != null && status !== false ? (
        <span
          className={cn(
            "inline-flex w-fit max-w-full items-center gap-1 rounded-full px-2 py-0.5 font-mono text-eyebrow font-bold uppercase",
            filled ? "bg-ink text-cream" : "bg-muted text-foreground",
          )}
          data-slot="mode-tile-status"
        >
          {status}
        </span>
      ) : null;

    if (layout === "row") {
      return (
        <Card
          ref={ref}
          interactive
          elevation={elevation}
          padding="md"
          className={cn(FILL[mode], "flex items-center gap-3.5", className)}
          {...props}
        >
          <Icon size={24} strokeWidth={2.5} className="shrink-0" aria-hidden />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-heading text-title-sm font-bold leading-tight">{name}</span>
            {line != null && <span className="text-meta text-muted-foreground">{line}</span>}
            {statusChip && <span className="mt-1">{statusChip}</span>}
          </span>
          <ChevronRight size={20} strokeWidth={2.5} className="shrink-0" aria-hidden />
        </Card>
      );
    }

    return (
      <Card
        ref={ref}
        interactive
        elevation={elevation}
        padding="md"
        className={cn(FILL[mode], "flex flex-col gap-1.5", className)}
        {...props}
      >
        <Icon size={24} strokeWidth={2.5} className="shrink-0" aria-hidden />
        <span className="mt-auto flex min-w-0 flex-col gap-1">
          <span className="font-heading text-title-sm font-bold leading-tight">{name}</span>
          {line != null && <span className="text-meta leading-snug text-muted-foreground">{line}</span>}
          {statusChip}
        </span>
      </Card>
    );
  },
);
ModeTile.displayName = "ModeTile";

export { ModeTile };
