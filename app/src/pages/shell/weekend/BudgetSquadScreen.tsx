/**
 * THE WEEKEND — budget mode build UI (O1, FW-LAUNCH).
 *
 * BUDGET_MODE_SPEC v1.1.1: every gameweek a fresh 13 (XI + 2 finishers) under
 * a 91.0 budget. This screen is a thin client over fantasySquads — the server
 * rebuilds and validates every edit; nothing here enforces a rule, it only
 * surfaces the server's answers (budget breakdown, lock state, violations as
 * toasts).
 *
 * Availability gating follows the retired FW-P1 teaser pattern: the entry query runs
 * imperatively and any rejection (backend not deployed yet, network) renders
 * the quiet "no board open" card — fail closed and silent, no build flag.
 * Linked from the WEEKEND hub since FW-GO.
 *
 * Score surfaces reuse FW-4's vocabulary verbatim: `points === null` renders
 * as awaiting (never 0.0), the honest zero carries its zeroReason, and the
 * settled label derives from the settlement stamp the server already read —
 * never from the clock (N2).
 *
 * Views are exported for the contract suite; the default export is the data
 * container (house pattern, DraftRoomScreen.tsx).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { ArrowLeftRight, Lock, Plus, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatPoints } from "../../../../convex/lib/fantasyScoring";
import { CROWD_LIQUIDITY_THRESHOLD } from "../../../../convex/lib/fantasyCrowd";
import {
  SLOT_ROLES,
  SQUAD_BUDGET,
  type SlotRole,
} from "../../../../convex/lib/fantasyConstants";
import {
  FORMATION_PRESETS,
  currentShape,
  planFormationChange,
  shapeLabel,
  shapeToFormation,
  type FormationPlan,
  type FormationShape,
  type PlannerSlot,
} from "@/lib/weekendFormations";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoInput } from "@/components/neo/NeoInput";
import { PitchView } from "@/components/weekend/PitchView";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { friendlyError } from "@/lib/errors";
import { leagueListLine } from "@/lib/leagueNames";
import { track } from "@/lib/analytics";

export type OpenGameweek = NonNullable<
  FunctionReturnType<typeof api.fantasyMarket.getOpenGameweek>
>;
export type Market = NonNullable<FunctionReturnType<typeof api.fantasyMarket.getMarket>>;
export type MarketPlayer = Market["players"][number];
export type BudgetSquad = NonNullable<FunctionReturnType<typeof api.fantasySquads.getSquad>>;
export type BudgetSlot = BudgetSquad["slots"][number];
export type BudgetSquadScore = NonNullable<
  FunctionReturnType<typeof api.fantasyScores.getSquadScore>
>;
export type SlotScoreRow = BudgetSquadScore["slots"][number];

const MARKET_RESULT_CAP = 40;

// ── formation picker (create) ──

// Unexported (react-refresh/only-export-components): consumed only here.
const DEFAULT_SHAPE: FormationShape = { DEF: 4, MID: 4, ATT: 2 };
const DEFAULT_FINISHERS: readonly [SlotRole, SlotRole] = ["MID", "ATT"];

/** D3: one tap, a shape — never a stepper. */
export function FormationChips({
  value,
  disabledLabels,
  onSelect,
}: {
  value: string | null;
  /** Chips a locked arrangement makes unreachable (with the current label active). */
  disabledLabels?: ReadonlySet<string>;
  onSelect: (shape: FormationShape, label: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5" data-testid="formation-chips">
      {FORMATION_PRESETS.map((preset) => (
        <NeoButton
          key={preset.label}
          variant={value === preset.label ? "primary" : "outline"}
          size="sm"
          className="font-mono tabular-nums px-2"
          disabled={disabledLabels?.has(preset.label) ?? false}
          aria-pressed={value === preset.label}
          onClick={() => onSelect(preset.shape, preset.label)}
        >
          {preset.label}
        </NeoButton>
      ))}
    </div>
  );
}

export function CreateSquadView({
  gwNumber,
  onCreate,
  busy,
}: {
  gwNumber: number;
  onCreate: (
    formation: Record<SlotRole, number>,
    finisherRoles: [SlotRole, SlotRole],
  ) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [shape, setShape] = useState<FormationShape>(DEFAULT_SHAPE);
  const [finishers, setFinishers] = useState<[SlotRole, SlotRole]>([
    ...DEFAULT_FINISHERS,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <NeoCard shadow="lg" className="text-center py-4">
        <p className="text-[10px] font-heading uppercase text-muted-foreground mb-1">
          {t("weekend.buildFor", { defaultValue: "Building for" })}
        </p>
        <p className="font-heading font-bold text-2xl">GW {gwNumber}</p>
        <p className="font-mono text-[11px] text-muted-foreground tracking-[0.16em] uppercase mt-1">
          13 {t("weekend.slots", { defaultValue: "slots" })} ·{" "}
          {SQUAD_BUDGET.toFixed(1)} {t("weekend.budget", { defaultValue: "budget" })}
        </p>
      </NeoCard>

      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
          {t("weekend.shape", { defaultValue: "Your shape" })}
        </p>
        <FormationChips
          value={shapeLabel(shape)}
          onSelect={(next) => setShape(next)}
        />
        <p className="text-[11px] text-muted-foreground mt-2">
          {t("weekend.shapeNote", {
            defaultValue: "Change it any time before kick-off — nothing is set in stone yet.",
          })}
        </p>
      </div>

      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
          {t("weekend.finisherRoles", { defaultValue: "Finisher slots" })}
        </p>
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-1.5 mb-1.5">
            {SLOT_ROLES.map((role) => (
              <NeoButton
                key={role}
                variant={finishers[i] === role ? "primary" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => {
                  const next: [SlotRole, SlotRole] = [...finishers];
                  next[i] = role;
                  setFinishers(next);
                }}
              >
                {role}
              </NeoButton>
            ))}
          </div>
        ))}
        <p className="text-[11px] text-muted-foreground">
          {t("weekend.finisherNote", {
            defaultValue:
              "Finishers score only from their entry minute — any position, free of your shape.",
          })}
        </p>
      </div>

      <NeoButton
        variant="primary"
        size="full"
        disabled={busy}
        onClick={() => onCreate(shapeToFormation(shape), finishers)}
      >
        {t("weekend.startBuilding", { defaultValue: "Start building" })}
      </NeoButton>
    </div>
  );
}

