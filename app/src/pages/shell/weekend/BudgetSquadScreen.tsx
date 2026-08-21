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
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeftRight, Check, ChevronDown, ChevronRight, Lock, Plus, X } from "lucide-react";
import { matchesNameSearch } from "../../../../convex/lib/fantasyPlayerName";
import {
  availabilityBadgeLabel,
  availabilityColor,
  availabilityLine,
} from "@/lib/weekendAvailability";
import type { AvailabilityInfo } from "@/lib/weekendAvailability";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { formatPoints } from "../../../../convex/lib/fantasyScoring";
import { CROWD_LIQUIDITY_THRESHOLD } from "../../../../convex/lib/fantasyCrowd";
import {
  SQUAD_BUDGET,
  type SlotRole,
} from "../../../../convex/lib/fantasyConstants";
import {
  FORMATION_CATALOGUE,
  currentShape,
  resolveFormation,
  shapeToFormation,
  type FormationPlan,
  type NamedFormation,
} from "@/lib/weekendFormations";
import {
  loadDisplayFormation,
  saveDisplayFormation,
} from "@/lib/weekendDisplayFormation";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoInput } from "@/components/neo/NeoInput";
import { PitchView } from "@/components/weekend/PitchView";
import { PlayerSheet } from "@/components/weekend/PlayerSheet";
import {
  FormationChooser,
  FormationSection,
} from "@/components/weekend/FormationChooser";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { friendlyError } from "@/lib/errors";
import { leagueName } from "@/lib/leagueNames";
import { WeekendLeaguesLine } from "@/components/weekend/WeekendLeaguesLine";
import { SquadTabs } from "@/components/weekend/SquadTabs";
import { SquadLedgerView } from "@/components/weekend/SquadLedgerView";
import { useWideScreen } from "@/hooks/useWideScreen";
import { track } from "@/lib/analytics";
import { isBuilderEntry } from "@/lib/weekendDeepLink";
import {
  readWeekendMarketCache,
  writeWeekendMarketCache,
} from "@/lib/weekendMarketCache";

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

// ── squad creation (the setup page — R1's full chooser) ──

// Unexported (react-refresh/only-export-components): consumed only here.
const DEFAULT_FINISHERS: readonly [SlotRole, SlotRole] = ["MID", "ATT"];

export function CreateSquadView({
  gwNumber,
  onCreate,
  busy,
}: {
  gwNumber: number;
  onCreate: (
    formation: Record<SlotRole, number>,
    finisherRoles: [SlotRole, SlotRole],
    formationName: string,
  ) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [formation, setFormation] = useState<NamedFormation>(FORMATION_CATALOGUE[0]);
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
          13 {t("weekend.slots", { defaultValue: "shirts" })} ·{" "}
          {SQUAD_BUDGET.toFixed(1)} {t("weekend.budget", { defaultValue: "budget" })}
        </p>
      </NeoCard>

      <FormationChooser
        selectedName={formation.name}
        busy={busy}
        onSelectFormation={setFormation}
        finishers={finishers.map((role, i) => ({ id: i, role, locked: false }))}
        onFinisherRole={(id, role) => {
          const next: [SlotRole, SlotRole] = [...finishers];
          next[id] = role;
          setFinishers(next);
        }}
      />

      <NeoButton
        variant="primary"
        size="full"
        disabled={busy}
        onClick={() =>
          onCreate(shapeToFormation(formation.shape), finishers, formation.name)
        }
      >
        {t("weekend.startBuilding", { defaultValue: "Start building" })}
      </NeoButton>
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
  // FW-REPRICE R1: a squad the reprice pushed over 91.0 stays legal at its
  // pre-edit cost, so the bar must measure against what actually binds. For
  // everyone else `allowance` IS `limit` and nothing below reads differently.
  // `?? limit` is a deploy-window guard, not defensive habit: CI ships the
  // frontend on its own and Convex is deployed by hand, so a build of this
  // page can be live for a while against a server that predates `allowance`.
  const ceiling = budget.allowance ?? budget.limit;
  const grandfathered = ceiling > budget.limit;
  const remaining = ceiling - budget.total;
  const pct = Math.min(100, (budget.total / ceiling) * 100);
  return (
    <NeoCard shadow="lg" className="py-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {t("weekend.spent", { defaultValue: "Spent" })}
        </span>
        <span className="font-mono font-bold tabular-nums">
          {budget.total.toFixed(1)}
          <span className="text-muted-foreground"> / {ceiling.toFixed(1)}</span>
        </span>
      </div>
      <div className="neo-border rounded h-3 overflow-hidden bg-muted/40">
        <div
          className="h-full bg-primary"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={budget.total}
          aria-valuemin={0}
          aria-valuemax={ceiling}
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
      {grandfathered && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {t("weekend.budgetGrandfathered", {
            defaultValue:
              "New prices put this squad over the {{limit}} budget. It stays legal — but a change cannot make it cost more.",
            limit: budget.limit.toFixed(1),
          })}
        </p>
      )}
    </NeoCard>
  );
}

