import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { router } from "expo-router";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { ArrowUp } from "phosphor-react-native/src/icons/ArrowUp";
import { Heart } from "phosphor-react-native/src/icons/Heart";
import { Info } from "phosphor-react-native/src/icons/Info";
import { Lightbulb } from "phosphor-react-native/src/icons/Lightbulb";
import { SkipForward } from "phosphor-react-native/src/icons/SkipForward";
import { XCircle } from "phosphor-react-native/src/icons/XCircle";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button, Card, Eyebrow, Mono, Tag, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, size, space } from "@/theme/tokens";

import { clueText, type ClueI18n } from "./clues";
import { useGuardedLeave } from "@/lib/guardLeave";

type Challenge = {
  initials: string;
  difficulty: string;
  maskedName: string;
  potValue: number;
  clueStages: number;
  lettersRemaining: number;
};

type Verdict = { kind: "right" | "wrong" | "close" | "info"; text: string } | null;

type Ended = {
  score: number;
  rounds: number;
  correct: number;
  forfeited: boolean;
  eloChange: number | null;
  newElo: number | null;
};

const MASK = "•";
const isLetter = (ch: string) => /\p{L}/u.test(ch);

function errorCode(err: unknown): string | null {
  if (err instanceof ConvexError && err.data && typeof err.data === "object" && "code" in err.data) {
    return String((err.data as { code: unknown }).code);
  }
  return null;
}

