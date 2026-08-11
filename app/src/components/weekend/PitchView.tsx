/**
 * THE WEEKEND — the pitch (FW-POLISH O2, owner ruling D2).
 *
 * The 13 rendered as a football team, not a form: the XI positioned by
 * formation on a stylized CSS pitch (goal end at the top, halfway line at the
 * foot — the fantasy convention), the two finishers on the touchline strip
 * below. No image assets, no crests, no likenesses — lines and type only.
 *
 * Every FW-4 slot state re-renders here, compressed to chip size:
 *   empty          → dashed outline, position label, plus — a position to
 *                    fill, never a zero-score warning
 *   filled         → surname + price
 *   locked         → lock glyph, no edit affordance (tap = detail only)
 *   awaiting data  → "…" in the value line — NEVER a number (FW-4R N5)
 *   scored         → points; the honest zero renders AS 0.0 with its "DNP"
 *                    marker so it can never look like awaiting
 *   mismatch       → "×0.75" marker (applied) or "as {ROLE}" hint (browsing)
 *   few votes      → settled row whose crowd was below liquidity
 * The full FW-4 vocabulary (awaiting data / did not appear / crowd % /
 * insufficient votes) lives one tap away in the slot detail sheet — the chip
 * carries the state, the sheet carries the sentence.
 *
 * Dumb component: parents own every mutation; taps only report upward.
 */
import { useTranslation } from "react-i18next";
import { Lock, Plus } from "lucide-react";
import { formatPoints } from "../../../convex/lib/fantasyScoring";
import { CROWD_LIQUIDITY_THRESHOLD } from "../../../convex/lib/fantasyCrowd";
import type { SlotRole } from "../../../convex/lib/fantasyConstants";
import type { FormationRow } from "@/lib/weekendFormations";
import { cn } from "@/lib/utils";

/** Structural chip inputs — BudgetSlot and crew-sheet slots both satisfy it. */
export interface PitchSlot {
  slotIndex: number;
  slotRole: SlotRole;
  isFinisher: boolean;
  playerId: string | null;
  playerName: string | null;
  playerPrice: number | null;
  locked: boolean;
  committedPrice: number | null;
}

/** The score facts a chip can carry (subset of fantasyScores' slot row). */
export interface PitchSlotScore {
  slotIndex: number;
  state: string;
  points: number | null;
  zeroReason: string | null;
  mismatch: boolean;
  crowdFactor: number | null;
  crowdVotes?: number | null;
  version: number | null;
  rowState: string;
}

const ROW_ORDER: readonly SlotRole[] = ["GK", "DEF", "MID", "ATT"];

function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

// Unexported (react-refresh/only-export-components); tests read the chip's
// data-chip-state attribute instead.
function slotChipState(
  slot: PitchSlot,
  score: PitchSlotScore | undefined,
): "empty" | "awaiting" | "scored" | "locked" | "filled" {
  if (slot.playerId === null) return "empty";
  if (score !== undefined && score.state !== "empty") {
    if (score.state === "awaiting" || score.points === null) return "awaiting";
    return "scored";
  }
  return slot.locked ? "locked" : "filled";
}

