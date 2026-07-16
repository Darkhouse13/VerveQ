import { cn } from "@/lib/utils";
import { SYNERGY_FAMILIES, largestChain } from "@/lib/drawEngine";
import type { Card } from "@/lib/drawEngine";
import { FAMILY_CLASS, FAMILY_LABEL, formatMult, shortTag } from "./meta";
import { LAYOUT, SYNERGY_METERS_H } from "./layout";

interface SynergyMetersProps {
  /** Cards the chains are computed on (squad in draft, fielded five in-round). */
  cards: Card[];
  /** EngineConfig.synergyTable (from DrawRules) — multiplier per chain length. */
  synergyTable: number[];
  /**
   * F2b — the offer currently SELECTED but not yet confirmed. Each family it
   * would extend grows a pulsing ghost segment, and any multiplier the pick
   * would create is named. Null (the default) renders the meters unchanged.
   */
  ghostCard?: Card | null;
}

function tableMult(chain: number, table: number[]): number {
  if (table.length === 0) return 1;
  return table[Math.min(chain, table.length - 1)] ?? 1;
}

/** Chains cap at the 5 fielded cards — 5 segments per meter. */
const SEGMENTS = 5;

/**
 * 88px block: one 24px meter per synergy family showing the current largest
 * shared-tag chain (LAYOUT_SPEC "Synergy meters").
 *
 * With `ghostCard`, the meters answer the question the draft actually poses —
 * "what does THIS pick do to my chains?" — before the pick is committed, rather
 * than after it is irreversible. The ghost is computed by asking the engine's
 * own `largestChain` about the squad WITH the card appended, so a preview can't
 * disagree with the round that follows it.
 */
export function SynergyMeters({ cards, synergyTable, ghostCard = null }: SynergyMetersProps) {
  return (
    <div
      className="flex flex-col shrink-0"
      style={{ height: SYNERGY_METERS_H, gap: LAYOUT.synergyMeterGap }}
      data-testid="draw-synergy-meters"
    >
      {SYNERGY_FAMILIES.map((family) => {
        const { tag, chain } = largestChain(cards, family);
        const shown = Math.min(chain, SEGMENTS);
        const mult = tableMult(shown, synergyTable);
        const live = mult > 1;

        // What the selected offer would make of this family.
        const ghostChain = ghostCard
          ? Math.min(largestChain([...cards, ghostCard], family).chain, SEGMENTS)
          : shown;
        const extends_ = ghostChain > shown;
        const ghostMult = tableMult(ghostChain, synergyTable);
        // Activates a dormant chain, or upgrades a live one.
        const creates = extends_ && ghostMult > mult;

        return (
          <div
            key={family}
            className="flex items-center gap-1.5"
            style={{ height: LAYOUT.synergyMeterH }}
            data-testid={`draw-synergy-${family}`}
            data-ghost={extends_ ? "extends" : undefined}
          >
            <span className="font-heading font-bold text-[9px] w-11 shrink-0 tracking-wide">
              {FAMILY_LABEL[family]}
            </span>
            <div className="flex-1 flex gap-1 h-3.5">
              {Array.from({ length: SEGMENTS }, (_, i) => {
                const filled = i < shown;
                const ghost = !filled && i < ghostChain;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 rounded-sm neo-border",
                      filled
                        ? FAMILY_CLASS[family]
                        : ghost
                          ? cn(FAMILY_CLASS[family], "draw-ghost-seg")
                          : "bg-muted",
                      live && filled && "neo-shadow-sm",
                    )}
                    data-testid={ghost ? `draw-synergy-ghost-${family}` : undefined}
                  />
                );
              })}
            </div>
            <span
              className={cn(
                "font-mono font-bold text-[10px] w-[4.5rem] shrink-0 text-right leading-none",
                creates
                  ? "draw-ghost-chip text-foreground"
                  : live
                    ? ""
                    : "text-muted-foreground",
              )}
              data-testid={creates ? `draw-synergy-creates-${family}` : undefined}
            >
              {creates
                ? `${FAMILY_LABEL[family]} ${formatMult(ghostMult)}`
                : chain > 0
                  ? `${shortTag(tag)} ${live ? formatMult(mult) : "×1"}`
                  : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
