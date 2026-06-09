import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ShellNav, ShellTopNav } from "./ShellNav";

interface ShellLayoutProps {
  /** Optional eyebrow title rendered in the header. */
  title?: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Show a back affordance in the header (defaults to history back). */
  back?: boolean;
  /** Override the back handler; defaults to `navigate(-1)`. */
  onBack?: () => void;
  /** Slot rendered at the header's right edge (e.g. avatar, language). */
  headerRight?: ReactNode;
  /** Hide the persistent nav (mobile bottom bar / desktop top tabs). */
  hideNav?: boolean;
  /** Theme container class — e.g. `theme-learn` to apply the WARM palette. */
  theme?: string;
  /** Center the main content within its max width on desktop. */
  center?: boolean;
  /**
   * Embed an existing (legacy) screen inside the shell chrome: keeps the v2 nav
   * but lets the body scroll on desktop too (legacy screens are mobile-first and
   * taller than the viewport) and drops the horizontal padding so the embedded
   * screen keeps its own. Use for containment wrappers around v1 screens.
   */
  embed?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Shared chrome for every v2-shell screen, implementing the prototype's
 * never-scroll discipline:
 *
 *  - Mobile: lives in normal flow inside App's `max-w-md` column and scrolls
 *    vertically; the bottom nav is fixed and content clears it via padding.
 *  - Desktop (md+): breaks out to `fixed inset-0` to fill the whole viewport
 *    (escaping the `max-w-md` wrapper), the header and nav are fixed-height,
 *    and `main` fills the remaining space with `overflow-hidden` — the page
 *    never scrolls. Screens lay their content out to fit.
 */
export function ShellLayout({
  title,
  subtitle,
  back,
  onBack,
  headerRight,
  hideNav = false,
  theme,
  center = false,
  embed = false,
  className,
  children,
}: ShellLayoutProps) {
  const navigate = useNavigate();

  return (
    <div
      className={cn(
        theme,
        "relative min-h-[100dvh] w-full bg-background text-foreground",
        // Desktop: fill the viewport and never scroll.
        "md:fixed md:inset-0 md:z-40 md:min-h-0 md:h-[100dvh] md:overflow-hidden",
        "flex flex-col",
      )}
    >
      {!hideNav && <ShellTopNav />}

      {(title || back || headerRight) && (
        <header className="shrink-0 w-full">
          <div
            className={cn(
              "mx-auto w-full max-w-md md:max-w-6xl",
              "flex items-center gap-3 px-5 pt-5 pb-3 md:px-8 md:pt-6",
            )}
          >
            {back && (
              <button
                type="button"
                onClick={onBack ?? (() => navigate(-1))}
                aria-label="Back"
                className="neo-border neo-shadow rounded-lg bg-card p-2 shrink-0 transition-all active:neo-shadow-pressed"
              >
                <ArrowLeft size={20} strokeWidth={2.5} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              {title && (
                <h1 className="font-heading font-bold text-xl md:text-2xl truncate">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs md:text-sm text-muted-foreground truncate">
                  {subtitle}
                </p>
              )}
            </div>
            {headerRight && <div className="shrink-0">{headerRight}</div>}
          </div>
        </header>
      )}

      <main
        className={cn(
          "flex-1 w-full mx-auto",
          embed
            ? // Embedded legacy screen: keep the mobile column width centered,
              // let it scroll on desktop too, and let the screen own its padding.
              "max-w-md overflow-y-auto scrollbar-none"
            : [
                "max-w-md md:max-w-6xl px-5 md:px-8",
                // Mobile scrolls and clears the fixed bottom nav; desktop never scrolls.
                "overflow-y-auto scrollbar-none md:overflow-hidden",
              ],
          hideNav ? "pb-8" : embed ? "pb-28 md:pb-10" : "pb-28 md:pb-6",
          center && "flex flex-col justify-center",
          className,
        )}
      >
        {children}
      </main>

      {!hideNav && <ShellNav />}
    </div>
  );
}
