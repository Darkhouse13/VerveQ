/**
 * Sheet — the bottom sheet (VerveQ ONE P1.4). One component for what used to
 * be WeekendSheet, DrawSheet and six raw-Radix copies of them.
 *
 * Bottom-anchored, phone-column wide (max-w-sm), house header (eyebrow,
 * title, badge, 44px close), body scrolls inside 80dvh. `mdCenter` turns it
 * into a centred panel from md up (the Grid search sheet, the Arena help).
 * The theme of the surface it opened from rides along (ui/theme-scope).
 *
 * Layout overrides go through `className` (tailwind-merge): e.g.
 * `gap-3 max-h-[70dvh] overflow-y-visible` for a sheet whose list scrolls on
 * its own. A sheet that needs its own header passes `header` and renders a
 * `SheetTitle` inside it.
 */
import * as React from "react";

import {
  OverlayClose,
  OverlayContent,
  OverlayDescription,
  OverlayHeader,
  OverlayRoot,
  OverlayTitle,
} from "./overlay";

export const SheetTitle = OverlayTitle;
export const SheetDescription = OverlayDescription;
export const SheetClose = OverlayClose;

type ContentProps = Omit<
  React.ComponentPropsWithoutRef<typeof OverlayContent>,
  "variant" | "title" | "children"
>;

export interface SheetProps extends ContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The sheet's accessible name; shown in the house header. */
  title?: React.ReactNode;
  /** Mono uppercase line above the title. */
  eyebrow?: React.ReactNode;
  /** Right-aligned chip next to the close target (e.g. a price). */
  badge?: React.ReactNode;
  /** Visible supporting line, wired as the accessible description. */
  description?: React.ReactNode;
  /** Replaces the house header; must render a `SheetTitle`. */
  header?: React.ReactNode;
  hideClose?: boolean;
  closeLabel?: string;
  closeTestId?: string;
  titleClassName?: string;
  testId?: string;
  children: React.ReactNode;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  eyebrow,
  badge,
  description,
  header,
  hideClose,
  closeLabel,
  closeTestId,
  titleClassName,
  testId,
  children,
  ...contentProps
}: SheetProps) {
  return (
    <OverlayRoot open={open} onOpenChange={onOpenChange}>
      <OverlayContent
        variant="sheet"
        data-testid={testId}
        // Radix warns when no Description is wired; most sheets have none.
        {...(description === undefined ? { "aria-describedby": undefined } : {})}
        {...contentProps}
      >
        {header ?? (
          <OverlayHeader
            title={title}
            eyebrow={eyebrow}
            badge={badge}
            hideClose={hideClose}
            closeLabel={closeLabel}
            closeTestId={closeTestId}
            titleClassName={titleClassName}
          />
        )}
        {description !== undefined && <OverlayDescription>{description}</OverlayDescription>}
        {children}
      </OverlayContent>
    </OverlayRoot>
  );
}
