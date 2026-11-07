import { router } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

import { ChallengeLanding, ChallengeResult } from "@/components/daily/Challenge";
import { challengeUrl, shareDailyResult, tierGrid, visibleStandingPct, type DailyGameKey } from "@/components/daily/share";
import { DailyResult, type NextToday } from "@/components/results/DailyResult";
import { RunOver } from "@/components/results/RunOver";
import { AppBar, Button, Txt } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { color, space } from "@/theme/tokens";

/** The session shape both daily twins share (convex whosOlder.ts / missingLetters.ts publicView). */
export type TwinSession = {
  sessionId: string;
  kind: string;
  status: string;
  score: number;
  roundIndex: number;
  totalRounds: number | null;
  edition: number;
  history: { correct: boolean }[];
};

type Today = {
  edition: number;
  daily: TwinSession | null;
  standing: { finishers: number; below: number } | null;
  bestEndless: number | null;
  streak: { current: number; best: number; playedToday: boolean } | null;
} | null | undefined;

type ChallengeInfo = {
  challengeId: string;
  fromName: string | null;
  edition: number;
  isToday: boolean;
  score: number;
  total: number;
  own: boolean;
  myResult: { score: number; total: number } | null;
} | null | undefined;

export type PlayProps<S extends TwinSession> = {
  view: S;
  setView: (v: S) => void;
  /** Call once the last reveal of a finished run has been dismissed. */
  onDone: () => void;
};

export function DailyTwinShell<S extends TwinSession>(p: {
  game: DailyGameKey;
  title: string;
  accent: string;
  mode: "daily" | "endless";
  challengeId?: string;
  today: Today;
  challenge: ChallengeInfo;
  landingLine: string;
  next: NextToday | null;
  startDaily: () => Promise<S>;
  startEndless: () => Promise<S>;
  startChallenge: (challengeId: string) => Promise<S>;
  createChallenge: (sessionId: string) => Promise<string>;
  recordChallengeResult: (challengeId: string, sessionId: string) => Promise<unknown>;
  renderPlay: (props: PlayProps<S>) => ReactNode;
  renderLastMiss?: (view: S) => ReactNode;
}) {
  const { ready } = useSession();
  const [view, setView] = useState<S | null>(null);
  const [phase, setPhase] = useState<"boot" | "landing" | "play" | "finished" | "h2h">("boot");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(p.mode);
  const [runId, setRunId] = useState(0);
  const bestBefore = useRef<number | null>(null);

  const ch = p.challengeId ? p.challenge : null;
  const challengeActive = !!(ch && !ch.own);

  // A friend's challenge waits on a landing (or shows the head-to-head) before any play.
  const waitingOnChallenge = phase === "boot" && challengeActive;
  const shown = waitingOnChallenge ? (ch!.myResult ? "h2h" : "landing") : phase;

  // Otherwise start straight away once the session and the queries are in.
  useEffect(() => {
    if (!ready || phase !== "boot" || challengeActive) return;
    if (p.challengeId && p.challenge === undefined) return; // challenge still loading
    if (mode === "endless" && p.today === undefined) return;
    void begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, phase, p.challenge, p.today, mode, runId]);

  async function begin() {
    try {
      let s: S;
      if (mode === "endless") {
        bestBefore.current = p.today?.bestEndless ?? null;
        s = await p.startEndless();
      } else if (challengeActive && !ch!.isToday) {
        s = await p.startChallenge(ch!.challengeId);
      } else {
        s = await p.startDaily();
      }
      setView(s);
      setPhase(s.status === "completed" ? "finished" : "play");
    } catch {
      setError("Couldn't load the game. Try again in a moment.");
    }
  }

  // A finished run that answers a friend's challenge files itself, then shows the head-to-head.
  useEffect(() => {
    if (phase !== "finished" || !view || !challengeActive || view.kind === "endless") return;
    p.recordChallengeResult(ch!.challengeId, view.sessionId)
      .catch(() => undefined)
      .finally(() => setPhase("h2h"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, view?.sessionId]);

  async function shareChallenge(v: TwinSession) {
    try {
      const id = await p.createChallenge(v.sessionId);
      await shareDailyResult({
        game: p.game,
        edition: v.edition,
        score: v.score,
        total: v.totalRounds ?? v.history.length,
        history: v.history,
        standingPct: visibleStandingPct(p.today?.standing),
        url: challengeUrl(p.game, id),
      });
    } catch {
      setError("Couldn't make the link. Try again.");
    }
  }

  const close = () => router.back();

  if (shown === "landing" && ch) {
    return (
      <ChallengeLanding
        title={p.title}
        edition={ch.edition}
        fromName={ch.fromName ?? "A friend"}
        score={ch.score}
        total={ch.total}
        accent={p.accent}
        line={p.landingLine}
        onPlay={() => void begin()}
      />
    );
  }

  if (shown === "h2h" && ch) {
    const mine = ch.myResult?.score ?? view?.score ?? 0;
    const todaysDaily = p.today?.daily?.status === "completed" ? p.today.daily : null;
    return (
      <ChallengeResult
        title={p.title}
        edition={ch.edition}
        fromName={ch.fromName ?? "A friend"}
        theirScore={ch.score}
        myScore={mine}
        total={ch.total}
        myHistory={view?.history}
        accent={p.accent}
        onSendBack={todaysDaily ? () => void shareChallenge(todaysDaily) : undefined}
      />
    );
  }

  if (phase === "finished" && view) {
    if (view.kind === "endless") {
      return (
        <RunOver
          title={p.title}
          streak={view.score}
          previousBest={bestBefore.current}
          lastMiss={p.renderLastMiss?.(view)}
          onPlayAgain={() => {
            setView(null);
            setPhase("boot");
            setRunId((n) => n + 1);
          }}
          onTodayResult={() => {
            setMode("daily");
            setView(null);
            setPhase("boot");
          }}
        />
      );
    }
    const total = view.totalRounds ?? view.history.length;
    const pct = visibleStandingPct(p.today?.standing);
    const shareText = [
      `${p.title} #${view.edition} · ${view.score}/${total}`,
      tierGrid(view.history),
      ...(pct != null ? [`Better than ${pct}% of today's players`] : []),
      `https://verveq.com/${p.game}`,
    ].join("\n");
    return (
      <DailyResult
        title={p.title}
        eyebrow={`Daily #${view.edition}`}
        accent={p.accent}
        correct={view.score}
        total={total}
        squares={view.history.map((h) => h.correct)}
        standing={pct != null ? { pct, players: p.today?.standing?.finishers ?? 0 } : null}
        shareText={shareText}
        onChallenge={view.kind === "daily" ? () => void shareChallenge(view) : undefined}
        reminderHref="/notify"
        next={p.next}
        extra={
          <View style={{ paddingHorizontal: space.gutter, paddingTop: space.xxl }}>
            <Button
              variant="secondary"
              label={p.today?.bestEndless ? `Endless · best ${p.today.bestEndless}` : "Keep going in Endless"}
              onPress={() => {
                setMode("endless");
                setView(null);
                setPhase("boot");
              }}
            />
          </View>
        }
      />
    );
  }

  if (phase === "play" && view) {
    return <>{p.renderPlay({ view, setView: (v) => setView(v), onDone: () => setPhase("finished") })}</>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.ink }}>
      <AppBar title={p.title} onBack={close} close />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.l, paddingHorizontal: space.gutter }}>
        {error ? (
          <>
            <Txt c={color.muted} center>
              {error}
            </Txt>
            <Button
              variant="secondary"
              label="Try again"
              onPress={() => {
                setError(null);
                void begin();
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
