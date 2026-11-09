import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { Export } from "phosphor-react-native/src/icons/Export";
import { Hourglass } from "phosphor-react-native/src/icons/Hourglass";
import { Lightbulb } from "phosphor-react-native/src/icons/Lightbulb";
import { LinkSimple } from "phosphor-react-native/src/icons/LinkSimple";
import { Trophy } from "phosphor-react-native/src/icons/Trophy";
import { UsersThree } from "phosphor-react-native/src/icons/UsersThree";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AnswerStrip,
  Avatar,
  NeedsNameCard,
  ScoreBlock,
  duelLabel,
  hoursLeft,
  shareDuelLink,
  useNeedsName,
  type DuelView,
} from "@/components/duel/common";
import { AppBar, Button, Card, Eyebrow, Mono, ProgressSegments, Tag, Txt, haptic } from "@/components/ui";
import { api } from "@/lib/convex";
import { color, radius, space } from "@/theme/tokens";
import { guardParams, isConvexId } from "@/lib/params";

type Reveal = { picked: string; correctValue: string; correct: boolean; explanation: string | null };

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function OptionButton({
  letter,
  label,
  state,
  onPress,
}: {
  letter: string;
  label: string;
  state: "idle" | "pending" | "right" | "wrong" | "dim";
  onPress?: () => void;
}) {
  const border = state === "right" ? color.right : state === "wrong" ? color.wrong : state === "pending" ? color.lime : state === "dim" ? color.lineSoft : color.line;
  const bg = state === "right" ? color.rightBg : state === "wrong" ? color.wrongBg : state === "dim" ? color.surfaceLow : color.surface;
  const tileBg = state === "right" ? color.right : state === "wrong" ? color.wrong : color.line;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64,
        borderRadius: radius.card,
        borderWidth: state === "right" || state === "wrong" || state === "pending" ? 2 : 1.5,
        borderColor: border,
        backgroundColor: bg,
        flexDirection: "row",
        alignItems: "center",
        gap: space.m,
        paddingHorizontal: space.l,
        paddingVertical: space.m,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View style={{ width: 32, height: 32, borderRadius: radius.chip, backgroundColor: tileBg, alignItems: "center", justifyContent: "center" }}>
        <Mono s={13} c={state === "right" || state === "wrong" ? color.ink : color.muted}>
          {letter}
        </Mono>
      </View>
      <Txt v="rowTitle" c={state === "dim" ? color.dim : color.cream} style={{ flex: 1 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function DuelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const duelId = id as DuelView["duelId"];
  const insets = useSafeAreaInsets();
  const { ready, needsName, user } = useNeedsName();

  const getMyDuel = useMutation(api.duels.getMyDuel);
  const submitAnswer = useMutation(api.duels.submitAnswer);
  const complete = useMutation(api.duels.complete);
  const markShared = useMutation(api.duels.markShared);
  const rematch = useMutation(api.duels.rematch);
  const status = useQuery(api.duels.getDuelStatus, ready && !needsName ? { duelId } : "skip");

  const [view, setView] = useState<DuelView | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [busy, setBusy] = useState(false);
  // The option just tapped, lit before the server grades it.
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completing = useRef(false);

  const load = useCallback(async () => {
    try {
      setView(await getMyDuel({ duelId }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error && /expired/i.test(e.message) ? "This duel has expired" : "Couldn't load this duel");
    }
  }, [getMyDuel, duelId]);

  useEffect(() => {
    if (!ready || needsName || view) return;
    getMyDuel({ duelId })
      .then(setView)
      .catch((e: unknown) => setError(e instanceof Error && /expired/i.test(e.message) ? "This duel has expired" : "Couldn't load this duel"));
  }, [ready, needsName, view, getMyDuel, duelId]);

  // All questions answered but not locked in yet → lock in.
  useEffect(() => {
    if (!view || completing.current) return;
    const answered = view.myResult.perQuestion.length;
    if (!view.currentQuestion && !view.myResult.completedAt && answered >= view.questionCount && view.status === "awaiting_opponent") {
      completing.current = true;
      complete({ duelId })
        .then(load)
        .catch(() => setError("Couldn't save your result — try again"))
        .finally(() => {
          completing.current = false;
        });
    }
  }, [view, complete, duelId, load]);

  // A resolved status should refresh the view (per-question data + winner).
  useEffect(() => {
    if (!view || !status || status.status === view.status) return;
    getMyDuel({ duelId })
      .then(setView)
      .catch(() => {});
  }, [status, view, getMyDuel, duelId]);

  // Leaving the app mid-question: the server clock keeps running (score is time-based).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active" && view?.status === "awaiting_opponent") void load();
    });
    return () => sub.remove();
  }, [view, load]);

  async function answer(value: string) {
    if (!view?.currentQuestion || busy || reveal) return;
    haptic.tap();
    setPending(value);
    setBusy(true);
    try {
      const r = await submitAnswer({ duelId, questionIndex: view.myResult.perQuestion.length, answer: value });
      if (r.correct) haptic.right();
      else haptic.wrong();
      setReveal({ picked: value, correctValue: r.correctAnswer, correct: r.correct, explanation: r.explanation });
    } catch {
      setError("That answer didn't go through — try again");
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  async function next() {
    setReveal(null);
    await load();
  }

  async function doRematch() {
    try {
      const r = await rematch({ duelId });
      router.replace(`/duels/${r.duelId}`);
    } catch {
      setError("Couldn't start a rematch");
    }
  }

  async function share() {
    if (!view?.linkCode) return;
    markShared({ duelId }).catch(() => {});
    await shareDuelLink(view.linkCode, view.myResult.score);
  }

  if (needsName) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="Duel" onBack={() => router.back()} />
        <NeedsNameCard next={`/duels/${duelId}`} />
      </View>
    );
  }

  const total = view?.questionCount ?? 10;
  const answered = view?.myResult.perQuestion.length ?? 0;

  // ── Loading / error ─────────────────────────────────────────────
  if (!view) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="Duel" onBack={() => router.back()} close />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.l, paddingHorizontal: space.gutter }}>
          {error ? (
            <>
              <Txt c={color.muted} center>
                {error}
              </Txt>
              <Button variant="secondary" label="Back to Friends" onPress={() => router.replace("/friends")} />
            </>
          ) : (
            <ActivityIndicator color={color.lime} />
          )}
        </View>
      </View>
    );
  }

  const meName = user?.username ?? "You";
  const them = view.role === "challenger" ? view.opponent : view.challenger;
  const themName = them.id ? them.username : "Your friend";

  // ── Playing ─────────────────────────────────────────────────────
  if (view.currentQuestion || reveal) {
    const q = view.currentQuestion;
    const segs: ("right" | "wrong" | "current")[] = view.myResult.perQuestion.map((a) => (a.correct ? "right" : "wrong"));
    const states = reveal ? [...segs, reveal.correct ? ("right" as const) : ("wrong" as const)] : [...segs, "current" as const];
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar
          title="Duel"
          eyebrow={duelLabel(view)}
          onBack={() => router.back()}
          close
          right={
            <Mono s={15}>
              {Math.min(answered + 1, total)}
              <Mono s={15} c={color.dim}>{`/${total}`}</Mono>
            </Mono>
          }
        />
        <View style={{ marginTop: space.s }}>
          <ProgressSegments states={states} total={total} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xxl, paddingBottom: space.xl, gap: space.xl }}>
          <View style={{ gap: space.m }}>
            {reveal ? <Tag label={reveal.correct ? "Correct" : "Wrong"} tone="solid" c={reveal.correct ? color.right : color.wrong} /> : null}
            <Txt v="h1Game">{q?.question ?? ""}</Txt>
          </View>
          <View style={{ gap: space.m }}>
            {q?.options.map((label, i) => {
              const value = q.optionValues[i] ?? label;
              let st: "idle" | "pending" | "right" | "wrong" | "dim" = value === pending ? "pending" : "idle";
              if (reveal) st = value === reveal.correctValue ? "right" : value === reveal.picked ? "wrong" : "dim";
              return <OptionButton key={value} letter={LETTERS[i] ?? "?"} label={label} state={st} onPress={reveal || busy ? undefined : () => answer(value)} />;
            })}
          </View>
          {reveal?.explanation ? (
            <View style={{ flexDirection: "row", gap: space.m }}>
              <Lightbulb size={20} weight="bold" color={color.yellow} />
              <Txt c={color.muted} style={{ flex: 1 }}>
                {reveal.explanation}
              </Txt>
            </View>
          ) : null}
        </ScrollView>
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
          {reveal ? (
            <Button label={answered + 1 >= total ? "See your score" : "Next question"} icon={ArrowRight} iconRight onPress={next} />
          ) : (
            <Txt v="caption" c={color.dim} center>
              Faster right answers score more
            </Txt>
          )}
          {error ? (
            <Txt v="caption" c={color.wrong} center>
              {error}
            </Txt>
          ) : null}
        </View>
      </View>
    );
  }

  const resolved = view.status === "resolved" || view.status === "expired";
  const myScore = view.myResult.score;

  // ── Result ──────────────────────────────────────────────────────
  if (resolved) {
    const iWon = view.winnerId != null && view.winnerId === user?._id;
    const draw = view.winnerId == null && view.status === "resolved";
    const headline = view.status === "expired" && !view.opponentResult.completedAt ? "Nobody took this one" : draw ? "Dead heat" : iWon ? "You won" : `${themName} wins`;
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="Duel" eyebrow={duelLabel(view)} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: space.xxl, gap: space.xl }}>
          <View style={{ alignItems: "center", gap: space.s }}>
            {iWon ? <Trophy size={32} weight="fill" color={color.yellow} /> : null}
            <Txt v="h1Game" center>
              {headline}
            </Txt>
          </View>
          <View style={{ flexDirection: "row", gap: space.m }}>
            <ScoreBlock name={meName} score={myScore} sub="You" winner={iWon} />
            <ScoreBlock
              name={themName}
              score={view.opponentResult.completedAt ? view.opponentResult.score : "–"}
              sub={view.opponentResult.completedAt ? undefined : "Didn't finish"}
              winner={!iWon && !draw && view.winnerId != null}
            />
          </View>
          <View style={{ gap: space.m }}>
            <Eyebrow>Your answers</Eyebrow>
            <AnswerStrip perQuestion={view.myResult.perQuestion} total={total} />
          </View>
          {them.id ? (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/rivals/${them.id}`)}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: space.l }}>
                <Avatar name={themName} />
                <View style={{ flex: 1, gap: space.xs }}>
                  <Txt v="rowTitle">{`You vs ${themName}`}</Txt>
                  <Txt v="caption" c={color.muted}>
                    See your record
                  </Txt>
                </View>
                <ArrowRight size={20} weight="bold" color={color.dim} />
              </Card>
            </Pressable>
          ) : null}
        </ScrollView>
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
          <Button label={iWon ? "Rematch — defend your win" : "Rematch"} icon={ArrowClockwise} onPress={doRematch} />
          <Button variant="secondary" label="Back to Friends" onPress={() => router.replace("/friends")} />
        </View>
      </View>
    );
  }

  // ── Played, waiting for the other side ──────────────────────────
  const canShare = view.role === "challenger" && !!view.linkCode && !view.opponent.id;
  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title="Duel" eyebrow={duelLabel(view)} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: space.xxl, gap: space.xl }}>
        <View style={{ alignItems: "center", gap: space.m }}>
          <Tag label="Your turn is done" c={color.lime} />
          <Mono s={72}>{myScore}</Mono>
          <Txt c={color.muted}>{`${view.myResult.perQuestion.filter((a) => a.correct).length} of ${total} right`}</Txt>
        </View>
        <AnswerStrip perQuestion={view.myResult.perQuestion} total={total} />
        {canShare ? (
          <Card style={{ gap: space.m }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
              <LinkSimple size={20} weight="bold" color={color.muted} />
              <Mono s={13} c={color.cream} style={{ flex: 1 }}>{`verveq.com/s/d/${view.linkCode}`}</Mono>
            </View>
            <Txt v="caption" c={color.muted}>
              Send it to a friend. They play the same 10 questions and see your score to beat.
            </Txt>
          </Card>
        ) : (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
            <UsersThree size={20} weight="bold" color={color.muted} />
            <Txt v="caption" c={color.muted} style={{ flex: 1 }}>
              {view.opponentResult.completedAt ? "Both done — working out the winner…" : `${themName} hasn't finished yet`}
            </Txt>
          </Card>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s }}>
          <Hourglass size={16} weight="bold" color={color.dim} />
          <Txt v="caption" c={color.dim}>{`Ends in ${hoursLeft(view.expiresAt)} · you'll see the result in Friends`}</Txt>
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
        {canShare ? <Button label="Send to a friend" icon={Export} onPress={share} /> : null}
        <Button variant="secondary" label="Back to Friends" onPress={() => router.replace("/friends")} />
        {error ? (
          <Txt v="caption" c={color.wrong} center>
            {error}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

export default guardParams(DuelScreen, { id: isConvexId });
