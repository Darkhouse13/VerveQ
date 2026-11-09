import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Image } from "expo-image";
import { router, type Href } from "expo-router";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { Check } from "phosphor-react-native/src/icons/Check";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Crown } from "phosphor-react-native/src/icons/Crown";
import { Export } from "phosphor-react-native/src/icons/Export";
import { Fire } from "phosphor-react-native/src/icons/Fire";
import { Hourglass } from "phosphor-react-native/src/icons/Hourglass";
import { House } from "phosphor-react-native/src/icons/House";
import { Info } from "phosphor-react-native/src/icons/Info";
import { Lightning } from "phosphor-react-native/src/icons/Lightning";
import { Plus } from "phosphor-react-native/src/icons/Plus";
import { Target } from "phosphor-react-native/src/icons/Target";
import { Trophy } from "phosphor-react-native/src/icons/Trophy";
import { XCircle } from "phosphor-react-native/src/icons/XCircle";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, Share, Text, TextInput, View } from "react-native";

import { AppBar, Button, Card, Eyebrow, Mono, Tag, Txt, haptic } from "@/components/ui";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";
import { Avatar, arenaUrl, errorText, fmtPts, modeCapacity, modeLabel, subjectLabel, subjectLine, useServerNow, useTick } from "./shared";

export type Room = NonNullable<FunctionReturnType<typeof api.challengeArenas.getRoom>>;
type Player = Room["players"][number];

const indexOf = (room: Room, userId: string) => Math.max(0, room.players.findIndex((p) => p.userId === userId));
const activePlayers = (room: Room) => room.players.filter((p) => !p.left);

async function invite(code: string) {
  haptic.tap();
  const url = arenaUrl(code);
  try {
    await Share.share({ message: `Join my VerveQ live room — code ${code}\n${url}`, url, title: "VerveQ live room" });
  } catch {
    /* dismissed */
  }
}

// ── Lobby ───────────────────────────────────────────────────────────────

