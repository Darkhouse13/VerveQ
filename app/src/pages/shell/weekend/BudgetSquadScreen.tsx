/**
 * THE WEEKEND — budget mode build UI (O1, FW-LAUNCH).
 *
 * BUDGET_MODE_SPEC v1.1.1: every gameweek a fresh 13 (XI + 2 finishers) under
 * a 91.0 budget. This screen is a thin client over fantasySquads — the server
 * rebuilds and validates every edit; nothing here enforces a rule, it only
 * surfaces the server's answers (budget breakdown, lock state, violations as
 * toasts).
 *
 * Availability gating follows HomeWeekendTeaser: the entry query runs
 * imperatively and any rejection (backend not deployed yet, network) renders
 * the quiet "no board open" card — fail closed and silent, no build flag. The
 * route is registered but UNLINKED from any nav (the FW-3/FW-4 idiom), so the
 * prod frontend can ship ahead of the backend deploy.
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
  FORMATION_BOUNDS,
  SLOT_ROLES,
  SQUAD_BUDGET,
  XI_SIZE,
  type SlotRole,
} from "../../../../convex/lib/fantasyConstants";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoInput } from "@/components/neo/NeoInput";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { friendlyError } from "@/lib/errors";

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

export const DEFAULT_FORMATION = { GK: 1, DEF: 4, MID: 4, ATT: 2 } as const;
export const DEFAULT_FINISHERS: readonly [SlotRole, SlotRole] = ["MID", "ATT"];

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
  const [formation, setFormation] = useState<Record<SlotRole, number>>({
    ...DEFAULT_FORMATION,
  });
  const [finishers, setFinishers] = useState<[SlotRole, SlotRole]>([
    ...DEFAULT_FINISHERS,
  ]);
  const total = SLOT_ROLES.reduce((sum, role) => sum + formation[role], 0);

  const step = (role: SlotRole, delta: number) => {
    const bounds = FORMATION_BOUNDS[role];
    const next = formation[role] + delta;
    if (next < bounds.min || next > bounds.max) return;
    setFormation({ ...formation, [role]: next });
  };

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
        <div className="flex flex-col gap-2">
          {SLOT_ROLES.map((role) => (
            <NeoCard key={role} className="flex items-center justify-between py-2">
              <span className="font-heading font-bold text-sm w-10">{role}</span>
              {role === "GK" ? (
                <span className="font-mono font-bold text-lg tabular-nums pr-1">1</span>
              ) : (
                <div className="flex items-center gap-3">
                  <NeoButton
                    variant="outline"
                    size="sm"
                    aria-label={`${role} -`}
                    disabled={formation[role] <= FORMATION_BOUNDS[role].min}
                    onClick={() => step(role, -1)}
                  >
                    −
                  </NeoButton>
                  <span className="font-mono font-bold text-lg tabular-nums w-5 text-center">
                    {formation[role]}
                  </span>
                  <NeoButton
                    variant="outline"
                    size="sm"
                    aria-label={`${role} +`}
                    disabled={formation[role] >= FORMATION_BOUNDS[role].max}
                    onClick={() => step(role, 1)}
                  >
                    +
                  </NeoButton>
                </div>
              )}
            </NeoCard>
          ))}
        </div>
        <p
          className={`text-[11px] mt-2 text-center ${total === XI_SIZE ? "text-muted-foreground" : "font-bold text-destructive"}`}
        >
          {t("weekend.xiCount", {
            defaultValue: "XI: {{total}} of 11",
            total,
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
        disabled={busy || total !== XI_SIZE}
        onClick={() => onCreate(formation, finishers)}
      >
        {t("weekend.startBuilding", { defaultValue: "Start building" })}
      </NeoButton>
    </div>
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

// ── slot rows ──

/** The nominal-position mismatch hint: a browsing warning, never a block —
 *  all-positions-eligible, the ×0.75 dampener prices the risk at scoring. */
