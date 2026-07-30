/**
 * THE WEEKEND — the draft room (FW-3): lobby → order reveal → board → done.
 *
 * Server-clocked throughout (INSIDE_OUT_AUDIT LM12): every timer on this
 * screen derives from server timestamps in the room read model plus the
 * `useClockOffset` correction — the chess clock renders
 * `bankMs - (serverNow - turnStartedAt)` and nothing here ever counts down on
 * its own authority. Every view renders from one `getRoom` query, so a cold
 * page load mid-draft resumes exactly (LM7).
 *
 * Views are exported for the contract suite; the default export is the data
 * container (house pattern, ChallengeArenaScreen.tsx).
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { Bot, Check, ScrollText, Swords, Timer } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { NeoInput } from "@/components/neo/NeoInput";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { useClockOffset, useTick } from "@/lib/arena";
import { formatBank } from "@/lib/weekend";
import { friendlyError } from "@/lib/errors";

export type DraftRoom = NonNullable<FunctionReturnType<typeof api.fantasyDraftRooms.getRoom>>;
export type DraftPool = NonNullable<FunctionReturnType<typeof api.fantasyDraftRooms.getDraftPool>>;
export type PoolPlayer = DraftPool[number];

const POOL_RESULT_CAP = 40;

// ── lobby ──

export function LobbyView({
  room,
  onReady,
  onArm,
  busy,
}: {
  room: DraftRoom;
  onReady: (ready: boolean) => void;
  onArm: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const mySeat = room.mySeatIndex === null ? null : room.seats[room.mySeatIndex];
  const isCreator = mySeat !== null && mySeat.userId === room.createdBy;
  const allReady = room.seats.length >= 2 && room.seats.every((s) => s.ready);
  const waitingOn = room.seats.filter((s) => !s.ready).map((s) => s.name);

  return (
    <div className="flex flex-col gap-4">
      <NeoCard shadow="lg" className="text-center py-4">
        <p className="text-[10px] font-heading uppercase text-muted-foreground mb-1">
          {t("weekend.draftFor", { defaultValue: "Drafting for" })}
        </p>
        <p className="font-heading font-bold text-2xl">
          {room.gameweek === null ? "—" : `GW ${room.gameweek.gwNumber}`}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground tracking-[0.16em] uppercase mt-1">
          {room.crew?.code ?? ""} · 13 {t("weekend.rounds", { defaultValue: "rounds" })} · 6:30{" "}
          {t("weekend.bankEach", { defaultValue: "bank each" })}
        </p>
      </NeoCard>

      <div className="flex flex-col gap-2">
        {room.seats.map((seat, i) => (
          <NeoCard
            key={seat.userId}
            color={i === room.mySeatIndex ? "primary" : "default"}
            className="flex items-center justify-between py-2.5"
          >
            <p className="font-heading font-bold text-sm">
              {seat.name}
              {seat.userId === room.createdBy && (
                <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">
                  {t("weekend.host", { defaultValue: "host" })}
                </span>
              )}
            </p>
            <NeoBadge color={seat.ready ? "success" : "muted"}>
              {seat.ready
                ? t("weekend.ready", { defaultValue: "Ready" })
                : t("weekend.idle", { defaultValue: "Idle" })}
            </NeoBadge>
          </NeoCard>
        ))}
      </div>

      {mySeat !== null && (
        <NeoButton
          variant={mySeat.ready ? "success" : "primary"}
          size="full"
          disabled={busy}
          onClick={() => onReady(!mySeat.ready)}
        >
          {mySeat.ready && <Check size={16} strokeWidth={3} className="mr-1.5" />}
          {mySeat.ready
            ? t("weekend.readyOn", { defaultValue: "Ready — tap to undo" })
            : t("weekend.readyUp", { defaultValue: "Ready up" })}
        </NeoButton>
      )}

      {isCreator && (
        <>
          <NeoButton
            variant="danger"
            size="full"
            disabled={!allReady || busy}
            onClick={onArm}
          >
            <Swords size={16} strokeWidth={3} className="mr-1.5" />
            {t("weekend.armDraft", { defaultValue: "Start the draft" })}
          </NeoButton>
          {!allReady && (
            <p className="text-[11px] text-muted-foreground text-center">
              {room.seats.length < 2
                ? t("weekend.needTwo", { defaultValue: "A draft needs at least 2 drafters." })
                : t("weekend.waitingOn", {
                    defaultValue: "Waiting on: {{names}}",
                    names: waitingOn.join(", "),
                  })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── order reveal ──

/**
 * The reveal moment: seat names flip face-up one at a time, timed off the
 * SERVER's orderRevealedAt so a refresh mid-reveal lands at the right step
 * rather than restarting the drama.
 */
