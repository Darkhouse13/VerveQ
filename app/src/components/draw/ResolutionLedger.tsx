/**
 * Ticket D1 — the staged resolution ledger (DISPLAY-ONLY).
 *
 * Replaces the collapsed math line ("582 ×1.98 = 1151 CLEARED") with a
 * plain-language ledger that lands beat by beat under the existing G3 beat
 * scheduler (RoundStage owns revealStep; this component only reads it):
 *
 *   1. one entry per fielded card, in engine (payload) order: {name} →
 *      {contribution}, and under it the equation
 *        {rating} × {🔥|❄}{×form} × {FIXTURE} {×fixtureMult}
 *      the form factor (D1.1) shows only when form !== 1 — 🔥 above 1, ❄
 *      below — so the visible equation multiplies out; a card the fixture
 *      moved but form left flat drops it ("{rating} × {FIXTURE} …"), and the
 *      entry is the one line "{name} → {contribution}" when fixtureMult === 1
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
 * VerveQ ONE P4.2 — at the 12px floor a card's name and its whole equation no
 * longer fit one 318px line (the name was truncated to ~8 characters), so a
 * pushed card takes two lines: the name and its points, then the equation.
 *
 * The block reserves its FULL height from the first reveal frame (it is known
 * from the payload: which cards are flat, how many chains), so nothing below
 * it shifts while lines land.
 */
import { cn } from "@/lib/utils";
import type { Card, RoundBreakdown } from "@/lib/drawEngine";
import { formatMult } from "./meta";
import { tagName } from "./tags";
import { useDrawT } from "./drawI18n";

/** One 12px line on a 16px leading. */
const LINE_H = 16;
/** Gap between entries. */
const ROW_GAP = 4;
/** py-2 (2×8px) + neo-border (2×2px): the inline height must absorb it. */
const FRAME_H = 20;

/** The ledger's reserved height for a round, known from the payload. */
function ledgerHeight(round: RoundBreakdown): number {
  const cardLines = round.cards.reduce((sum, c) => sum + (isFlat(c) ? 1 : 2), 0);
  const entries = round.cards.length + round.synergies.length + 2;
  const lines = cardLines + round.synergies.length + 2;
  return lines * LINE_H + (entries - 1) * ROW_GAP + FRAME_H;
}

function isFlat(c: { fixtureMult: number; form: number }): boolean {
  return c.fixtureMult === 1 && c.form === 1;
}

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
  "flex items-baseline justify-between gap-2 font-mono font-bold text-eyebrow tracking-normal leading-4 uppercase";

export function ResolutionLedger({
  round,
  squad,
  fixtureLabel,
  pendingReveal,
  revealStep,
  totalShown,
  verdictShown,
}: ResolutionLedgerProps) {
  const t = useDrawT();
  const nameByCard = new Map(squad.map((card) => [card.id, card.name]));
  const fieldedCount = round.cards.length;

  const cardShown = (order: number) => !pendingReveal || revealStep > order;
  const baseShown = !pendingReveal || revealStep > fieldedCount;
  const chainShown = (index: number) => !pendingReveal || revealStep > fieldedCount + 1 + index;

  return (
    <div
      className="draw-border-quiet neo-border neo-shadow bg-card text-card-foreground flex flex-col shrink-0 rounded-lg px-3 py-2"
      style={{ height: ledgerHeight(round), gap: ROW_GAP }}
      data-testid="draw-ledger"
    >
      {round.cards.map((c, order) => {
        if (!cardShown(order)) return null;
        // Fielded ⊆ squad by engine contract, so the name always resolves.
        const name = nameByCard.get(c.cardId) ?? c.cardId;
        const flat = isFlat(c);
        // `form` is on the payload (CardRoundBreakdown.form); it's rendered
        // with formatMult only — never re-derived. It appears only when it
        // actually pushed the card (form !== 1): 🔥 above 1, ❄ below. A card
        // the fixture moved but form left flat drops the form factor entirely,
        // so the printed equation still multiplies out.
        const formPushed = c.form !== 1;
        return (
          <div key={c.cardId} className="draw-reveal-land" data-testid={`draw-ledger-card-${order}`}>
            <p className={ROW_CLASS}>
              <span className="truncate min-w-0">{name}</span>
              <span className="shrink-0">
                → <span className="text-accent">{Math.round(c.contribution)}</span>
              </span>
            </p>
            {!flat && (
              <p className={cn(ROW_CLASS, "justify-start font-normal text-muted-foreground")}>
                <span className="truncate">
                  {c.rating} ×{" "}
                  {formPushed && (
                    <>
                      {c.form > 1 ? "🔥" : "❄"}
                      {formatMult(c.form)} ×{" "}
                    </>
                  )}
                  {fixtureLabel} {formatMult(c.fixtureMult)}
                </span>
              </p>
            )}
          </div>
        );
      })}

      {baseShown && (
        <p className={cn(ROW_CLASS, "draw-reveal-land")} data-testid="draw-ledger-base">
          <span>{t("round.yourFive")}</span>
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
            <span className="truncate min-w-0">{t("round.chain", { tag: tagName(s.tag) })}</span>
            <span>{formatMult(s.mult)}</span>
          </p>
        ) : null,
      )}

      {totalShown && (
        <p className={cn(ROW_CLASS, "draw-reveal-stamp")} data-testid="draw-ledger-total">
          <span className="text-accent">{Math.round(round.score)}</span>
          <span>
            {t("round.needed", { n: round.threshold })}
            {verdictShown && (
              <span
                className={cn(
                  "draw-reveal-verdict inline-block ml-1",
                  round.cleared ? "text-verdict-right" : "text-verdict-wrong",
                )}
                data-testid="draw-round-verdict"
              >
                {round.cleared ? t("round.cleared") : t("round.busted")}
              </span>
            )}
          </span>
        </p>
      )}
    </div>
  );
}