// ── formation editor (squad screen) ──

/**
 * The persistent way BACK into the shape (the owner's #1 defect): chips on
 * the squad screen itself, live until locks bite. Each chip is planned
 * against the CURRENT slots — a shape the locked arrangement cannot reach
 * renders disabled rather than failing on tap. The parent decides what a
 * plan with displaced players means (budget: clear into the tray; crew:
 * players hold their slot and field out of listed position).
 */
export function FormationSection({
  slots,
  editable,
  onApply,
}: {
  slots: ReadonlyArray<PlannerSlot>;
  editable: boolean;
  onApply: (
    plan: FormationPlan,
    label: string,
  ) => void;
}) {
  const { t } = useTranslation();
  const label = shapeLabel(currentShape(slots));

  const disabledLabels = useMemo(() => {
    const set = new Set<string>();
    for (const preset of FORMATION_PRESETS) {
      if (!planFormationChange(slots, preset.shape).ok) set.add(preset.label);
    }
    return set;
  }, [slots]);

  if (!editable) {
    return (
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {t("weekend.shapeLockedLine", {
          defaultValue: "Set up in a {{label}}",
          label,
        })}
      </p>
    );
  }

  return (
    <div data-testid="formation-section">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
        {t("weekend.shapeLine", { defaultValue: "Shape — {{label}}", label })}
      </p>
      <FormationChips
        value={label}
        disabledLabels={disabledLabels}
        onSelect={(shape, nextLabel) => {
          const plan = planFormationChange(slots, shape);
          if (plan.ok && plan.changesAnything) onApply(plan, nextLabel);
        }}
      />
    </div>
  );
}

// ── displaced tray ──

/**
 * D3: a shape change never silently drops a pick. Players whose slot the new
 * shape could not hold wait here, one tap from an open slot. They are back
 * in the market server-side (their slot was cleared) — the tray is the
 * visible promise that the pick isn't lost.
 */
export function DisplacedTray({
  players,
  canPlace,
  onPlace,
}: {
  players: ReadonlyArray<{ playerId: string; name: string }>;
  canPlace: boolean;
  onPlace: (playerId: string) => void;
}) {
  const { t } = useTranslation();
  if (players.length === 0) return null;
  return (
    <NeoCard color="yellow" className="py-2.5" data-testid="displaced-tray">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] mb-1.5">
        {t("weekend.trayTitle", { defaultValue: "Waiting to come back on" })}
      </p>
      <div className="flex flex-col gap-1.5">
        {players.map((player) => (
          <div key={player.playerId} className="flex items-center justify-between gap-2">
            <p className="font-heading font-bold text-sm truncate">{player.name}</p>
            <NeoButton
              variant="secondary"
              size="sm"
              disabled={!canPlace}
              onClick={() => onPlace(player.playerId)}
            >
              {t("weekend.trayPlace", { defaultValue: "Bring back on" })}
            </NeoButton>
          </div>
        ))}
      </div>
    </NeoCard>
  );
}

// ── budget tracker ──

