/**
 * THE WEEKEND — the pitch (FW-POLISH O2, rebuilt FW-IMMERSE A2).
 *
 * The 13 rendered as a football team on a pitch that reads as a PLACE, not a
 * diagram: an inline-SVG turf with perspective (touchlines converge toward
 * the far goal), graduated mow stripes (near bands deeper — the same cue a
 * broadcast camera gives), a floodlight wash and edge vignette, and markings
 * projected into the same perspective. Goal end far (top), halfway line at
 * the near foot — the fantasy convention, unchanged.
 *
 * Slots are shirt silhouettes: a generic jersey (no crest, no likeness, no
 * image asset — one inline path) over FPL-style plates carrying name and
 * value. Every FW-4 slot state still renders, compressed to chip size:
 *   empty          → dashed jersey outline, position label, plus
 *   filled         → cream shirt (finishers pink), surname + price plates
 *   locked         → lock glyph, no edit affordance (tap = detail only)
 *   awaiting data  → "…" in the value plate — NEVER a number (FW-4R N5)
 *   scored         → value plate flips lime with the points; the honest zero
 *                    renders AS 0.0 with its "DNP" marker
 *   mismatch       → "×0.75" marker (applied) or "as {ROLE}" hint (browsing)
 *   few votes      → settled row whose crowd was below liquidity
 * Placement lands with a drop-in; a freshly scored plate pulses once — both
 * shortened under prefers-reduced-motion (index.css owns the keyframes).
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

// ── the jersey ──

/** One generic jersey path, 24×22 box: crew neck, raglan sleeves. The only
 *  "artwork" on the pitch — a silhouette, never a kit, crest or likeness. */
const JERSEY_PATH =
  "M8.6 1.4 C9.6 2.7 14.4 2.7 15.4 1.4 L19.2 2.9 L23.2 7.6 L19.7 10.4 L17.9 8.4 " +
  "L17.9 19.6 Q17.9 21 16.4 21 L7.6 21 Q6.1 21 6.1 19.6 L6.1 8.4 L4.3 10.4 " +
  "L0.8 7.6 L4.8 2.9 Z";

/** Right-half shade: a quiet one-sided shadow so the shirt reads lit from the
 *  floodlight side instead of flat. */
const JERSEY_SHADE_PATH =
  "M12 2.38 C13.5 2.38 15 2 15.4 1.4 L19.2 2.9 L23.2 7.6 L19.7 10.4 L17.9 8.4 " +
  "L17.9 19.6 Q17.9 21 16.4 21 L12 21 Z";