export function LobbyView({ room, me, bottomInset }: { room: Room; me: string; bottomInset: number }) {
  const setReady = useMutation(api.challengeArenas.setReady);
  const setTeam = useMutation(api.challengeArenas.setTeam);
  const start = useMutation(api.challengeArenas.start);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useTick(true, 1000);

  const players = activePlayers(room);
  const mine = room.players.find((p) => p.userId === me);
  const isHost = room.hostId === me;
  const cap = modeCapacity(room.mode);
  const allReady = players.length >= 2 && players.every((p) => p.ready);
  const canForce = now >= room.forceStartAvailableAt && players.length >= 2;
  const unready = players.filter((p) => !p.ready && p.userId !== room.hostId).length;

  const run = async (fn: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e, fallback));
    } finally {
      setBusy(false);
    }
  };

  const row = (p: Player) => {
    const you = p.userId === me;
    return (
      <View key={p.userId} style={{ minHeight: size.listRow, flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l, paddingVertical: space.m, borderBottomWidth: 1, borderBottomColor: color.lineSoft }}>
        <Avatar name={p.nameSnapshot} index={indexOf(room, p.userId)} />
        <View style={{ flex: 1, gap: space.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
            <Txt v="rowTitle" numberOfLines={1} style={{ flexShrink: 1 }}>
              {p.nameSnapshot}
            </Txt>
            {you ? <Txt v="caption" c={color.muted}>(you)</Txt> : null}
          </View>
          {p.isHost ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
              <Crown size={16} weight="fill" color={color.yellow} />
              <Mono s={11} c={color.yellow}>
                HOST
              </Mono>
            </View>
          ) : null}
        </View>
        {p.ready ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
            <CheckCircle size={20} weight="fill" color={color.right} />
            <Txt v="caption" c={color.right} style={{ fontFamily: font.bold }}>
              Ready
            </Txt>
          </View>
        ) : (
          <Txt v="caption" c={color.dim}>
            Not ready
          </Txt>
        )}
      </View>
    );
  };

  const empty = Math.max(0, cap - players.length);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: space.xl, gap: space.xxl }}>
        <View style={{ paddingHorizontal: space.gutter, alignItems: "center", gap: space.s }}>
          <Eyebrow>Room code</Eyebrow>
          <Text maxFontSizeMultiplier={1} selectable style={{ fontFamily: font.mono, fontSize: 48, letterSpacing: 8, color: color.cream }}>
            {room.code}
          </Text>
          <Txt v="caption" c={color.muted}>
            {`${modeLabel(room.mode)} · ${room.config.rounds} rounds × ${room.config.perRound} questions`}
          </Txt>
          <View style={{ flexDirection: "row", gap: space.m, marginTop: space.s, alignSelf: "stretch" }}>
            <Button variant="secondary" label="Invite" icon={Export} style={{ flex: 1 }} onPress={() => invite(room.code)} />
          </View>
        </View>

        <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Eyebrow>Players</Eyebrow>
            <Mono s={12} c={color.muted}>{`${players.length}/${cap} joined`}</Mono>
          </View>

          {room.mode === "2v2" ? (
            <View style={{ flexDirection: "row", gap: space.m }}>
              {(["A", "B"] as const).map((team) => {
                const on = mine?.team === team;
                const members = players.filter((p) => p.team === team);
                return (
                  <Pressable
                    key={team}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    disabled={busy || on}
                    onPress={() => run(() => setTeam({ arenaId: room.arenaId, team }), "Couldn't switch team")}
                    style={{ flex: 1, padding: space.l, gap: space.s, borderRadius: radius.card, borderWidth: on ? 2 : 1, borderColor: on ? color.lime : color.lineSoft, backgroundColor: color.surface }}
                  >
                    <Eyebrow c={on ? color.lime : color.muted}>{`Team ${team}`}</Eyebrow>
                    <Txt v="caption" c={color.cream} numberOfLines={2}>
                      {members.length ? members.map((m) => m.nameSnapshot).join(", ") : "Empty"}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
            {players.map(row)}
            {Array.from({ length: empty }, (_, i) => (
              <View key={`empty-${i}`} style={{ minHeight: size.listRow, flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", borderColor: color.line, alignItems: "center", justifyContent: "center" }}>
                  <Plus size={16} weight="bold" color={color.dim} />
                </View>
                <Txt c={color.dim}>Waiting for a player…</Txt>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={{ paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: bottomInset + space.xxl, gap: space.m }}>
        {error ? (
          <Txt v="caption" c={color.wrong} center>
            {error}
          </Txt>
        ) : null}
        {mine && !mine.ready ? (
          <Button label="I'm ready" icon={Check} disabled={busy} onPress={() => run(() => setReady({ arenaId: room.arenaId, ready: true }), "Couldn't mark you ready")} />
        ) : mine && !isHost ? (
          <Button variant="secondary" label="Not ready yet" disabled={busy} onPress={() => run(() => setReady({ arenaId: room.arenaId, ready: false }), "Try again")} />
        ) : null}
        {isHost && mine?.ready ? (
          allReady ? (
            <Button label={`Start with ${players.length} players`} disabled={busy} onPress={() => run(() => start({ arenaId: room.arenaId }), "Couldn't start")} />
          ) : players.length < 2 ? (
            <Txt v="caption" c={color.muted} center>
              Invite at least 1 friend to start.
            </Txt>
          ) : canForce ? (
            <Button
              label={`Start without ${unready} not ready`}
              variant="secondary"
              disabled={busy}
              onPress={() => run(() => start({ arenaId: room.arenaId, force: true }), "Couldn't start")}
            />
          ) : (
            <Txt v="caption" c={color.muted} center>
              Waiting for everyone to be ready.
            </Txt>
          )
        ) : null}
      </View>
    </View>
  );
}

// ── Countdown ───────────────────────────────────────────────────────────

export function CountdownView({ room }: { room: Room }) {
  const [n, setN] = useState(3);
  useEffect(() => {
    const id = setInterval(() => setN((x) => Math.max(1, x - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  const first = room.config.categories[0];
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.l, paddingHorizontal: space.gutter }}>
      <Eyebrow>{`Round 1 · ${subjectLabel(first)}`}</Eyebrow>
      <Text maxFontSizeMultiplier={1} style={{ fontFamily: font.mono, fontSize: 96, color: color.lime }}>{n}</Text>
      <Txt c={color.muted}>Get ready</Txt>
    </View>
  );
}

// ── Question / reveal ───────────────────────────────────────────────────

function Scoreboard({ room, me }: { room: Room; me: string }) {
  const players = activePlayers(room);
  const reveal = room.phase !== "question";
  return (
    <View style={{ flexDirection: "row", gap: space.s, paddingHorizontal: space.gutter }}>
      {players.map((p) => {
        const ans = reveal ? room.revealAnswers.find((a) => a.userId === p.userId) : null;
        return (
          <View
            key={p.userId}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: space.s, padding: space.s, borderRadius: radius.tile, backgroundColor: color.surface, borderWidth: 1, borderColor: p.userId === me ? color.line : color.lineSoft }}
          >
            <Avatar name={p.nameSnapshot} index={indexOf(room, p.userId)} sizePx={32} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="micro" c={color.muted} numberOfLines={1}>
                {p.userId === me ? "You" : p.nameSnapshot}
              </Txt>
              <Mono s={13}>{fmtPts(p.totalScore)}</Mono>
            </View>
            {ans ? ans.correct ? <CheckCircle size={16} weight="fill" color={color.right} /> : <XCircle size={16} weight="fill" color={color.wrong} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function Countdown({ room }: { room: Room }) {
  const serverNow = useServerNow(room.timer?.serverNow, room.phase === "question");
  const start = room.timer?.questionStartedAt;
  const windowMs = room.timer?.questionWindowMs ?? 10_000;
  const remaining = start && serverNow ? Math.min(windowMs, Math.max(0, start + windowMs - serverNow)) : windowMs;
  const frac = room.phase === "question" ? remaining / windowMs : 0;
  const low = remaining < 3000;
  return (
    <View style={{ paddingHorizontal: space.gutter, gap: space.s }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: color.line, overflow: "hidden" }}>
        <View style={{ width: `${frac * 100}%`, height: 8, borderRadius: 4, backgroundColor: low ? color.wrong : color.lime }} />
      </View>
      {room.phase === "question" ? (
        <Mono s={13} c={low ? color.wrong : color.muted} style={{ alignSelf: "flex-end" }}>{`${Math.ceil(remaining / 1000)} s`}</Mono>
      ) : null}
    </View>
  );
}

const same = (a?: string | null, b?: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export function QuestionView({ room, me, bottomInset }: { room: Room; me: string; bottomInset: number }) {
  const submit = useMutation(api.challengeArenas.submitAnswer);
  const q = room.currentQuestion;
  const slot = `${room.currentRound}:${room.currentQuestionIndex}`;
  const [picked, setPicked] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [logoState, setLogoState] = useState<"idle" | "wrong" | "close" | "correct">("idle");
  const [checkingLogo, setCheckingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSlot = useRef(slot);
  const buzzed = useRef<string | null>(null);

  // New question → reset local answer state.
  useEffect(() => {
    if (lastSlot.current !== slot) {
      lastSlot.current = slot;
      setPicked(null);
      setTyped("");
      setLogoState("idle");
      setError(null);
    }
  }, [slot]);

  const mineReveal = room.revealAnswers.find((a) => a.userId === me);
  useEffect(() => {
    if (room.phase === "reveal" && buzzed.current !== slot) {
      buzzed.current = slot;
      if (mineReveal?.correct) haptic.right();
      else haptic.wrong();
    }
  }, [room.phase, slot, mineReveal?.correct]);

  const answered = picked ?? room.myCurrentAnswer?.answer ?? null;
  const reveal = room.phase !== "question";
  const category = room.config.categories[room.currentRound];

  async function choose(value: string) {
    if (reveal || answered) return;
    haptic.tap();
    setPicked(value);
    try {
      await submit({ arenaId: room.arenaId, answer: value });
    } catch (e) {
      setError(errorText(e, "That answer didn't go through"));
    }
  }

  async function guessLogo() {
    const value = typed.trim();
    if (!value || reveal || logoState === "correct" || checkingLogo) return;
    setCheckingLogo(true);
    try {
      const res = await submit({ arenaId: room.arenaId, answer: value });
      if ("result" in res && res.result === "correct") {
        haptic.right();
        setLogoState("correct");
      } else if ("close" in res && res.close) {
        haptic.wrong();
        setLogoState("close");
      } else {
        haptic.wrong();
        setLogoState("wrong");
      }
    } catch (e) {
      setError(errorText(e, "That answer didn't go through"));
    } finally {
      setCheckingLogo(false);
    }
  }

  return (
    // Edge-to-edge Android doesn't resize the window for the keyboard; this keeps the logo input in view.
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={{ gap: space.l, paddingTop: space.s }}>
        <Countdown room={room} />
        <Scoreboard room={room} me={me} />
      </View>

      <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.m }}>
        <Eyebrow>{subjectLabel(category)}</Eyebrow>
        {q?.kind === "logo_text" ? (
          <>
            <Txt v="h1Game">{reveal ? (q.correctAnswer ?? "Name the company") : "Name the company"}</Txt>
            {q.imageUrl ? (
              <View style={{ height: 160, borderRadius: radius.hero, backgroundColor: color.cream, alignItems: "center", justifyContent: "center", padding: space.xl }}>
                <Image source={{ uri: q.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel="Logo to name" />
              </View>
            ) : null}
          </>
        ) : (
          <Txt v="h1Game">{q && "question" in q ? (q.question ?? "") : ""}</Txt>
        )}
      </View>

      {q?.kind === "logo_text" ? (
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.m }}>
          <TextInput maxFontSizeMultiplier={1.3}
            accessibilityLabel="Company name"
            value={typed}
            editable={!reveal && logoState !== "correct"}
            onChangeText={(t) => {
              setTyped(t);
              if (logoState === "wrong" || logoState === "close") setLogoState("idle");
            }}
            onSubmitEditing={() => {
              // The keyboard's send key skips Button's tap tick; same instant feedback.
              if (typed.trim() && !checkingLogo) haptic.tap();
              void guessLogo();
            }}
            returnKeyType="send"
            autoCorrect={false}
            placeholder="Type the company"
            placeholderTextColor={color.dim}
            style={{
              height: size.input,
              borderRadius: radius.input,
              borderWidth: 1.5,
              borderColor: logoState === "correct" ? color.right : logoState === "idle" ? color.line : color.wrong,
              backgroundColor: color.surface,
              paddingHorizontal: space.l,
              fontFamily: font.bold,
              fontSize: 17,
              color: color.cream,
            }}
          />
          <Txt v="caption" c={logoState === "correct" ? color.right : logoState === "idle" ? color.dim : color.wrong}>
            {logoState === "correct" ? "Got it" : logoState === "close" ? "So close, check the spelling" : logoState === "wrong" ? "Not that one, keep guessing" : "Unlimited guesses until time runs out"}
          </Txt>
          {!reveal && logoState !== "correct" ? <Button label={checkingLogo ? "Checking…" : "Guess"} disabled={!typed.trim() || checkingLogo} onPress={guessLogo} /> : null}
        </View>
      ) : (
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.m }}>
          {(q && "options" in q ? (q.options ?? []) : []).map((label, i) => {
            const value = (q && "optionValues" in q ? q.optionValues?.[i] : undefined) ?? label;
            const isMine = same(answered, value);
            const isRight = reveal && "correctAnswer" in q! && same(q!.correctAnswer as string | undefined, value);
            const isWrongMine = reveal && isMine && !isRight;
            const border = isRight ? color.right : isWrongMine ? color.wrong : isMine ? color.lime : color.line;
            const bg = isRight ? color.rightBg : isWrongMine ? color.wrongBg : color.surface;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityState={{ selected: isMine, disabled: reveal || !!answered }}
                onPress={() => choose(value)}
                style={({ pressed }) => ({
                  minHeight: 64,
                  borderRadius: radius.card,
                  borderWidth: isMine || isRight ? 2 : 1.5,
                  borderColor: border,
                  backgroundColor: bg,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.m,
                  paddingHorizontal: space.l,
                  paddingVertical: space.m,
                  opacity: reveal && !isRight && !isMine ? 0.55 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <View style={{ width: 32, height: 32, borderRadius: radius.chip, backgroundColor: isRight ? color.right : isWrongMine ? color.wrong : color.line, alignItems: "center", justifyContent: "center" }}>
                  {isRight ? <Check size={16} weight="bold" color={color.ink} /> : isWrongMine ? <XCircle size={16} weight="fill" color={color.ink} /> : <Mono s={13} c={color.muted}>{String.fromCharCode(65 + i)}</Mono>}
                </View>
                <Txt v="rowTitle" style={{ flex: 1 }}>
                  {label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: space.gutter, paddingBottom: bottomInset + space.xl, gap: space.s }}>
        {error ? (
          <Txt v="caption" c={color.wrong} center>
            {error}
          </Txt>
        ) : reveal && mineReveal ? (
          <Txt v="caption" c={mineReveal.correct ? color.right : color.muted} center>
            {mineReveal.correct ? `+${fmtPts(mineReveal.points)} pts` : "No points this time"}
          </Txt>
        ) : answered && !reveal ? (
          <Txt v="caption" c={color.muted} center>
            Locked in. Waiting for the others…
          </Txt>
        ) : (
          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: space.s }}>
            <Info size={16} weight="bold" color={color.dim} />
            <Txt v="caption" c={color.dim}>
              Faster right answers score more · first right gets +50
            </Txt>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Round break ─────────────────────────────────────────────────────────

export function RoundBreakView({ room, me, bottomInset }: { room: Room; me: string; bottomInset: number }) {
  const readyNext = useMutation(api.challengeArenas.readyNextRound);
  const [busy, setBusy] = useState(false);
  const [seenAt] = useState(() => Date.now());
  const now = useTick(true, 500);
  const left = Math.max(0, Math.ceil((seenAt + 8000 - now) / 1000));
  const rows = room.roundLeaderboard ?? [];
  const totals = new Map(room.players.map((p) => [p.userId as string, p.totalScore]));
  const totalOf = (ids: string[]) => ids.reduce((sum, id) => sum + (totals.get(id) ?? 0), 0);
  const ranked = [...rows].sort((a, b) => totalOf(b.playerIds as string[]) - totalOf(a.playerIds as string[]));
  const meReady = room.players.find((p) => p.userId === me)?.ready;
  const roundWinner = rows[0];
  const iWonRound = roundWinner?.playerIds.some((id) => id === me);
  const nextCat = room.config.categories[room.currentRound + 1];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.s }}>
        <Eyebrow>{`Round ${room.currentRound + 1} done · ${subjectLabel(room.config.categories[room.currentRound])}`}</Eyebrow>
        <Txt v="h1Game">{iWonRound ? "You won this round" : `${roundWinner?.label ?? "Someone"} won this round`}</Txt>
      </View>

      <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xxl, gap: space.m }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Eyebrow>Standings</Eyebrow>
          <Eyebrow>This round · total</Eyebrow>
        </View>
        <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, overflow: "hidden" }}>
          {ranked.map((r, i) => {
            const mine = r.playerIds.some((id) => id === me);
            return (
              <View key={r.id} style={{ minHeight: size.listRow, flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l, backgroundColor: mine ? color.surfaceHigh : undefined, borderBottomWidth: i === ranked.length - 1 ? 0 : 1, borderBottomColor: color.lineSoft }}>
                <Mono s={15} c={color.muted} style={{ width: 16 }}>{`${i + 1}`}</Mono>
                {room.mode === "2v2" ? null : <Avatar name={r.label} index={indexOf(room, r.playerIds[0] as string)} />}
                <Txt v="rowTitle" style={{ flex: 1 }} numberOfLines={1}>
                  {mine && room.mode !== "2v2" ? "You" : r.label}
                </Txt>
                <Mono s={13} c={color.right}>{`+${fmtPts(r.score)}`}</Mono>
                <Mono s={15} style={{ minWidth: 56, textAlign: "right" }}>
                  {fmtPts(totalOf(r.playerIds as string[]))}
                </Mono>
              </View>
            );
          })}
        </View>
      </View>

      {nextCat ? (
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xxl }}>
          <Card style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
            <View style={{ width: 48, height: 48, borderRadius: radius.tile, backgroundColor: color.surfaceHigh, alignItems: "center", justifyContent: "center" }}>
              <Hourglass size={24} weight="regular" color={color.cream} />
            </View>
            <View style={{ flex: 1, gap: space.xs }}>
              <Eyebrow>{`Next up · round ${room.currentRound + 2}`}</Eyebrow>
              <Txt v="rowTitle">{subjectLabel(nextCat)}</Txt>
              <Txt v="caption" c={color.muted}>
                {subjectLine(nextCat)}
              </Txt>
            </View>
          </Card>
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: space.gutter, paddingBottom: bottomInset + space.xxl, gap: space.m }}>
        <Txt v="caption" c={color.muted} center>
          {`Next round in ${left} s, or as soon as everyone's ready`}
        </Txt>
        <Button
          label={meReady ? "Ready" : "I'm ready"}
          icon={Check}
          disabled={busy || !!meReady}
          onPress={async () => {
            setBusy(true);
            try {
              await readyNext({ arenaId: room.arenaId });
            } catch {
              /* the scheduled advance will move the room on anyway */
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
    </View>
  );
}

// ── Final ───────────────────────────────────────────────────────────────

export function FinalView({ room, me, bottomInset }: { room: Room; me: string; bottomInset: number }) {
  const summary = useQuery(api.challengeArenas.getArenaSummary, { arenaId: room.arenaId });
  const rematch = useMutation(api.challengeArenas.rematch);
  const [busy, setBusy] = useState(false);
  const podium = room.finalPodium ?? [];
  const winner = podium[0];
  const myRank = podium.findIndex((r) => r.playerIds.some((id) => id === me));
  const iWon = myRank === 0;
  const behind = winner && myRank > 0 ? winner.score - podium[myRank]!.score : 0;
  const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

  const nameOf = (p: { userId: string; nameSnapshot: string }) => (p.userId === me ? "You" : p.nameSnapshot);
  const awards = summary
    ? [
        summary.superlatives.fastest[0] && {
          icon: Lightning,
          title: "Fastest",
          who: nameOf(summary.superlatives.fastest[0]),
          detail: `avg ${((summary.superlatives.fastest[0].avgCorrectMs ?? 0) / 1000).toFixed(1)} s`,
        },
        summary.superlatives.sharpshooter[0] && {
          icon: Target,
          title: "Accuracy",
          who: nameOf(summary.superlatives.sharpshooter[0]),
          detail: `${Math.round(summary.superlatives.sharpshooter[0].accuracy * 100)}%`,
        },
        summary.superlatives.hotStreak[0] && {
          icon: Fire,
          title: "Best streak",
          who: nameOf(summary.superlatives.hotStreak[0]),
          detail: `${summary.superlatives.hotStreak[0].longestStreak} in a row`,
        },
      ].filter(Boolean)
    : [];

  async function doRematch() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await rematch({ arenaId: room.arenaId });
      router.replace(`/arena/${res.code}` as Href);
    } catch {
      setBusy(false);
    }
  }

  // Podium order on screen: 2nd, 1st, 3rd.
  const blocks = [podium[1], podium[0], podium[2]].map((r, i) => ({ r, place: [2, 1, 3][i]!, h: [96, 128, 64][i]! })).filter((b) => b.r);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, alignItems: "center", gap: space.s }}>
        <Trophy size={40} weight="fill" color={color.yellow} />
        <Txt v="h1Tab" center>
          {iWon ? "You win" : `${winner?.label ?? "Game"} wins`}
        </Txt>
        {myRank > 0 ? (
          <Txt c={color.muted} center>{`You came ${ordinal(myRank + 1)}, ${fmtPts(behind)} pts behind`}</Txt>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: space.s, paddingHorizontal: space.gutter, paddingTop: space.xl }}>
        {blocks.map(({ r, place, h }) => {
          const firstId = r!.playerIds[0] as string;
          const mine = r!.playerIds.some((id) => id === me);
          return (
            <View key={r!.id} style={{ flex: 1, alignItems: "center", gap: space.s }}>
              {room.mode === "2v2" ? null : <Avatar name={r!.label} index={indexOf(room, firstId)} />}
              <Txt v="caption" numberOfLines={1} style={{ fontFamily: font.bold }}>
                {mine && room.mode !== "2v2" ? "You" : r!.label}
              </Txt>
              <View style={{ alignSelf: "stretch", height: h, borderRadius: radius.card, backgroundColor: place === 1 ? color.lime : color.surface, borderWidth: place === 1 ? 0 : 1, borderColor: color.lineSoft, alignItems: "center", justifyContent: "center", gap: space.xs }}>
                <Mono s={20} c={place === 1 ? color.ink : color.cream}>{`${place}`}</Mono>
                <Mono s={12} c={place === 1 ? color.ink : color.muted}>
                  {fmtPts(r!.score)}
                </Mono>
              </View>
            </View>
          );
        })}
      </View>

      {awards.length ? (
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xxl, gap: space.m }}>
          <Eyebrow>Awards</Eyebrow>
          <View style={{ flexDirection: "row", gap: space.s }}>
            {awards.map((a) => {
              if (!a) return null;
              const Ico = a.icon;
              return (
                <Card key={a.title} style={{ flex: 1, gap: space.s, padding: space.m }}>
                  <Ico size={20} weight="fill" color={color.yellow} />
                  <Eyebrow>{a.title}</Eyebrow>
                  <Txt v="caption" style={{ fontFamily: font.bold }} numberOfLines={1}>
                    {a.who}
                  </Txt>
                  <Mono s={12} c={color.muted}>
                    {a.detail}
                  </Mono>
                </Card>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      <View style={{ paddingHorizontal: space.gutter, paddingBottom: bottomInset + space.xxl, gap: space.m }}>
        {room.rematchArenaCode ? (
          <Button label="Join the rematch" icon={ArrowClockwise} onPress={() => router.replace(`/arena/${room.rematchArenaCode}` as Href)} />
        ) : (
          <Button label="Rematch, same players" icon={ArrowClockwise} disabled={busy} onPress={doRematch} />
        )}
        <View style={{ flexDirection: "row", gap: space.m }}>
          <Button variant="secondary" label="New room" icon={Plus} style={{ flex: 1, paddingHorizontal: space.l }} onPress={() => router.replace("/arena" as Href)} />
          <Button variant="secondary" label="Home" icon={House} style={{ flex: 1, paddingHorizontal: space.l }} onPress={() => router.dismissAll()} />
        </View>
      </View>
    </View>
  );
}

export function RoomBar({ room, onLeave }: { room: Room; onLeave: () => void }) {
  const phase = room.phase;
  const eyebrow =
    phase === "lobby"
      ? "Lobby"
      : phase === "final"
        ? `Room ${room.code}`
        : phase === "round_break" || phase === "countdown"
          ? room.code
          : `Round ${room.currentRound + 1}/${room.config.rounds} · Q ${room.currentQuestionIndex + 1}/${room.config.perRound}`;
  return <AppBar title={phase === "final" ? "Final" : "Live room"} eyebrow={eyebrow} onBack={onLeave} close={phase !== "lobby" && phase !== "final"} />;
}

export function EndedView({ title, line, bottomInset }: { title: string; line: string; bottomInset: number }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: space.gutter, paddingBottom: bottomInset + space.xxl }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.m }}>
        <Tag label="Room closed" c={color.muted} />
        <Txt v="h1Game" center>
          {title}
        </Txt>
        <Txt c={color.muted} center>
          {line}
        </Txt>
      </View>
      <Button label="New room" onPress={() => router.replace("/arena" as Href)} />
    </View>
  );
}
