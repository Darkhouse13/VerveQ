import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Share2, Copy, Flame } from "lucide-react";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { ResultScreen } from "@/components/shell/play/result/ResultScreen";
import { HeroPill, ResultHero } from "@/components/shell/play/result/ResultHero";
import { ResultActions } from "@/components/shell/play/result/ResultActions";
import type {
  DrawLeaderboardEntry,
  DrawRarity,
  DrawRunView,
  DrawStreak,
} from "@/lib/drawApi/types";
import type { Card } from "@/lib/drawEngine";
import { DrawCardFace } from "./DrawCardFace";
import { CardDetailSheet } from "./CardDetailSheet";
import { ShareCard } from "./ShareCard";
import { buildIdentity, buildShareText, buildTrail, outcomeLabel, rarityLine } from "./share";
import type { ShareCardData } from "./share";
import { useDrawT } from "./drawI18n";

interface ResultStageProps {
  view: DrawRunView;
  rarity: DrawRarity | null;
  streak: DrawStreak | null;
  leaderboard: DrawLeaderboardEntry[];
  nextBoardAt: number | null;
  shareUrl: string;
  /** "Next today" — the screen's way on (there is no second board today). */
  next?: ReactNode;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * S4 — result, on the shared ResultScreen (VerveQ ONE P4.2): the hero (final
 * score, outcome, one square per fixture played, rarity line), the streak and
 * the countdown to the next board, Share as the ONE lime action, then "Next
 * today" (one board a day: there is no "play again"), Copy. Below: the share
 * card (S5), the full board reveal and today's leaderboard. This screen may
 * scroll (the no-scroll budget binds S2/S3 only).
 *
 * The hero wears THE DRAW's lime outline on the card fill rather than a mode
 * fill: the mode's identity is its card faces and a lime edge, never a large
 * lime fill.
 */
export function ResultStage({ view, rarity, streak, leaderboard, nextBoardAt, shareUrl, next }: ResultStageProps) {
  const t = useDrawT();
  const outcome = view.outcome ?? "banked";
  const trail = buildTrail(view.rounds, outcome);
  const identity = useMemo(() => buildIdentity(view.rounds), [view.rounds]);
  const shareData: ShareCardData = {
    boardNumber: view.boardNumber,
    outcome,
    trail,
    identity,
    score: view.finalScore ?? 0,
    url: shareUrl,
    rarity,
  };
  // F6 — one gate, shared with the share card and the share text.
  const rarityText = rarityLine(rarity, t);
  const [detailCard, setDetailCard] = useState<Card | null>(null);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (nextBoardAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nextBoardAt]);

