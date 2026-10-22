/**
 * The solo modes' endings on the shared ResultScreen (VerveQ ONE P3.1): Quiz,
 * Survival, the Daily Quiz, Daily Survival and Blitz. They used to leave the
 * shell for the v1 pages /results, /daily-results and /blitz-results; each
 * play screen now renders its result in place, inside its own StageFrame.
 *
 * Every ending runs the same order (ResultScreen):
 *   score hero on the mode accent → rating change / next-daily line →
 *   Share (the ONE lime primary) → Next today → Play again (secondary) →
 *   the run's details folded away → one quiet claim-name line.
 */
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "convex/react";
import { Check, Minus, RotateCcw, Share2, TrendingDown, TrendingUp, X } from "lucide-react";
import { StageFrame, type StageMode } from "@/components/shell/play/PlayStage";
import { ClaimNamePrompt } from "@/components/shell/onboarding/ClaimNamePrompt";
import { useUtcMidnightCountdown } from "@/hooks/useUtcMidnightCountdown";
import { track } from "@/lib/analytics";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { getTodayUTC, isWorldCupEditionActive } from "../../../../../convex/lib/daily";
import { api } from "../../../../../convex/_generated/api";
import { ResultDetails, ResultScreen } from "./ResultScreen";
import { HeroPill, ResultHero } from "./ResultHero";
import { NextTodayCard, ResultActions, type ResultAction } from "./ResultActions";
import { useNextToday } from "./useNextToday";
import type { TodayGame } from "./nextToday";
import { answerGrid, resultShareUrl, useResultShare, type ShareMode } from "./shareResult";

// ── Result shapes (what each play loop hands its screen) ──────────────────

export interface AnswerRow {
  correct: boolean;
  timeTaken: number;
  score: number;
}

/** Ranked runs report the server's rating change (null when none was written). */
export interface RatingChange {
  eloChange: number | null;
  newElo: number | null;
  kFactor?: number;
  kFactorLabel?: string;
}

export interface QuizResultData extends RatingChange {
  score: number;
  correctCount: number;
  total: number;
  avgTime: number;
  sport: string;
  isCameFirst: boolean;
  breakdown: AnswerRow[];
}

export interface SurvivalResultData extends RatingChange {
  score: number;
  /** The round the run reached (the server's round counter). */
  rounds: number;
  correctCount: number;
  sport: string;
}

export interface DailyQuizResultData {
  score: number;
  correctCount: number;
  total: number;
  sport: string;
  breakdown: AnswerRow[];
}

export interface DailySurvivalResultData {
  score: number;
  /** The round the run reached (the server's round counter). */
  rounds: number;
  correctCount: number;
  /** One emoji per finished round: 🟩 clean, 🟨 helped, 🟥 miss, ⬜ skip. */
  shareString?: string;
  /** The tab-away rule ended the run. */
  forfeited?: boolean;
}

export interface BlitzResultData {
  score: number;
  correctCount: number;
  wrongCount: number;
  sport: string;
}

// ── Shared pieces ──────────────────────────────────────────────────────────

/** Raw sport keys are lowercase ("football") — title-case for display. */
function topicLabel(sport: string): string {
  return sport ? sport[0].toUpperCase() + sport.slice(1) : sport;
}