/**
 * FW-AVAIL — the squad-level headline: how many of your thirteen the feed has
 * flagged this weekend.
 *
 * Deliberately a COUNT and a list of names, not a call to action. It does not
 * say who to sell, and it does not appear at all when nothing is flagged —
 * a permanent "0 flagged" strip would train managers to stop reading it, and
 * would also imply an all-clear this data cannot support (two of the eight
 * covered leagues file no report at all).
 *
 * Locked slots are counted. The manager cannot act on them any more, but the
 * reason a slot is about to score zero is still the most useful sentence on
 * the screen.
 */
export function SquadAvailabilityNotice({
  slots,
}: {
  slots: ReadonlyArray<Pick<BudgetSlot, "playerName"> & { availability?: AvailabilityInfo | null }>;
}) {
  const { t } = useTranslation();
  const flagged = slots.filter((slot) => slot.availability != null);
  if (flagged.length === 0) return null;

  const out = flagged.filter((slot) => slot.availability!.status === "out");
  const names = flagged
    .map((slot) => slot.playerName)
    .filter((name): name is string => name !== null)
    .join(", ");

  return (
    <NeoCard
      color={out.length > 0 ? "destructive" : "yellow"}
      className="py-2"
      data-testid="squad-availability-notice"
    >
      <p className="text-[11px] font-bold">
        {out.length > 0
          ? t("weekend.squadFlaggedOut", {
              defaultValue:
                "{{count}} of your squad are flagged to miss this weekend.",
              count: out.length,
            })
          : t("weekend.squadFlaggedDoubt", {
              defaultValue: "{{count}} of your squad are doubtful this weekend.",
              count: flagged.length,
            })}
      </p>
      <p className="mt-0.5 text-[11px]">{names}</p>
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

/**
 * The picker's whole body — one component, two hosts (B1):
 *  - phones: inside PlayerPickerDialog, exactly the FW-POLISH-3 picker;
 *  - wide screens (xl+): inline as the persistent market panel beside the
 *    pitch. `browse` is the panel's idle state: no slot armed, so the market
 *    reads as facts — no Pick buttons, no slot pre-filter to clear (the O3
 *    "All positions" affordance belongs to a slot context and hides here).
 * Hosts MOUNT a fresh panel per context (key on the slot) — defaults re-arm
 * by remount, not by effect.
 */
export function PickerPanel({
  slotRole,
  finisher = false,
  browse = false,
  host,
  market,
  leagues,
  inSquad,
  remaining,
  now,
  onPick,
}: {
  slotRole: SlotRole | null;
  /** Finisher slots ask a different question than the XI's positions. */
  finisher?: boolean;
  /** Idle market browse (wide panel, no slot armed): read-only, no Pick. */
  browse?: boolean;
  /** Dialog host renders the prompt as the Radix title (a11y). */
  host: "dialog" | "panel";
  market: Market | null | undefined;
  /** Which leagues actually play this window (D4) — null/undefined hides the line. */
  leagues?: ReadonlyArray<{ leagueId: number }> | null;
  inSquad: ReadonlySet<string>;
  remaining: number;
  now: number;
  onPick?: (playerId: string) => void;
}) {
  const { t } = useTranslation();
  const convex = useConvex();

  // O4: the slot asks its question in football, not in database.
  const prompt = browse
    ? t("weekend.marketBrowse", { defaultValue: "The weekend's market" })
    : finisher
      ? t("weekend.pickFinisher", { defaultValue: "Who changes the game late?" })
      : slotRole === "GK"
        ? t("weekend.pickGk", { defaultValue: "Who starts between the sticks?" })
        : slotRole === "DEF"
          ? t("weekend.pickDef", { defaultValue: "Who holds the back line?" })
          : slotRole === "MID"
            ? t("weekend.pickMid", { defaultValue: "Who runs the midfield?" })
            : slotRole === "ATT"
              ? t("weekend.pickAtt", { defaultValue: "Who leads the line?" })
              : t("weekend.pickAny", { defaultValue: "Who makes your 13?" });
  const [search, setSearch] = useState("");
  const [affordableOnly, setAffordableOnly] = useState(false);
  // D4: a partial gameweek is normal — players without a fixture are OUT of
  // the browse by default, behind an explicit "show all", instead of pages
  // of badge noise.
  const [showAll, setShowAll] = useState(false);
  // The subscribed market is fixture-scoped (the default browse above).
  // "Show all" needs the fixtureless rest too — pulled imperatively on the
  // explicit toggle, never on a plain navigation mount.
  const [fullMarket, setFullMarket] = useState<Market | null>(null);
  useEffect(() => {
    if (!showAll) return;
    let cancelled = false;
    void convex
      .query(api.fantasyMarket.getMarket, {})
      .then((full) => {
        if (!cancelled) setFullMarket(full);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showAll, convex]);
  const effectiveMarket = showAll ? (fullMarket ?? market) : market;
  // O3 (FW-POLISH-3): the picker opens FROM a slot, so it pre-filters to the
  // slot's position instead of showing a tab row. That pre-filter is a
  // FILTER default, not an eligibility rule — FW-1's deliberate
  // out-of-position pick stays possible through exactly ONE affordance, the
  // "All positions" entry in the filter sheet, which clears it.
  const [allPositions, setAllPositions] = useState(false);
  // FW-AVAIL: an opt-in filter, not a default. The feed's report is often late
  // and sometimes wrong, so hiding flagged players by default would quietly
  // remove real options from the board; the manager turns it on when they have
  // decided they do not want to see them.
  const [hideFlagged, setHideFlagged] = useState(false);
  const [leagueFilter, setLeagueFilter] = useState<number | null>(null);
  const [clubFilter, setClubFilter] = useState<string | null>(null);
  const [filterSheet, setFilterSheet] = useState<"league" | "club" | null>(null);
  const [clubSearch, setClubSearch] = useState("");
  // FW-SCOUT: the player whose detail sheet is open, living INSIDE the panel
  // so both hosts get it identically (a nested Radix dialog in the phone
  // host — the filter sheet's proven precedent). The host's remount contract
  // (key on slot) closes it with the panel, which is correct: a new slot
  // context is a new question.
  const [detailPlayer, setDetailPlayer] = useState<Id<"fantasyPlayers"> | null>(null);

  /** The market's club catalogue, grouped per league — there is deliberately
   *  no clubs table, so the list is derived from the rows themselves.
   *  League order: the window's playing leagues first (getWeekendLeagues
   *  order), then any league only reachable via Show all, by name. */
  const clubCatalogue = useMemo(() => {
    const byLeague = new Map<number, Map<string, string>>();
    for (const p of effectiveMarket?.players ?? []) {
      const clubs = byLeague.get(p.leagueId) ?? new Map<string, string>();
      if (!clubs.has(p.clubId)) clubs.set(p.clubId, p.clubName ?? p.clubId);
      byLeague.set(p.leagueId, clubs);
    }
    const weekendOrder = (leagues ?? []).map((l) => l.leagueId);
    const leagueIds = [...byLeague.keys()].sort((a, b) => {
      const ia = weekendOrder.indexOf(a);
      const ib = weekendOrder.indexOf(b);
      if (ia !== -1 || ib !== -1) {
        return (ia === -1 ? Infinity : ia) < (ib === -1 ? Infinity : ib) ? -1 : 1;
      }
      return leagueName(a).localeCompare(leagueName(b));
    });
    return leagueIds.map((leagueId) => ({
      leagueId,
      clubs: [...(byLeague.get(leagueId) ?? new Map<string, string>()).entries()]
        .map(([clubId, name]) => ({ clubId, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [effectiveMarket, leagues]);

  const clubFilterName = useMemo(() => {
    if (clubFilter === null) return null;
    for (const group of clubCatalogue) {
      const club = group.clubs.find((c) => c.clubId === clubFilter);
      if (club) return club.name;
    }
    return null;
  }, [clubCatalogue, clubFilter]);

  const results = useMemo(() => {
    if (effectiveMarket === null || effectiveMarket === undefined) return [];
    // FW-NAMES: match on the accent-folded key, so "ljubicic" finds Ljubičić
    // and "hojlund" finds Højlund on a phone keyboard that offers neither
    // character. The rendered name keeps every accent.
    const needle = search.trim();
    return effectiveMarket.players
      .filter(
        (p) =>
          (showAll || p.kickoffAt !== null) &&
          (allPositions || slotRole === null || p.position === slotRole) &&
          (leagueFilter === null || p.leagueId === leagueFilter) &&
          (clubFilter === null || p.clubId === clubFilter) &&
          (!affordableOnly || (p.price !== null && p.price <= remaining)) &&
          (!hideFlagged || p.availability == null) &&
          (needle.length === 0 ||
            matchesNameSearch(p.name, needle) ||
            matchesNameSearch(p.clubName ?? "", needle)),
      )
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0) || a.name.localeCompare(b.name))
      .slice(0, MARKET_RESULT_CAP);
  }, [
    effectiveMarket,
    search,
    slotRole,
    allPositions,
    leagueFilter,
    clubFilter,
    affordableOnly,
    showAll,
    hideFlagged,
    remaining,
  ]);

  return (
    <div className="flex flex-col gap-4 min-h-0">
        {host === "dialog" ? (
          <DialogTitle className="font-heading font-bold text-lg" data-testid="picker-prompt">
            {prompt}
          </DialogTitle>
        ) : (
          <h2 className="font-heading font-bold text-lg" data-testid="picker-prompt">
            {prompt}
          </h2>
        )}

        <NeoInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("weekend.searchMarket", {
            defaultValue: "Search name or club…",
          })}
        />
        {/* O3: one-line filter row. The slot's position is the pre-filter (no
            tab row — the picker KNOWS the slot); League/Club drill down in a
            sheet; ≤budget and Show all keep their semantics. Horizontal
            scroll stays inside this row, never the page. */}
        {/* shrink-0: inside the dialog's squeezed flex column this row would
            otherwise be shrunk vertically and clip the chips.
            overflow-y-hidden + pb-1: overflow-x-auto alone computes
            overflow-y to auto, and the chips' pressed-state translate (4px)
            then grows scrollHeight past clientHeight — the bar scrolls
            vertically under the finger. Clip the axis and pad the translate's
            travel so nothing is cut off mid-press. */}
        <div
          className="flex gap-1.5 overflow-x-auto overflow-y-hidden pb-1 shrink-0 scrollbar-none"
          data-testid="picker-filter-row"
        >
          <NeoButton
            variant={leagueFilter !== null ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
            data-testid="picker-league-chip"
            onClick={() => setFilterSheet("league")}
          >
            {leagueFilter === null
              ? t("weekend.filterLeague", { defaultValue: "League" })
              : leagueName(leagueFilter)}
            <ChevronDown size={12} strokeWidth={3} className="ml-1" aria-hidden />
          </NeoButton>
          <NeoButton
            variant={clubFilter !== null ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
            data-testid="picker-club-chip"
            onClick={() => {
              setClubSearch("");
              setFilterSheet("club");
            }}
          >
            {clubFilterName ?? t("weekend.filterClub", { defaultValue: "Club" })}
            <ChevronDown size={12} strokeWidth={3} className="ml-1" aria-hidden />
          </NeoButton>
          <NeoButton
            variant={affordableOnly ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
            onClick={() => setAffordableOnly((v) => !v)}
          >
            ≤ {remaining.toFixed(1)}
          </NeoButton>
          <NeoButton
            variant={showAll ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
            aria-pressed={showAll}
            onClick={() => setShowAll((v) => !v)}
          >
            {t("weekend.showAll", { defaultValue: "Show all" })}
          </NeoButton>
          <NeoButton
            variant={hideFlagged ? "primary" : "outline"}
            size="sm"
            className="shrink-0"
            data-testid="picker-hide-flagged"
            aria-pressed={hideFlagged}
            onClick={() => setHideFlagged((v) => !v)}
          >
            {t("weekend.hideFlagged", { defaultValue: "Hide flagged" })}
          </NeoButton>
          {allPositions && (
            <NeoButton
              variant="primary"
              size="sm"
              className="shrink-0"
              data-testid="picker-all-positions-chip"
              aria-pressed
              onClick={() => setAllPositions(false)}
            >
              {t("weekend.allPositions", { defaultValue: "All positions" })}
              <X size={12} strokeWidth={3} className="ml-1" aria-hidden />
            </NeoButton>
          )}
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
                data-testid="picker-row"
                className={`flex items-center justify-between py-2 ${!pickable ? "opacity-45" : ""}`}
              >
                {/* FW-SCOUT: the row BODY opens the detail sheet; PICK stays
                    its own sibling button so the two taps can never collide.
                    A button here, not onClick on the NeoCard — the card
                    would render as a <button> and nest the PICK button
                    inside it (invalid HTML, double-fire). */}
                <button
                  type="button"
                  data-testid="picker-row-body"
                  className="min-w-0 flex-1 text-left active:opacity-60"
                  onClick={() => setDetailPlayer(player.playerId)}
                >
                  <p className="font-heading font-bold text-sm truncate">
                    {player.name}
                    <span className="ml-1.5 font-mono text-[10px] text-muted-foreground uppercase">
                      {player.position}
                    </span>
                  </p>
                  <p
                    className="text-[11px] text-muted-foreground truncate"
                    data-testid="picker-club-line"
                  >
                    {player.clubName ?? player.clubId}
                    {/* != null: also covers `undefined` from a backend that
                        predates the field — deploy-order tolerance. */}
                    {player.opponentName != null && (
                      // U1 matchup line: earliest fixture's opponent + venue,
                      // e.g. "Getafe · vs Sevilla (H)". No fixture keeps the
                      // badge, never a fabricated opponent.
                      <span className="whitespace-nowrap">
                        {" · vs "}
                        {player.opponentName} {player.isHome ? "(H)" : "(A)"}
                      </span>
                    )}
                    {/* FW-AVAIL: the feed's own words, on the line the manager
                        is already reading. Absent when nothing is reported —
                        which is silence, never an all-clear. */}
                    {player.availability != null && (
                      <span
                        className={
                          player.availability.status === "out"
                            ? "text-destructive"
                            : "text-foreground"
                        }
                        data-testid="picker-availability-reason"
                      >
                        {" · "}
                        {player.availability.reason ??
                          availabilityLine(player.availability, t)}
                      </span>
                    )}
                  </p>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {player.availability != null && (
                    <NeoBadge
                      color={availabilityColor(player.availability.status)}
                      size="sm"
                      data-testid="picker-availability-badge"
                    >
                      {availabilityBadgeLabel(player.availability.status, t)}
                    </NeoBadge>
                  )}
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
                  {pickable && onPick !== undefined && (
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

        {/* League/Club drill sheet (the FormationChooser bottom-sheet
            precedent), searchable and grouped by league; a chosen league
            scopes the club list. Its footer holds THE one out-of-position
            affordance (O3): "All positions" clears the slot pre-filter so the
            deliberate mismatch pick FW-1 permits stays reachable without a
            tab row. */}
        <DialogPrimitive.Root
          open={filterSheet !== null}
          onOpenChange={(next) => !next && setFilterSheet(null)}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content
              data-testid="picker-filter-sheet"
              className="theme-weekend weekend-sheet-in fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm neo-border neo-shadow-lg rounded-t-xl border-b-0 bg-background text-foreground p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-3 max-h-[70dvh]"
            >
              <div className="flex items-start justify-between gap-2">
                <DialogPrimitive.Title className="font-heading font-bold text-lg">
                  {filterSheet === "club"
                    ? t("weekend.filterClubTitle", { defaultValue: "Filter by club" })
                    : t("weekend.filterLeagueTitle", { defaultValue: "Filter by league" })}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close
                  className="neo-border rounded bg-card p-1 shrink-0 active:neo-shadow-pressed"
                  aria-label={t("common.close", { defaultValue: "Close" })}
                >
                  <X size={14} strokeWidth={3} />
                </DialogPrimitive.Close>
              </div>

              {filterSheet === "club" && (
                <NeoInput
                  value={clubSearch}
                  onChange={(e) => setClubSearch(e.target.value)}
                  data-testid="picker-club-search"
                  placeholder={t("weekend.searchClubs", { defaultValue: "Search clubs…" })}
                />
              )}

              <div className="flex flex-col gap-1 overflow-y-auto min-h-0">
                {filterSheet === "league" ? (
                  <>
                    <SheetRow
                      selected={leagueFilter === null}
                      onClick={() => {
                        setLeagueFilter(null);
                        setFilterSheet(null);
                      }}
                    >
                      {t("weekend.allLeagues", { defaultValue: "All leagues" })}
                    </SheetRow>
                    {clubCatalogue.map((group) => (
                      <SheetRow
                        key={group.leagueId}
                        selected={leagueFilter === group.leagueId}
                        onClick={() => {
                          setLeagueFilter(group.leagueId);
                          if (
                            clubFilter !== null &&
                            !group.clubs.some((c) => c.clubId === clubFilter)
                          ) {
                            setClubFilter(null);
                          }
                          setFilterSheet(null);
                        }}
                      >
                        {leagueName(group.leagueId)}
                      </SheetRow>
                    ))}
                  </>
                ) : (
                  <>
                    <SheetRow
                      selected={clubFilter === null}
                      onClick={() => {
                        setClubFilter(null);
                        setFilterSheet(null);
                      }}
                    >
                      {t("weekend.allClubs", { defaultValue: "All clubs" })}
                    </SheetRow>
                    {(leagueFilter === null
                      ? clubCatalogue
                      : clubCatalogue.filter((g) => g.leagueId === leagueFilter)
                    ).map((group) => {
                      const needle = clubSearch.trim().toLowerCase();
                      const clubs =
                        needle.length === 0
                          ? group.clubs
                          : group.clubs.filter((c) =>
                              c.name.toLowerCase().includes(needle),
                            );
                      if (clubs.length === 0) return null;
                      return (
                        <div key={group.leagueId}>
                          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground pt-2 pb-1">
                            {leagueName(group.leagueId)}
                          </p>
                          <div className="flex flex-col gap-1">
                            {clubs.map((club) => (
                              <SheetRow
                                key={club.clubId}
                                selected={clubFilter === club.clubId}
                                onClick={() => {
                                  setClubFilter(club.clubId);
                                  setLeagueFilter(group.leagueId);
                                  setFilterSheet(null);
                                }}
                              >
                                {club.name}
                              </SheetRow>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* The O3 mismatch affordance belongs to a SLOT context — the
                  idle browse has no pre-filter to clear, so it hides there. */}
              {!browse && (
                <div className="border-t-2 border-border pt-3">
                  <button
                    type="button"
                    data-testid="picker-all-positions"
                    aria-pressed={allPositions}
                    onClick={() => {
                      setAllPositions((v) => !v);
                      setFilterSheet(null);
                    }}
                    className="flex w-full items-center justify-between gap-2 text-left active:opacity-60"
                  >
                    <span>
                      <span className="block font-heading font-bold text-sm">
                        {t("weekend.allPositions", { defaultValue: "All positions" })}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {t("weekend.allPositionsBody", {
                          defaultValue: "Out-of-position picks carry the ×0.75 risk.",
                        })}
                      </span>
                    </span>
                    {allPositions && <Check size={16} strokeWidth={3} aria-hidden />}
                  </button>
                </div>
              )}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        {/* FW-SCOUT: player detail sheet, from the row body. */}
        <PlayerSheet
          playerId={detailPlayer}
          onClose={() => setDetailPlayer(null)}
          surface="picker"
        />
    </div>
  );
}

/**
 * The phone host: the FW-POLISH-3 picker dialog, now a thin shell over
 * PickerPanel. Radix unmounts closed content, so each open mounts a fresh
 * panel with re-armed defaults (the remount contract in PickerPanel's doc).
 */
export function PlayerPickerDialog({
  open,
  slotRole,
  finisher = false,
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
  finisher?: boolean;
  market: Market | null | undefined;
  leagues?: ReadonlyArray<{ leagueId: number }> | null;
  inSquad: ReadonlySet<string>;
  remaining: number;
  now: number;
  onPick: (playerId: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="theme-weekend neo-border neo-shadow-lg rounded-xl bg-background max-w-sm mx-auto max-h-[85dvh] flex flex-col">
        <PickerPanel
          host="dialog"
          slotRole={slotRole}
          finisher={finisher}
          market={market}
          leagues={leagues}
          inSquad={inSquad}
          remaining={remaining}
          now={now}
          onPick={onPick}
        />
      </DialogContent>
    </Dialog>
  );
}

/** A tappable row inside the picker's filter sheet. */
function SheetRow({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-2 neo-border rounded px-3 py-2 text-left font-heading font-bold text-sm active:neo-shadow-pressed ${
        selected ? "bg-primary text-primary-foreground" : "bg-card"
      }`}
    >
      <span className="truncate">{children}</span>
      {selected && <Check size={14} strokeWidth={3} className="shrink-0" aria-hidden />}
    </button>
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
  formationRows = null,
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
  /** R2 display layout for the pitch rows (from the squad's named formation). */
  formationRows?: NamedFormation["rows"] | null;
  onAssign: (slotIndex: number) => void;
  onClear: (slotIndex: number) => void;
  onSwap: (slotIndex: number) => void;
}) {
  const { t } = useTranslation();
  /** The chip whose detail sheet is open. */
  const [sheetSlot, setSheetSlot] = useState<number | null>(null);
  /** FW-SCOUT: the player whose full stats sheet is open (stacked over the
   *  slot dialog — the nested-Radix precedent). Covers the pitch AND the
   *  crew sheet, which renders this same SquadView. */
  const [statsPlayer, setStatsPlayer] = useState<Id<"fantasyPlayers"> | null>(null);

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
      <SquadAvailabilityNotice slots={squad.slots} />

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
        formationRows={formationRows}
        onSlotTap={handleTap}
      />

      <Dialog
        open={sheetSlot !== null}
        onOpenChange={(next) => !next && setSheetSlot(null)}
      >
        <DialogContent className="theme-weekend neo-border neo-shadow-lg rounded-xl bg-background max-w-sm mx-auto">
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
              {sheet.availability != null && (
                <p
                  className={`text-[11px] font-bold ${
                    sheet.availability.status === "out"
                      ? "text-destructive"
                      : "text-foreground"
                  }`}
                  data-testid="slot-availability"
                >
                  {availabilityLine(sheet.availability, t)}
                </p>
              )}
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
              <NeoButton
                variant="outline"
                size="sm"
                data-testid="slot-sheet-stats"
                onClick={() => setStatsPlayer(sheet.playerId)}
              >
                {t("weekend.seasonStats", { defaultValue: "Season stats & form" })}
              </NeoButton>
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

      {/* FW-SCOUT: full stats, stacked over the slot dialog. */}
      <PlayerSheet
        playerId={statsPlayer}
        onClose={() => setStatsPlayer(null)}
        surface="pitch"
      />
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
  const { search } = useLocation();
  const { t } = useTranslation();
  const convex = useConvex();
  const [gate, setGate] = useState<Gate>({ state: "checking" });
  const wide = useWideScreen();

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
  // Scoped to the fixture-having universe — the picker's default browse (D4);
  // "Show all" fetches the full pool imperatively inside PickerPanel. The
  // session cache paints a repeat visit instantly while this subscription
  // re-executes behind it (navigation unmounts drop every query).
  const marketLive = useQuery(api.fantasyMarket.getMarket, gameweekId === null ? "skip" : { fixtureOnly: true });
  useEffect(() => {
    if (marketLive != null) writeWeekendMarketCache(marketLive);
  }, [marketLive]);
  const market = marketLive ?? readWeekendMarketCache(gameweekId);
  // Skipped until the gate opened — the gate proves this deploy unit answers.
  const weekendLeagues = useQuery(
    api.fantasyMarket.getWeekendLeagues,
    gameweekId === null ? "skip" : {},
  );
  const score = useQuery(
    api.fantasyScores.getSquadScore,
    gameweekId === null ? "skip" : { gameweekId, context: "budget" as const },
  );

  // FW-RECEIPT: the squad's weekend as a timeline — subscribed only while its
  // tab is open (thirteen version-chains re-derived per push is a read the
  // squad tab doesn't need).
  const [tab, setTab] = useState<"squad" | "ledger">("squad");
  const ledger = useQuery(
    api.fantasyLedger.getSquadLedger,
    gameweekId === null || tab !== "ledger"
      ? "skip"
      : { gameweekId, context: "budget" as const },
  );
  // The way back to a settled weekend's receipt once its board has closed —
  // a settled gameweek is never the open one.
  const latestReceipt = useQuery(api.fantasyReceipts.latestReceiptRef, {});

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
    name: string;
    names: string[];
  } | null>(null);
  /** R2: the squad's display formation NAME — client-side only, per squad. */
  const [displayName, setDisplayName] = useState<string | null>(null);
  useEffect(() => {
    setDisplayName(
      squad?.squadId != null ? loadDisplayFormation(squad.squadId) : null,
    );
  }, [squad?.squadId]);
  const displayFormation =
    squad != null ? resolveFormation(displayName, currentShape(squad.slots)) : null;
  const rememberFormation = (name: string) => {
    if (squad?.squadId != null) saveDisplayFormation(squad.squadId, name);
    setDisplayName(name);
  };

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

  // Against `allowance`, not `limit` — see BudgetBar. A grandfathered squad's
  // headroom is zero, not negative, and the picker must price affordability
  // off the ceiling that actually binds.
  const remaining =
    squad?.budget == null
      ? SQUAD_BUDGET
      : (squad.budget.allowance ?? squad.budget.limit) - squad.budget.total;

  const editable = gate.state === "open" && gate.gameweek.status !== "final";

  const pickerSlotRow =
    pickerSlot === null ? undefined : squad?.slots.find((s) => s.slotIndex === pickerSlot);
  const pickerRole = pickerSlotRow?.slotRole ?? null;
  const pickerFinisher = pickerSlotRow?.isFinisher ?? false;

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
   *  loudly, never silently. The display NAME is remembered only once the
   *  band change actually lands. */
  const runShapeChange = (
    plan: FormationPlan,
    formationName: string,
  ) => {
    if (squad === null || squad === undefined) return;
    const nameBySlot = new Map(
      squad.slots.map((s) => [s.slotIndex, s.playerName ?? "…"]),
    );
    run(async () => {
      await setFormationMutation({ squadId: squad.squadId, slots: plan.payload });
      rememberFormation(formationName);
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

  /** R1: finisher role change from the chooser sheet — one slot relabelled,
   *  the player (if any) stays on. The server validates as ever. */
  const setFinisherRole = (slotIndex: number, role: SlotRole) => {
    if (squad === null || squad === undefined) return;
    const target = squad.slots.find((s) => s.slotIndex === slotIndex);
    if (target === undefined || target.slotRole === role) return;
    run(
      () =>
        setFormationMutation({
          squadId: squad.squadId,
          slots: squad.slots.map((s) => ({
            slotIndex: s.slotIndex,
            slotRole: s.slotIndex === slotIndex ? role : s.slotRole,
            isFinisher: s.isFinisher,
          })),
        }),
      t("weekend.finisherRoleFailed", {
        defaultValue: "Couldn't change that finisher role.",
      }),
    );
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

  /** Shared by both picker hosts: land the pick, then disarm the slot. */
  const handlePick = (playerId: string) => {
    const slotIndex = pickerSlot;
    setPickerSlot(null);
    if (slotIndex === null || squad == null) return;
    run(
      () =>
        setSlot({
          squadId: squad.squadId,
          slotIndex,
          playerId: playerId as Id<"fantasyPlayers">,
        }),
      t("weekend.pickFailed", { defaultValue: "That pick didn't land." }),
    );
  };

  // B1: wide screens hold the market beside the pitch instead of behind a
  // modal — same PickerPanel, persistent host. JS-gated on the same 1280px
  // line the xl: classes use, so exactly one host exists at a time.
  const showMarketPanel = wide && gate.state === "open" && squad != null && tab === "squad";

  return (
    <ShellLayout
      theme="theme-weekend"
      title={t("weekend.budgetTitle", { defaultValue: "Your weekend 13" })}
      back
      // U2: back walks UP the flow — this screen's parent is the hub, not the
      // compete grid two levels above it.
      onBack={() => navigate(SHELL_ROUTES.weekend)}
      scroll
    >
      <div
        className={
          showMarketPanel
            ? "grid grid-cols-[minmax(0,1fr)_minmax(360px,420px)] gap-6 items-start max-w-5xl mx-auto w-full"
            : "flex flex-col gap-4 md:max-w-md md:mx-auto md:w-full"
        }
      >
      <div className="flex flex-col gap-4 min-w-0">
        {/* O4: the leagues line lives here (compact strip) and on the hub —
            no longer inside the picker, which filters by league instead. */}
        {gate.state === "open" &&
          weekendLeagues != null &&
          weekendLeagues.leagues.length > 0 && (
            <WeekendLeaguesLine
              leagueIds={weekendLeagues.leagues.map((l) => l.leagueId)}
              testid="squad-leagues-strip"
            />
          )}
        {/* FW-RECEIPT: the newest settled weekend's receipt, reachable after
            its board closed (a settled gameweek is never the open one). */}
        {latestReceipt != null && (
          <NeoCard
            color="success"
            onClick={() => navigate(SHELL_ROUTES.weekendReceipt(latestReceipt.gameweekId))}
            className="flex items-center justify-between gap-2 py-2.5 text-left"
            data-testid="squad-receipt-chip"
          >
            <p className="font-heading font-bold text-sm min-w-0 truncate">
              {t("weekend.receiptChip", {
                defaultValue: "Gameweek {{gw}} settled — your receipt is in",
                gw: latestReceipt.gwNumber,
              })}
            </p>
            <ChevronRight size={16} strokeWidth={3} className="shrink-0" aria-hidden />
          </NeoCard>
        )}
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
              onCreate={(formation, finisherRoles, formationName) =>
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
                      // `entry` splits the paid direct-to-builder funnel from
                      // hub-entry; the redirect's tag is still on this URL.
                      track("weekend_squad_created", {
                        gw_number: gate.gameweek.gwNumber,
                        entry: isBuilderEntry(search) ? "builder" : "hub",
                      });
                      // The chosen display name survives the reload (R2).
                      if (created?.squadId != null) {
                        saveDisplayFormation(created.squadId, formationName);
                      }
                      setDisplayName(formationName);
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
            {/* FW-RECEIPT Part 2: the squad and its weekend's story, one
                screen, two tabs. */}
            <SquadTabs
              tabs={[
                {
                  key: "squad" as const,
                  label: t("weekend.tabSquad", { defaultValue: "Squad" }),
                  testid: "squad-tab-squad",
                },
                {
                  key: "ledger" as const,
                  label: t("weekend.tabLedger", { defaultValue: "Ledger" }),
                  testid: "squad-tab-ledger",
                },
              ]}
              active={tab}
              onSelect={(key) => setTab(key)}
            />
            {tab === "ledger" ? (
              <SquadLedgerView
                ledger={ledger}
                {...(ledger != null && ledger.state === "final"
                  ? {
                      onOpenReceipt: () =>
                        navigate(SHELL_ROUTES.weekendReceipt(gate.gameweek.gameweekId)),
                    }
                  : {})}
              />
            ) : (
              <>
            <FormationSection
              slots={squad.slots}
              editable={editable}
              displayFormation={displayFormation}
              busy={busy}
              onRelayout={(formation) => rememberFormation(formation.name)}
              onShapePlan={(formation, plan) => {
                if (plan.displaced.length > 0) {
                  setConfirmShape({
                    plan,
                    name: formation.name,
                    names: plan.displaced.map(
                      (d) =>
                        squad.slots.find((s) => s.slotIndex === d.slotIndex)?.playerName ??
                        "…",
                    ),
                  });
                } else if (plan.changesAnything) {
                  runShapeChange(plan, formation.name);
                }
              }}
              onFinisherRole={setFinisherRole}
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
              formationRows={displayFormation?.rows ?? null}
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
            {!wide && (
              <PlayerPickerDialog
                open={pickerSlot !== null}
                slotRole={pickerRole}
                finisher={pickerFinisher}
                market={market}
                leagues={weekendLeagues?.leagues ?? null}
                inSquad={inSquad}
                remaining={remaining}
                now={Date.now()}
                onPick={handlePick}
                onClose={() => setPickerSlot(null)}
              />
            )}
            <Dialog
              open={confirmShape !== null}
              onOpenChange={(next) => !next && setConfirmShape(null)}
            >
              <DialogContent className="theme-weekend neo-border neo-shadow-lg rounded-xl bg-background max-w-sm mx-auto">
                <DialogTitle className="font-heading font-bold text-lg">
                  {t("weekend.shapeConfirmTitle", {
                    defaultValue: "Switch to {{label}}?",
                    label: confirmShape?.name ?? "",
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
                      if (pending !== null) runShapeChange(pending.plan, pending.name);
                    }}
                  >
                    {t("weekend.shapeConfirmGo", { defaultValue: "Switch shape" })}
                  </NeoButton>
                </div>
              </DialogContent>
            </Dialog>
              </>
            )}
          </>
        )}
      </div>

      {showMarketPanel && (
        <aside
          data-testid="market-panel"
          className="min-w-0 sticky top-2 max-h-[calc(100dvh-9rem)] flex flex-col"
        >
          <NeoCard shadow="lg" className="flex flex-col min-h-0 overflow-hidden">
            {pickerSlot !== null && (
              <button
                type="button"
                data-testid="market-panel-browse"
                onClick={() => setPickerSlot(null)}
                className="self-start mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground active:opacity-60"
              >
                ← {t("weekend.backToBrowse", { defaultValue: "Back to browsing" })}
              </button>
            )}
            <PickerPanel
              key={pickerSlot ?? "browse"}
              host="panel"
              browse={pickerSlot === null}
              slotRole={pickerRole}
              finisher={pickerFinisher}
              market={market}
              leagues={weekendLeagues?.leagues ?? null}
              inSquad={inSquad}
              remaining={remaining}
              now={Date.now()}
              onPick={pickerSlot === null ? undefined : handlePick}
            />
          </NeoCard>
        </aside>
      )}
      </div>
    </ShellLayout>
  );
}