export function SlotChip({
  slot,
  score,
  nominalPosition,
  swapArmed,
  editable,
  onTap,
}: {
  slot: PitchSlot;
  score: PitchSlotScore | undefined;
  nominalPosition: SlotRole | undefined;
  swapArmed: boolean;
  editable: boolean;
  onTap: () => void;
}) {
  const { t } = useTranslation();
  const state = slotChipState(slot, score);
  const filled = slot.playerId !== null;
  const price = slot.locked ? (slot.committedPrice ?? slot.playerPrice) : slot.playerPrice;

  // One micro-marker per chip, most consequential first; the sheet says the rest.
  let micro: string | null = null;
  if (state === "scored" && score !== undefined) {
    const settled = score.rowState === "final";
    if (score.zeroReason !== null) {
      micro = t("weekend.chipDnp", { defaultValue: "DNP" });
    } else if (score.mismatch) {
      micro = t("weekend.chipMismatch", { defaultValue: "×0.75" });
    } else if (
      settled &&
      (score.crowdVotes ?? 0) < CROWD_LIQUIDITY_THRESHOLD &&
      score.version !== null
    ) {
      micro = t("weekend.chipFewVotes", { defaultValue: "few votes" });
    }
  } else if (
    filled &&
    nominalPosition !== undefined &&
    nominalPosition !== slot.slotRole
  ) {
    micro = t("weekend.chipListed", {
      defaultValue: "as {{pos}}",
      pos: nominalPosition,
    });
  }

  const valueLine =
    state === "awaiting"
      ? "…"
      : state === "scored" && score !== undefined
        ? formatPoints(score.points)
        : price !== null
          ? price.toFixed(1)
          : filled
            ? "—"
            : null;

  return (
    <button
      type="button"
      data-testid={`pitch-slot-${slot.slotIndex}`}
      data-chip-state={state}
      aria-label={
        filled
          ? `${slot.playerName ?? ""} — ${slot.slotRole}`
          : t("weekend.emptyChipAria", {
              defaultValue: "Open {{role}} spot",
              role: slot.slotRole,
            })
      }
      onClick={onTap}
      className={cn(
        "w-[64px] min-h-[58px] rounded-md px-1 py-1 flex flex-col items-center justify-center gap-0 text-center transition-all select-none",
        // Chips contrast the PITCH (always dark), independent of the page
        // theme: cream shirts on dark turf, dark chip ink, quiet dark
        // mini-shadow (R4 — offset shadows never cast in lime).
        filled
          ? "border-2 border-[hsl(0_0%_7%)] neo-shadow-sm bg-[hsl(30_100%_97%)] text-[hsl(0_0%_7%)]"
          : "border-2 border-dashed border-[hsl(75_100%_55%/0.55)] text-[hsl(30_100%_97%/0.92)] bg-[hsl(0_0%_100%/0.04)]",
        swapArmed && "bg-yellow text-yellow-foreground ring-2 ring-ring",
        state === "locked" && "opacity-85",
        !editable && !filled && "opacity-60",
      )}
    >
      {filled ? (
        <>
          <span className="font-mono text-[8px] font-bold uppercase tracking-[0.12em] leading-none flex items-center gap-0.5">
            {slot.isFinisher ? `F·${slot.slotRole}` : slot.slotRole}
            {slot.locked && <Lock size={8} strokeWidth={3} aria-label="locked" />}
          </span>
          <span className="font-heading font-bold text-[11px] leading-tight max-w-full truncate">
            {surname(slot.playerName ?? "…")}
          </span>
          <span className="font-mono font-bold text-[11px] tabular-nums leading-tight">
            {valueLine}
          </span>
          {micro !== null && (
            <span className="font-mono text-[8px] uppercase leading-none opacity-75">
              {micro}
            </span>
          )}
        </>
      ) : (
        <>
          <Plus size={14} strokeWidth={3} aria-hidden />
          <span className="font-heading font-bold text-[11px] leading-tight">
            {slot.slotRole}
          </span>
        </>
      )}
    </button>
  );
}

/**
 * The pitch itself: markings drawn with borders (no assets), XI rows derived
 * from the slots' roles, finishers on the touchline strip below.
 */