function Jersey({
  variant,
  swapArmed,
}: {
  variant: "xi" | "finisher" | "empty";
  swapArmed: boolean;
}) {
  const fill =
    variant === "empty"
      ? "none"
      : swapArmed
        ? "hsl(48 100% 60%)"
        : variant === "finisher"
          ? "hsl(330 90% 80%)"
          : "hsl(30 100% 97%)";
  return (
    <svg
      viewBox="0 0 24 22"
      className="w-[42px] h-[38px]"
      aria-hidden
      style={{ filter: "drop-shadow(1.5px 2px 0 hsl(0 0% 0% / 0.55))" }}
    >
      <path
        d={JERSEY_PATH}
        fill={fill}
        stroke={
          variant === "empty" ? "hsl(75 100% 55% / 0.65)" : "hsl(0 0% 7%)"
        }
        strokeWidth={variant === "empty" ? 1.1 : 1}
        strokeDasharray={variant === "empty" ? "2.6 1.8" : undefined}
        strokeLinejoin="round"
      />
      {variant !== "empty" && (
        <path d={JERSEY_SHADE_PATH} fill="hsl(0 0% 0% / 0.09)" />
      )}
    </svg>
  );
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
        "w-[64px] rounded-md px-0.5 py-1 flex flex-col items-center gap-[3px] text-center transition-all select-none",
        swapArmed && "ring-2 ring-ring bg-[hsl(48_100%_60%/0.12)]",
        state === "locked" && "opacity-85",
        !editable && !filled && "opacity-60",
      )}
    >
      {/* Role line above the shirt — filled chips only (an empty chip already
          says its role under the dashed jersey; twice was noise). */}
      {filled && (
        <span className="font-mono text-[8px] font-bold uppercase tracking-[0.12em] leading-none flex items-center gap-0.5 text-[hsl(30_100%_97%/0.85)]">
          {slot.isFinisher ? `F·${slot.slotRole}` : slot.slotRole}
          {slot.locked && <Lock size={8} strokeWidth={3} aria-label="locked" />}
        </span>
      )}

      {filled ? (
        // Keyed by player: a placement re-mounts this column and the drop-in
        // keyframe carries the shirt onto the pitch.
        <span
          key={slot.playerId ?? undefined}
          className="weekend-chip-in w-full flex flex-col items-center gap-[2px]"
        >
          <span className="relative">
            <Jersey
              variant={slot.isFinisher ? "finisher" : "xi"}
              swapArmed={swapArmed}
            />
          </span>
          <span className="w-full rounded-[3px] bg-[hsl(30_100%_97%)] text-[hsl(0_0%_7%)] font-heading font-bold text-[9.5px] leading-[13px] px-0.5 truncate neo-shadow-sm border border-[hsl(0_0%_7%)]">
            {surname(slot.playerName ?? "…")}
          </span>
          <span
            // Keyed by content: the tick from awaiting to a number (or a
            // revision) re-mounts the plate and fires its one-shot pulse.
            key={`v-${valueLine ?? ""}-${state}`}
            className={cn(
              "w-full rounded-[3px] font-mono font-bold text-[9.5px] leading-[13px] tabular-nums border border-[hsl(0_0%_7%)]",
              state === "scored"
                ? "weekend-score-in bg-[hsl(74_100%_50%)] text-[hsl(0_0%_5%)]"
                : "bg-[hsl(0_0%_10%)] text-[hsl(30_100%_97%/0.92)]",
            )}
          >
            {valueLine}
          </span>
          {micro !== null && (
            <span className="font-mono text-[8px] uppercase leading-none text-[hsl(30_100%_97%/0.75)]">
              {micro}
            </span>
          )}
        </span>
      ) : (
        <span className="w-full flex flex-col items-center gap-[2px]">
          <span className="relative">
            <Jersey variant="empty" swapArmed={swapArmed} />
            <Plus
              size={13}
              strokeWidth={3}
              aria-hidden
              className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 text-[hsl(75_100%_55%/0.85)]"
            />
          </span>
          <span className="font-heading font-bold text-[10px] leading-tight text-[hsl(30_100%_97%/0.9)]">
            {slot.slotRole}
          </span>
        </span>
      )}
    </button>
  );
}

// ── the turf ──

/**
 * The pitch surface, one inline SVG stretched to the container
 * (preserveAspectRatio="none"): graduated mow stripes (near bands taller —
 * the broadcast-camera depth cue), floodlight wash from the far end, edge
 * vignette, and markings projected into a converging-touchline perspective.
 * Circles are drawn as ellipses — exactly what perspective does to them.
 * Decorative; the chips carry every fact.
 */
