/**
 * Ticket D1 — the staged resolution ledger (DISPLAY-ONLY).
 *
 * Replaces the collapsed math line ("582 ×1.98 = 1151 CLEARED") with a
 * plain-language ledger that lands beat by beat under the existing G3 beat
 * scheduler (RoundStage owns revealStep; this component only reads it):
 *
 *   1. one line per fielded card, in engine (payload) order:
 *        {name}  {rating} × {🔥|❄}{×form} × {FIXTURE} {×fixtureMult} → {contribution}
 *      the form factor (D1.1) shows only when form !== 1 — 🔥 above 1, ❄
 *      below — so the visible equation multiplies out; a card the fixture
 *      moved but form left flat drops it ("{rating} × {FIXTURE} …"), and the
 *      whole line collapses to "{name} → {contribution}" when fixtureMult === 1
 *      && form === 1 (nothing pushed the card either way);
 *   2. YOUR FIVE — the base sum;
 *   3. one line per GRANTED chain, in synergies[] payload order — absent
 *      families get no invented ×1 row (engine contract: synergies[] only
 *      ever carries granted families);
 *   4. the total vs the threshold, then the CLEARED / BUSTED verdict on the
 *      same line (the verdict is RoundStage's verdictShown beat).
 *
 * PAYLOAD TRUTH (recon R1): every number here is a RoundBreakdown /
 * CardRoundBreakdown / SynergyBreakdown field, rounded for display. Nothing
 * is recomputed — this file contains no score arithmetic. `fixtureMult` is
 * labelled with the fixture's archetype name, never "position": it is the
 * combined product of every modifier the card matched.
 *
 * The block reserves its FULL height from the first reveal frame
 * (rows × 15px − trailing gap), so the bench strip, meters, bar and buttons
 * never shift while lines land. Worst case (5 cards + 3 granted chains +
 * base + total = 10 rows) is 146px: the round stack stays at
 * 628 + 12 + 146 = 786px ≤ the 812px budget.
 */
import { cn } from "@/lib/utils";
import type { Card, RoundBreakdown } from "@/lib/drawEngine";
import { formatMult } from "./meta";
import { tagName } from "./tags";

/** text-[11px] leading-none row (11px) + the 4px column gap. */
const ROW_H = 15;
const ROW_GAP = 4;
/**
 * D3.1 — the ledger now wears the house card frame (px-3 py-2 + neo-border).
 * With box-sizing:border-box the inline height must ABSORB that chrome or the
 * bottom row clips, so the container is grown by exactly py-2 (2×8px) +
 * neo-border (2×2px) = 20px. This adds 20px to the resolved-round stack
 * (worst case 786 → 806px, still ≤ the 812px budget); px is horizontal only
 * and costs no height.
 */
const FRAME_H = 20;

interface ResolutionLedgerProps {
  round: RoundBreakdown;
  /** The drafted six — cardId → display name for the per-card lines. */
  squad: Card[];
  /** Archetype label of the resolved fixture (e.g. "FORTRESS"). */
  fixtureLabel: string;
  pendingReveal: boolean;
  revealStep: number;
  /** RoundStage's gates (it needs them for the threshold bar and punch). */
  totalShown: boolean;
  verdictShown: boolean;
}

const ROW_CLASS =
  "flex items-baseline justify-between gap-2 font-mono font-bold text-[11px] leading-none uppercase";

export function ResolutionLedger({
  round,
  squad,
  fixtureLabel,
  pendingReveal,
  revealStep,
  totalShown,
  verdictShown,
}: ResolutionLedgerProps) {
  const nameByCard = new Map(squad.map((card) => [card.id, card.name]));
  const fieldedCount = round.cards.length;
  const rows = fieldedCount + round.synergies.length + 2;

  const cardShown = (order: number) => !pendingReveal || revealStep > order;
  const baseShown = !pendingReveal || revealStep > fieldedCount;
  const chainShown = (index: number) => !pendingReveal || revealStep > fieldedCount + 1 + index;

  return (
    <div
      className="draw-surface-dark draw-border-quiet neo-border neo-shadow flex flex-col shrink-0 rounded-lg px-3 py-2"
      style={{ height: rows * ROW_H - ROW_GAP + FRAME_H, gap: ROW_GAP }}
      data-testid="draw-ledger"
    >
      {round.cards.map((c, order) => {
        if (!cardShown(order)) return null;
        // Fielded ⊆ squad by engine contract, so the name always resolves.
        const name = nameByCard.get(c.cardId) ?? c.cardId;
        const flat = c.fixtureMult === 1 && c.form === 1;
        // `form` is on the payload (CardRoundBreakdown.form); it's rendered
        // with formatMult only — never re-derived. It appears only when it
        // actually pushed the card (form !== 1): 🔥 above 1, ❄ below. A card
        // the fixture moved but form left flat drops the form factor entirely,
        // so the printed equation still multiplies out.
        const formPushed = c.form !== 1;
        return (
          <p
            key={c.cardId}
            className={cn(ROW_CLASS, "draw-reveal-land")}
            data-testid={`draw-ledger-card-${order}`}
          >
            <span className="truncate min-w-0">{name}</span>
            {flat ? (
              <span className="shrink-0">
                → <span className="text-accent">{Math.round(c.contribution)}</span>
              </span>
            ) : (
              <span className="shrink-0">
                {c.rating} ×{" "}
                {formPushed && (
                  <>
                    {c.form > 1 ? "🔥" : "❄"}
                    {formatMult(c.form)} ×{" "}
                  </>
                )}
                {fixtureLabel} {formatMult(c.fixtureMult)} →{" "}
                <span className="text-accent">{Math.round(c.contribution)}</span>
              </span>
            )}
          </p>
        );
      })}

      {baseShown && (
        <p className={cn(ROW_CLASS, "draw-reveal-land")} data-testid="draw-ledger-base">
          <span>YOUR FIVE</span>
          <span className="text-accent">{Math.round(round.baseSum)}</span>
        </p>
      )}

      {round.synergies.map((s, index) =>
        chainShown(index) ? (
          <p
            key={s.family}
            className={cn(ROW_CLASS, "draw-reveal-stamp")}
            data-testid={`draw-ledger-chain-${s.family}`}
          >
            <span>{tagName(s.tag)} CHAIN</span>
            <span>{formatMult(s.mult)}</span>
          </p>
        ) : null,
      )}

      {totalShown && (
        <p className={cn(ROW_CLASS, "draw-reveal-stamp")} data-testid="draw-ledger-total">
          <span className="text-accent">{Math.round(round.score)}</span>
          <span>
            NEEDED {round.threshold}
            {verdictShown && (
              <span
                className={cn(
                  "draw-reveal-verdict inline-block ml-1",
                  round.cleared ? "text-success" : "text-destructive",
                )}
                data-testid="draw-round-verdict"
              >
                {round.cleared ? "CLEARED" : "BUSTED"}
              </span>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
