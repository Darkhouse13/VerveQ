import { router } from "expo-router";
import { ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { Alert, Pressable, ScrollView, View } from "react-native";

import { AppBar, Button, Mono, ProgressSegments, Tag, Txt } from "@/components/ui";
import { color, radius, space } from "@/theme/tokens";
import { AnswerRing } from "./AnswerRing";
import { AnswerButton, BottomActions, Explanation, FooterNote, LETTERS, LoadingNote, QuestionBlock, ScoreClockRow, answerStateFor } from "./QuizParts";
import { QUIZ_MAX, type useQuizSession } from "./useQuizSession";

type Run = ReturnType<typeof useQuizSession>;

function confirmQuit() {
  Alert.alert("Quit this game?", "Your answers so far won't count.", [
    { text: "Keep playing", style: "cancel" },
    { text: "Quit", style: "destructive", onPress: () => router.back() },
  ]);
}

function EventCard({ label, state, onPress, disabled }: { label: string; state: ReturnType<typeof answerStateFor>; onPress: () => void; disabled: boolean }) {
  const right = state === "right";
  const wrong = state === "wrong";
  const dim = state === "dim";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 152,
        borderRadius: radius.hero,
        borderWidth: right || wrong ? 2 : 1.5,
        borderColor: right ? color.right : wrong ? color.wrong : state === "pending" ? color.lime : color.line,
        backgroundColor: right ? color.rightBg : wrong ? color.wrongBg : dim ? color.surfaceLow : color.surface,
        padding: space.gutter,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      {right ? (
        <View style={{ position: "absolute", top: space.l, right: space.l }}>
          <Tag label="First" tone="solid" c={color.right} />
        </View>
      ) : null}
      <Txt v="cardTitle" c={dim ? color.dim : color.cream} center>
        {label}
      </Txt>
    </Pressable>
  );
}

/** One run screen for ranked Quiz and Which Came First (mockups QuizQuestion/QuizAnswer, CameFirst). */
export function QuizRunView({ run, title, eyebrow, tag, cameFirst }: { run: Run; title: string; eyebrow: string; tag: string; cameFirst?: boolean }) {
  const q = run.question;
  const segs = [...run.rows.map((r) => (r.correct ? "right" : "wrong") as "right" | "wrong"), ...(run.reveal ? [] : (["current"] as const))];
  const answeredLast = run.reveal && run.qNum >= QUIZ_MAX;

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar
        title={title}
        eyebrow={eyebrow}
        onBack={() => (run.rows.length ? confirmQuit() : router.back())}
        close
        right={
          <Mono s={15}>
            {run.qNum}
            <Mono s={15} c={color.dim}>{`/${QUIZ_MAX}`}</Mono>
          </Mono>
        }
      />
      {!q ? (
        <View style={{ flex: 1 }}>
          <LoadingNote text={run.error ?? (cameFirst ? "Loading Which Came First…" : "Loading quiz…")} />
          {run.error ? (
            <BottomActions>
              <Button label="Back" onPress={() => router.back()} />
            </BottomActions>
          ) : null}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingTop: space.s }}>
            <ProgressSegments states={segs} total={QUIZ_MAX} />
            <View style={{ height: space.l }} />
            <ScoreClockRow
              points={run.total}
              clock={run.clock}
              right={
                run.clock.deadlineAt ? (
                  <AnswerRing
                    deadlineAt={run.clock.deadlineAt}
                    totalMs={run.clock.totalMs}
                    frozen={!!run.reveal || run.checking}
                    onExpire={() => void run.pick(null)}
                  />
                ) : undefined
              }
            />
            {cameFirst ? (
              <>
                <View style={{ paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xl, gap: space.s, alignItems: "center" }}>
                  {run.reveal ? (
                    <Tag label={run.reveal.correct ? "Right" : run.selected == null ? "Time's up" : "Wrong"} tone="solid" c={run.reveal.correct ? color.right : color.wrong} />
                  ) : (
                    <Tag label="Pick the earlier" c={color.yellow} />
                  )}
                  <Txt v="h1Game" center>
                    {q.question || "Which came first?"}
                  </Txt>
                </View>
                <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
                  {q.options.map((opt, i) => (
                    <View key={`${run.qNum}-${i}`} style={{ gap: space.m }}>
                      {i > 0 ? (
                        <View style={{ alignItems: "center" }}>
                          <Mono s={13} c={color.muted}>
                            OR
                          </Mono>
                        </View>
                      ) : null}
                      <EventCard
                        label={opt}
                        state={answerStateFor(i, { revealed: !!run.reveal, selected: run.selected, correctIdx: run.correctIdx })}
                        disabled={!!run.reveal || run.checking}
                        onPress={() => void run.pick(i)}
                      />
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <QuestionBlock text={q.question} image={q.imageUrl} tag={tag} verdict={run.reveal ? run.reveal.correct : null} verdictLabel={run.selected == null ? "Time's up" : undefined} />
                <View style={{ paddingHorizontal: space.gutter, gap: space.m }}>
                  {q.options.map((opt, i) => (
                    <AnswerButton
                      key={`${run.qNum}-${i}`}
                      letter={LETTERS[i]}
                      label={opt}
                      state={answerStateFor(i, { revealed: !!run.reveal, selected: run.selected, correctIdx: run.correctIdx })}
                      disabled={!!run.reveal || run.checking}
                      onPress={() => void run.pick(i)}
                    />
                  ))}
                </View>
              </>
            )}
            {run.reveal?.explanation ? <Explanation text={run.reveal.explanation} /> : null}
            {run.error ? (
              <Txt v="caption" c={color.wrong} center style={{ marginTop: space.l }}>
                {run.error}
              </Txt>
            ) : null}
          </ScrollView>
          <BottomActions>
            {run.reveal ? (
              <Button label={run.loadingNext ? "Loading…" : answeredLast ? "See result" : "Next question"} icon={run.loadingNext ? undefined : ArrowRight} iconRight disabled={run.loadingNext} onPress={() => void run.next()} />
            ) : (
              <FooterNote text={cameFirst ? "Tap the event that happened first" : "Leaving the app ends this game"} />
            )}
          </BottomActions>
        </>
      )}
    </View>
  );
}