function PitchSurface() {
  // Band edges of the 9 mow stripes, far → near, heights growing ~15% per
  // band in a 100×144 space.
  const bands = [0, 8.6, 18.5, 29.9, 43.0, 58.0, 75.3, 95.2, 118.1, 144];
  // Perspective: half-width of the pitch at height y (converges far/top).
  const halfW = (y: number) => 40 + (8 * (y - 5)) / 134;
  const line = "hsl(78 90% 88% / 0.5)";
  return (
    <svg
      viewBox="0 0 100 144"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="wknd-turf-depth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(0 0% 0%)" stopOpacity="0.5" />
          <stop offset="0.3" stopColor="hsl(0 0% 0%)" stopOpacity="0.08" />
          <stop offset="0.72" stopColor="hsl(0 0% 0%)" stopOpacity="0" />
          <stop offset="1" stopColor="hsl(0 0% 0%)" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id="wknd-turf-sides" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="hsl(0 0% 0%)" stopOpacity="0.38" />
          <stop offset="0.1" stopColor="hsl(0 0% 0%)" stopOpacity="0" />
          <stop offset="0.9" stopColor="hsl(0 0% 0%)" stopOpacity="0" />
          <stop offset="1" stopColor="hsl(0 0% 0%)" stopOpacity="0.38" />
        </linearGradient>
        <radialGradient id="wknd-floodlight" cx="0.5" cy="0.16" r="0.75">
          <stop offset="0" stopColor="hsl(75 100% 72%)" stopOpacity="0.14" />
          <stop offset="0.55" stopColor="hsl(75 100% 72%)" stopOpacity="0.04" />
          <stop offset="1" stopColor="hsl(75 100% 72%)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* mow stripes */}
      {bands.slice(0, -1).map((top, i) => (
        <rect
          key={top}
          x="0"
          y={top}
          width="100"
          height={bands[i + 1] - top}
          fill={i % 2 === 0 ? "hsl(140 34% 10%)" : "hsl(142 30% 13.5%)"}
        />
      ))}

      {/* light & depth washes */}
      <rect x="0" y="0" width="100" height="144" fill="url(#wknd-floodlight)" />
      <rect x="0" y="0" width="100" height="144" fill="url(#wknd-turf-depth)" />
      <rect x="0" y="0" width="100" height="144" fill="url(#wknd-turf-sides)" />

      {/* markings, projected */}
      <g
        stroke={line}
        strokeWidth={1.3}
        fill="none"
        vectorEffect="non-scaling-stroke"
      >
        {/* boundary: touchlines converge toward the far goal */}
        <path
          d={`M ${50 - halfW(5)} 5 L ${50 + halfW(5)} 5 L ${50 + halfW(139)} 139 L ${50 - halfW(139)} 139 Z`}
          vectorEffect="non-scaling-stroke"
        />
        {/* penalty area + six-yard box, hung from the far goal line */}
        <path
          d={`M ${50 - 0.56 * halfW(5)} 5 L ${50 - 0.56 * halfW(26)} 26 L ${50 + 0.56 * halfW(26)} 26 L ${50 + 0.56 * halfW(5)} 5`}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={`M ${50 - 0.27 * halfW(5)} 5 L ${50 - 0.27 * halfW(13.5)} 13.5 L ${50 + 0.27 * halfW(13.5)} 13.5 L ${50 + 0.27 * halfW(5)} 5`}
          vectorEffect="non-scaling-stroke"
        />
        {/* penalty arc (an ellipse — what perspective makes of a circle) */}
        <path d="M 43.4 26 A 8.4 4.6 0 0 0 56.6 26" vectorEffect="non-scaling-stroke" />
        {/* halfway line at the near foot + centre circle */}
        <path d="M 37.2 139 A 12.8 7.6 0 0 1 62.8 139" vectorEffect="non-scaling-stroke" />
        {/* corner arcs, far end */}
        <path
          d={`M ${50 - halfW(5) + 2.4} 5 A 2.4 1.7 0 0 1 ${50 - halfW(5)} 6.9`}
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={`M ${50 + halfW(5) - 2.4} 5 A 2.4 1.7 0 0 0 ${50 + halfW(5)} 6.9`}
          vectorEffect="non-scaling-stroke"
        />
      </g>
      {/* penalty spot + centre spot */}
      <ellipse cx="50" cy="18.5" rx="0.8" ry="0.5" fill={line} />
      <ellipse cx="50" cy="138.2" rx="0.9" ry="0.55" fill={line} />
    </svg>
  );
}

/**
 * The pitch itself: SVG turf below, XI rows derived from the slots' roles,
 * finishers on the touchline strip below.
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
        <PitchSurface />

        <div
          className="relative grid py-3 px-1 min-h-[480px]"
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
