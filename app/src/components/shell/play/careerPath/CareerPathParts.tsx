/**
 * Career Path pieces shared by both modes (VerveQ ONE P3.2): the club path
 * card (question content — it owns the answering column) and the two result
 * screens, on the shared ResultScreen: score hero → one lime Share → the next
 * action → details folded.
 */
import { ArrowRight, Check, Repeat, RotateCcw, Share2, Shirt, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ResultDetails, ResultScreen } from "@/components/shell/play/result/ResultScreen";
import { HeroPill, ResultHero } from "@/components/shell/play/result/ResultHero";
import { ResultActions } from "@/components/shell/play/result/ResultActions";
import { RevealedAnswer, VerdictBadge } from "@/components/shell/play/StageSignals";
import { cn } from "@/lib/utils";
import { clubsForDisplay, type CareerPathClub } from "../../../../../convex/lib/careerPathClubs";

/** The career, club by club, oldest first. */
export function ClubPath({ clubs, className }: { clubs: CareerPathClub[]; className?: string }) {
  const { t } = useTranslation("play");
  return (
    <Card padding="md" className={cn("animate-slide-up motion-reduce:animate-none", className)} data-testid="career-path-clubs">
      <Eyebrow className="mb-3">{t("careerPath.clubsHeading")}</Eyebrow>
      <ol className="space-y-2">
        {clubsForDisplay(clubs).map((row, i) =>
          row.kind === "gap" ? (
            <li key={`gap-${i}`} className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full neo-border bg-background font-mono text-body-sm font-bold text-muted-foreground">
                ⋯
              </span>
              <span className="font-body text-meta text-muted-foreground">{t("careerPath.moreClubs", { count: row.hidden })}</span>
            </li>
          ) : (
            <li key={`${row.name}-${row.position}`} className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full neo-border bg-background font-mono text-body-sm font-bold">
                {row.position}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <Shirt size={14} className="shrink-0 text-mode-accent" aria-hidden="true" />
                <span className="truncate font-heading text-body font-bold">{row.name}</span>
                {row.loan && (
                  <Badge tone="muted" className="shrink-0">
                    {t("careerPath.loan")}
                  </Badge>
                )}
              </span>
            </li>
          ),
        )}
      </ol>
    </Card>
  );
}

/** The quiet "playing as guest" line at the foot of a result. */
function GuestFooter({ onAccount }: { onAccount: () => void }) {
  const { t } = useTranslation("play");
  return (
    <>
      <p className="text-meta text-muted-foreground">{t("careerPath.guestNudge")}</p>
      <Button variant="ghost" size="sm" onClick={onAccount} data-testid="career-path-guest-cta">
        {t("careerPath.guestNudgeCta")}
      </Button>
    </>
  );
}

export function CareerPathClassicResult({
  correct,
  typoAccepted,
  answerName,
  score,
  onShare,
  onNext,
  onAccount,
}: {
  correct: boolean;
  typoAccepted?: boolean;
  answerName?: string;
  score: number;
  onShare: () => void;
  onNext: () => void;
  /** Shown only to guests: the invite to save progress. */
  onAccount?: () => void;
}) {
  const { t } = useTranslation("play");
  return (
    <ResultScreen
      testId="career-path-result"
      hero={
        <ResultHero eyebrow={t("careerPath.classicModeTitle")} score={score} caption={t("careerPath.pointsEarned")}>
          <div className="mt-4 flex flex-col items-center gap-2">
            <VerdictBadge right={correct} testId="career-path-verdict">
              {correct ? t("careerPath.resultCorrect") : t("careerPath.resultWrong")}
            </VerdictBadge>
            {answerName && (
              <RevealedAnswer className="text-title-sm">{t("careerPath.itWas", { name: answerName })}</RevealedAnswer>
            )}
            {correct && typoAccepted && <p className="text-meta font-bold">{t("careerPath.typoAccepted")}</p>}
          </div>
        </ResultHero>
      }
      actions={
        <ResultActions
          primary={{
            label: t("careerPath.shareResult"),
            icon: <Share2 size={18} aria-hidden="true" />,
            onClick: onShare,
            testId: "career-path-share",
          }}
          secondary={[
            {
              label: t("careerPath.nextPlayer"),
              icon: <ArrowRight size={18} aria-hidden="true" />,
              onClick: onNext,
              testId: "career-path-next",
            },
          ]}
        />
      }
      footer={onAccount ? <GuestFooter onAccount={onAccount} /> : undefined}
    />
  );
}

export interface LadderRoundSummary {
  correct: boolean;
  answerName?: string;
  score: number;
  resolution: "guessed" | "skipped" | "timed_out";
}

export function CareerPathLadderResult({
  results,
  rounds,
  totalScore,
  onShare,
  onPlayAgain,
  onChangeMode,
  onAccount,
}: {
  results: ReadonlyArray<LadderRoundSummary>;
  rounds: number;
  totalScore: number;
  onShare: () => void;
  onPlayAgain: () => void;
  onChangeMode: () => void;
  onAccount?: () => void;
}) {
  const { t } = useTranslation("play");
  const solved = results.filter((r) => r.correct).length;
  return (
    <ResultScreen
      testId="career-path-ladder-result"
      hero={
        <ResultHero
          eyebrow={t("careerPath.ladderModeTitle")}
          score={solved}
          total={rounds}
          caption={t("careerPath.pathsSolved")}
          squares={results.map((r) => r.correct)}
          squaresLabel={t("result.squares", { score: solved, total: rounds })}
          // The 2 / 3 / 3 / 2 easy → impossible ramp.
          breaks={[2, 5, 8]}
        >
          <HeroPill testId="career-path-ladder-points">{t("careerPath.totalPoints", { score: totalScore })}</HeroPill>
        </ResultHero>
      }
      actions={
        <ResultActions
          primary={{
            label: t("careerPath.shareResult"),
            icon: <Share2 size={18} aria-hidden="true" />,
            onClick: onShare,
            testId: "career-path-share",
          }}
          secondary={[
            {
              label: t("careerPath.playAgain"),
              icon: <RotateCcw size={18} aria-hidden="true" />,
              onClick: onPlayAgain,
              testId: "career-path-play-again",
            },
            {
              label: t("careerPath.changeMode"),
              icon: <Repeat size={18} aria-hidden="true" />,
              onClick: onChangeMode,
              testId: "career-path-change-mode",
            },
          ]}
        />
      }
      details={
        <ResultDetails summary={t("result.answers")} testId="career-path-ladder-answers">
          <ol>
            {results.map((r, i) => (
              <li key={i} className="flex items-center gap-3 border-b border-border/15 py-2 text-body-sm last:border-b-0">
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink",
                    r.correct ? "bg-verdict-right" : "bg-verdict-wrong",
                  )}
                  aria-hidden="true"
                >
                  {r.correct ? <Check size={14} strokeWidth={3.5} /> : <X size={14} strokeWidth={3.5} />}
                </span>
                <span className="min-w-0 flex-1 truncate font-heading font-bold">{r.answerName ?? "—"}</span>
                <span className="shrink-0 font-mono text-meta text-muted-foreground">
                  {r.resolution === "timed_out"
                    ? t("careerPath.timeUp")
                    : r.resolution === "skipped"
                      ? t("careerPath.skipped")
                      : t("careerPath.points", { score: r.score })}
                </span>
              </li>
            ))}
          </ol>
        </ResultDetails>
      }
      footer={onAccount ? <GuestFooter onAccount={onAccount} /> : undefined}
    />
  );
}
