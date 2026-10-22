/**
 * Learn v2 — the frame and the one Learn-only primitive.
 *
 * VerveQ ONE P4.3: Learn runs on the app's ONE ink ground. The warm
 * `.theme-learn` palette is gone; teaching content sits on `.theme-paper`
 * reading cards instead (TeachingReveal). The old Chip / Eyebrow / LadderDots
 * duplicates were replaced by the ui primitives (Badge, Eyebrow) and the game
 * frame's StepDots. What stays here is the hub frame and the mastery bar.
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-height container for the Learn hub screens with the desktop
 * never-scroll contract (mobile screens opt into vertical scroll per-region).
 * A run uses the shared StageFrame instead.
 */
export function LearnShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "bg-background text-foreground shell-canvas-bg flex flex-col",
        // Fill the viewport and never scroll — on every device (matches
        // ShellLayout's discipline). Screens keep internal scroll valves.
        "fixed inset-0 z-frame h-[100dvh] overflow-hidden",
        // iOS standalone insets (matches ShellLayout).
        "safe-pt safe-pb",
      )}
    >
      {/* Desktop canvas group (matches ShellLayout): `contents` is a no-op
          below xl; at xl+ the Learn screens lay out inside a height-bounded,
          centered column, with the width bounded from 1440px so ultra-wide
          monitors don't stretch the hero bands edge-to-edge. */}
      <div className="contents xl:flex xl:flex-col xl:w-full xl:flex-1 xl:min-h-0 xl:max-h-[50rem] xl:my-auto min-[1440px]:max-w-6xl min-[1440px]:mx-auto">
        {children}
      </div>
    </div>
  );
}

/** Horizontal mastery bar (0..1). Locked-in topics fill brighter than ones still learning. */
export function MasteryBar({ value, locked = false }: { value: number; locked?: boolean }) {
  return (
    <div className="h-3 overflow-hidden rounded-full neo-border bg-muted">
      <div
        className={cn("h-full", locked ? "bg-foreground" : "bg-muted-foreground")}
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
      />
    </div>
  );
}