export function BudgetBar({ budget }: { budget: NonNullable<BudgetSquad["budget"]> }) {
  const { t } = useTranslation();
  const remaining = budget.limit - budget.total;
  const pct = Math.min(100, (budget.total / budget.limit) * 100);
  return (
    <NeoCard shadow="lg" className="py-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {t("weekend.spent", { defaultValue: "Spent" })}
        </span>
        <span className="font-mono font-bold tabular-nums">
          {budget.total.toFixed(1)}
          <span className="text-muted-foreground"> / {budget.limit.toFixed(1)}</span>
        </span>
      </div>
      <div className="neo-border rounded h-3 overflow-hidden bg-muted/40">
        <div
          className="h-full bg-primary"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={budget.total}
          aria-valuemin={0}
          aria-valuemax={budget.limit}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
        <span>
          {t("weekend.committedCost", {
            defaultValue: "{{cost}} locked in",
            cost: budget.committed.toFixed(1),
          })}
        </span>
        <span className="font-mono font-bold tabular-nums text-foreground">
          {t("weekend.remaining", {
            defaultValue: "{{amount}} left",
            amount: remaining.toFixed(1),
          })}
        </span>
      </div>
    </NeoCard>
  );
}

// ── slot detail (the sheet behind a chip tap) ──

/** The nominal-position mismatch hint: a browsing warning, never a block —
 *  all-positions-eligible, the ×0.75 dampener prices the risk at scoring. */
function nominalMismatch(slot: BudgetSlot, nominal: SlotRole | undefined): boolean {
  return nominal !== undefined && nominal !== slot.slotRole;
}

/** FW-4 vocabulary, verbatim: awaiting is never 0.0; the honest zero says why. */
export function SlotScoreCell({ score }: { score: SlotScoreRow }) {
  const { t } = useTranslation();
  if (score.state === "awaiting" || score.points === null) {
    return (
      <span className="text-[11px] text-muted-foreground">
        {t("weekend.awaitingData", { defaultValue: "awaiting data" })}
      </span>
    );
  }
  // O2 crowd line, settled rows only: a non-zero factor shows its direction;
  // a zero factor for lack of liquidity says so — visible, not silent.
  const settled = score.rowState === "final";
  const crowdLabel =
    settled && score.crowdFactor !== null && score.crowdFactor !== 0
      ? t("weekend.crowdFactor", {
          defaultValue: "crowd {{pct}}%",
          pct: `${score.crowdFactor > 0 ? "+" : ""}${Math.round(score.crowdFactor * 100)}`,
        })
      : settled && (score.crowdVotes ?? 0) < CROWD_LIQUIDITY_THRESHOLD && score.version !== null
        ? t("weekend.insufficientVotes", { defaultValue: "insufficient votes" })
        : null;
  return (
    <span className="text-right">
      <span className="font-mono font-bold tabular-nums">{formatPoints(score.points)}</span>
      {score.zeroReason !== null && (
        <span className="block text-[10px] font-mono uppercase text-muted-foreground">
          {t("weekend.didNotAppear", { defaultValue: "did not appear" })}
        </span>
      )}
      {score.mismatch && (
        <span className="block text-[10px] font-mono uppercase text-muted-foreground">
          {t("weekend.mismatchApplied", { defaultValue: "×0.75 mismatch" })}
        </span>
      )}
      {crowdLabel !== null && (
        <span className="block text-[10px] font-mono uppercase text-muted-foreground">
          {crowdLabel}
        </span>
      )}
    </span>
  );
}

// ── score header ──

export function ScoreHeader({ score }: { score: BudgetSquadScore }) {
  const { t } = useTranslation();
  const settled = score.state === "final" && score.awaitingSlots === 0;
  return (
    <NeoCard color={settled ? "success" : "default"} shadow="lg" className="text-center py-3">
      <p className="text-[10px] font-heading uppercase text-muted-foreground">
        GW {score.gwNumber}
      </p>
      <p className="font-heading font-bold text-3xl tabular-nums">
        {formatPoints(score.total)}
        <span className="text-sm ml-1">{t("weekend.pts", { defaultValue: "pts" })}</span>
      </p>
      <p className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground mt-0.5">
        {settled
          ? t("weekend.settled", { defaultValue: "settled" })
          : t("weekend.provisional", { defaultValue: "provisional" })}
        {score.awaitingSlots > 0 &&
          ` · ${t("weekend.slotsAwaiting", {
            defaultValue: "{{count}} awaiting",
            count: score.awaitingSlots,
          })}`}
      </p>
    </NeoCard>
  );
}

// ── player picker ──

