import { useMutation } from "convex/react";
import { router } from "expo-router";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { Check } from "phosphor-react-native/src/icons/Check";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ClubPath, GuessDots, TierTag, VerdictBar, type CareerPathClub } from "@/components/careerpath/ClubPath";
import { NameInput } from "@/components/careerpath/NameInput";
import { AppBar, Button, Mono, Tag, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, space } from "@/theme/tokens";
import type { Id } from "@convex/_generated/dataModel";
import { useGuardedLeave } from "@/lib/guardLeave";

type Round = {
  sessionId: Id<"careerPathSessions">;
  clubs: CareerPathClub[];
  difficulty: string;
  score: number;
  maxGuesses: number;
  wrongGuessCount: number;
  wrongGuesses: string[];
};

type Verdict = { tone: "wrong" | "close" | "right"; text: string } | null;
type Finish = { won: boolean; answerName?: string; score: number; reason?: "left" } | null;

export default function CareerPathClassic() {
  const insets = useSafeAreaInsets();
  const { ready } = useSession();
  const start = useMutation(api.careerPath.startChallenge);
  const submit = useMutation(api.careerPath.submitGuess);
  const penalize = useMutation(api.careerPath.penalizeTabSwitch);

  const [round, setRound] = useState<Round | null>(null);
  const [guess, setGuess] = useState("");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [finish, setFinish] = useState<Finish>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roundRef = useRef<Round | null>(null);
  const finishRef = useRef<Finish>(null);
  useEffect(() => {
    roundRef.current = round;
    finishRef.current = finish;
  }, [round, finish]);
  const started = useRef(false);

  const fetchRound = useCallback(async () => {
    try {
      const r = await start({ sport: "football", mode: "classic" });
      setRound({
        sessionId: r.sessionId,
        clubs: r.clubs as CareerPathClub[],
        difficulty: r.difficulty,
        score: r.score,
        maxGuesses: r.maxGuesses,
        wrongGuessCount: r.wrongGuessCount,
        wrongGuesses: [],
      });
    } catch {
      setError("We couldn't start a Career Path round right now. Try again.");
    }
  }, [start]);

  /** "Play another" / "Try again": clear the screen, then deal a new path. */
  const newRound = useCallback(() => {
    setError(null);
    setVerdict(null);
    setFinish(null);
    setGuess("");
    setRound(null);
    void fetchRound();
  }, [fetchRound]);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void fetchRound();
  }, [ready, fetchRound]);

  // Back / X mid-round: confirm, then the same penalty as leaving the app.
  useGuardedLeave(!!round && !finish, () => {
    if (round) void penalize({ sessionId: round.sessionId }).catch(() => {});
  });

  // Leaving the app ends the round, like switching tabs on the web.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      const r = roundRef.current;
      if (st === "active" || !r || finishRef.current) return;
      setFinish({ won: false, score: 0, reason: "left" });
      void penalize({ sessionId: r.sessionId }).catch(() => {});
    });
    return () => sub.remove();
  }, [penalize]);

  async function onGuess() {
    const r = round;
    const text = guess.trim();
    if (!r || !text || busy || finish) return;
    setBusy(true);
    try {
      const res = await submit({ sessionId: r.sessionId, guess: text });
      setGuess("");
      if (res.correct) {
        haptic.right();
        setVerdict(null);
        setFinish({ won: true, answerName: res.answerName, score: res.score });
      } else if (res.closeCall) {
        setVerdict({ tone: "close", text: "So close — check the spelling" });
        setRound({ ...r, score: res.score });
      } else if (res.gameOver) {
        haptic.wrong();
        setVerdict(null);
        setFinish({ won: false, answerName: res.answerName, score: 0 });
      } else {
        haptic.wrong();
        const left = (res.maxGuesses ?? r.maxGuesses) - (res.wrongGuessCount ?? r.wrongGuessCount + 1);
        setVerdict({ tone: "wrong", text: `Wrong — ${left} guess${left === 1 ? "" : "es"} left` });
        setRound({ ...r, score: res.score, wrongGuessCount: res.wrongGuessCount ?? r.wrongGuessCount + 1, wrongGuesses: [...r.wrongGuesses, text] });
      }
    } catch {
      setError("That guess didn't go through — try again.");
    } finally {
      setBusy(false);
    }
  }

  const headerScore = finish ? finish.score : (round?.score ?? 1000);

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar
        title="Career Path"
        eyebrow="One at a time"
        onBack={() => router.back()}
        close
        right={
          <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: 15, color: color.cream, paddingHorizontal: space.s }}>
            {headerScore}
            <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, color: color.dim }}> pts</Text>
          </Text>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {!round ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.l, paddingHorizontal: space.gutter }}>
            {error ? (
              <>
                <Txt c={color.muted} center>
                  {error}
                </Txt>
                <Button variant="secondary" label="Try again" icon={ArrowClockwise} onPress={newRound} />
              </>
            ) : (
              <ActivityIndicator color={color.lime} />
            )}
          </View>
        ) : (
          <>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space.l }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.gutter, paddingTop: space.s }}>
                <TierTag difficulty={round.difficulty} />
                <GuessDots used={round.wrongGuessCount} max={round.maxGuesses} />
              </View>
              <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.m }}>
                <Txt v="h1Game">He played for…</Txt>
                <ClubPath clubs={round.clubs} />
              </View>
            </ScrollView>

            <View style={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
              {finish ? (
                <>
                  <View
                    style={{
                      borderRadius: radius.card,
                      borderWidth: 2,
                      borderColor: finish.won ? color.right : color.line,
                      backgroundColor: finish.won ? color.rightBg : color.surface,
                      padding: space.gutter,
                      gap: space.s,
                    }}
                  >
                    <Tag
                      label={finish.won ? `Correct · +${finish.score} pts` : finish.reason === "left" ? "Round ended" : "Out of guesses"}
                      tone="solid"
                      c={finish.won ? color.right : color.wrong}
                    />
                    {finish.answerName ? (
                      <Txt v="h1Game">{finish.answerName}</Txt>
                    ) : (
                      <Txt c={color.muted}>You left the app, so this round is over.</Txt>
                    )}
                  </View>
                  <Button label="Play another" icon={ArrowClockwise} onPress={newRound} />
                  <Button variant="secondary" label="Back to modes" onPress={() => router.back()} />
                </>
              ) : (
                <>
                  {verdict ? <VerdictBar tone={verdict.tone} text={verdict.text} /> : null}
                  {round.wrongGuesses.length > 0 ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s }}>
                      <Txt v="caption" c={color.dim}>
                        Previous guesses
                      </Txt>
                      {round.wrongGuesses.map((g, i) => (
                        <View key={`${g}-${i}`} style={{ paddingHorizontal: space.s, paddingVertical: space.xs, borderRadius: radius.chip, backgroundColor: color.surface }}>
                          <Txt v="caption" c={color.muted} style={{ textDecorationLine: "line-through" }}>
                            {g}
                          </Txt>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <NameInput
                    accessibilityLabel="Your guess"
                    placeholder="Type a player's name…"
                    value={guess}
                    onChangeText={setGuess}
                    onSubmitEditing={() => {
                    // The keyboard's send key skips Button's tap tick; same instant feedback.
                    if (!busy && guess.trim()) haptic.tap();
                    void onGuess();
                  }}
                    active={guess.length > 0}
                    editable={!busy}
                  />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.s, paddingHorizontal: space.xs }}>
                    <Check size={16} weight="bold" color={color.muted} />
                    <Txt v="caption" c={color.muted}>
                      Small typos are forgiven
                    </Txt>
                  </View>
                  {error ? (
                    <Mono s={12} c={color.wrong}>
                      {error}
                    </Mono>
                  ) : null}
                  <Button label={busy ? "Checking…" : "Guess"} disabled={!guess.trim() || busy} onPress={() => void onGuess()} />
                </>
              )}
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
