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
 *  - ALL devices: `fixed inset-0` — the page itself never scrolls. On mobile
 *    the bottom nav is an in-flow row at the foot of the column and `main`
 *    gets exactly the space between header and nav; screens lay their content
 *    out to fit. `main` keeps a vertical-scroll safety valve for content that
 *    can't fit very short viewports (and for `embed`ded legacy screens), with
 *    overflow-x always clipped so pressed-state translates never spawn a
 *    horizontal scrollbar.
 *  - Desktop (md+): the header and top nav are fixed-height and `main` is
 *    `overflow-hidden` — never scrolls.
 *  - Large desktop (xl+): the header + main group is additionally bounded to a
 *    laptop-equivalent height and vertically centered, so tall monitors get a
 *    proportioned canvas instead of content stretched to fill the viewport.
 *    The cap only bites on tall viewports — short xl windows are unchanged.
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
        "w-full bg-background text-foreground shell-canvas-bg",
        // Fill the viewport and never scroll — on every device.
        "fixed inset-0 z-40 h-[100dvh] overflow-hidden",
        "flex flex-col",
      )}
    >
      {!hideNav && <ShellTopNav />}

      {/* Desktop canvas group: `contents` is a no-op below xl, keeping those
          layouts byte-identical; at xl+ it becomes the bounded, centered
          flex column the header and main lay out inside. */}
      <div className="contents xl:flex xl:flex-col xl:w-full xl:flex-1 xl:min-h-0 xl:max-h-[50rem] xl:my-auto">
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
          "flex-1 min-h-0 w-full mx-auto",
          embed
            ? // Embedded legacy screen: keep the mobile column width centered,
              // let it scroll internally on every device (the page stays
              // fixed), and let the screen own its padding.
              "max-w-md overflow-y-auto overflow-x-hidden scrollbar-none"
            : [
                "max-w-md md:max-w-6xl px-5 md:px-8",
                // Internal vertical valve for content that can't fit a very
                // short viewport; desktop never scrolls. Horizontal overflow
                // is always clipped (pressed-state translate).
                "overflow-y-auto overflow-x-hidden scrollbar-none md:overflow-hidden",
              ],
          hideNav ? "pb-8" : embed ? "pb-4 md:pb-10" : "pb-4 md:pb-6",
          center && "flex flex-col justify-center",
          className,
        )}
      >
        {children}
      </main>
      </div>

      {!hideNav && <ShellNav />}
    </div>
  );
}