function nominalMismatch(slot: BudgetSlot, nominal: SlotRole | undefined): boolean {
  return nominal !== undefined && nominal !== slot.slotRole;
}

export function SlotRow({
  slot,
  nominalPosition,
  score,
  swapArmed,
  editable,
  onAssign,
  onClear,
  onSwap,
}: {
  slot: BudgetSlot;
  nominalPosition: SlotRole | undefined;
  score: SlotScoreRow | undefined;
  swapArmed: boolean;
  editable: boolean;
  onAssign: () => void;
  onClear: () => void;
  onSwap: () => void;
}) {
  const { t } = useTranslation();
  const filled = slot.playerId !== null;
  const price = slot.locked ? (slot.committedPrice ?? slot.playerPrice) : slot.playerPrice;

  return (
    <NeoCard
      color={swapArmed ? "yellow" : "default"}
      className="flex items-center justify-between py-2 gap-2"
    >
      <div className="flex items-center gap-2 min-w-0">
        <NeoBadge color={slot.isFinisher ? "pink" : "muted"} size="sm" className="shrink-0">
          {slot.isFinisher ? `F·${slot.slotRole}` : slot.slotRole}
        </NeoBadge>
        <div className="min-w-0">
          {filled ? (
            <>
              <p className="font-heading font-bold text-sm truncate">
                {slot.playerName ?? "…"}
                {slot.locked && (
                  <Lock size={11} strokeWidth={3} className="inline ml-1 -mt-0.5" />
                )}
              </p>
              {nominalMismatch(slot, nominalPosition) && (
                <p className="text-[10px] font-mono uppercase text-muted-foreground">
                  {t("weekend.nominalMismatch", {
                    defaultValue: "listed {{pos}} — ×0.75 risk if the verdict agrees",
                    pos: nominalPosition,
                  })}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("weekend.emptySlot", { defaultValue: "Empty — scores 0" })}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {score !== undefined && score.state !== "empty" ? (
          <SlotScoreCell score={score} />
        ) : (
          filled && (
            <span className="font-mono font-bold tabular-nums">
              {price === null ? "—" : price.toFixed(1)}
            </span>
          )
        )}
        {editable && !slot.locked && (
          <>
            <NeoButton
              variant="ghost"
              size="sm"
              aria-label={t("weekend.moveSlot", { defaultValue: "Move" })}
              onClick={onSwap}
            >
              <ArrowLeftRight size={14} strokeWidth={3} />
            </NeoButton>
            {filled ? (
              <NeoButton
                variant="ghost"
                size="sm"
                aria-label={t("weekend.clearSlot", { defaultValue: "Clear" })}
                onClick={onClear}
              >
                <X size={14} strokeWidth={3} />
              </NeoButton>
            ) : (
              <NeoButton
                variant="primary"
                size="sm"
                aria-label={t("weekend.fillSlot", { defaultValue: "Add" })}
                onClick={onAssign}
              >
                <Plus size={14} strokeWidth={3} />
              </NeoButton>
            )}
          </>
        )}
        {editable && slot.locked && filled && (
          <NeoBadge color="muted" size="sm">
            {t("weekend.lockedBadge", { defaultValue: "Locked" })}
          </NeoBadge>
        )}
      </div>
    </NeoCard>
  );
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
  inSquad,
  remaining,
  now,
  onPick,
  onClose,
}: {
  open: boolean;
  slotRole: SlotRole | null;
  market: Market | null | undefined;
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

  // Re-arm the defaults each time the picker opens for a slot.
  useEffect(() => {
    if (open) {
      setSearch("");
      setPosition(slotRole ?? "ALL");
      setAffordableOnly(false);
    }
  }, [open, slotRole]);

  const results = useMemo(() => {
    if (market === null || market === undefined) return [];
    const needle = search.trim().toLowerCase();
    return market.players
      .filter(
        (p) =>
          (position === "ALL" || p.position === position) &&
          (!affordableOnly || (p.price !== null && p.price <= remaining)) &&
          (needle.length === 0 ||
            p.name.toLowerCase().includes(needle) ||
            (p.clubName ?? "").toLowerCase().includes(needle)),
      )
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0) || a.name.localeCompare(b.name))
      .slice(0, MARKET_RESULT_CAP);
  }, [market, search, position, affordableOnly, remaining]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="neo-border neo-shadow-lg rounded-xl bg-background max-w-sm mx-auto max-h-[85dvh] flex flex-col">
        <DialogTitle className="font-heading font-bold text-lg">
          {t("weekend.pickFor", {
            defaultValue: "Pick for the {{role}} slot",
            role: slotRole ?? "",
          })}
        </DialogTitle>

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
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto min-h-0">
          {results.map((player) => {
            const started = player.kickoffAt !== null && player.kickoffAt <= now;
            const taken = inSquad.has(player.playerId);
            const unpriced = player.price === null;
            const over = player.price !== null && player.price > remaining;
            const pickable = !started && !taken && !unpriced;
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
                  {player.kickoffAt === null && (
                    <NeoBadge color="yellow" size="sm">
                      {t("weekend.noFixture", { defaultValue: "No match" })}
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
              {t("weekend.noResults", { defaultValue: "Nobody matches those filters." })}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── squad view ──

export function SquadView({
  squad,
  score,
  nominalByPlayer,
  editable,
  swapSource,
  onAssign,
  onClear,
  onSwap,
}: {
  squad: BudgetSquad;
  score: BudgetSquadScore | null | undefined;
  nominalByPlayer: ReadonlyMap<string, SlotRole>;
  editable: boolean;
  swapSource: number | null;
  onAssign: (slotIndex: number) => void;
  onClear: (slotIndex: number) => void;
  onSwap: (slotIndex: number) => void;
}) {
  const { t } = useTranslation();
  const scoreBySlot = useMemo(() => {
    const map = new Map<number, SlotScoreRow>();
    for (const row of score?.slots ?? []) map.set(row.slotIndex, row);
    return map;
  }, [score]);

  const xi = squad.slots.filter((s) => !s.isFinisher);
  const finishers = squad.slots.filter((s) => s.isFinisher);

  const renderSlot = (slot: BudgetSlot) => (
    <SlotRow
      key={slot.slotIndex}
      slot={slot}
      nominalPosition={
        slot.playerId === null ? undefined : nominalByPlayer.get(slot.playerId)
      }
      score={scoreBySlot.get(slot.slotIndex)}
      swapArmed={swapSource === slot.slotIndex}
      editable={editable}
      onAssign={() => onAssign(slot.slotIndex)}
      onClear={() => onClear(slot.slotIndex)}
      onSwap={() => onSwap(slot.slotIndex)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {score !== null && score !== undefined && <ScoreHeader score={score} />}
      {squad.budget !== null && <BudgetBar budget={squad.budget} />}

      {swapSource !== null && (
        <NeoCard color="yellow" className="py-2 text-center">
          <p className="text-[11px] font-bold">
            {t("weekend.swapPrompt", {
              defaultValue: "Tap another slot to swap positions — or tap ⇄ again to cancel.",
            })}
          </p>
        </NeoCard>
      )}

      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
          {t("weekend.startingXi", { defaultValue: "Starting XI" })}
        </p>
        <div className="flex flex-col gap-1.5">{xi.map(renderSlot)}</div>
      </div>
      <div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
          {t("weekend.finishers", { defaultValue: "Finishers" })}
        </p>
        <div className="flex flex-col gap-1.5">{finishers.map(renderSlot)}</div>
      </div>
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

  // Fail-closed availability gate (HomeWeekendTeaser precedent): an
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
          </>
        )}
      </div>
    </ShellLayout>
  );
}
