import type { FunctionReturnType } from "convex/server";
import { ArrowDown } from "phosphor-react-native/src/icons/ArrowDown";
import { ArrowUp } from "phosphor-react-native/src/icons/ArrowUp";
import { CalendarBlank } from "phosphor-react-native/src/icons/CalendarBlank";
import { Check } from "phosphor-react-native/src/icons/Check";
import { MagnifyingGlass } from "phosphor-react-native/src/icons/MagnifyingGlass";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { Robot } from "phosphor-react-native/src/icons/Robot";
import { Scroll } from "phosphor-react-native/src/icons/Scroll";
import { SignOut } from "phosphor-react-native/src/icons/SignOut";
import { Star } from "phosphor-react-native/src/icons/Star";
import { Sword } from "phosphor-react-native/src/icons/Sword";
import { Timer } from "phosphor-react-native/src/icons/Timer";
import { UserPlus } from "phosphor-react-native/src/icons/UserPlus";
import { X } from "phosphor-react-native/src/icons/X";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Button, Card, Eyebrow, IconButton, Mono, PillButton, Txt, haptic } from "@/components/ui";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";
import { Badge, List, Sheet, formatBank, formatPrice, useTick } from "./social";

export type DraftRoom = NonNullable<FunctionReturnType<typeof api.fantasyDraftRooms.getRoom>>;
export type DraftPool = NonNullable<FunctionReturnType<typeof api.fantasyDraftRooms.getDraftPool>>;
export type PoolPlayer = DraftPool[number];

