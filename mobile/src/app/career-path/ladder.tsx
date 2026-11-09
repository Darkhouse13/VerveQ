import { useMutation } from "convex/react";
import { router } from "expo-router";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { SkipForward } from "phosphor-react-native/src/icons/SkipForward";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { ClubPath, TierTag, VerdictBar, type CareerPathClub } from "@/components/careerpath/ClubPath";
import { NameInput } from "@/components/careerpath/NameInput";
import { AppBar, Button, Card, Eyebrow, Mono, ProgressSegments, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, space } from "@/theme/tokens";
import type { Id } from "@convex/_generated/dataModel";

const ROUNDS = 10;
const ROUND_MS = 30_000;
const REVEAL_MS = 1_300; // server: CAREER_PATH_LADDER_REVEAL_MS
const TIMEOUT_GRACE_MS = 400; // the server only accepts a timeout once its own clock has passed the deadline

type Rung = {
  sessionId: Id<"careerPathSessions">;
  clubs: CareerPathClub[];
  difficulty: string;
  ladderRound: number;
  startsAt: number;
  deadlineAt: number;
  score: number;
  maxGuesses: number;
  wrongGuessCount: number;
};

type Settled = {
  correct: boolean;
  answerName?: string;
  score: number;
  resolution?: "guessed" | "timed_out" | "skipped";
  nextRound?: Omit<Rung, "clubs"> & { clubs: unknown[] };
};

type Result = { solved: boolean; score: number };

const fmt = (n: number) => n.toLocaleString("en-GB");

/** Ticks on its own (250ms) so the clubs and the guess input never re-render for the clock. */
function LiveRing({ deadlineAt, offset, frozen }: { deadlineAt: number | null; offset: number; frozen: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (frozen || !deadlineAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [frozen, deadlineAt]);
  const msLeft = frozen ? 0 : deadlineAt ? Math.min(ROUND_MS, deadlineAt - (now + offset)) : ROUND_MS;
  return <TimerRing msLeft={msLeft} />;
}

function TimerRing({ msLeft }: { msLeft: number }) {
  const secs = Math.max(0, Math.ceil(msLeft / 1000));
  const frac = Math.max(0, Math.min(1, msLeft / ROUND_MS));
  const C = 2 * Math.PI * 36;
  const tone = secs <= 5 ? color.wrong : color.yellow;
  return (
    <View style={{ width: 80, height: 80 }} accessibilityRole="timer" accessibilityLabel={`${secs} seconds left`}>
      <Svg width={80} height={80} viewBox="0 0 84 84">
        <Circle cx={42} cy={42} r={36} fill="none" stroke={color.surfaceHigh} strokeWidth={7} />
        <Circle
          cx={42}
          cy={42}
          r={36}
          fill="none"
          stroke={tone}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform="rotate(-90 42 42)"
        />
      </Svg>
      <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: space.xs }}>
        <Mono s={24} style={{ lineHeight: 26 }}>
          {secs}
        </Mono>
        <Mono s={11} c={color.muted} style={{ letterSpacing: 1.3 }}>
          SEC
        </Mono>
      </View>
    </View>
  );
}