export function PlayerPickerDialog({
  open,
  slotRole,
  market,
  leagues,
  inSquad,
  remaining,
  now,
  onPick,
  onClose,
}: {
  open: boolean;
  slotRole: SlotRole | null;
  market: Market | null | undefined;
  /** Which leagues actually play this window (D4) — null/undefined hides the line. */
  leagues?: ReadonlyArray<{ leagueId: number }> | null;
  inSquad: ReadonlySet<string>;
  remaining: number;
  now: number;
  onPick: (playerId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<SlotRole | "ALL">(slotRole ?? "ALL");
  const [affordableOnly, setAffordableOnly] = useState(false);
  // D4: a partial gameweek is normal — players without a fixture are OUT of
  // the browse by default, behind an explicit "show all", instead of pages
  // of badge noise.
  const [showAll, setShowAll] = useState(false);

  // Re-arm the defaults each time the picker opens for a slot.
  useEffect(() => {
    if (open) {
      setSearch("");
      setPosition(slotRole ?? "ALL");
      setAffordableOnly(false);
      setShowAll(false);
    }
  }, [open, slotRole]);

  const results = useMemo(() => {
    if (market === null || market === undefined) return [];
    const needle = search.trim().toLowerCase();
    return market.players
      .filter(
        (p) =>
          (showAll || p.kickoffAt !== null) &&
          (position === "ALL" || p.position === position) &&
          (!affordableOnly || (p.price !== null && p.price <= remaining)) &&
          (needle.length === 0 ||
            p.name.toLowerCase().includes(needle) ||
            (p.clubName ?? "").toLowerCase().includes(needle)),
      )
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0) || a.name.localeCompare(b.name))
      .slice(0, MARKET_RESULT_CAP);
  }, [market, search, position, affordableOnly, showAll, remaining]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="neo-border neo-shadow-lg rounded-xl bg-background max-w-sm mx-auto max-h-[85dvh] flex flex-col">
        <DialogTitle className="font-heading font-bold text-lg">
          {t("weekend.pickFor", {
            defaultValue: "Pick for the {{role}} slot",
            role: slotRole ?? "",
          })}
        </DialogTitle>
        {leagues != null && leagues.length > 0 && (
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground -mt-2">
            {t("weekend.thisWeekend", {
              defaultValue: "This weekend: {{leagues}}",
              leagues: leagueListLine(leagues.map((l) => l.leagueId)),
            })}
          </p>
        )}

        <NeoInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("weekend.searchMarket", {
            defaultValue: "Search name or club…",
          })}
        />
        <div className="flex gap-1.5 flex-wrap">
          {(["ALL", ...SLOT_ROLES] as const).map((p) => (
            <NeoButton
              key={p}
              variant={position === p ? "primary" : "outline"}
              size="sm"
              onClick={() => setPosition(p)}
            >
              {p}
            </NeoButton>
          ))}
          <NeoButton
            variant={affordableOnly ? "primary" : "outline"}
            size="sm"
            onClick={() => setAffordableOnly((v) => !v)}
          >
            ≤ {remaining.toFixed(1)}
          </NeoButton>
          <NeoButton
            variant={showAll ? "primary" : "outline"}
            size="sm"
            aria-pressed={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            {t("weekend.showAll", { defaultValue: "Show all" })}
          </NeoButton>
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto min-h-0">
          {results.map((player) => {
            const started = player.kickoffAt !== null && player.kickoffAt <= now;
            const taken = inSquad.has(player.playerId);
            const unpriced = player.price === null;
            const over = player.price !== null && player.price > remaining;
            // Unlike the draft (R5), budget mode cannot take a fixtureless
            // player: the swap-in ban is checked against his kickoff, and
            // with no fixture the server fails closed. Mirror that here.
            const noFixture = player.kickoffAt === null;
            const pickable = !started && !taken && !unpriced && !noFixture;
            return (
              <NeoCard
                key={player.playerId}
                className={`flex items-center justify-between py-2 ${!pickable ? "opacity-45" : ""}`}
              >
                <div className="min-w-0">
                  <p className="font-heading font-bold text-sm truncate">
                    {player.name}
                    <span className="ml-1.5 font-mono text-[10px] text-muted-foreground uppercase">
                      {player.position}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {player.clubName ?? player.clubId}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {noFixture && (
                    <NeoBadge color="muted" size="sm">
                      {t("weekend.noFixture", { defaultValue: "No fixture" })}
                    </NeoBadge>
                  )}
                  {started && (
                    <NeoBadge color="muted" size="sm">
                      {t("weekend.started", { defaultValue: "Started" })}
                    </NeoBadge>
                  )}
                  {taken && (
                    <NeoBadge color="muted" size="sm">
                      {t("weekend.inSquad", { defaultValue: "In squad" })}
                    </NeoBadge>
                  )}
                  {unpriced ? (
                    <NeoBadge color="yellow" size="sm">
                      {t("weekend.unpriced", { defaultValue: "No price yet" })}
                    </NeoBadge>
                  ) : (
                    <span
                      className={`font-mono font-bold tabular-nums ${over ? "text-destructive" : ""}`}
                    >
                      {player.price?.toFixed(1)}
                    </span>
                  )}
                  {pickable && (
                    <NeoButton
                      variant="primary"
                      size="sm"
                      onClick={() => onPick(player.playerId)}
                    >
                      {t("weekend.pick", { defaultValue: "Pick" })}
                    </NeoButton>
                  )}
                </div>
              </NeoCard>
            );
          })}
          {results.length === MARKET_RESULT_CAP && (
            <p className="text-[11px] text-muted-foreground text-center">
              {t("weekend.narrowSearch", {
                defaultValue: "Showing the top 40 — search to narrow.",
              })}
            </p>
          )}
          {results.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-4">
              {showAll
                ? t("weekend.noResults", { defaultValue: "Nobody matches those filters." })
                : t("weekend.noEligibleResults", {
                    defaultValue:
                      "Nobody with a fixture this weekend matches — Show all includes the rest.",
                  })}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── squad view (the pitch, D2) ──

export function SquadView({
  squad,
  score,
  nominalByPlayer,
  editable,
  playersFixed = false,
  swapSource,
  onAssign,
  onClear,
  onSwap,
}: {
  /** Structural: the budget squad payload, or a crew sheet with budget null. */
  squad: Pick<BudgetSquad, "slots"> & { budget: BudgetSquad["budget"] | null };
  score: BudgetSquadScore | null | undefined;
  nominalByPlayer: ReadonlyMap<string, SlotRole>;
  editable: boolean;
  playersFixed?: boolean;
  swapSource: number | null;
  onAssign: (slotIndex: number) => void;
  onClear: (slotIndex: number) => void;
  onSwap: (slotIndex: number) => void;
}) {
  const { t } = useTranslation();
  /** The chip whose detail sheet is open. */
  const [sheetSlot, setSheetSlot] = useState<number | null>(null);

  const scoreBySlot = useMemo(() => {
    const map = new Map<number, SlotScoreRow>();
    for (const row of score?.slots ?? []) map.set(row.slotIndex, row);
    return map;
  }, [score]);

  const slotByIndex = useMemo(
    () => new Map(squad.slots.map((s) => [s.slotIndex, s])),
    [squad.slots],
  );

  // Tap grammar: an armed swap consumes the tap (parent toggles/swaps); an
  // open slot goes straight to the picker; a manned slot opens his sheet.
  const handleTap = (slotIndex: number) => {
    const slot = slotByIndex.get(slotIndex);
    if (slot === undefined) return;
    if (swapSource !== null) {
      onSwap(slotIndex);
      return;
    }
    if (slot.playerId === null) {
      if (editable && !slot.locked && !playersFixed) onAssign(slotIndex);
      return;
    }
    setSheetSlot(slotIndex);
  };

  const sheet = sheetSlot === null ? undefined : slotByIndex.get(sheetSlot);
  const sheetScore = sheetSlot === null ? undefined : scoreBySlot.get(sheetSlot);
  const sheetNominal =
    sheet?.playerId != null ? nominalByPlayer.get(sheet.playerId) : undefined;
  const sheetPrice =
    sheet === undefined
      ? null
      : sheet.locked
        ? (sheet.committedPrice ?? sheet.playerPrice)
        : sheet.playerPrice;

  // The score header appears once something is resolved or awaited — an
  // untouched squad before the weekend has no number worth headlining.
  const scoreWorthShowing =
    score != null && (score.scoredSlots > 0 || score.awaitingSlots > 0);

  return (
    <div className="flex flex-col gap-4">
      {scoreWorthShowing && score != null && <ScoreHeader score={score} />}
      {squad.budget !== null && <BudgetBar budget={squad.budget} />}

      {swapSource !== null && (
        <NeoCard color="yellow" className="py-2 text-center">
          <p className="text-[11px] font-bold">
            {t("weekend.swapPrompt", {
              defaultValue: "Now tap where he goes — or tap him again to leave it.",
            })}
          </p>
        </NeoCard>
      )}

      <PitchView
        slots={squad.slots}
        scoreBySlot={scoreBySlot}
        nominalByPlayer={nominalByPlayer}
        editable={editable}
        swapSource={swapSource}
        onSlotTap={handleTap}
      />

      <Dialog
        open={sheetSlot !== null}
        onOpenChange={(next) => !next && setSheetSlot(null)}
      >
        <DialogContent className="neo-border neo-shadow-lg rounded-xl bg-background max-w-sm mx-auto">
          {sheet !== undefined && sheet.playerId !== null && (
            <>
              <DialogTitle className="font-heading font-bold text-lg pr-8">
                {sheet.playerName ?? "…"}
              </DialogTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <NeoBadge color={sheet.isFinisher ? "pink" : "muted"} size="sm">
                  {sheet.isFinisher ? `F·${sheet.slotRole}` : sheet.slotRole}
                </NeoBadge>
                {sheet.locked && (
                  <NeoBadge color="muted" size="sm">
                    {t("weekend.lockedBadge", { defaultValue: "Locked" })}
                  </NeoBadge>
                )}
                {sheetPrice !== null && (
                  <span className="font-mono font-bold tabular-nums text-sm">
                    {sheetPrice.toFixed(1)}
                  </span>
                )}
              </div>
              {nominalMismatch(sheet, sheetNominal) && (
                <p className="text-[11px] font-mono uppercase text-muted-foreground">
                  {t("weekend.nominalMismatch", {
                    defaultValue: "listed {{pos}} — ×0.75 risk if the verdict agrees",
                    pos: sheetNominal,
                  })}
                </p>
              )}
              {sheetScore !== undefined && sheetScore.state !== "empty" && (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {t("weekend.thisGw", { defaultValue: "This gameweek" })}
                  </span>
                  <SlotScoreCell score={sheetScore} />
                </div>
              )}
              {editable && !sheet.locked ? (
                <div className="flex gap-2">
                  <NeoButton
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    aria-label={t("weekend.moveSlot", { defaultValue: "Move" })}
                    onClick={() => {
                      const index = sheetSlot;
                      setSheetSlot(null);
                      if (index !== null) onSwap(index);
                    }}
                  >
                    <ArrowLeftRight size={14} strokeWidth={3} />
                    {t("weekend.moveSlot", { defaultValue: "Move" })}
                  </NeoButton>
                  {!playersFixed && (
                    <NeoButton
                      variant="danger"
                      size="sm"
                      className="flex-1"
                      aria-label={t("weekend.clearSlot", { defaultValue: "Clear" })}
                      onClick={() => {
                        const index = sheetSlot;
                        setSheetSlot(null);
                        if (index !== null) onClear(index);
                      }}
                    >
                      <X size={14} strokeWidth={3} />
                      {t("weekend.clearSlot", { defaultValue: "Clear" })}
                    </NeoButton>
                  )}
                </div>
              ) : (
                sheet.locked && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("weekend.lockedNote", {
                      defaultValue: "His match has kicked off — this one's played.",
                    })}
                  </p>
                )
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── container ──

type Gate =
  | { state: "checking" }
  | { state: "closed" } // no open gameweek, backend missing, or network error
  | { state: "open"; gameweek: OpenGameweek };

export default function BudgetSquadScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const convex = useConvex();
  const [gate, setGate] = useState<Gate>({ state: "checking" });

  // Fail-closed availability gate (the FW-P1 teaser precedent): an
  // imperative query so an undeployed backend rejects into the catch instead
  // of throwing into the render tree. Any failure = the quiet closed card.
  useEffect(() => {
    let cancelled = false;
    convex
      .query(api.fantasyMarket.getOpenGameweek, {})
      .then((gw) => {
        if (cancelled) return;
        setGate(gw === null ? { state: "closed" } : { state: "open", gameweek: gw });
      })
      .catch(() => {
        if (!cancelled) setGate({ state: "closed" });
      });
    return () => {
      cancelled = true;
    };
  }, [convex]);

  const gameweekId = gate.state === "open" ? gate.gameweek.gameweekId : null;
  const squad = useQuery(
    api.fantasySquads.getSquad,
    gameweekId === null ? "skip" : { gameweekId, context: "budget" as const },
  );
  const market = useQuery(api.fantasyMarket.getMarket, gameweekId === null ? "skip" : {});
  // Skipped until the gate opened — the gate proves this deploy unit answers.
  const weekendLeagues = useQuery(
    api.fantasyMarket.getWeekendLeagues,
    gameweekId === null ? "skip" : {},
  );
  const score = useQuery(
    api.fantasyScores.getSquadScore,
    gameweekId === null ? "skip" : { gameweekId, context: "budget" as const },
  );

  const createSquad = useMutation(api.fantasySquads.createSquad);
  const setSlot = useMutation(api.fantasySquads.setSlot);
  const setFormationMutation = useMutation(api.fantasySquads.setFormation);

  const [busy, setBusy] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [swapSource, setSwapSource] = useState<number | null>(null);
  /** D3 tray: picks a shape change displaced, waiting to be re-placed. */
  const [tray, setTray] = useState<Array<{ playerId: string; name: string }>>([]);
  const [confirmShape, setConfirmShape] = useState<{
    plan: FormationPlan;
    label: string;
    names: string[];
  } | null>(null);

  const run = (fn: () => Promise<unknown>, fallback: string) => {
    if (busy) return;
    setBusy(true);
    void fn()
      .catch((e: unknown) => toast.error(friendlyError(e, fallback)))
      .finally(() => setBusy(false));
  };

  const nominalByPlayer = useMemo(() => {
    const map = new Map<string, SlotRole>();
    for (const p of market?.players ?? []) map.set(p.playerId, p.position);
    return map;
  }, [market]);

  const inSquad = useMemo(() => {
    const set = new Set<string>();
    for (const slot of squad?.slots ?? []) {
      if (slot.playerId !== null) set.add(slot.playerId);
    }
    return set;
  }, [squad]);

  const remaining =
    squad?.budget == null ? SQUAD_BUDGET : squad.budget.limit - squad.budget.total;

  const editable = gate.state === "open" && gate.gameweek.status !== "final";

  const pickerRole =
    pickerSlot === null
      ? null
      : (squad?.slots.find((s) => s.slotIndex === pickerSlot)?.slotRole ?? null);

  /** Swap two slots' (slotRole, isFinisher) atomically — the only legal way
   *  to traverse XI↔finisher or trade roles, since each setSlot call must
   *  leave the squad legal and a swap's midpoint never is. */
  const swapSlots = (a: number, b: number) => {
    if (squad === null || squad === undefined) return;
    const byIndex = new Map(squad.slots.map((s) => [s.slotIndex, s]));
    const slotA = byIndex.get(a);
    const slotB = byIndex.get(b);
    if (slotA === undefined || slotB === undefined) return;
    const payload = squad.slots.map((s) => ({
      slotIndex: s.slotIndex,
      slotRole:
        s.slotIndex === a ? slotB.slotRole : s.slotIndex === b ? slotA.slotRole : s.slotRole,
      isFinisher:
        s.slotIndex === a
          ? slotB.isFinisher
          : s.slotIndex === b
            ? slotA.isFinisher
            : s.isFinisher,
    }));
    run(
      () => setFormationMutation({ squadId: squad.squadId, slots: payload }),
      t("weekend.swapFailed", { defaultValue: "That swap isn't legal." }),
    );
  };

  /** Execute a planned shape change: relabel first (atomic, always legal),
   *  then clear each displaced slot into the tray. A clear that fails leaves
   *  the player fielded out of role with the visible mismatch hint — degraded
   *  loudly, never silently. */
  const runShapeChange = (
    plan: FormationPlan,
  ) => {
    if (squad === null || squad === undefined) return;
    const nameBySlot = new Map(
      squad.slots.map((s) => [s.slotIndex, s.playerName ?? "…"]),
    );
    run(async () => {
      await setFormationMutation({ squadId: squad.squadId, slots: plan.payload });
      const cleared: Array<{ playerId: string; name: string }> = [];
      for (const d of plan.displaced) {
        await setSlot({ squadId: squad.squadId, slotIndex: d.slotIndex, playerId: null });
        cleared.push({ playerId: d.playerId, name: nameBySlot.get(d.slotIndex) ?? "…" });
      }
      if (cleared.length > 0) {
        setTray((prev) => [
          ...prev.filter((p) => !cleared.some((c) => c.playerId === p.playerId)),
          ...cleared,
        ]);
      }
    }, t("weekend.shapeFailed", { defaultValue: "Couldn't switch the shape." }));
  };

  /** Bring a displaced player back on: first open unlocked XI slot, else an
   *  open finisher slot. The tray filters itself once he's back in the squad. */
  const placeFromTray = (playerId: string) => {
    if (squad === null || squad === undefined) return;
    const open = [...squad.slots]
      .sort((a, b) => Number(a.isFinisher) - Number(b.isFinisher) || a.slotIndex - b.slotIndex)
      .find((s) => s.playerId === null && !s.locked);
    if (open === undefined) return;
    run(
      () =>
        setSlot({
          squadId: squad.squadId,
          slotIndex: open.slotIndex,
          playerId: playerId as Id<"fantasyPlayers">,
        }),
      t("weekend.pickFailed", { defaultValue: "That pick didn't land." }),
    );
  };

  return (
    <ShellLayout
      title={t("weekend.budgetTitle", { defaultValue: "Your weekend 13" })}
      back
      onBack={() => navigate(SHELL_ROUTES.compete)}
      scroll
    >
      <div className="flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full">
        {gate.state === "checking" || (gate.state === "open" && squad === undefined) ? (
          <NeoCard className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </p>
          </NeoCard>
        ) : gate.state === "closed" ? (
          <NeoCard className="text-center py-6">
            <p className="font-heading font-bold">
              {t("weekend.noBoard", { defaultValue: "No board is open right now." })}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("weekend.noBoardBody", {
                defaultValue: "A fresh board opens for each weekend. Check back soon.",
              })}
            </p>
          </NeoCard>
        ) : squad === null ? (
          editable ? (
            <CreateSquadView
              gwNumber={gate.gameweek.gwNumber}
              busy={busy}
              onCreate={(formation, finisherRoles) =>
                run(
                  () =>
                    createSquad({
                      gameweekId: gate.gameweek.gameweekId,
                      context: "budget",
                      formation,
                      finisherRoles: [...finisherRoles],
                    }).then((created) => {
                      // Real server transition (ANALYTICS.md): the squad row
                      // exists. gw_number, never identity, rides along.
                      track("weekend_squad_created", {
                        gw_number: gate.gameweek.gwNumber,
                      });
                      return created;
                    }),
                  t("weekend.createFailed", {
                    defaultValue: "Could not create your squad.",
                  }),
                )
              }
            />
          ) : (
            <NeoCard className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                {t("weekend.gwClosed", {
                  defaultValue: "This gameweek is closed — you didn't enter this one.",
                })}
              </p>
            </NeoCard>
          )
        ) : (
          <>
            <FormationSection
              slots={squad.slots}
              editable={editable}
              onApply={(plan, label) => {
                if (plan.displaced.length > 0) {
                  setConfirmShape({
                    plan,
                    label,
                    names: plan.displaced.map(
                      (d) =>
                        squad.slots.find((s) => s.slotIndex === d.slotIndex)?.playerName ??
                        "…",
                    ),
                  });
                } else {
                  runShapeChange(plan);
                }
              }}
            />
            <DisplacedTray
              players={tray.filter((p) => !inSquad.has(p.playerId))}
              canPlace={
                !busy && squad.slots.some((s) => s.playerId === null && !s.locked)
              }
              onPlace={placeFromTray}
            />
            <SquadView
              squad={squad}
              score={score}
              nominalByPlayer={nominalByPlayer}
              editable={editable}
              swapSource={swapSource}
              onAssign={(slotIndex) => setPickerSlot(slotIndex)}
              onClear={(slotIndex) =>
                run(
                  () => setSlot({ squadId: squad.squadId, slotIndex, playerId: null }),
                  t("weekend.clearFailed", { defaultValue: "Could not clear that slot." }),
                )
              }
              onSwap={(slotIndex) => {
                if (swapSource === null) {
                  setSwapSource(slotIndex);
                } else if (swapSource === slotIndex) {
                  setSwapSource(null);
                } else {
                  const source = swapSource;
                  setSwapSource(null);
                  swapSlots(source, slotIndex);
                }
              }}
            />
            <PlayerPickerDialog
              open={pickerSlot !== null}
              slotRole={pickerRole}
              market={market}
              leagues={weekendLeagues?.leagues ?? null}
              inSquad={inSquad}
              remaining={remaining}
              now={Date.now()}
              onPick={(playerId) => {
                const slotIndex = pickerSlot;
                setPickerSlot(null);
                if (slotIndex === null) return;
                run(
                  () =>
                    setSlot({
                      squadId: squad.squadId,
                      slotIndex,
                      playerId: playerId as Id<"fantasyPlayers">,
                    }),
                  t("weekend.pickFailed", { defaultValue: "That pick didn't land." }),
                );
              }}
              onClose={() => setPickerSlot(null)}
            />
            <Dialog
              open={confirmShape !== null}
              onOpenChange={(next) => !next && setConfirmShape(null)}
            >
              <DialogContent className="neo-border neo-shadow-lg rounded-xl bg-background max-w-sm mx-auto">
                <DialogTitle className="font-heading font-bold text-lg">
                  {t("weekend.shapeConfirmTitle", {
                    defaultValue: "Switch to {{label}}?",
                    label: confirmShape?.label ?? "",
                  })}
                </DialogTitle>
                <p className="text-sm">
                  {t("weekend.shapeConfirmBody", {
                    defaultValue:
                      "This shape has no room for {{names}} — they'll wait on the touchline, one tap from coming back on.",
                    names: confirmShape?.names.join(", ") ?? "",
                  })}
                </p>
                <div className="flex gap-2">
                  <NeoButton
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setConfirmShape(null)}
                  >
                    {t("weekend.shapeConfirmCancel", { defaultValue: "Keep shape" })}
                  </NeoButton>
                  <NeoButton
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const pending = confirmShape;
                      setConfirmShape(null);
                      if (pending !== null) runShapeChange(pending.plan);
                    }}
                  >
                    {t("weekend.shapeConfirmGo", { defaultValue: "Switch shape" })}
                  </NeoButton>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </ShellLayout>
  );
}
