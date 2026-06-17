import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { V2_SHELL_ENABLED } from "@/lib/flags";
import { useNavigate, useLocation } from "react-router-dom";
import { Star, ArrowUp, ArrowDown } from "lucide-react";
import { useEffect } from "react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import type { GameResultState } from "@/types/api";

function getGrade(accuracy: number) {
  if (accuracy >= 0.9)
    return { letter: "A", color: "success" as const, stars: 3 };
  if (accuracy >= 0.7)
    return { letter: "B", color: "primary" as const, stars: 2 };
  if (accuracy >= 0.5)
    return { letter: "C", color: "accent" as const, stars: 1 };
  if (accuracy >= 0.3)
    return { letter: "D", color: "blue" as const, stars: 1 };
  return { letter: "F", color: "destructive" as const, stars: 0 };
}

type TFunc = ReturnType<typeof useTranslation>["t"];

function getKFactorExplanation(t: TFunc, label?: string, k?: number) {
  if (!label || !k) return null;
  if (label === "Placement Match") {
    return t("result.kFactorPlacement", { k });
  }
  if (label === "High-Tier Protection") {
    return t("result.kFactorHighTier", { k });
  }
  return t("result.kFactorStandard", { k });
}

function formatRecentOutcome(
  t: TFunc,
  match: NonNullable<GameResultState["recentMatches"]>[number],
  currentUserIsPlayer1?: boolean,
) {
  const myScore = currentUserIsPlayer1 ? match.player1Score : match.player2Score;
  const opponentScore = currentUserIsPlayer1 ? match.player2Score : match.player1Score;
  const outcome = match.outcome === "draw"
    ? t("result.outcomeDraw")
    : currentUserIsPlayer1
      ? match.outcome === "win" ? t("result.outcomeWin") : t("result.outcomeLoss")
      : match.outcome === "win" ? t("result.outcomeLoss") : t("result.outcomeWin");
  return `${outcome} ${myScore}-${opponentScore}`;
}