export function PitchView({
  slots,
  scoreBySlot,
  nominalByPlayer,
  editable,
  swapSource,
  formationRows,
  onSlotTap,
}: {
  slots: ReadonlyArray<PitchSlot>;
  scoreBySlot: ReadonlyMap<number, PitchSlotScore>;
  nominalByPlayer: ReadonlyMap<string, SlotRole>;
  editable: boolean;
  swapSource: number | null;
  /** R2 display layout (GK row first). Absent/mismatched → one row per role. */
  formationRows?: ReadonlyArray<FormationRow> | null;
  onSlotTap: (slotIndex: number) => void;
}) {
  const { t } = useTranslation();
  const xi = slots.filter((s) => !s.isFinisher);
  const finishers = slots.filter((s) => s.isFinisher);

  // Slice the XI into visual rows. The named layout applies only while its
  // per-role totals match the actual slots (they can drift for a render
  // between a band change and the store update) — otherwise fall back to the
  // plain one-row-per-role reading, which is always consistent.
  const byRole = new Map<SlotRole, PitchSlot[]>(
    ROW_ORDER.map((role) => [
      role,
      xi.filter((s) => s.slotRole === role).sort((a, b) => a.slotIndex - b.slotIndex),
    ]),
  );
  const layoutMatches =
    formationRows != null &&
    ROW_ORDER.every(
      (role) =>
        formationRows
          .filter((r) => r.role === role)
          .reduce((sum, r) => sum + r.count, 0) === (byRole.get(role)?.length ?? 0),
    );
  const rows: PitchSlot[][] = [];
  if (layoutMatches && formationRows != null) {
    const cursor = new Map<SlotRole, number>();
    for (const rowSpec of formationRows) {
      const pool = byRole.get(rowSpec.role) ?? [];
      const from = cursor.get(rowSpec.role) ?? 0;
      rows.push(pool.slice(from, from + rowSpec.count));
      cursor.set(rowSpec.role, from + rowSpec.count);
    }
  } else {
    for (const role of ROW_ORDER) rows.push(byRole.get(role) ?? []);
  }

  const chip = (slot: PitchSlot) => (
    <SlotChip
      key={slot.slotIndex}
      slot={slot}
      score={scoreBySlot.get(slot.slotIndex)}
      nominalPosition={
        slot.playerId === null ? undefined : nominalByPlayer.get(slot.playerId)
      }
      swapArmed={swapSource === slot.slotIndex}
      editable={editable}
      onTap={() => onSlotTap(slot.slotIndex)}
    />
  );

  return (
    <div data-testid="weekend-pitch">
      <div className="weekend-pitch neo-border neo-shadow-lg rounded-xl relative overflow-hidden">
        {/* Markings: goal end up top, halfway line at the foot. Decorative. */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-[3%] border-2 border-[hsl(var(--pitch-line))] rounded-sm" />
          {/* penalty area + six-yard box, hung from the top boundary */}
          <div className="absolute top-[3%] left-1/2 -translate-x-1/2 w-[56%] h-[15%] border-2 border-t-0 border-[hsl(var(--pitch-line))]" />
          <div className="absolute top-[3%] left-1/2 -translate-x-1/2 w-[27%] h-[6.5%] border-2 border-t-0 border-[hsl(var(--pitch-line))]" />
          {/* penalty arc */}
          <div className="absolute top-[18%] left-1/2 -translate-x-1/2 w-[18%] h-[6%] border-2 border-t-0 border-[hsl(var(--pitch-line))] rounded-b-full" />
          {/* centre circle over the halfway line at the foot */}
          <div className="absolute bottom-[3%] left-1/2 -translate-x-1/2 translate-y-[2px] w-[26%] h-[10%] border-2 border-b-0 border-[hsl(var(--pitch-line))] rounded-t-full" />
        </div>

        <div
          className="relative grid py-3 px-1 min-h-[420px]"
          style={{
            gridTemplateRows: `0.8fr${" 1fr".repeat(Math.max(rows.length - 1, 0))}`,
          }}
        >
          {rows.map((rowSlots, i) => (
            <div key={i} className="flex items-center justify-evenly">
              {rowSlots.map(chip)}
            </div>
          ))}
        </div>
      </div>

      {/* The touchline shares the turf so empty finisher chips read the same. */}
      <div
        className="weekend-pitch neo-border neo-shadow rounded-lg mt-2 px-3 py-2 flex items-center gap-3"
        data-testid="finisher-touchline"
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[hsl(30_100%_97%/0.7)] shrink-0">
          {t("weekend.finishers", { defaultValue: "Finishers" })}
        </p>
        <div className="flex items-center gap-2 flex-1 justify-evenly">
          {finishers.map(chip)}
        </div>
      </div>
    </div>
  );
}