/** "M•••• S••••" → one tile row per word (spec: revealed = cream tile, hidden = outline). */
function MaskTiles({ masked }: { masked: string }) {
  const words = masked.trim().split(/\s+/);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.l, rowGap: space.s }}>
      {words.map((word, w) => (
        <View key={w} style={{ flexDirection: "row", gap: space.xs }}>
          {Array.from(word).map((ch, i) =>
            ch === MASK ? (
              <View key={i} style={{ width: 22, height: 32, borderRadius: radius.chip, borderWidth: 1.5, borderColor: color.line }} />
            ) : isLetter(ch) ? (
              <View key={i} style={{ width: 22, height: 32, borderRadius: radius.chip, backgroundColor: color.cream, alignItems: "center", justifyContent: "center" }}>
                <Mono s={15} c={color.ink}>
                  {ch.toUpperCase()}
                </Mono>
              </View>
            ) : (
              <View key={i} style={{ height: 32, justifyContent: "center" }}>
                <Mono s={15} c={color.muted}>
                  {ch}
                </Mono>
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function Lives({ lives }: { lives: number }) {
  return (
    <View accessibilityLabel={`${lives} lives left of 3`} style={{ flexDirection: "row", gap: space.xs }}>
      {[0, 1, 2].map((i) => (
        <Heart key={i} size={20} weight={i < lives ? "fill" : "regular"} color={i < lives ? color.orange : color.dim} />
      ))}
    </View>
  );
}

export function SurvivalGame({ daily }: { daily: boolean }) {
  const insets = useSafeAreaInsets();
  const { ready, isAnonymous } = useSession();
  const startGame = useMutation(api.survivalSessions.startGame);
  const startDailyGame = useMutation(api.survivalSessions.startDailyGame);
  const submitGuess = useMutation(api.survivalSessions.submitGuess);
  const requestHelp = useMutation(api.survivalSessions.requestHelp);
  const skipChallenge = useMutation(api.survivalSessions.skipChallenge);
  const endRun = useMutation(api.survivalSessions.endRun);
  const penalize = useMutation(api.survivalSessions.penalizeTabSwitch);
  const completeSurvival = useMutation(api.games.completeSurvival);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [skipsLeft, setSkipsLeft] = useState(3);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [helpStage, setHelpStage] = useState(0);
  const [clues, setClues] = useState<ClueI18n[]>([]);
  const [guess, setGuess] = useState("");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<"played" | "failed" | null>(null);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [attempt, setAttempt] = useState(0);

  const correctRef = useRef(0);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);

  const gated = !daily && ready && isAnonymous;

  // ── start (or resume, for the daily) ──
  useEffect(() => {
    if (!ready || gated || startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        if (daily) {
          const r = await startDailyGame({});
          setSessionId(r.sessionId);
          setRound(r.round);
          setLives(r.lives);
          setScore(r.score);
          setSkipsLeft(r.skipsLeft);
          setChallenge(r.challenge);
          setHelpStage(r.helpStage ?? 0);
          setClues((r.clues ?? []) as ClueI18n[]);
        } else {
          const r = await startGame({ sport: "football" });
          setSessionId(r.sessionId);
          setRound(r.round);
          setLives(r.lives);
          setScore(r.score);
          setSkipsLeft(r.skipsLeft);
          setChallenge(r.challenge);
        }
      } catch (err) {
        setStartError(errorCode(err) === "already_attempted" ? "played" : "failed");
      }
    })();
  }, [ready, gated, daily, startDailyGame, startGame, attempt]);

  const finish = useCallback(
    async (finalScore: number, finalRound: number, forfeited = false) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      let eloChange: number | null = null;
      let newElo: number | null = null;
      // Daily runs never touch ELO; the server rejects them in completeSurvival.
      if (!daily && sessionId) {
        try {
          const res = await completeSurvival({ sessionId: sessionId as never });
          eloChange = res.eloChange;
          newElo = res.newElo;
        } catch {
          /* result still shows without the rating line */
        }
      }
      setEnded({ score: finalScore, rounds: finalRound, correct: correctRef.current, forfeited, eloChange, newElo });
    },
    [daily, sessionId, completeSurvival],
  );

  const nextRound = (c: Challenge | null, r: number) => {
    if (c) setChallenge(c);
    setRound(r);
    setHelpStage(0);
    setClues([]);
    setGuess("");
  };

  async function onGuess() {
    if (!sessionId || !guess.trim() || busy) return;
    setBusy(true);
    try {
      const res = await submitGuess({ sessionId: sessionId as never, guess: guess.trim() });
      if (res.closeCall) {
        haptic.wrong();
        setVerdict({
          kind: "close",
          text: res.ambiguousSurname
            ? "More than one player has that surname — type the full name."
            : "Close! Check your spelling.",
        });
        return;
      }
      setLives(res.lives);
      setScore(res.score);
      setStreak(res.speedStreak ?? 0);
      if (res.correct) {
        haptic.right();
        correctRef.current += 1;
        const shown = res.typoAccepted
          ? `Close enough — we counted ${res.correctAnswer}`
          : res.surnameMatch
            ? `Surname accepted: ${res.correctAnswer}`
            : `${res.correctAnswer} · +${res.pointsEarned} pts${res.earnedLife ? " · +1 life" : ""}`;
        setVerdict({ kind: "right", text: shown });
      } else {
        haptic.wrong();
        setVerdict({ kind: "wrong", text: res.correctAnswer ? `It was ${res.correctAnswer}` : "Wrong" });
      }
      if (res.gameOver) {
        await finish(res.score, res.round);
        return;
      }
      nextRound(res.nextChallenge, res.round);
    } catch {
      setVerdict({ kind: "info", text: "That guess didn't go through — try again" });
    } finally {
      setBusy(false);
    }
  }

  async function onHelp() {
    if (!sessionId || busy || !challenge) return;
    setBusy(true);
    try {
      const res = await requestHelp({ sessionId: sessionId as never });
      haptic.tap();
      setHelpStage(res.stage);
      if (res.kind === "clue" && res.hintI18n) setClues((prev) => [...prev, res.hintI18n as ClueI18n]);
      setChallenge({ ...challenge, maskedName: res.maskedName, potValue: res.potValue, lettersRemaining: res.lettersRemaining });
    } catch {
      setVerdict({ kind: "info", text: "Nothing left to reveal" });
    } finally {
      setBusy(false);
    }
  }

  async function onSkip() {
    if (!sessionId || busy || skipsLeft <= 0) return;
    setBusy(true);
    try {
      const res = await skipChallenge({ sessionId: sessionId as never });
      setSkipsLeft(res.skipsLeft);
      setVerdict(null);
      if (res.gameOver) {
        await finish(res.score, res.round);
        return;
      }
      nextRound(res.challenge, res.round);
    } catch {
      setVerdict({ kind: "info", text: "Couldn't skip — try again" });
    } finally {
      setBusy(false);
    }
  }

  function onCashOut() {
    if (!sessionId || busy) return;
    Alert.alert(
      "Cash out?",
      daily ? "This ends today's run. You get one Daily Survival run per day." : `Bank ${score} pts and end this run.`,
      [
        { text: "Keep playing", style: "cancel" },
        {
          text: "Cash out",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const res = await endRun({ sessionId: sessionId as never });
              await finish(res.score, res.round);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  // Back / X mid-run: confirm, then the same penalty as leaving the app.
  // Confirming the leave ends the run: a ranked run settles on its banked
  // score right away (no free exit from a bad run — the server also settles
  // abandoned runs on expiry); a daily run is forfeited as before.
  useGuardedLeave(!!sessionId && !ended, () => {
    if (!sessionId) return;
    if (daily) {
      void penalize({ sessionId: sessionId as never, currentRound: round }).catch(() => {});
      return;
    }
    void endRun({ sessionId: sessionId as never })
      .then(() => completeSurvival({ sessionId: sessionId as never }))
      .catch(() => {});
  });

  // Leaving the app mid-round = the web's tab-switch penalty (daily: the run is forfeited).
  const live = useRef({ sessionId, round, ended });
  useEffect(() => {
    live.current = { sessionId, round, ended };
  }, [sessionId, round, ended]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (st) => {
      const cur = live.current;
      if (st !== "background" || !cur.sessionId || cur.ended || finishedRef.current) return;
      try {
        const res = await penalize({ sessionId: cur.sessionId as never, currentRound: cur.round });
        if (!res.penalized) return;
        if ("dailyForfeit" in res && res.dailyForfeit) {
          await finish(0, cur.round, true);
          return;
        }
        setLives(res.lives);
        if (res.warning) {
          setVerdict({ kind: "info", text: "You left the app — this round's pot dropped to the floor. Next time costs a life." });
          if ("potValue" in res && typeof res.potValue === "number") {
            setChallenge((c) => (c ? { ...c, potValue: res.potValue as number } : c));
          }
        } else {
          setVerdict({ kind: "wrong", text: "You left the app — that cost a life." });
        }
        if (res.gameOver) await finish(score, cur.round);
      } catch {
        /* offline: the server still holds the run */
      }
    });
    return () => sub.remove();
  }, [penalize, finish, score]);

  const title = daily ? "Daily Survival" : "Survival";
  const eyebrow = `Round ${round}${daily ? " · Daily" : " · Ranked"}`;
  const clueNext = challenge ? helpStage < challenge.clueStages : false;
  const helpExhausted = challenge ? !clueNext && challenge.lettersRemaining <= 0 : true;

  // ── gates and states ──
  if (gated) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title={title} eyebrow="Ranked" onBack={() => router.back()} />
        <View style={{ flex: 1, paddingHorizontal: space.gutter, justifyContent: "center", gap: space.l }}>
          <Tag label="Ranked" c={color.lime} />
          <Txt v="h1Game">Create an account to play ranked</Txt>
          <Txt c={color.muted}>Ranked Survival counts toward your rating. Your streak and games come with you.</Txt>
          <Button label="Create account" onPress={() => router.push("/create-account")} style={{ marginTop: space.s }} />
          <Button variant="secondary" label="Play Daily Survival instead" onPress={() => router.replace("/daily-survival")} />
        </View>
      </View>
    );
  }

  if (ended) {
    const right = ended.correct;
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title={title} eyebrow={daily ? "Daily" : "Ranked"} onBack={() => router.back()} close />
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.x4, gap: space.m, alignItems: "center" }}>
          <Tag label={ended.forfeited ? "Run forfeited" : "Run over"} tone="solid" c={ended.forfeited ? color.wrong : color.orange} />
          <Eyebrow>Points</Eyebrow>
          <Text style={{ fontFamily: font.mono, fontSize: 88, lineHeight: 96, color: color.cream }}>{ended.score}</Text>
          <Txt c={color.muted}>{ended.forfeited ? "You left the app during today's run" : `${right} right · reached round ${ended.rounds}`}</Txt>
          {ended.eloChange != null && ended.newElo != null ? (
            <Card hero style={{ alignSelf: "stretch", marginTop: space.xl, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ gap: space.xs }}>
                <Eyebrow>Rating</Eyebrow>
                <Mono s={28}>{ended.newElo}</Mono>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.xs,
                  paddingHorizontal: space.m,
                  paddingVertical: space.s,
                  borderRadius: radius.chip,
                  backgroundColor: ended.eloChange >= 0 ? color.right : color.wrong,
                }}
              >
                <ArrowUp size={16} weight="bold" color={color.ink} style={{ transform: [{ rotate: ended.eloChange >= 0 ? "0deg" : "180deg" }] }} />
                <Mono s={15} c={color.ink}>{`${ended.eloChange >= 0 ? "+" : "−"}${Math.abs(ended.eloChange)}`}</Mono>
              </View>
            </Card>
          ) : null}
        </ScrollView>
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
          {daily ? (
            <Button label="Back to Play" onPress={() => router.back()} />
          ) : (
            <>
              <Button
                label="Play again"
                icon={ArrowClockwise}
                onPress={() => {
                  finishedRef.current = false;
                  startedRef.current = false;
                  correctRef.current = 0;
                  setEnded(null);
                  setVerdict(null);
                  setSessionId(null);
                  setChallenge(null);
                  setClues([]);
                  setHelpStage(0);
                  setStreak(0);
                  setAttempt((n) => n + 1);
                }}
              />
              <Button variant="secondary" label="Home" onPress={() => router.back()} />
            </>
          )}
        </View>
      </View>
    );
  }

  if (!challenge) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title={title} onBack={() => router.back()} close />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.gutter, gap: space.l }}>
          {startError === "played" ? (
            <>
              <Txt v="h1Game" center>
                {"You've played today's run"}
              </Txt>
              <Txt c={color.muted} center>
                One Daily Survival run per day. A new one goes live at midnight UTC.
              </Txt>
              <Button label="Back to Play" style={{ alignSelf: "stretch" }} onPress={() => router.back()} />
            </>
          ) : startError === "failed" ? (
            <>
              <Txt c={color.muted} center>
                {"Couldn't start a run right now."}
              </Txt>
              <Button
                label="Try again"
                style={{ alignSelf: "stretch" }}
                onPress={() => {
                  startedRef.current = false;
                  setStartError(null);
                  setAttempt((n) => n + 1);
                }}
              />
            </>
          ) : (
            <ActivityIndicator color={color.lime} />
          )}
        </View>
      </View>
    );
  }

  const initials = challenge.initials.replace(/[^\p{L}]/gu, "").split("");
  const verdictColor = verdict?.kind === "right" ? color.right : verdict?.kind === "info" ? color.muted : color.wrong;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.ink }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <AppBar title={title} eyebrow={eyebrow} onBack={() => router.back()} close right={<Lives lives={lives} />} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: space.gutter, paddingTop: space.s }}>
        <Mono s={13} c={color.muted}>
          {"Score "}
          <Mono s={13}>{score}</Mono>
        </Mono>
        <Mono s={13} c={color.muted}>
          {"Streak "}
          <Mono s={13}>{`×${streak}`}</Mono>
        </Mono>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space.l }}>
        {/* Initials */}
        <View style={{ alignItems: "center", gap: space.m, paddingHorizontal: space.gutter, paddingTop: space.xl }}>
          <Txt c={color.muted}>Who has these initials?</Txt>
          <View accessibilityLabel={`Initials ${initials.join(" ")}`} style={{ flexDirection: "row", gap: space.m }}>
            {initials.map((ch, i) => (
              <View key={i} style={{ width: initials.length > 3 ? 64 : 80, height: 96, borderRadius: radius.card, backgroundColor: color.orange, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontFamily: font.bold, fontSize: 56, color: color.ink }}>{ch}</Text>
              </View>
            ))}
          </View>
          <Txt v="caption" c={color.dim}>
            Any player with these initials counts
          </Txt>
        </View>

        {/* Clues */}
        <View style={{ gap: space.m, paddingHorizontal: space.gutter, paddingTop: space.xl }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.m }}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Hints point to the best-known player</Eyebrow>
            </View>
            <Mono s={13}>{`Pot ${challenge.potValue} pts`}</Mono>
          </View>
          {clues.map((c, i) => (
            <Card key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: space.m }}>
              <Lightbulb size={20} weight="fill" color={color.yellow} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Eyebrow c={color.yellow}>{clues.length > 1 ? `Clue ${i + 1}` : "Clue"}</Eyebrow>
                <Txt>{clueText(c)}</Txt>
              </View>
            </Card>
          ))}
        </View>

        {/* Letters */}
        <View style={{ alignItems: "center", gap: space.s, paddingHorizontal: space.gutter, paddingTop: space.xl }}>
          <Eyebrow>Letters so far</Eyebrow>
          <MaskTiles masked={challenge.maskedName} />
        </View>

        {verdict ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s, paddingHorizontal: space.gutter, paddingTop: space.l }}>
            {verdict.kind === "info" ? <Info size={16} weight="bold" color={verdictColor} /> : verdict.kind === "right" ? null : <XCircle size={16} weight="fill" color={verdictColor} />}
            <Txt v="caption" c={verdictColor} center>
              {verdict.text}
            </Txt>
          </View>
        ) : null}
      </ScrollView>

      {/* Actions */}
      <View style={{ gap: space.m, paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: insets.bottom + space.xxl }}>
        <View style={{ flexDirection: "row", gap: space.s }}>
          <ActionChip
            flex={1.4}
            disabled={busy || helpExhausted}
            onPress={onHelp}
            icon={<Lightbulb size={20} weight="bold" color={color.cream} />}
            label={clueNext ? "Clue" : "Letter"}
            meta="−15%"
          />
          <ActionChip
            flex={1}
            disabled={busy || skipsLeft <= 0}
            onPress={onSkip}
            icon={<SkipForward size={20} weight="bold" color={color.cream} />}
            label="Skip"
            meta={`(${skipsLeft})`}
          />
          <ActionChip flex={1} disabled={busy} onPress={onCashOut} label="Cash out" muted />
        </View>
        <TextInput
          accessibilityLabel="Your guess"
          value={guess}
          onChangeText={(t) => {
            setGuess(t);
            if (verdict?.kind === "close") setVerdict(null);
          }}
          onSubmitEditing={() => {
            // The keyboard's send key skips Button's tap tick; give the same instant feedback.
            if (!busy && guess.trim()) haptic.tap();
            void onGuess();
          }}
          placeholder="Type a player's name…"
          placeholderTextColor={color.dim}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="send"
          style={{
            height: size.input,
            borderRadius: radius.input,
            borderWidth: 1.5,
            borderColor: verdict?.kind === "close" ? color.yellow : "#3A3A3A",
            backgroundColor: color.surface,
            color: color.cream,
            paddingHorizontal: space.l,
            fontFamily: font.bold,
            fontSize: 17,
          }}
        />
        <Button label={busy ? "Checking…" : "Submit guess"} disabled={busy || !guess.trim()} onPress={onGuess} />
      </View>
    </KeyboardAvoidingView>
  );
}

function ActionChip({
  label,
  meta,
  icon,
  onPress,
  disabled,
  flex,
  muted,
}: {
  label: string;
  meta?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  flex: number;
  muted?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        flex,
        minWidth: 0,
        height: size.buttonSecondary,
        borderRadius: size.buttonSecondary / 2,
        borderWidth: 1.5,
        borderColor: color.line,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.s,
        paddingHorizontal: space.m,
        opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
      })}
    >
      {icon}
      <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 15, color: muted ? color.muted : color.cream }}>
        {label}
        {meta ? <Text style={{ fontFamily: font.mono, fontSize: 12, color: color.muted }}>{` ${meta}`}</Text> : null}
      </Text>
    </Pressable>
  );
}
