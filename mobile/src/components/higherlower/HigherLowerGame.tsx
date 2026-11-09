import { useMutation } from "convex/react";
import { router } from "expo-router";
import { ArrowClockwise } from "phosphor-react-native/src/icons/ArrowClockwise";
import { ArrowDown } from "phosphor-react-native/src/icons/ArrowDown";
import { ArrowUp } from "phosphor-react-native/src/icons/ArrowUp";
import { CheckCircle } from "phosphor-react-native/src/icons/CheckCircle";
import { Export } from "phosphor-react-native/src/icons/Export";
import { Info } from "phosphor-react-native/src/icons/Info";
import { XCircle } from "phosphor-react-native/src/icons/XCircle";
import { useCallback, useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { ActivityIndicator, AppState, ScrollView, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar, Button, Eyebrow, Mono, Tag, Txt, haptic } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { api } from "@/lib/convex";
import { color, font, radius, space } from "@/theme/tokens";
import { useGuardedLeave } from "@/lib/guardLeave";

// Same labels as the web (en/play.json higherLower.stats).
const STAT_LABELS: Record<string, string> = {
  goalsFor: "Goals scored",
  goalsAgainst: "Goals conceded",
  goals: "Goals",
  cleanSheets: "Clean sheets",
  assists: "Assists",
  appearances: "Appearances",
  minutes: "Minutes played",
  cardsYellow: "Yellow cards",
  yellowCards: "Yellow cards",
  redCards: "Red cards",
  wins: "Wins",
  losses: "Losses",
  draws: "Draws",
  points: "Points",
};
const statLabel = (key: string) =>
  STAT_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

// Tournaments named by a single year (World Cup, Euro, …), as on the web.
const SINGLE_YEAR_CONTEXTS = new Set(["league:fb_1", "league:fb_4", "league:fb_9", "league:fb_15"]);
const seasonText = (season: number | undefined, context: string) =>
  season == null ? null : SINGLE_YEAR_CONTEXTS.has(context) ? `${season}` : `${season}/${String(season + 1).slice(-2)} season`;

type Pair = { aName: string; aValue: number; bName: string };
type Ctx = { statKey: string; context: string; contextLabel: string; season?: number };
type Outcome = { correct: boolean; bValue: number } | null;
type Ended = {
  score: number;
  reason: "wrong" | "exhausted" | "left";
  /** The last pair played, both values already revealed by then. */
  last?: { aName: string; aValue: number; bName: string; bValue: number };
  ctx?: Ctx;
};

// Best run on this phone (the server keeps no Higher or Lower best).
const BEST_KEY = "verveq_hl_best_football";
const SHARE_URL = "https://verveq.com/games/higher-or-lower/?ref=higher_lower_share";

export function HigherLowerGame() {
  const insets = useSafeAreaInsets();
  const { ready } = useSession();
  const start = useMutation(api.higherLower.startSession);
  const makeGuess = useMutation(api.higherLower.makeGuess);
  const penalize = useMutation(api.higherLower.penalizeTabSwitch);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pair, setPair] = useState<Pair | null>(null);
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [score, setScore] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [busy, setBusy] = useState(false);
  // The side the player tapped, shown at once while the server checks it.
  const [picked, setPicked] = useState<"higher" | "lower" | null>(null);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [failed, setFailed] = useState(false);
  const [run, setRun] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(BEST_KEY)
      .then((v) => setBest(v ? Number(v) || 0 : 0))
      .catch(() => setBest(0));
  }, []);

  // Ends the run and records a new best on this phone.
  const bestRef = useRef<number | null>(null);
  useEffect(() => {
    bestRef.current = best;
  }, [best]);
  const finish = useCallback((e: Ended) => {
    const prev = bestRef.current ?? 0;
    const isNew = e.score > prev;
    setNewBest(isNew);
    if (isNew) {
      setBest(e.score);
      void SecureStore.setItemAsync(BEST_KEY, String(e.score)).catch(() => undefined);
    }
    setEnded(e);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    start({ sport: "football" })
      .then((r) => {
        if (cancelled) return;
        setSessionId(r.sessionId);
        setPair({ aName: r.playerAName, aValue: r.playerAValue, bName: r.playerBName });
        setCtx({ statKey: r.statKey, context: r.context, contextLabel: r.contextLabel, season: r.season });
        setScore(0);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [ready, start, run]);

  const guess = useCallback(
    async (pick: "higher" | "lower") => {
      if (!sessionId || !pair || busy || outcome) return;
      setPicked(pick);
      setBusy(true);
      try {
        const res = await makeGuess({ sessionId: sessionId as never, guess: pick });
        if (res.correct) haptic.right();
        else haptic.wrong();
        setOutcome({ correct: res.correct, bValue: res.playerBValue });
        setScore(res.score);
        // Hold the reveal for a beat, as on the web, then deal the next pair or end.
        setTimeout(() => {
          setOutcome(null);
          if (res.gameOver) {
            finish({
              score: res.score,
              reason: res.correct ? "exhausted" : "wrong",
              last: { aName: pair.aName, aValue: pair.aValue, bName: pair.bName, bValue: res.playerBValue },
              ctx: ctx ?? undefined,
            });
            return;
          }
          if ("nextPlayerAName" in res && res.nextPlayerAName != null && res.nextPlayerAValue != null && res.nextPlayerBName != null) {
            setPair({ aName: res.nextPlayerAName, aValue: res.nextPlayerAValue, bName: res.nextPlayerBName });
            if (res.statKey && res.context) {
              setCtx({ statKey: res.statKey, context: res.context, contextLabel: res.contextLabel, season: res.season });
            }
          }
        }, 1300);
      } catch {
        setFailed(true);
      } finally {
        setBusy(false);
        setPicked(null);
      }
    },
    [sessionId, pair, ctx, busy, outcome, makeGuess, finish],
  );

  // Back / X mid-run: confirm, then the same penalty as leaving the app.
  useGuardedLeave(!!sessionId && !ended, () => {
    if (sessionId) void penalize({ sessionId: sessionId as never }).catch(() => {});
  });

  // Leaving the app ends the run, like the web's tab switch.
  const live = useRef({ sessionId, ended, ctx });
  useEffect(() => {
    live.current = { sessionId, ended, ctx };
  }, [sessionId, ended, ctx]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (st) => {
      const cur = live.current;
      if (st !== "background" || !cur.sessionId || cur.ended) return;
      try {
        const res = await penalize({ sessionId: cur.sessionId as never });
        if (res.penalized) finish({ score: res.score, reason: "left", ctx: cur.ctx ?? undefined });
      } catch {
        /* offline */
      }
    });
    return () => sub.remove();
  }, [penalize, finish]);

  const label = ctx ? statLabel(ctx.statKey) : "";

  if (ended) {
    const endCtx = ended.ctx;
    const endLabel = endCtx ? statLabel(endCtx.statKey) : "";
    const endSeason = endCtx ? seasonText(endCtx.season, endCtx.context) : null;
    const playAgain = () => {
      setEnded(null);
      setNewBest(false);
      setPair(null);
      setCtx(null);
      setSessionId(null);
      setFailed(false);
      setRun((n) => n + 1);
    };
    return (
      <View style={{ flex: 1, backgroundColor: color.ink }}>
        <AppBar title="Higher or Lower" eyebrow="Game over" onBack={() => router.back()} close />
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingTop: space.xxl, paddingHorizontal: space.gutter, gap: space.m }}>
          <Tag
            label={ended.reason === "exhausted" ? "Perfect run" : ended.reason === "left" ? "Run ended" : "Game over"}
            tone="solid"
            c={ended.reason === "exhausted" ? color.right : color.wrong}
          />
          <Eyebrow>Final score</Eyebrow>
          <Text style={{ fontFamily: font.mono, fontSize: 104, lineHeight: 112, color: color.cream }}>{ended.score}</Text>
          <Txt c={color.muted} center>
            {ended.reason === "exhausted"
              ? "Perfect run: this stat pool is exhausted."
              : ended.reason === "left"
                ? "Run ended — you left the app"
                : ended.score === 1
                  ? "1 right in a row"
                  : `${ended.score} right in a row`}
          </Txt>
          {newBest && ended.score > 0 ? (
            <Tag label="New best" c={color.lime} />
          ) : best != null && best > 0 ? (
            <Mono s={13} c={color.dim}>{`YOUR BEST · ${best}`}</Mono>
          ) : null}

          {endCtx ? (
            <View style={{ alignSelf: "stretch", marginTop: space.l, backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1, borderColor: color.lineSoft, padding: space.l, gap: space.m }}>
              <View style={{ gap: space.xs }}>
                <Eyebrow>{ended.reason === "wrong" ? "The card that ended it" : "Your last call"}</Eyebrow>
                <Txt v="rowTitle">{[endCtx.contextLabel, endSeason].filter(Boolean).join(" · ")}</Txt>
                <Txt v="caption" c={color.muted}>
                  {endLabel}
                </Txt>
              </View>
              {ended.last ? (
                <View style={{ gap: space.s }}>
                  <RecapRow name={ended.last.aName} value={ended.last.aValue} />
                  <RecapRow name={ended.last.bName} value={ended.last.bValue} tone={ended.reason === "wrong" ? color.wrong : color.right} />
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
        <View style={{ paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
          <Button label="Play again" icon={ArrowClockwise} onPress={playAgain} />
          <Button
            variant="secondary"
            label="Share result"
            icon={Export}
            onPress={() =>
              void Share.share({
                message: `I scored ${ended.score} in VerveQ's Higher or Lower ⚽\nCan you beat me?\n${SHARE_URL}`,
              })
            }
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar
        title="Higher or Lower"
        eyebrow="Who has more?"
        onBack={() => router.back()}
        close
        right={
          <View style={{ alignItems: "center", gap: space.xs }}>
            <Mono s={17}>{score}</Mono>
            <Mono s={10} c={color.dim}>
              SCORE
            </Mono>
          </View>
        }
      />

      {!pair || !ctx ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.l, paddingHorizontal: space.gutter }}>
          {failed ? (
            <>
              <Txt c={color.muted} center>
                {"Higher or Lower couldn't load right now."}
              </Txt>
              <Button
                label="Try again"
                style={{ alignSelf: "stretch" }}
                onPress={() => {
                  setFailed(false);
                  setRun((n) => n + 1);
                }}
              />
            </>
          ) : (
            <ActivityIndicator color={color.lime} />
          )}
        </View>
      ) : (
        <>
          {/* Context: league + season prominent, then the stat */}
          <View style={{ alignItems: "center", gap: space.s, paddingHorizontal: space.gutter, paddingTop: space.xl }}>
            <Txt v="h1Game" center>
              {ctx.contextLabel}
            </Txt>
            {seasonText(ctx.season, ctx.context) ? (
              <Mono s={15} c={color.yellow} style={{ letterSpacing: 1.8 }}>
                {seasonText(ctx.season, ctx.context)!.toUpperCase()}
              </Mono>
            ) : null}
            <View style={{ marginTop: space.xs, backgroundColor: color.cream, borderRadius: radius.chip, paddingHorizontal: space.s, paddingVertical: space.xs }}>
              <Mono s={12} c={color.ink} style={{ letterSpacing: 1.4 }}>
                {label.toUpperCase()}
              </Mono>
            </View>
          </View>

          {/* Cards */}
          <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xl, gap: space.m }}>
            <StatCard name={pair.aName} value={String(pair.aValue)} caption={label.toLowerCase()} />
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: space.xl + 192 - 18, alignItems: "center", zIndex: 2 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: color.ink, borderWidth: 1.5, borderColor: color.line, alignItems: "center", justifyContent: "center" }}>
                <Mono s={13} c={color.muted}>
                  VS
                </Mono>
              </View>
            </View>
            <StatCard
              name={pair.bName}
              value={outcome ? String(outcome.bValue) : "?"}
              caption={outcome ? (outcome.correct ? "Correct" : "Wrong") : picked ? "Checking…" : `more or fewer than ${pair.aValue}?`}
              state={outcome ? (outcome.correct ? "right" : "wrong") : picked ? "pending" : "hidden"}
            />
          </View>

          <View style={{ flex: 1 }} />
          <View style={{ paddingHorizontal: space.gutter, paddingTop: space.l, paddingBottom: insets.bottom + space.xxl, gap: space.m }}>
            {failed ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.s }}>
                <Info size={16} weight="bold" color={color.muted} />
                <Txt v="caption" c={color.muted}>
                  {"That answer didn't go through — try again"}
                </Txt>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: space.m }}>
              {/* The tapped side stays lit while the answer is checked; guess() ignores taps while busy. */}
              <Button label="Higher" icon={ArrowUp} disabled={(busy || !!outcome) && picked !== "higher"} style={{ flex: 1, paddingHorizontal: space.l }} onPress={() => guess("higher")} />
              <Button label="Lower" icon={ArrowDown} disabled={(busy || !!outcome) && picked !== "lower"} style={{ flex: 1, paddingHorizontal: space.l }} onPress={() => guess("lower")} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function StatCard({ name, value, caption, state }: { name: string; value: string; caption: string; state?: "hidden" | "pending" | "right" | "wrong" }) {
  const pending = state === "pending";
  const hidden = state === "hidden" || pending;
  const tone = state === "right" ? color.right : state === "wrong" ? color.wrong : null;
  return (
    <View
      style={{
        height: 192,
        borderRadius: radius.hero,
        borderWidth: tone || pending ? 2 : 1.5,
        borderStyle: hidden && !pending ? "dashed" : "solid",
        borderColor: tone ?? (pending ? color.lime : hidden ? "#5A524C" : color.line),
        backgroundColor: state === "right" ? color.rightBg : state === "wrong" ? color.wrongBg : hidden ? color.surfaceLow : color.surface,
        alignItems: "center",
        justifyContent: "center",
        gap: space.s,
        paddingHorizontal: space.gutter,
      }}
    >
      <Txt v="cardTitle" center numberOfLines={1}>
        {name}
      </Txt>
      <Text style={{ fontFamily: font.mono, fontSize: 56, lineHeight: 64, color: hidden ? "#5A524C" : color.cream }}>{value}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
        {state === "right" ? <CheckCircle size={16} weight="fill" color={color.right} /> : state === "wrong" ? <XCircle size={16} weight="fill" color={color.wrong} /> : null}
        <Txt v="caption" c={tone ?? color.muted}>
          {caption}
        </Txt>
      </View>
    </View>
  );
}

function RecapRow({ name, value, tone }: { name: string; value: number; tone?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
      {tone ? (
        tone === color.wrong ? <XCircle size={18} weight="fill" color={tone} /> : <CheckCircle size={18} weight="fill" color={tone} />
      ) : (
        <View style={{ width: 18 }} />
      )}
      <Txt v="body" numberOfLines={1} style={{ flex: 1 }}>
        {name}
      </Txt>
      <Mono s={17} c={tone ?? color.cream}>
        {String(value)}
      </Mono>
    </View>
  );
}