export function OrderRevealView({ room, serverNow }: { room: DraftRoom; serverNow: number }) {
  const { t } = useTranslation();
  const order = room.snakeOrder ?? [];
  const revealedAt = room.orderRevealedAt ?? serverNow;
  const stepMs = room.orderRevealMs / (order.length + 1);
  const revealedCount = Math.min(
    order.length,
    Math.max(0, Math.floor((serverNow - revealedAt) / stepMs)),
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="font-heading font-bold text-center text-xl uppercase tracking-wide animate-pulse-urgent">
        {t("weekend.orderReveal", { defaultValue: "The order" })}
      </p>
      <div className="flex flex-col gap-2">
        {order.map((seatIndex, position) => (
          <NeoCard
            key={seatIndex}
            color={position < revealedCount ? (seatIndex === room.mySeatIndex ? "primary" : "yellow") : "default"}
            shadow={position < revealedCount ? "lg" : "none"}
            className="flex items-center gap-3 py-2.5"
          >
            <span className="font-mono font-bold text-lg w-7 text-center">{position + 1}</span>
            <span className="font-heading font-bold">
              {position < revealedCount ? room.seats[seatIndex]?.name : "…"}
            </span>
          </NeoCard>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground text-center">
        {t("weekend.snakeNote", { defaultValue: "Snake order — last picks twice." })}
      </p>
    </div>
  );
}

// ── the board ──

export function DraftBoardView({
  room,
  pool,
  serverNow,
  onPick,
  busy,
}: {
  room: DraftRoom;
  pool: DraftPool | null | undefined;
  serverNow: number;
  onPick: (playerId: string) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [showLog, setShowLog] = useState(false);

  const playerById = useMemo(() => {
    const map = new Map<string, PoolPlayer>();
    for (const player of pool ?? []) map.set(player.playerId, player);
    return map;
  }, [pool]);

  const takenBySeat = useMemo(() => {
    const taken = new Map<string, number>();
    for (const pick of room.picks) {
      if (pick.playerId !== null) taken.set(pick.playerId, pick.seatIndex);
    }
    return taken;
  }, [room.picks]);

  const round = Math.floor((room.currentPickIndex ?? 0) / room.seats.length) + 1;
  const turnSeat = room.turnSeatIndex === null ? null : room.seats[room.turnSeatIndex];
  const myTurn = room.turnSeatIndex !== null && room.turnSeatIndex === room.mySeatIndex;
  const turnElapsed = room.turnStartedAt === null ? 0 : Math.max(0, serverNow - room.turnStartedAt);
  const turnRemaining =
    turnSeat === null ? 0 : Math.max(0, turnSeat.bankMs - turnElapsed);

  const results = useMemo(() => {
    if (pool === null || pool === undefined) return [];
    const needle = search.trim().toLowerCase();
    return pool
      .filter(
        (p) =>
          needle.length === 0 ||
          p.name.toLowerCase().includes(needle) ||
          (p.clubName ?? "").toLowerCase().includes(needle),
      )
      .sort((a, b) => (b.price ?? 4) - (a.price ?? 4) || a.name.localeCompare(b.name))
      .slice(0, POOL_RESULT_CAP);
  }, [pool, search]);

  return (
    <div className="flex flex-col gap-3">
      <NeoCard
        color={myTurn ? "primary" : "default"}
        shadow="lg"
        className={`flex items-center justify-between py-3 ${myTurn ? "animate-pulse-urgent" : ""}`}
      >
        <div>
          <p className="text-[10px] font-heading uppercase text-muted-foreground">
            {t("weekend.roundOf", { defaultValue: "Round {{round}} of 13", round })} · #
            {(room.currentPickIndex ?? 0) + 1}
          </p>
          <p className="font-heading font-bold text-lg leading-tight">
            {myTurn
              ? t("weekend.yourPick", { defaultValue: "Your pick" })
              : t("weekend.onClock", {
                  defaultValue: "{{name}} is on the clock",
                  name: turnSeat?.name ?? "…",
                })}
          </p>
        </div>
        <div className="text-right">
          <Timer size={14} strokeWidth={3} className="inline mr-1 -mt-0.5" />
          <span className="font-mono font-bold text-2xl tabular-nums">
            {formatBank(turnRemaining)}
          </span>
        </div>
      </NeoCard>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {room.seats.map((seat, i) => (
          <NeoBadge
            key={seat.userId}
            color={i === room.turnSeatIndex ? "destructive" : i === room.mySeatIndex ? "primary" : "muted"}
            className="whitespace-nowrap shrink-0"
          >
            {seat.name} · {formatBank(i === room.turnSeatIndex ? turnRemaining : seat.bankMs)}
          </NeoBadge>
        ))}
      </div>

      <PicksGrid room={room} playerById={playerById} />

      <NeoButton variant="ghost" size="sm" onClick={() => setShowLog((v) => !v)}>
        <ScrollText size={14} strokeWidth={3} className="mr-1.5" />
        {showLog
          ? t("weekend.hideLog", { defaultValue: "Hide draft log" })
          : t("weekend.showLog", { defaultValue: "Draft log" })}
      </NeoButton>
      {showLog && <DraftLogView room={room} playerById={playerById} />}

      <NeoInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("weekend.searchPool", { defaultValue: "Search 2,895 players…" })}
      />
      <div className="flex flex-col gap-1.5">
        {results.map((player) => {
          const takenSeat = takenBySeat.get(player.playerId);
          const started = player.kickoffAt !== null && player.kickoffAt <= serverNow;
          const pickable = myTurn && takenSeat === undefined && !started && !busy;
          return (
            <NeoCard
              key={player.playerId}
              className={`flex items-center justify-between py-2 ${takenSeat !== undefined || started ? "opacity-45" : ""}`}
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
                {/* R5: no fixture this gameweek — pickable, but say so. */}
                {!player.hasFixture && (
                  <NeoBadge color="yellow">
                    {t("weekend.noFixture", { defaultValue: "No match" })}
                  </NeoBadge>
                )}
                {started && (
                  <NeoBadge color="muted">
                    {t("weekend.started", { defaultValue: "Started" })}
                  </NeoBadge>
                )}
                {takenSeat !== undefined ? (
                  <NeoBadge color="muted">
                    {room.seats[takenSeat]?.name ?? t("weekend.taken", { defaultValue: "Taken" })}
                  </NeoBadge>
                ) : (
                  <>
                    <span className="font-mono font-bold tabular-nums">
                      {player.price === null ? "—" : player.price.toFixed(1)}
                    </span>
                    {myTurn && (
                      <NeoButton
                        variant="primary"
                        size="sm"
                        disabled={!pickable}
                        onClick={() => onPick(player.playerId)}
                      >
                        {t("weekend.pick", { defaultValue: "Pick" })}
                      </NeoButton>
                    )}
                  </>
                )}
              </div>
            </NeoCard>
          );
        })}
        {pool !== null && pool !== undefined && results.length === POOL_RESULT_CAP && (
          <p className="text-[11px] text-muted-foreground text-center">
            {t("weekend.narrowSearch", { defaultValue: "Showing the top 40 — search to narrow." })}
          </p>
        )}
      </div>
    </div>
  );
}

// ── picks grid ──

export function PicksGrid({
  room,
  playerById,
}: {
  room: DraftRoom;
  playerById: ReadonlyMap<string, PoolPlayer>;
}) {
  const { t } = useTranslation();
  const rounds = Math.max(1, ...room.picks.map((p) => p.round));
  const bySlot = new Map<string, DraftRoom["picks"][number]>();
  for (const pick of room.picks) bySlot.set(`${pick.round}:${pick.seatIndex}`, pick);

  return (
    <div className="overflow-x-auto neo-border rounded-lg">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b-2 border-border bg-muted/40">
            <th className="p-1.5 font-mono text-left w-8">R</th>
            {room.seats.map((seat, i) => (
              <th key={seat.userId} className="p-1.5 font-heading text-left whitespace-nowrap">
                {seat.name}
                {i === room.mySeatIndex && (
                  <span className="text-muted-foreground"> ({t("weekend.you", { defaultValue: "you" })})</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rounds }, (_, r) => r + 1).map((r) => (
            <tr key={r} className="border-b border-border/40 last:border-0">
              <td className="p-1.5 font-mono text-muted-foreground">{r}</td>
              {room.seats.map((_, seatIndex) => {
                const pick = bySlot.get(`${r}:${seatIndex}`);
                const player = pick?.playerId ? playerById.get(pick.playerId) : undefined;
                return (
                  <td key={seatIndex} className="p-1.5 whitespace-nowrap">
                    {pick === undefined ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {player?.name ?? "…"}
                        {pick.auto && <Bot size={11} strokeWidth={2.5} className="text-muted-foreground" />}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── log ──

export function DraftLogView({
  room,
  playerById,
}: {
  room: DraftRoom;
  playerById: ReadonlyMap<string, PoolPlayer>;
}) {
  const { t } = useTranslation();
  return (
    <NeoCard className="py-2 max-h-56 overflow-y-auto">
      <ol className="flex flex-col gap-1 text-[11px]">
        {[...room.picks].reverse().map((pick) => (
          <li key={pick.seq} className="flex items-center justify-between gap-2">
            <span className="font-mono text-muted-foreground w-7 shrink-0">#{pick.pickNumber}</span>
            <span className="font-heading font-bold truncate">
              {room.seats[pick.seatIndex]?.name ?? "?"}
            </span>
            <span className="truncate flex-1 text-right">
              {pick.playerId === null ? "—" : (playerById.get(pick.playerId)?.name ?? "…")}
            </span>
            <span className="font-mono text-muted-foreground shrink-0 tabular-nums">
              {(pick.elapsedMs / 1000).toFixed(1)}s
            </span>
            {pick.auto && (
              <NeoBadge color="muted" className="shrink-0">
                {t("weekend.auto", { defaultValue: "Auto" })}
              </NeoBadge>
            )}
          </li>
        ))}
      </ol>
    </NeoCard>
  );
}

// ── completed ──

export function CompletedView({
  room,
  pool,
  onBackToCrew,
  onArrangeSheet,
}: {
  room: DraftRoom;
  pool: DraftPool | null | undefined;
  onBackToCrew: () => void;
  onArrangeSheet: (roomId: string) => void;
}) {
  const { t } = useTranslation();
  const playerById = useMemo(() => {
    const map = new Map<string, PoolPlayer>();
    for (const player of pool ?? []) map.set(player.playerId, player);
    return map;
  }, [pool]);
  const autoCount = room.picks.filter((p) => p.auto).length;

  return (
    <div className="flex flex-col gap-4">
      <NeoCard color="success" shadow="lg" className="text-center py-4">
        <p className="font-heading font-bold text-xl">
          {t("weekend.draftDone", { defaultValue: "Draft complete" })}
        </p>
        <p className="text-sm opacity-80 mt-1">
          {t("weekend.draftDoneBody", {
            defaultValue:
              "Squads are on their default sheets — arrange yours before kickoff. Every player stays editable until his match starts.",
          })}
        </p>
        {autoCount > 0 && (
          <p className="font-mono text-[11px] mt-2 opacity-70">
            {t("weekend.autoPicks", { defaultValue: "{{count}} auto-picks", count: autoCount })}
          </p>
        )}
      </NeoCard>
      <NeoButton
        variant="primary"
        size="full"
        onClick={() => onArrangeSheet(room.roomId)}
      >
        {t("weekend.arrangeSheet", { defaultValue: "Arrange your sheet" })}
      </NeoButton>
      <PicksGrid room={room} playerById={playerById} />
      <DraftLogView room={room} playerById={playerById} />
      <NeoButton variant="secondary" size="full" onClick={onBackToCrew}>
        {t("weekend.backToCrew", { defaultValue: "Back to the crew" })}
      </NeoButton>
    </div>
  );
}

// ── container ──

export default function DraftRoomScreen() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { roomId = "" } = useParams();
  const room = useQuery(api.fantasyDraftRooms.getRoom, { roomId });
  const needsPool =
    room !== null &&
    room !== undefined &&
    (room.status === "drafting" || room.status === "completed");
  const pool = useQuery(api.fantasyDraftRooms.getDraftPool, needsPool ? { roomId } : "skip");

  const setSeatReady = useMutation(api.fantasyDraftRooms.setSeatReady);
  const armDraft = useMutation(api.fantasyDraftRooms.armDraft);
  const makePick = useMutation(api.fantasyDraftRooms.makePick);
  const [busy, setBusy] = useState(false);

  const offset = useClockOffset(room?.serverNow ?? null);
  const tick = useTick(200);
  const serverNow = tick - offset;

  const run = (fn: () => Promise<unknown>, fallback: string) => {
    if (busy) return;
    setBusy(true);
    void fn()
      .catch((e: unknown) => toast.error(friendlyError(e, fallback)))
      .finally(() => setBusy(false));
  };

  const crewCode = room?.crew?.code ?? null;
  const onBackToCrew = () =>
    crewCode === null
      ? navigate(SHELL_ROUTES.weekendCrews)
      : navigate(SHELL_ROUTES.weekendCrew(crewCode));

  return (
    <ShellLayout
      title={room?.crew?.name ?? t("weekend.draftTitle", { defaultValue: "Draft room" })}
      back
      onBack={onBackToCrew}
      scroll
    >
      <div className="md:max-w-lg md:mx-auto md:w-full">
        {room === undefined ? (
          <NeoCard className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </p>
          </NeoCard>
        ) : room === null ? (
          <NeoCard color="destructive" className="text-center py-6">
            <p className="font-heading font-bold">
              {t("weekend.roomGone", {
                defaultValue: "This room isn't yours to see — join the crew first.",
              })}
            </p>
            <NeoButton
              variant="secondary"
              size="md"
              className="mt-3"
              onClick={() => navigate(SHELL_ROUTES.weekendCrews)}
            >
              {t("weekend.backToCrews", { defaultValue: "Back to crews" })}
            </NeoButton>
          </NeoCard>
        ) : room.status === "lobby" ? (
          <LobbyView
            room={room}
            busy={busy}
            onReady={(ready) =>
              run(
                () => setSeatReady({ roomId: room.roomId, ready }),
                t("weekend.readyFailed", { defaultValue: "Could not update ready state." }),
              )
            }
            onArm={() =>
              run(
                () => armDraft({ roomId: room.roomId }),
                t("weekend.armFailed", { defaultValue: "Could not start the draft." }),
              )
            }
          />
        ) : room.status === "order_reveal" ? (
          <OrderRevealView room={room} serverNow={serverNow} />
        ) : room.status === "drafting" ? (
          <DraftBoardView
            room={room}
            pool={pool}
            serverNow={serverNow}
            busy={busy}
            onPick={(playerId) =>
              run(
                () =>
                  makePick({
                    roomId: room.roomId,
                    playerId: playerId as Id<"fantasyPlayers">,
                  }),
                t("weekend.pickFailed", { defaultValue: "That pick didn't land." }),
              )
            }
          />
        ) : room.status === "completed" ? (
          <CompletedView
            room={room}
            pool={pool}
            onBackToCrew={onBackToCrew}
            onArrangeSheet={(id) => navigate(SHELL_ROUTES.weekendSheet(id))}
          />
        ) : (
          <NeoCard className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              {t("weekend.roomAbandoned", { defaultValue: "This room expired before drafting." })}
            </p>
          </NeoCard>
        )}
      </div>
    </ShellLayout>
  );
}