export default function ResultScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("screens");
  const checkAchievements = useMutation(api.achievements.checkAndUnlock);

  const state = location.state as GameResultState | null;

  useEffect(() => {
    if (!state) {
      navigate("/home", { replace: true });
      return;
    }
    (async () => {
      try {
        const res = await checkAchievements();
        if (res.newlyUnlocked.length > 0) {
          toast.success(
            t("result.achievementUnlocked", { count: res.newlyUnlocked.length }),
          );
        }
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;

  const isChallenge = state.mode === "challenge";
  const isQuiz = state.mode === "quiz" || isChallenge;
  const accuracy = isQuiz
    ? state.correctCount / state.total
    : state.score / Math.max(state.total, 1);
  const grade = getGrade(accuracy);
  const challengeTitle =
    state.outcome === "win"
      ? t("result.outcomeYouWon")
      : state.outcome === "loss"
        ? t("result.outcomeYouLost")
        : state.outcome === "draw"
          ? t("result.outcomeDrawTitle")
          : state.outcome === "forfeitWin"
            ? t("result.outcomeOpponentForfeited")
            : state.outcome === "forfeitLoss"
              ? t("result.outcomeForfeit")
              : t("result.matchResult");
  const eloChange = state.eloChange;
  const eloPositive = eloChange !== null && eloChange >= 0;
  const kFactorExplanation = getKFactorExplanation(
    t,
    state.kFactorLabel,
    state.kFactor,
  );
  const challengeScoreline = `${state.score} - ${state.opponentScore ?? 0}`;
  const seriesLabel = state.versusScore
    ? `${state.versusScore.player1Wins}-${state.versusScore.player2Wins}${state.versusScore.draws ? `-${state.versusScore.draws}` : ""}`
    : null;
  const currentStreak = state.currentStreak ?? state.versusScore?.currentStreak ?? null;
  const recentMatches = state.recentMatches ?? state.versusScore?.recentMatches ?? [];
  const streakIsYou =
    !!currentStreak &&
    (currentStreak.owner === "you" ||
      (currentStreak.owner === "player1" && state.currentUserIsPlayer1) ||
      (currentStreak.owner === "player2" && !state.currentUserIsPlayer1));
  const streakLabel = currentStreak
    ? streakIsYou
      ? t("result.streakActiveYour", { count: currentStreak.count })
      : t("result.streakActiveOpponent", { count: currentStreak.count })
    : t("result.streakNone");

  const stats = isChallenge
    ? [
        { label: t("result.statYourScore"), value: `${state.score}`, color: "primary" as const },
        { label: t("result.statOpponent"), value: `${state.opponentScore ?? 0}`, color: "accent" as const },
        { label: t("result.statCorrect"), value: `${state.correctCount}/${state.total}`, color: "success" as const },
        { label: t("result.statTopic"), value: state.sport, color: "blue" as const },
      ]
    : isQuiz
      ? [
          { label: t("result.statCorrect"), value: `${state.correctCount}`, color: "success" as const },
          { label: t("result.statAvgTime"), value: `${state.avgTime.toFixed(1)}s`, color: "blue" as const },
          { label: t("result.statAccuracy"), value: `${Math.round(accuracy * 100)}%`, color: "accent" as const },
          { label: t("result.statScore"), value: `${state.score}`, color: "primary" as const },
        ]
      : [
        { label: t("result.statRounds"), value: `${state.total}`, color: "success" as const },
        { label: t("result.statScore"), value: `${state.score}`, color: "primary" as const },
        { label: t("result.statTopic"), value: state.sport, color: "blue" as const },
        { label: t("result.statMode"), value: "Survival", color: "accent" as const },
      ];

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center">
      <NeoCard shadow="lg" className="w-full text-center py-8 mb-6">
        <p className="font-mono font-bold text-6xl animate-pulse-score">
          {state.mode === "challenge" ? challengeScoreline : isQuiz ? `${state.correctCount}/${state.total}` : state.score}
        </p>
        <p className="font-heading text-sm text-muted-foreground mt-2">
          {isChallenge ? t("result.matchResult") : t("result.finalScore")}
        </p>
      </NeoCard>

      {isChallenge ? (
        <div className="mb-6 animate-badge-land text-center">
          <NeoBadge
            color={state.outcome === "win" || state.outcome === "forfeitWin" ? "success" : state.outcome === "draw" ? "blue" : "destructive"}
            rotated
            size="md"
            className="text-xl px-6 py-2"
          >
            {challengeTitle}
          </NeoBadge>
          {state.opponentName && (
            <p className="text-xs text-muted-foreground mt-3">
              {t("result.versusOpponent", { name: state.opponentName })}
            </p>
          )}
          {seriesLabel && (
            <p className="text-xs font-heading font-bold text-muted-foreground mt-2">
              {t("result.seriesLabel", { series: seriesLabel })}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mb-4 animate-badge-land">
            <NeoBadge
              color={grade.color}
              rotated
              size="md"
              className="text-2xl px-6 py-2"
            >
              {grade.letter}
            </NeoBadge>
          </div>

          <div className="flex gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <Star
                key={s}
                size={32}
                strokeWidth={2.5}
                className={`neo-border rounded ${s <= grade.stars ? "fill-primary text-primary" : "text-muted"}`}
              />
            ))}
          </div>
        </>
      )}

      {eloChange !== null && (
        <div className="flex items-center gap-2 mb-6">
          {eloPositive ? (
            <ArrowUp
              size={20}
              strokeWidth={3}
              className="text-success"
            />
          ) : (
            <ArrowDown
              size={20}
              strokeWidth={3}
              className="text-destructive"
            />
          )}
          <span
            className={`font-mono font-bold text-xl ${eloPositive ? "text-success" : "text-destructive"}`}
          >
            {eloPositive ? "+" : ""}
            {Math.round(eloChange)} ELO
          </span>
        </div>
      )}

      {state.kFactorLabel && state.kFactorLabel !== "Standard" && (
        <div className="mb-6 text-center">
          <NeoBadge
            color={state.kFactorLabel === "Placement Match" ? "blue" : "accent"}
            rotated
            size="md"
          >
            {state.kFactorLabel}
          </NeoBadge>
          {kFactorExplanation && (
            <p className="text-xs text-muted-foreground mt-3 max-w-xs">
              {kFactorExplanation}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 w-full mb-8">
        {stats.map((s) => (
          <NeoCard
            key={s.label}
            color={s.color}
            className="text-center py-3"
          >
            <p className="font-mono font-bold text-lg">{s.value}</p>
            <p className="text-[10px] font-heading uppercase opacity-80">
              {s.label}
            </p>
          </NeoCard>
        ))}
      </div>

      {isChallenge && (
        <NeoCard className="w-full mb-8 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-heading font-bold text-sm uppercase">{t("result.rivalry")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="neo-border rounded-md p-3 text-center bg-muted">
              <p className="font-mono font-bold text-lg">{seriesLabel ?? "0-0"}</p>
              <p className="text-[10px] font-heading uppercase opacity-80">{t("result.seriesCardLabel")}</p>
            </div>
            <div className="neo-border rounded-md p-3 text-center bg-muted">
              <p className="font-mono font-bold text-sm">{streakLabel}</p>
              <p className="text-[10px] font-heading uppercase opacity-80">{t("result.streakCardLabel")}</p>
            </div>
          </div>
          {recentMatches.length > 0 && (
            <div>
              <p className="text-[10px] font-heading uppercase text-muted-foreground mb-2">{t("result.lastFive")}</p>
              <div className="flex flex-wrap gap-2">
                {recentMatches.slice(0, 5).map((match, index) => (
                  <span key={`${match.playedAt}-${index}`} className="neo-border rounded px-2 py-1 text-[10px] font-mono font-bold bg-card">
                    {formatRecentOutcome(t, match, state.currentUserIsPlayer1)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </NeoCard>
      )}

      {isQuiz && state.scoreBreakdown && state.scoreBreakdown.length > 0 && (
        <NeoCard className="w-full mb-8 py-4">
          <p className="font-heading font-bold text-sm text-center mb-3">
            {t("result.scoreBreakdown")}
          </p>
          <div className="grid grid-cols-5 gap-2">
            {state.scoreBreakdown.map((item, index) => (
              <div
                key={index}
                className={`neo-border rounded-md px-2 py-2 text-center ${
                  item.correct ? "bg-success text-success-foreground" : "bg-muted"
                }`}
              >
                <p className="font-mono font-bold text-xs">{t("result.questionShort", { num: index + 1 })}</p>
                <p className="font-mono font-bold text-sm">{item.score}</p>
                <p className="text-[9px] opacity-80">
                  {item.timeTaken.toFixed(1)}s
                </p>
              </div>
            ))}
          </div>
        </NeoCard>
      )}

      <div className="w-full space-y-3">
        {isChallenge ? (
          <NeoButton
            variant="primary"
            size="full"
            onClick={() => navigate("/home")}
          >
            {t("result.backToHome")}
          </NeoButton>
        ) : (
          <>
            <NeoButton
              variant="primary"
              size="full"
              onClick={() => navigate(`/sport-select?mode=${state.mode}`)}
            >
              {t("result.playAgain")}
            </NeoButton>
            <NeoButton
              variant="secondary"
              size="full"
              onClick={() =>
                navigate(
                  V2_SHELL_ENABLED
                    ? "/compete"
                    : `/sport-select?mode=${isQuiz ? "survival" : "quiz"}`,
                )
              }
            >
              {t("result.tryOtherMode")}
            </NeoButton>
          </>
        )}
        {!isChallenge && (
          <button
            className="w-full text-center text-sm text-muted-foreground font-heading underline underline-offset-4 cursor-pointer"
            onClick={() => navigate("/home")}
          >
            {t("result.backToHome")}
          </button>
        )}
      </div>
    </div>
  );
}