function ResultFrame({
  mode,
  title,
  subtitle,
  onExit,
  children,
}: {
  mode: StageMode;
  title: string;
  subtitle?: string;
  onExit: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("play");
  return (
    <StageFrame mode={mode} title={title} subtitle={subtitle} onExit={onExit} exitLabel={t("result.home")}>
      {children}
    </StageFrame>
  );
}

/** The ranked line under the hero: the rating change, in plain words. */
function RatingLine({ eloChange, newElo, kFactor, kFactorLabel }: RatingChange) {
  const { t } = useTranslation("play");
  const { t: ts } = useTranslation("screens");
  if (eloChange === null) return null;
  const change = Math.round(eloChange);
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  // Only the non-standard K-factors are worth a sentence.
  const explain =
    kFactorLabel && kFactor && kFactorLabel !== "Standard"
      ? kFactorLabel === "Placement Match"
        ? ts("result.kFactorPlacement", { k: kFactor })
        : kFactorLabel === "High-Tier Protection"
          ? ts("result.kFactorHighTier", { k: kFactor })
          : null
      : null;
  return (
    <div className="text-center" data-testid="result-rating">
      <p className="inline-flex items-center gap-2 font-mono font-bold text-body">
        <Icon size={18} strokeWidth={3} aria-hidden="true" />
        {change > 0
          ? t("result.rating.up", { change })
          : change < 0
            ? t("result.rating.down", { change: Math.abs(change) })
            : t("result.rating.same")}
        {newElo != null && (
          <span className="font-normal text-muted-foreground">· {t("result.rating.now", { elo: Math.round(newElo) })}</span>
        )}
      </p>
      {explain && <p className="mt-1 text-meta text-muted-foreground">{explain}</p>}
    </div>
  );
}

/** The dailies' line under the hero: one ticking countdown to the next edition. */
export function NextDailyCountdown({ className }: { className?: string }) {
  const { t } = useTranslation("play");
  const time = useUtcMidnightCountdown();
  return (
    <p className={cn("text-center text-body-sm text-muted-foreground tabular-nums", className)} data-testid="next-daily-countdown">
      {t("result.nextDailyIn", { time })}
    </p>
  );
}

/** "Next today" — the next unfinished daily, then Home. */
export function NextTodayFor({ from, mode }: { from: TodayGame | null; mode: ShareMode }) {
  const target = useNextToday(from);
  return (
    <NextTodayCard
      target={target}
      testId="result-next-today"
      onFollow={() =>
        track("daily_next_today_clicked", { from: mode, to: target.kind === "game" ? target.game : "home" })
      }
    />
  );
}

function ShareAction(onClick: () => void, label: string): ResultAction {
  return { label, icon: <Share2 size={18} aria-hidden="true" />, onClick, testId: "result-share" };
}

function PlayAgainAction(onClick: () => void, label: string): ResultAction {
  return { label, icon: <RotateCcw size={18} aria-hidden="true" />, onClick, testId: "result-play-again" };
}

/** Label/value rows for a "Details" disclosure. */
function StatRows({ rows }: { rows: ReadonlyArray<[string, ReactNode]> }) {
  return (
    <dl>
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 border-b border-border/15 py-2 text-body-sm last:border-b-0">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-mono font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One row per question: its verdict, points and time. */
function AnswerList({ rows }: { rows: ReadonlyArray<AnswerRow> }) {
  const { t } = useTranslation("play");
  return (
    <ol data-testid="result-answers">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center gap-3 border-b border-border/15 py-2 text-body-sm last:border-b-0">
          <span
            className={cn(
              "grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink",
              r.correct ? "bg-verdict-right" : "bg-verdict-wrong",
            )}
            aria-label={r.correct ? t("result.right") : t("result.wrong")}
          >
            {r.correct ? <Check size={14} strokeWidth={3.5} /> : <X size={14} strokeWidth={3.5} />}
          </span>
          <span className="flex-1 font-heading font-bold">{t("result.question", { n: i + 1 })}</span>
          <span className="font-mono tabular-nums text-muted-foreground">{t("result.seconds", { value: r.timeTaken.toFixed(1) })}</span>
          <span className="w-16 text-right font-mono font-bold tabular-nums">{t("result.pts", { score: r.score })}</span>
        </li>
      ))}
    </ol>
  );
}

