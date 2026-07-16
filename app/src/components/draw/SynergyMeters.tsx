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
 */
export function SynergyMeters({ cards, synergyTable }: SynergyMetersProps) {
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
        return (
          <div
            key={family}
            className="flex items-center gap-1.5"
            style={{ height: LAYOUT.synergyMeterH }}
            data-testid={`draw-synergy-${family}`}
          >
            <span className="font-heading font-bold text-[9px] w-11 shrink-0 tracking-wide">
              {FAMILY_LABEL[family]}
            </span>
            <div className="flex-1 flex gap-1 h-3.5">
              {Array.from({ length: SEGMENTS }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-sm neo-border",
                    i < shown ? FAMILY_CLASS[family] : "bg-muted",
                    live && i < shown && "neo-shadow-sm",
                  )}
                />
              ))}
            </div>
            <span
              className={cn(
                "font-mono font-bold text-[10px] w-16 shrink-0 text-right leading-none",
                live ? "" : "text-muted-foreground",
              )}
            >
              {chain > 0 ? `${shortTag(tag)} ${live ? formatMult(mult) : `×1`}` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