export default function CareerPathLadder() {
  const insets = useSafeAreaInsets();
  const { ready } = useSession();
  const start = useMutation(api.careerPath.startChallenge);
  const submit = useMutation(api.careerPath.submitGuess);
  const resolve = useMutation(api.careerPath.resolveLadderChallenge);

  const [rung, setRung] = useState<Rung | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [reveal, setReveal] = useState<{ tone: "right" | "wrong"; text: string } | null>(null);
  const [verdict, setVerdict] = useState<{ tone: "wrong" | "close"; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0); // server clock − device clock
  const [openedAt, setOpenedAt] = useState<number | null>(null); // the rung's startsAt once it has opened
  const started = useRef(false);
  const settling = useRef(false);

  const live = !!rung && !reveal && !done && openedAt === rung.startsAt;

  // Open the rung at its server start time (one timer, no per-tick renders).
  const rungStartsAt = rung?.startsAt ?? null;
  useEffect(() => {
    if (rungStartsAt == null) return;
    const t = setTimeout(() => setOpenedAt(rungStartsAt), Math.max(0, rungStartsAt - (Date.now() + offset)));
    return () => clearTimeout(t);
  }, [rungStartsAt, offset]);

  const fetchLadder = useCallback(async () => {
    try {
      const r = await start({ sport: "football", mode: "ladder" });
      const at = Date.now();
      setOffset((r.startsAt ?? at) - at);
      setRung({
        sessionId: r.sessionId,
        clubs: r.clubs as CareerPathClub[],
        difficulty: r.difficulty,
        ladderRound: r.ladderRound ?? 1,
        startsAt: r.startsAt ?? at,
        deadlineAt: r.deadlineAt ?? at + ROUND_MS,
        score: r.score,
        maxGuesses: r.maxGuesses,
        wrongGuessCount: 0,
      });
    } catch {
      setError("We couldn't start 10 Path right now. Try again.");
    }
  }, [start]);

  /** "Play again" / "Try again": clear the run, then start a new one. */
  const begin = useCallback(() => {
    setError(null);
    setResults([]);
    setDone(false);
    setReveal(null);
    setVerdict(null);
    setGuess("");
    setRung(null);
    void fetchLadder();
  }, [fetchLadder]);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    void fetchLadder();
  }, [ready, fetchLadder]);

  /** A rung is over: show the answer for the reveal beat, then deal the next one. */
  const settle = useCallback((res: Settled, solved: boolean) => {
    if (!rung) return;
    if (solved) haptic.right();
    else haptic.wrong();
    setVerdict(null);
    setGuess("");
    setResults((prev) => [...prev, { solved, score: solved ? res.score : 0 }]);
    const name = res.answerName ?? "";
    const text = solved
      ? `Correct · ${name}`
      : res.resolution === "timed_out"
        ? `Time's up — it was ${name}`
        : res.resolution === "skipped"
          ? `Skipped — it was ${name}`
          : `Out of guesses — it was ${name}`;
    setReveal({ tone: solved ? "right" : "wrong", text });
    const next = res.nextRound;
    if (next) setOffset(next.startsAt - REVEAL_MS - Date.now());
    setTimeout(() => {
      setReveal(null);
      if (next) {
        setRung({ ...next, clubs: next.clubs as CareerPathClub[], wrongGuessCount: 0 });
      } else {
        setDone(true);
      }
    }, REVEAL_MS);
  }, [rung]);

  // The clock ran out: ask the server to settle the rung as timed out.
  useEffect(() => {
    if (!live || !rung) return;
    const fireIn = Math.max(0, rung.deadlineAt + TIMEOUT_GRACE_MS - (Date.now() + offset));
    const t = setTimeout(() => {
      if (settling.current) return;
      settling.current = true;
      resolve({ sessionId: rung.sessionId, reason: "timed_out" })
        .then((res) => settle(res as Settled, false))
        .catch(() => setError("Lost the connection — keep going"))
        .finally(() => {
          settling.current = false;
        });
    }, fireIn);
    return () => clearTimeout(t);
  }, [live, rung, offset, resolve, settle]);

  async function onSkip() {
    if (!live || !rung || busy) return;
    setBusy(true);
    try {
      const res = await resolve({ sessionId: rung.sessionId, reason: "skipped" });
      settle(res as Settled, false);
    } catch {
      setError("That skip didn't go through — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onGuess() {
    const text = guess.trim();
    if (!live || !rung || !text || busy) return;
    setBusy(true);
    try {
      const res = await submit({ sessionId: rung.sessionId, guess: text });
      if (res.correct) settle(res as Settled, true);
      else if (res.gameOver) settle(res as Settled, false);
      else if (res.closeCall) {
        setVerdict({ tone: "close", text: "So close — check the spelling" });
        setRung({ ...rung, score: res.score });
      } else {
        haptic.wrong();
        const used = res.wrongGuessCount ?? rung.wrongGuessCount + 1;
        const left = rung.maxGuesses - used;
        setGuess("");
        setVerdict({ tone: "wrong", text: `Wrong — ${left} guess${left === 1 ? "" : "es"} left` });
        setRung({ ...rung, score: res.score, wrongGuessCount: used });
      }
    } catch {
      setError("That guess didn't go through — try again.");
    } finally {
      setBusy(false);
    }
  }

  const total = results.reduce((sum, r) => sum + r.score, 0);
  const solved = results.filter((r) => r.solved).length;
  const segs = results.map((r) => (r.solved ? "right" : "wrong") as "right" | "wrong" | "current");
  if (rung && !done && !reveal) segs.push("current");
  const roundNo = rung?.ladderRound ?? 1;

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar
        title="10 Path"
        eyebrow={done ? "Finished" : `Path ${roundNo} / ${ROUNDS}`}
        onBack={() => router.back()}
        close
        right={
          <Text maxFontSizeMultiplier={1.3} style={{ fontFamily: font.mono, fontSize: 15, color: color.cream, paddingHorizontal: space.s }}>
            {fmt(total)}
            <Text maxFontSizeMultiplier={1.3} style={{ fontSize: 12, color: color.dim }}> pts</Text>
          </Text>
        }
      />
      <View style={{ paddingTop: space.s }}>
        <ProgressSegments states={segs} total={ROUNDS} />
      </View>

      {done ? (
        <View style={{ flex: 1, paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space.xxl }}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.m }}>
            <Eyebrow>Paths solved</Eyebrow>
            <Text maxFontSizeMultiplier={1} style={{ fontFamily: font.mono, fontSize: 88, lineHeight: 96, color: color.cream }}>
              {solved}
              <Text maxFontSizeMultiplier={1} style={{ fontSize: 48, color: color.dim }}>/{ROUNDS}</Text>
            </Text>
            <Txt c={color.muted}>{`${fmt(total)} total points`}</Txt>
          </View>
          <View style={{ gap: space.m }}>
            <Button label="Play again" icon={ArrowClockwise} onPress={begin} />
            <Button variant="secondary" label="Back to modes" onPress={() => router.back()} />
          </View>
        </View>
      ) : !rung ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.l, paddingHorizontal: space.gutter }}>
          {error ? (
            <>
              <Txt c={color.muted} center>
                {error}
              </Txt>
              <Button variant="secondary" label="Try again" icon={ArrowClockwise} onPress={begin} />
            </>
          ) : (
            <ActivityIndicator color={color.lime} />
          )}
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: space.l }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.gutter, paddingTop: space.xl }}>
              <View style={{ gap: space.s }}>
                <TierTag difficulty={rung.difficulty} />
                <Txt v="h1Game">He played for…</Txt>
              </View>
              <LiveRing deadlineAt={rung?.deadlineAt ?? null} offset={offset} frozen={!!reveal} />
            </View>
            <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl }}>
              <ClubPath clubs={rung.clubs} rowHeight={40} fontSize={17} />
            </View>
          </ScrollView>

          <View style={{ paddingHorizontal: space.gutter, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
            {reveal ? (
              <VerdictBar tone={reveal.tone} text={reveal.text} />
            ) : (
              <>
                {verdict ? <VerdictBar tone={verdict.tone} text={verdict.text} /> : null}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Txt v="caption" c={color.dim}>
                    {`${rung.maxGuesses - rung.wrongGuessCount} guesses left · or skip to the next path`}
                  </Txt>
                  <Mono s={13} c={color.muted}>{`+${fmt(rung.score)}`}</Mono>
                </View>
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
                  editable={live && !busy}
                />
                {error ? (
                  <Card style={{ padding: space.m }}>
                    <Txt v="caption" c={color.muted}>
                      {error}
                    </Txt>
                  </Card>
                ) : null}
                <View style={{ flexDirection: "row", gap: space.m }}>
                  <Button variant="secondary" label="Skip" icon={SkipForward} iconRight disabled={!live || busy} onPress={() => void onSkip()} style={{ height: 56, borderRadius: 28 }} />
                  <Button label={busy ? "Checking…" : "Guess"} disabled={!live || busy || !guess.trim()} onPress={() => void onGuess()} style={{ flex: 1 }} />
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
