import { useEffect, useMemo, useState } from "react";
import { Share2, Copy, Flame } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoCard } from "@/components/neo/NeoCard";
import type {
  DrawLeaderboardEntry,
  DrawRarity,
  DrawRunView,
  DrawStreak,
} from "@/lib/drawApi/types";
import { DrawCardFace } from "./DrawCardFace";
import { ShareCard } from "./ShareCard";
import { buildIdentity, buildShareText, buildTrail, OUTCOME_LABEL } from "./share";
import type { ShareCardData } from "./share";

interface ResultStageProps {
  view: DrawRunView;
  rarity: DrawRarity | null;
  streak: DrawStreak | null;
  leaderboard: DrawLeaderboardEntry[];
  nextBoardAt: number | null;
  shareUrl: string;
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

const OUTCOME_TONE: Record<string, string> = {
  banked: "bg-success text-success-foreground",
  busted: "bg-destructive text-destructive-foreground",
  fullclear: "bg-yellow text-yellow-foreground",
};

/**
 * S4 — result: final score, rounds trail, outcome, rarity line, streak,
 * countdown to the next board, share card (S5), full board reveal,
 * leaderboard. This screen may scroll (the 390×844 no-scroll budget binds
 * S2/S3 only).
 */
export function ResultStage({ view, rarity, streak, leaderboard, nextBoardAt, shareUrl }: ResultStageProps) {
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
  };

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (nextBoardAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [nextBoardAt]);

  const handleShare = async () => {
    const text = buildShareText(shareData);
    try {
      if (navigator.share) {
        await navigator.share({ title: "THE DRAW", text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Result copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText(shareData));
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const squadIds = new Set(view.squad.map((c) => c.id));

  return (
    <div className="flex flex-col gap-3 pb-6" data-testid="draw-result-stage">
      <NeoCard shadow="lg" className={cn("text-center py-4", OUTCOME_TONE[outcome])}>
        <p className="font-heading font-black text-3xl leading-none">{OUTCOME_LABEL[outcome]}</p>
        <p className="font-mono font-bold text-5xl leading-none mt-2" data-testid="draw-final-score">
          {Math.round(view.finalScore ?? 0).toLocaleString("en-US")}
        </p>
        <p className="text-2xl mt-2 tracking-wide">{trail}</p>
        {rarity !== null && (
          <p className="font-heading font-bold text-[11px] mt-2 uppercase" data-testid="draw-rarity-line">
            Only {rarity.linePercent}% drafted this line
          </p>
        )}
      </NeoCard>

      <div className="flex items-center justify-between gap-2">
        <span className="neo-border neo-shadow-sm rounded-full bg-card px-3 py-1 font-heading font-bold text-xs inline-flex items-center gap-1">
          <Flame size={12} strokeWidth={3} />
          STREAK {streak?.current ?? 0}
        </span>
        {nextBoardAt !== null && (
          <span className="font-mono font-bold text-xs text-muted-foreground" data-testid="draw-countdown">
            NEXT BOARD {formatCountdown(nextBoardAt - now)}
          </span>
        )}
      </div>

      <ShareCard data={shareData} />
      <div className="grid grid-cols-2 gap-3">
        <NeoButton variant="primary" onClick={handleShare} data-testid="draw-share-btn">
          <Share2 size={14} /> SHARE
        </NeoButton>
        <NeoButton variant="secondary" onClick={handleCopy}>
          <Copy size={14} /> COPY
        </NeoButton>
      </div>

      {/* Full board reveal — every offer, drafted picks highlighted. */}
      {view.fullBoard && (
        <div data-testid="draw-board-reveal">
          <p className="font-heading font-bold text-xs tracking-wide mb-2">THE FULL BOARD</p>
          <div className="flex flex-col gap-1.5">
            {view.fullBoard.map((row, r) => (
              <div key={r} className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-[9px] w-5 text-muted-foreground">
                  R{r + 1}
                </span>
                {row.map((card) => (
                  <div
                    key={card.id}
                    className={cn(
                      "neo-border rounded flex-1 min-w-0 h-14 bg-card",
                      squadIds.has(card.id)
                        ? "ring-2 ring-primary neo-shadow-sm"
                        : "opacity-60",
                    )}
                  >
                    <DrawCardFace card={card} size="mini" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {leaderboard.length > 0 && (
        <div data-testid="draw-leaderboard">
          <p className="font-heading font-bold text-xs tracking-wide mb-2">TODAY'S BOARD</p>
          <div className="flex flex-col gap-1">
            {leaderboard.map((entry) => (
              <div
                key={`${entry.rank}-${entry.name}`}
                className={cn(
                  "neo-border rounded-lg flex items-center gap-2 px-2 py-1.5",
                  entry.isYou ? "bg-primary text-primary-foreground neo-shadow-sm" : "bg-card",
                )}
              >
                <span className="font-mono font-bold text-xs w-6">#{entry.rank}</span>
                <span className="font-heading font-bold text-xs flex-1 truncate">{entry.name}</span>
                <span className="font-heading text-[9px] uppercase opacity-70">
                  {OUTCOME_LABEL[entry.outcome]}
                </span>
                <span className="font-mono font-bold text-xs">{entry.score.toLocaleString("en-US")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