const POOL_CAP = 60;

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View
      style={{
        height: size.input,
        borderRadius: radius.input,
        borderWidth: 1.5,
        borderColor: color.line,
        backgroundColor: color.surface,
        paddingHorizontal: space.l,
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
      }}
    >
      <MagnifyingGlass size={20} weight="bold" color={color.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={color.dim}
        selectionColor={color.lime}
        autoCorrect={false}
        style={{ flex: 1, color: color.cream, fontFamily: font.bold, fontSize: 17, height: "100%" }}
      />
      {value.length > 0 ? (
        <Pressable accessibilityLabel="Clear search" onPress={() => onChange("")} hitSlop={12}>
          <X size={20} weight="bold" color={color.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Lobby ──────────────────────────────────────────────────────────────────

function nextDays(n: number) {
  const out: { key: string; label: string; date: Date }[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(base.getTime() + i * 86_400_000);
    out.push({ key: d.toISOString(), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short" }), date: d });
  }
  return out;
}
const TIMES = [18, 19, 20, 21];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={{ height: 36, paddingHorizontal: space.m, borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? color.lime : color.line, justifyContent: "center" }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: 13, color: on ? color.lime : color.muted }}>{label}</Text>
    </Pressable>
  );
}

export function LobbyView({
  room,
  busy,
  onReady,
  onArm,
  onClaim,
  onLeave,
  onSchedule,
  onReplace,
}: {
  room: DraftRoom;
  busy: boolean;
  onReady: (ready: boolean) => void;
  onArm: () => void;
  onClaim: () => void;
  onLeave: () => void;
  onSchedule: (at: number | null) => void;
  onReplace: (removeUserId: string, addUserId: string) => void;
}) {
  const mySeat = room.mySeatIndex === null ? null : room.seats[room.mySeatIndex];
  const isCreator = mySeat !== null && mySeat.userId === room.createdBy;
  const allReady = room.seats.length >= 2 && room.seats.every((s) => s.ready);
  const waitingOn = room.seats.filter((s) => !s.ready).map((s) => s.name);
  const available = room.crewMembers.filter((m) => !room.seats.some((s) => s.userId === m.userId));
  const [replaceFor, setReplaceFor] = useState<{ userId: string; name: string } | null>(null);
  const days = useMemo(() => nextDays(5), []);
  const [day, setDay] = useState<string | null>(null);
  const [hour, setHour] = useState<number | null>(null);

  return (
    <View style={{ gap: space.xl }}>
      <Card hero style={{ alignItems: "center", gap: space.s, borderColor: color.lime }}>
        <Eyebrow c={color.lime}>Drafting for</Eyebrow>
        <Txt v="h1Tab">{room.gameweek === null ? "—" : `GW ${room.gameweek.gwNumber}`}</Txt>
        <Mono s={12} c={color.muted}>
          {`${room.crew?.code ?? ""} · 13 ROUNDS · 6:30 BANK EACH`}
        </Mono>
      </Card>

      <View style={{ gap: space.m }}>
        <Eyebrow>{`Seats · ${room.seats.length} of 8`}</Eyebrow>
        <List>
          {room.seats.map((seat, i) => (
            <View
              key={seat.userId}
              style={{
                minHeight: size.listRow,
                paddingHorizontal: space.l,
                flexDirection: "row",
                alignItems: "center",
                gap: space.m,
                borderBottomWidth: i === room.seats.length - 1 ? 0 : 1,
                borderBottomColor: color.lineSoft,
                backgroundColor: i === room.mySeatIndex ? color.surfaceHigh : "transparent",
              }}
            >
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space.s, minWidth: 0 }}>
                <Txt v="rowTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {seat.name}
                </Txt>
                {seat.userId === room.createdBy ? <Eyebrow>Host</Eyebrow> : null}
              </View>
              <Badge label={seat.ready ? "Ready" : "Idle"} tone={seat.ready ? "good" : "muted"} />
              {isCreator && seat.userId !== room.createdBy && available.length > 0 ? (
                <PillButton label="Replace" outline onPress={() => setReplaceFor({ userId: seat.userId, name: seat.name })} />
              ) : null}
            </View>
          ))}
        </List>
      </View>

      <View style={{ gap: space.m }}>
        {mySeat === null ? (
          <Button label={room.seats.length >= 8 ? "All 8 seats are claimed" : "Claim a draft seat"} icon={UserPlus} disabled={busy || room.seats.length >= 8} onPress={onClaim} />
        ) : (
          <Button
            label={mySeat.ready ? "Ready — tap to undo" : "Ready up"}
            variant={mySeat.ready ? "secondary" : "primary"}
            icon={mySeat.ready ? Check : undefined}
            disabled={busy}
            onPress={() => onReady(!mySeat.ready)}
          />
        )}
        {isCreator ? (
          <>
            <Button label="Start the draft" icon={Sword} variant={allReady ? "primary" : "secondary"} disabled={!allReady || busy} onPress={onArm} />
            {!allReady ? (
              <Txt v="caption" c={color.muted} center>
                {room.seats.length < 2 ? "A draft needs at least 2 drafters." : `Waiting on: ${waitingOn.join(", ")}`}
              </Txt>
            ) : null}
          </>
        ) : null}
        {mySeat !== null ? <Button label="Release my seat" variant="ghost" icon={SignOut} disabled={busy} onPress={onLeave} /> : null}
      </View>

      {isCreator ? (
        <Card style={{ gap: space.l }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
            <CalendarBlank size={20} weight="bold" color={color.cream} />
            <Txt v="rowTitle">Plan the draft</Txt>
          </View>
          {room.scheduledFor !== null ? (
            <Txt v="caption" c={color.muted}>
              {`Planned: ${new Date(room.scheduledFor).toLocaleString(undefined, { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
            </Txt>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
            {days.map((d) => (
              <Chip key={d.key} label={d.label} on={day === d.key} onPress={() => setDay(d.key)} />
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
            {TIMES.map((h) => (
              <Chip key={h} label={`${h}:00`} on={hour === h} onPress={() => setHour(h)} />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: space.m }}>
            <Button
              label="Save"
              variant="secondary"
              style={{ flex: 1 }}
              disabled={busy || day === null || hour === null}
              onPress={() => {
                const d = days.find((x) => x.key === day);
                if (!d || hour === null) return;
                const at = new Date(d.date);
                at.setHours(hour, 0, 0, 0);
                onSchedule(at.getTime());
              }}
            />
            {room.scheduledFor !== null ? <Button label="Clear" variant="ghost" style={{ flex: 1 }} disabled={busy} onPress={() => onSchedule(null)} /> : null}
          </View>
        </Card>
      ) : null}

      <Sheet open={replaceFor !== null} onClose={() => setReplaceFor(null)} title={`Replace ${replaceFor?.name ?? ""}`}>
        <List>
          {available.map((m, i) => (
            <Pressable
              key={m.userId}
              onPress={() => {
                if (replaceFor) onReplace(replaceFor.userId, m.userId);
                setReplaceFor(null);
              }}
              style={{ minHeight: size.listRow, paddingHorizontal: space.l, justifyContent: "center", borderBottomWidth: i === available.length - 1 ? 0 : 1, borderBottomColor: color.lineSoft }}
            >
              <Txt v="rowTitle">{m.name}</Txt>
            </Pressable>
          ))}
        </List>
      </Sheet>
    </View>
  );
}

// ── Order reveal ───────────────────────────────────────────────────────────

export function OrderRevealView({ room, offset }: { room: DraftRoom; offset: number }) {
  const serverNow = useTick(200) - offset;
  const order = room.snakeOrder ?? [];
  const revealedAt = room.orderRevealedAt ?? serverNow;
  const stepMs = room.orderRevealMs / (order.length + 1);
  const shown = Math.min(order.length, Math.max(0, Math.floor((serverNow - revealedAt) / stepMs)));
  return (
    <View style={{ gap: space.l }}>
      <Txt v="h1Game" center>
        The order
      </Txt>
      <View style={{ gap: space.m }}>
        {order.map((seatIndex, position) => {
          const on = position < shown;
          const mine = seatIndex === room.mySeatIndex;
          return (
            <Card
              key={seatIndex}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.l,
                borderColor: on ? (mine ? color.lime : color.line) : color.lineSoft,
                backgroundColor: on ? color.surface : color.surfaceLow,
              }}
            >
              <Mono s={20} c={on ? color.cream : color.dim} style={{ width: 32, textAlign: "center" }}>
                {position + 1}
              </Mono>
              <Txt v="rowTitle" c={on ? color.cream : color.dim}>
                {on ? `${room.seats[seatIndex]?.name ?? ""}${mine ? " (you)" : ""}` : "…"}
              </Txt>
            </Card>
          );
        })}
      </View>
      <Txt v="caption" c={color.muted} center>
        Snake order — last picks twice.
      </Txt>
    </View>
  );
}

// ── Shortlist ──────────────────────────────────────────────────────────────

export function ShortlistPanel({ pool, queuedIds, onChange, compact }: { pool: DraftPool | null | undefined; queuedIds: readonly string[]; onChange: (ids: string[]) => void; compact?: boolean }) {
  const [search, setSearch] = useState("");
  const byId = useMemo(() => new Map((pool ?? []).map((p) => [p.playerId as string, p])), [pool]);
  const queued = queuedIds.map((id) => byId.get(id)).filter((p): p is PoolPlayer => p !== undefined);
  const needle = search.trim().toLowerCase();
  const candidates = needle
    ? (pool ?? [])
        .filter((p) => !queuedIds.includes(p.playerId))
        .filter((p) => p.name.toLowerCase().includes(needle) || (p.clubName ?? "").toLowerCase().includes(needle))
        .sort((a, b) => (b.price ?? 4) - (a.price ?? 4))
        .slice(0, compact ? 6 : 12)
    : [];
  const move = (i: number, dir: -1 | 1) => {
    const next = [...queuedIds];
    const t = i + dir;
    if (t < 0 || t >= next.length) return;
    [next[i], next[t]] = [next[t]!, next[i]!];
    onChange(next);
  };
  return (
    <Card style={{ gap: space.m }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
        <Star size={20} weight="fill" color={color.yellow} />
        <Txt v="rowTitle">Private auto-pick queue</Txt>
      </View>
      <Txt v="caption" c={color.muted}>
        Your order is private. On timeout, legal queued players are tried first.
      </Txt>
      {queued.map((p, i) => (
        <View key={p.playerId} style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
          <Mono s={13} c={color.muted} style={{ width: 24 }}>
            {i + 1}
          </Mono>
          <Txt v="rowTitle" numberOfLines={1} style={{ flex: 1 }}>
            {p.name}
          </Txt>
          <IconButton icon={ArrowUp} label="Move up" onPress={() => move(i, -1)} />
          <IconButton icon={ArrowDown} label="Move down" onPress={() => move(i, 1)} />
          <IconButton icon={X} label="Remove" onPress={() => onChange(queuedIds.filter((id) => id !== p.playerId))} />
        </View>
      ))}
      <SearchBox value={search} onChange={setSearch} placeholder="Search to add players…" />
      {candidates.map((p) => (
        <Pressable
          key={p.playerId}
          onPress={() => {
            haptic.tap();
            onChange([...queuedIds, p.playerId]);
          }}
          style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: space.m }}
        >
          <Txt v="body" numberOfLines={1} style={{ flex: 1 }}>
            {`${p.name} · ${p.clubName ?? p.clubId}`}
          </Txt>
          <Plus size={20} weight="bold" color={color.lime} />
        </Pressable>
      ))}
    </Card>
  );
}

// ── Picks grid + log ───────────────────────────────────────────────────────

export function PicksGrid({ room, playerById }: { room: DraftRoom; playerById: ReadonlyMap<string, PoolPlayer> }) {
  const rounds = Math.max(1, ...room.picks.map((p) => p.round));
  const bySlot = new Map<string, DraftRoom["picks"][number]>();
  for (const p of room.picks) bySlot.set(`${p.round}:${p.seatIndex}`, p);
  const COL = 120;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, backgroundColor: color.surface }}>
      <View>
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: color.line, backgroundColor: color.surfaceHigh }}>
          <View style={{ width: 40, padding: space.s }}>
            <Mono s={12} c={color.muted}>
              R
            </Mono>
          </View>
          {room.seats.map((s, i) => (
            <View key={s.userId} style={{ width: COL, padding: space.s }}>
              <Txt v="micro" numberOfLines={1} c={i === room.mySeatIndex ? color.lime : color.cream}>
                {i === room.mySeatIndex ? `${s.name} (you)` : s.name}
              </Txt>
            </View>
          ))}
        </View>
        {Array.from({ length: rounds }, (_, r) => r + 1).map((r) => (
          <View key={r} style={{ flexDirection: "row", borderBottomWidth: r === rounds ? 0 : 1, borderBottomColor: color.lineSoft }}>
            <View style={{ width: 40, padding: space.s }}>
              <Mono s={12} c={color.muted}>
                {r}
              </Mono>
            </View>
            {room.seats.map((_, seatIndex) => {
              const pick = bySlot.get(`${r}:${seatIndex}`);
              const player = pick?.playerId ? playerById.get(pick.playerId) : undefined;
              return (
                <View key={seatIndex} style={{ width: COL, padding: space.s, flexDirection: "row", alignItems: "center", gap: space.xs }}>
                  <Txt v="caption" numberOfLines={1} c={pick ? color.cream : color.dim} style={{ flexShrink: 1 }}>
                    {pick === undefined ? "—" : (player?.name ?? "…")}
                  </Txt>
                  {pick?.auto ? <Robot size={16} weight="bold" color={color.muted} /> : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function DraftLog({ room, playerById }: { room: DraftRoom; playerById: ReadonlyMap<string, PoolPlayer> }) {
  return (
    <List>
      {[...room.picks].reverse().map((pick, i, arr) => (
        <View
          key={pick.seq}
          style={{
            minHeight: 48,
            paddingHorizontal: space.l,
            flexDirection: "row",
            alignItems: "center",
            gap: space.m,
            borderBottomWidth: i === arr.length - 1 ? 0 : 1,
            borderBottomColor: color.lineSoft,
          }}
        >
          <Mono s={12} c={color.muted} style={{ width: 32 }}>{`#${pick.pickNumber}`}</Mono>
          <Txt v="micro" numberOfLines={1} style={{ width: 80 }}>
            {room.seats[pick.seatIndex]?.name ?? "?"}
          </Txt>
          <Txt v="caption" numberOfLines={1} style={{ flex: 1, textAlign: "right" }}>
            {pick.playerId === null ? "—" : (playerById.get(pick.playerId)?.name ?? "…")}
          </Txt>
          <Mono s={12} c={color.muted}>{`${(pick.elapsedMs / 1000).toFixed(1)}s`}</Mono>
          {pick.auto ? <Badge label="Auto" /> : null}
        </View>
      ))}
    </List>
  );
}

// ── Drafting board ─────────────────────────────────────────────────────────

function useTurnRemaining(room: DraftRoom, offset: number, ms: number) {
  const serverNow = useTick(ms) - offset;
  const turnSeat = room.turnSeatIndex === null ? null : room.seats[room.turnSeatIndex];
  const elapsed = room.turnStartedAt === null ? 0 : Math.max(0, serverNow - room.turnStartedAt);
  return turnSeat ? Math.max(0, turnSeat.bankMs - elapsed) : 0;
}

/** Leaf: only this redraws on the 200 ms tick. */
function TurnClock({ room, offset }: { room: DraftRoom; offset: number }) {
  const remaining = useTurnRemaining(room, offset, 200);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
      <Timer size={20} weight="bold" color={remaining < 15_000 ? color.wrong : color.cream} />
      <Mono s={28} c={remaining < 15_000 ? color.wrong : color.cream}>
        {formatBank(remaining)}
      </Mono>
    </View>
  );
}

/** Leaf: seat banks tick once a second. */
function SeatsStrip({ room, offset }: { room: DraftRoom; offset: number }) {
  const remaining = useTurnRemaining(room, offset, 1000);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
      {room.seats.map((seat, i) => {
        const onClock = i === room.turnSeatIndex;
        const mine = i === room.mySeatIndex;
        return (
          <View
            key={seat.userId}
            style={{ height: 36, paddingHorizontal: space.m, borderRadius: radius.pill, borderWidth: 1.5, borderColor: onClock ? color.wrong : mine ? color.lime : color.line, justifyContent: "center" }}
          >
            <Mono s={12} c={onClock ? color.wrong : mine ? color.lime : color.muted}>
              {`${seat.name} · ${formatBank(onClock ? remaining : seat.bankMs)}`}
            </Mono>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function DraftBoardView({
  room,
  pool,
  offset,
  busy,
  onPick,
  queuedIds,
  onQueueChange,
}: {
  room: DraftRoom;
  pool: DraftPool | null | undefined;
  offset: number;
  busy: boolean;
  onPick: (playerId: string) => void;
  queuedIds: readonly string[];
  onQueueChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [showLog, setShowLog] = useState(false);
  const playerById = useMemo(() => new Map((pool ?? []).map((p) => [p.playerId as string, p])), [pool]);
  const takenBySeat = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of room.picks) if (p.playerId !== null) m.set(p.playerId, p.seatIndex);
    return m;
  }, [room.picks]);

  const round = Math.floor((room.currentPickIndex ?? 0) / Math.max(1, room.seats.length)) + 1;
  const turnSeat = room.turnSeatIndex === null ? null : room.seats[room.turnSeatIndex];
  const myTurn = room.turnSeatIndex !== null && room.turnSeatIndex === room.mySeatIndex;
  // Kickoff locks only need minute precision: a coarse clock keeps the list still.
  const coarseNow = useTick(30_000) - offset;

  const results = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (pool ?? [])
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || (p.clubName ?? "").toLowerCase().includes(needle))
      .sort((a, b) => (b.price ?? 4) - (a.price ?? 4) || a.name.localeCompare(b.name))
      .slice(0, POOL_CAP);
  }, [pool, search]);

  return (
    <View style={{ gap: space.xl }}>
      <Card hero style={{ flexDirection: "row", alignItems: "center", gap: space.l, borderColor: myTurn ? color.lime : color.lineSoft, borderWidth: myTurn ? 2 : 1 }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Mono s={11} c={color.muted}>{`ROUND ${round} OF 13 · #${(room.currentPickIndex ?? 0) + 1}`}</Mono>
          <Txt v="cardTitle" c={myTurn ? color.lime : color.cream} numberOfLines={2}>
            {myTurn ? "Your pick" : `${turnSeat?.name ?? "…"} is on the clock`}
          </Txt>
        </View>
        <TurnClock room={room} offset={offset} />
      </Card>

      <SeatsStrip room={room} offset={offset} />

      <PicksGrid room={room} playerById={playerById} />
      <ShortlistPanel pool={pool} queuedIds={queuedIds} onChange={onQueueChange} compact />

      <Button label={showLog ? "Hide draft log" : "Draft log"} variant="ghost" icon={Scroll} onPress={() => setShowLog((v) => !v)} />
      {showLog ? <DraftLog room={room} playerById={playerById} /> : null}

      <View style={{ gap: space.m }}>
        <Eyebrow>Players</Eyebrow>
        <SearchBox value={search} onChange={setSearch} placeholder="Search players or clubs…" />
        <List>
          {results.map((p, i) => {
            const takenSeat = takenBySeat.get(p.playerId);
            const started = p.kickoffAt !== null && p.kickoffAt <= coarseNow;
            const pickable = myTurn && takenSeat === undefined && !started && !busy;
            const dim = takenSeat !== undefined || started;
            return (
              <View
                key={p.playerId}
                style={{
                  minHeight: size.listRow,
                  paddingHorizontal: space.l,
                  paddingVertical: space.m,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.m,
                  borderBottomWidth: i === results.length - 1 ? 0 : 1,
                  borderBottomColor: color.lineSoft,
                  opacity: dim ? 0.45 : 1,
                }}
              >
                <View style={{ flex: 1, gap: space.xs, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
                    <Txt v="rowTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {p.name}
                    </Txt>
                    <Mono s={11} c={color.muted}>
                      {p.position}
                    </Mono>
                  </View>
                  <Txt v="caption" c={color.muted} numberOfLines={1}>
                    {p.clubName ?? p.clubId}
                  </Txt>
                </View>
                {!p.hasFixture ? <Badge label="No fixture" tone="warn" /> : null}
                {started ? <Badge label="Started" /> : null}
                {takenSeat !== undefined ? (
                  <Badge label={room.seats[takenSeat]?.name ?? "Taken"} />
                ) : (
                  <>
                    <Mono s={15}>{p.price === null ? "—" : formatPrice(p.price)}</Mono>
                    {myTurn ? <PillButton label="Pick" onPress={pickable ? () => onPick(p.playerId) : undefined} /> : null}
                  </>
                )}
              </View>
            );
          })}
        </List>
        {pool && results.length === POOL_CAP ? (
          <Txt v="caption" c={color.muted} center>
            {`Showing the top ${POOL_CAP} — search to narrow.`}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

// ── Completed ──────────────────────────────────────────────────────────────

export function CompletedView({ room, pool, onSheet, onBack }: { room: DraftRoom; pool: DraftPool | null | undefined; onSheet: () => void; onBack: () => void }) {
  const playerById = useMemo(() => new Map((pool ?? []).map((p) => [p.playerId as string, p])), [pool]);
  const autoCount = room.picks.filter((p) => p.auto).length;
  return (
    <View style={{ gap: space.xl }}>
      <Card hero style={{ alignItems: "center", gap: space.s, borderColor: color.right, backgroundColor: color.rightBg }}>
        <Check size={32} weight="bold" color={color.right} />
        <Txt v="cardTitle" center>
          Draft complete
        </Txt>
        <Txt v="caption" c={color.muted} center>
          Squads are on their default sheets — arrange yours before kickoff. Every player stays editable until his match starts.
        </Txt>
        {autoCount > 0 ? <Mono s={12} c={color.muted}>{`${autoCount} AUTO-PICKS`}</Mono> : null}
      </Card>
      {room.mySeatIndex !== null ? <Button label="Arrange your sheet" onPress={onSheet} /> : null}
      <PicksGrid room={room} playerById={playerById} />
      <DraftLog room={room} playerById={playerById} />
      <Button label="Back to the crew" variant="secondary" onPress={onBack} />
    </View>
  );
}