/** Quiz + Survival bank achievements as the run is scored, as the v1 page did. */
function useAchievementCheck() {
  const { t } = useTranslation("screens");
  const checkAchievements = useMutation(api.achievements.checkAndUnlock);
  useEffect(() => {
    checkAchievements()
      .then((res) => {
        if (res.newlyUnlocked.length > 0) {
          notify.success(t("result.achievementUnlocked", { count: res.newlyUnlocked.length }));
        }
      })
      .catch(() => {
        /* ignore */
      });
    // Once per result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ── Quiz ───────────────────────────────────────────────────────────────────

export function QuizResult({
  result,
  onPlayAgain,
  onExit,
}: {
  result: QuizResultData;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation("play");
  useAchievementCheck();
  const accuracy = Math.round((result.correctCount / Math.max(result.total, 1)) * 100);
  const share = useResultShare(
    "quiz",
    t("result.shareText.quiz", {
      correct: result.correctCount,
      total: result.total,
      score: result.score,
      emoji: answerGrid(result.breakdown),
      url: resultShareUrl("/games/", "quiz_share"),
    }),
    result.score,
  );
  return (
    <ResultFrame mode="quiz" title={result.isCameFirst ? t("quiz.cameFirstBadge") : t("quiz.title")} onExit={onExit}>
      <ResultScreen
        testId="quiz-result"
        hero={
          <ResultHero
            eyebrow={result.isCameFirst ? t("quiz.cameFirstBadge") : t("quiz.title")}
            score={result.correctCount}
            total={result.total}
            squares={result.breakdown.map((r) => r.correct)}
            squaresLabel={t("result.squares", { score: result.correctCount, total: result.total })}
            breaks={[]}
          >
            <HeroPill>{t("result.pts", { score: result.score })}</HeroPill>
          </ResultHero>
        }
        status={<RatingLine {...result} />}
        actions={
          <ResultActions
            primary={ShareAction(share, t("dailyShare.cta"))}
            next={<NextTodayFor from={null} mode="quiz" />}
            secondary={[PlayAgainAction(onPlayAgain, t("result.playAgain"))]}
          />
        }
        details={
          <ResultDetails summary={t("result.answers")} testId="result-details">
            <AnswerList rows={result.breakdown} />
            <StatRows
              rows={[
                [t("result.stat.accuracy"), `${accuracy}%`],
                [t("result.stat.avgTime"), t("result.seconds", { value: result.avgTime.toFixed(1) })],
                [t("result.stat.topic"), topicLabel(result.sport)],
              ]}
            />
          </ResultDetails>
        }
      />
    </ResultFrame>
  );
}

// ── Daily Quiz ─────────────────────────────────────────────────────────────

export function DailyQuizResult({ result, onExit }: { result: DailyQuizResultData; onExit: () => void }) {
  const { t } = useTranslation("play");
  const { t: ts } = useTranslation("screens");
  const date = getTodayUTC();
  // Same window predicate the backend uses to theme the daily's question pool,
  // so the eyebrow/share copy and the served questions flip together.
  const isWorldCup = isWorldCupEditionActive(result.sport, date);
  // `ref=daily_share` feeds cold-entry attribution; the link targets the static
  // daily landing page so the share unfurls with daily-specific OG copy.
  const share = useResultShare(
    "daily-quiz",
    ts(isWorldCup ? "dailyResult.shareQuizWorldCup" : "dailyResult.shareQuiz", {
      sport: topicLabel(result.sport),
      date,
      score: result.score,
      correct: result.correctCount,
      total: result.total,
      emoji: answerGrid(result.breakdown),
      url: resultShareUrl("/games/daily-football-quiz/", "daily_share"),
    }),
    result.score,
  );
  return (
    <ResultFrame mode="daily-quiz" title={t("dailyQuiz.title")} onExit={onExit}>
      <ResultScreen
        testId="daily-quiz-result"
        hero={
          <ResultHero
            eyebrow={t(isWorldCup ? "result.eyebrow.dailyQuizWorldCup" : "result.eyebrow.dailyQuiz", { date })}
            score={result.correctCount}
            total={result.total}
            squares={result.breakdown.map((r) => r.correct)}
            squaresLabel={t("result.squares", { score: result.correctCount, total: result.total })}
            breaks={[]}
          >
            <HeroPill>{t("result.pts", { score: result.score })}</HeroPill>
          </ResultHero>
        }
        status={<NextDailyCountdown />}
        actions={
          <ResultActions
            primary={ShareAction(share, t("dailyShare.cta"))}
            next={<NextTodayFor from="quiz" mode="daily-quiz" />}
          />
        }
        details={
          <ResultDetails summary={t("result.answers")} testId="result-details">
            <AnswerList rows={result.breakdown} />
            <StatRows rows={[[t("result.stat.topic"), topicLabel(result.sport)]]} />
          </ResultDetails>
        }
        // The Daily has no public board of its own, so no `board`: the copy
        // promises none.
        footer={<ClaimNamePrompt source="daily-quiz" />}
      />
    </ResultFrame>
  );
}

// ── Survival ───────────────────────────────────────────────────────────────

export function SurvivalResult({
  result,
  onPlayAgain,
  onExit,
}: {
  result: SurvivalResultData;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation("play");
  useAchievementCheck();
  const share = useResultShare(
    "survival",
    t("result.shareText.survival", {
      score: result.score,
      round: result.rounds,
      url: resultShareUrl("/games/football-survival/", "survival_share"),
    }),
    result.score,
  );
  return (
    <ResultFrame mode="survival" title={t("survival.title")} onExit={onExit}>
      <ResultScreen
        testId="survival-result"
        hero={
          <ResultHero eyebrow={t("result.eyebrow.survival")} score={result.score} caption={t("result.pointsCaption")}>
            <HeroPill>{t("result.line.survival", { correct: result.correctCount, round: result.rounds })}</HeroPill>
          </ResultHero>
        }
        status={<RatingLine {...result} />}
        actions={
          <ResultActions
            primary={ShareAction(share, t("dailyShare.cta"))}
            next={<NextTodayFor from={null} mode="survival" />}
            secondary={[PlayAgainAction(onPlayAgain, t("result.playAgain"))]}
          />
        }
        details={
          <ResultDetails summary={t("result.details")} testId="result-details">
            <StatRows
              rows={[
                [t("result.stat.rounds"), result.rounds],
                [t("result.stat.correct"), result.correctCount],
                [t("result.stat.topic"), topicLabel(result.sport)],
              ]}
            />
          </ResultDetails>
        }
      />
    </ResultFrame>
  );
}

// ── Daily Survival ─────────────────────────────────────────────────────────

export function DailySurvivalResult({ result, onExit }: { result: DailySurvivalResultData; onExit: () => void }) {
  const { t } = useTranslation("play");
  const { t: ts } = useTranslation("screens");
  const date = getTodayUTC();
  const share = useResultShare(
    "daily-survival",
    ts("dailyResult.shareSurvival", {
      sport: topicLabel("football"),
      date,
      score: result.score,
      rounds: result.rounds,
      emoji: result.shareString || "",
      url: resultShareUrl("/games/daily-football-quiz/", "daily_share"),
    }),
    result.score,
  );
  return (
    <ResultFrame mode="daily-survival" title={t("survival.daily.title")} onExit={onExit}>
      <ResultScreen
        testId="daily-survival-result"
        hero={
          <ResultHero eyebrow={t("result.eyebrow.dailySurvival", { date })} score={result.score} caption={t("result.pointsCaption")}>
            <HeroPill>
              {result.forfeited
                ? t("result.line.forfeited")
                : t("result.line.survival", { correct: result.correctCount, round: result.rounds })}
            </HeroPill>
          </ResultHero>
        }
        status={<NextDailyCountdown />}
        actions={
          <ResultActions
            primary={ShareAction(share, t("dailyShare.cta"))}
            next={<NextTodayFor from="survival" mode="daily-survival" />}
          />
        }
        details={
          <ResultDetails summary={t("result.details")} testId="result-details">
            {result.shareString && (
              <p className="pb-2 text-center text-title-sm tracking-widest" aria-hidden="true">
                {result.shareString}
              </p>
            )}
            <StatRows
              rows={[
                [t("result.stat.rounds"), result.rounds],
                [t("result.stat.correct"), result.correctCount],
              ]}
            />
          </ResultDetails>
        }
        footer={<ClaimNamePrompt source="daily-survival" />}
      />
    </ResultFrame>
  );
}

// ── Blitz ──────────────────────────────────────────────────────────────────

export function BlitzResult({
  result,
  onPlayAgain,
  onExit,
}: {
  result: BlitzResultData;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation("play");
  const share = useResultShare(
    "blitz",
    t("result.shareText.blitz", {
      score: result.score,
      correct: result.correctCount,
      url: resultShareUrl("/games/60-second-football-quiz/", "blitz_share"),
    }),
    result.score,
  );
  return (
    <ResultFrame mode="blitz" title={t("blitz.title")} onExit={onExit}>
      <ResultScreen
        testId="blitz-result"
        hero={
          <ResultHero eyebrow={t("result.eyebrow.blitz")} score={result.score} caption={t("result.pointsCaption")}>
            <HeroPill>{t("result.line.blitz", { correct: result.correctCount, wrong: result.wrongCount })}</HeroPill>
          </ResultHero>
        }
        actions={
          <ResultActions
            primary={ShareAction(share, t("dailyShare.cta"))}
            next={<NextTodayFor from={null} mode="blitz" />}
            secondary={[PlayAgainAction(onPlayAgain, t("result.playAgain"))]}
          />
        }
        details={
          <ResultDetails summary={t("result.details")} testId="result-details">
            <StatRows
              rows={[
                [t("result.stat.correct"), result.correctCount],
                [t("result.stat.wrong"), result.wrongCount],
                [t("result.stat.topic"), topicLabel(result.sport)],
              ]}
            />
          </ResultDetails>
        }
        // Blitz HAS a public board, and this run's score row is already
        // written — claiming a name is what makes it visible, at the score
        // just set. So the board promise here is literally true.
        footer={<ClaimNamePrompt board="blitz" source="blitz" />}
      />
    </ResultFrame>
  );
}