  // navigator.share is called straight from the tap (no await before it):
  // iOS drops the sheet when an await sits between the tap and the call.
  const handleShare = async () => {
    const text = buildShareText(shareData, t);
    try {
      if (navigator.share) {
        await navigator.share({ title: "THE DRAW", text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(text);
        notify.success(t("result.copied"));
      }
    } catch {
      /* user cancelled */
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText(shareData, t));
      notify.success(t("result.copied"));
    } catch {
      notify.error(t("result.copyFailed"));
    }
  };

  const squadIds = new Set(view.squad.map((c) => c.id));
  const cleared = view.rounds.filter((r) => r.cleared).length;
  const score = Math.round(view.finalScore ?? 0).toLocaleString("en-US");

  return (
    <>
      <ResultScreen
        testId="draw-result-stage"
        hero={
          <ResultHero
            eyebrow={t("result.eyebrow", { outcome: outcomeLabel(outcome, t), n: view.boardNumber })}
            score={score}
            caption={t("result.points")}
            squares={view.rounds.map((r) => r.cleared)}
            squaresLabel={t("result.squares", { cleared, total: view.rounds.length })}
            breaks={[]}
            className="draw-outline-lime bg-card text-card-foreground"
            testId="draw-final-score"
          >
            {rarityText && (
              <HeroPill testId="draw-rarity-line">{rarityText}</HeroPill>
            )}
          </ResultHero>
        }
        status={
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-body-sm text-muted-foreground tabular-nums">
            <span className="inline-flex items-center gap-1 font-bold text-foreground">
              <Flame size={14} strokeWidth={3} aria-hidden="true" />
              {t("result.streak", { count: streak?.current ?? 0 })}
            </span>
            {nextBoardAt !== null && (
              <span data-testid="draw-countdown">
                {t("result.nextBoard", { time: formatCountdown(nextBoardAt - now) })}
              </span>
            )}
          </p>
        }
        actions={
          <ResultActions
            primary={{
              label: t("result.share"),
              icon: <Share2 size={18} aria-hidden="true" />,
              onClick: () => void handleShare(),
              testId: "draw-share-btn",
            }}
            next={next}
            secondary={[
              {
                label: t("result.copy"),
                icon: <Copy size={18} aria-hidden="true" />,
                onClick: () => void handleCopy(),
                testId: "draw-copy-btn",
              },
            ]}
          />
        }
        details={
          <>
            <section className="flex flex-col gap-2">
              <h2 className="font-mono text-eyebrow uppercase text-muted-foreground">{t("result.shareCard")}</h2>
              <ShareCard data={shareData} />
            </section>

            {/* Full board reveal — every offer, drafted picks outlined. */}
            {view.fullBoard && (
              <section className="flex flex-col gap-2" data-testid="draw-board-reveal">
                <h2 className="font-heading font-bold text-title-sm">{t("result.fullBoard")}</h2>
                <p className="text-meta text-muted-foreground">{t("result.fullBoardHelp")}</p>
                <div className="flex flex-col gap-1.5">
                  {view.fullBoard.map((row, r) => (
                    <div key={r} className="flex items-center gap-1.5">
                      <span className="font-mono text-eyebrow w-6 shrink-0 text-muted-foreground">
                        {t("result.row", { n: r + 1 })}
                      </span>
                      {/* F7 — the reveal is outside the pick flow, so a tap
                          here is unambiguous: it opens the card's detail. */}
                      {row.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => setDetailCard(card)}
                          className={cn(
                            "neo-border rounded-md flex-1 min-w-0 h-14 bg-card text-card-foreground cursor-pointer active:neo-shadow-pressed",
                            squadIds.has(card.id) ? "draw-outline-lime neo-shadow-sm" : "draw-border-quiet text-muted-foreground",
                          )}
                          data-testid={`draw-reveal-card-${card.id}`}
                        >
                          <DrawCardFace card={card} size="mini" />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {leaderboard.length > 0 && (
              <section className="flex flex-col gap-2" data-testid="draw-leaderboard">
                <h2 className="font-heading font-bold text-title-sm">{t("result.leaderboard")}</h2>
                <ol className="flex flex-col gap-1">
                  {leaderboard.map((entry) => (
                    <li
                      key={`${entry.rank}-${entry.name}`}
                      className={cn(
                        "neo-border rounded-lg flex items-center gap-2 px-3 min-h-11 bg-card",
                        entry.isYou && "draw-outline-lime",
                      )}
                    >
                      <span className="font-mono font-bold text-body-sm w-8">#{entry.rank}</span>
                      <span className="font-heading font-bold text-body-sm flex-1 truncate">{entry.name}</span>
                      <span className="font-mono text-eyebrow text-muted-foreground">
                        {outcomeLabel(entry.outcome, t)}
                      </span>
                      {/* F5 — integers only. The engine's scores are floats
                          and this row rendered them raw ("444.291"). */}
                      <span className="font-mono font-bold text-body-sm tabular-nums">
                        {Math.round(entry.score).toLocaleString("en-US")}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        }
      />
      <CardDetailSheet card={detailCard} onClose={() => setDetailCard(null)} />
    </>
  );
}
