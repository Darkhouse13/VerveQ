import { Crown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Fixture } from "@/lib/drawEngine";
import { archetypeMeta } from "./meta";
import { DIR_ARROW, descriptorLine, effectTokens } from "./fixtureEffects";
import { useDrawT, type DrawT } from "./drawI18n";
import { LAYOUT } from "./layout";

/**
 * D4 — descriptor for the entry mount, fail-closed: an inexpressible modifier
 * shape renders NO line (and logs the shape) rather than wrong words.
 */
function entryDescriptor(fixture: Fixture, t: DrawT): string | null {
  try {
    return descriptorLine(fixture, t);
  } catch (err) {
    console.warn(String(err));
    return null;
  }
}

interface FixtureStripProps {
  fixtures: Fixture[];
  /** Fixture currently in play / up next; null pre-run. */
  activeIndex: number | null;
  /** Fixtures already cleared (indices < clearedCount are done). */
  clearedCount: number;
  /** Index of the fixture that busted the run, if any. */
  bustedIndex?: number | null;
  /** F1b — tap a chip for its detail sheet. Chips are inert when omitted. */
  onSelect?: (fixture: Fixture) => void;
  /**
   * D4 — "entry" is the cold visitor's first look at the gauntlet: one row per
   * fixture with its name, a plain-words descriptor and its threshold. The
   * default "draft" mount is the compact five-tile strip.
   */
  variant?: "entry" | "draft";
}

/** The effect tokens as wrapping spans ("DEF▲ ATT▼" — one per line in a tile). */
function EffectTokens({ fixture, testId, className }: { fixture: Fixture; testId: string; className?: string }) {
  const tokens = effectTokens(fixture);
  return (
    <span className={cn("font-mono font-bold text-eyebrow tracking-normal", className)} data-testid={testId}>
      {tokens.map((tk, i) => (
        <span key={i}>
          {i > 0 && " "}
          <span className="whitespace-nowrap">
            {tk.label}
            {DIR_ARROW[tk.dir]}
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * The gauntlet — the whole board (archetype + threshold per fixture) is
 * visible from board start (design contract; LAYOUT_SPEC "Fixture strip").
 *
 * F1a: each tile also carries its EFFECT LINE ("DEF▲ ATT▼"), derived from the
 * fixture's own modifiers — the modifiers are the whole game.
 *
 * VerveQ ONE P4.2 (12px floor): a 63px tile cannot hold the archetype NAME at
 * 12px, so the draft tile is icon + threshold over the effect tokens (one per
 * line); the name lives in the tile's accessible label, the next-fixture line,
 * the round's fixture card and the sheet a tap opens. The entry mount is a
 * list with room for every word.
 */
export function FixtureStrip({
  fixtures,
  activeIndex,
  clearedCount,
  bustedIndex = null,
  onSelect,
  variant = "draft",
}: FixtureStripProps) {
  const t = useDrawT();

  if (variant === "entry") {
    return (
      <ol className="flex flex-col gap-2" data-testid="draw-fixture-strip">
        {fixtures.map((fixture) => {
          const { label, Icon } = archetypeMeta(fixture.archetypeId, t);
          const descriptor = entryDescriptor(fixture, t);
          return (
            <li
              key={fixture.index}
              className="neo-border rounded-lg bg-card text-card-foreground flex items-center gap-3 px-3 py-2"
              data-testid={`draw-fixture-chip-${fixture.index}`}
            >
              <span className="font-mono text-eyebrow text-muted-foreground w-5 shrink-0">
                {t("draft.fixtureShort", { n: fixture.index + 1 })}
              </span>
              <Icon size={18} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-heading font-bold text-body-sm leading-tight">
                  {label}
                  {fixture.isBoss && (
                    <span className="inline-flex items-center gap-1 font-mono text-eyebrow text-yellow">
                      <Crown size={12} strokeWidth={3} aria-hidden="true" />
                      {t("round.boss")}
                    </span>
                  )}
                </span>
                {descriptor && (
                  <span
                    className="block text-meta text-muted-foreground leading-tight"
                    data-testid={`draw-fixture-descriptor-${fixture.index}`}
                  >
                    {descriptor}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-eyebrow uppercase text-muted-foreground">
                  {t("entry.clearsAt")}
                </span>
                <span className="block font-mono font-bold text-body leading-tight">{fixture.threshold}</span>
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div
      className="flex shrink-0"
      style={{ height: LAYOUT.fixtureStripH, gap: LAYOUT.fixtureChipGap }}
      data-testid="draw-fixture-strip"
    >
      {fixtures.map((fixture) => {
        const { label, Icon } = archetypeMeta(fixture.archetypeId, t);
        const cleared = fixture.index < clearedCount;
        const busted = bustedIndex === fixture.index;
        const active = !cleared && !busted && fixture.index === activeIndex;
        return (
          <button
            key={fixture.index}
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(fixture)}
            aria-label={t("sheet.fixtureLabel", { n: fixture.index + 1, label, threshold: fixture.threshold })}
            className={cn(
              "relative neo-border rounded-lg flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 px-0.5 leading-none",
              onSelect && "cursor-pointer active:neo-shadow-pressed",
              cleared
                ? "bg-success text-success-foreground"
                : busted
                  ? "bg-destructive text-destructive-foreground"
                  : active
                    ? "draw-outline-lime bg-card text-card-foreground neo-shadow-sm"
                    : "bg-card text-card-foreground",
            )}
            data-testid={`draw-fixture-chip-${fixture.index}`}
          >
            <span className="flex items-center gap-1">
              {cleared ? (
                <Check size={12} strokeWidth={4} aria-hidden="true" />
              ) : fixture.isBoss ? (
                // The boss tile shows its crown in the icon slot; the
                // archetype is in its label and its sheet.
                <Crown size={12} strokeWidth={3} className={cn(!busted && "text-yellow")} aria-hidden="true" />
              ) : (
                <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
              )}
              <span className="font-mono font-bold text-eyebrow tracking-normal">{fixture.threshold}</span>
            </span>
            <EffectTokens
              fixture={fixture}
              testId={`draw-fixture-effect-${fixture.index}`}
              className={cn("text-center max-w-full", !cleared && !busted && "text-muted-foreground")}
            />
          </button>
        );
      })}
    </div>
  );
}
