/**
 * ThemeScope — carries a surface's palette into its portalled overlays.
 *
 * Radix portals mount under document.body, outside the `.theme-*` container
 * that set the palette, so a sheet opened on THE WEEKEND used to render cream
 * unless someone hand-added `theme-weekend` to it. The frames that apply a
 * theme (ShellLayout, PlayStage, LearnShell) now also provide it here, and the
 * overlay primitives in this folder put it back on their portalled content.
 * React context flows through portals, so a sheet opened inside a themed
 * dialog inherits the dialog's theme too.
 *
 * Only PALETTE classes travel. `.theme-draw` is a scoping prefix for a handful
 * of opt-in draw surfaces (draw.css), not a palette, so it stays behind.
 */
import { createContext, useContext, type ReactNode } from "react";

/** Theme classes that redefine the colour tokens (src/index.css). */
const CARRIED = /^theme-(?:ink|weekend|older|letters|learn|paper)$/;

/** The carried palette classes in `className`, or null when there are none. */
// eslint-disable-next-line react-refresh/only-export-components
export function paletteClasses(className: string | null | undefined): string | null {
  if (!className) return null;
  const found = className.split(/\s+/).filter((c) => CARRIED.test(c));
  return found.length > 0 ? found.join(" ") : null;
}

const ThemeScopeContext = createContext<string | null>(null);

export function ThemeScope({
  theme,
  children,
}: {
  /** The frame's theme class(es); non-palette classes are ignored. */
  theme: string | null | undefined;
  children: ReactNode;
}) {
  const outer = useContext(ThemeScopeContext);
  // An unthemed frame keeps whatever an enclosing scope set.
  const value = paletteClasses(theme) ?? outer;
  return <ThemeScopeContext.Provider value={value}>{children}</ThemeScopeContext.Provider>;
}

/**
 * The palette an overlay opened here should wear. Falls back to the DOM when
 * no frame provided one: the element that had focus when the overlay opened
 * (the trigger, on desktop) and its nearest themed ancestor.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useThemeScope(): string | null {
  return useContext(ThemeScopeContext);
}

// eslint-disable-next-line react-refresh/only-export-components
export function themeFromFocus(): string | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  if (!(active instanceof Element)) return null;
  const host = active.closest('[class*="theme-"]');
  return host ? paletteClasses(host.getAttribute("class")) : null;
}
