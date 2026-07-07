import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
import { useNavigate, useLocation } from "react-router-dom";
import { Calendar, Copy, Check, Share2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getTodayUTC, isWorldCupEditionActive } from "../../convex/lib/daily";

interface DailyResultState {
  score: number;
  total: number;
  correctCount: number;
  sport: string;
  shareString?: string;
  mode: "daily-quiz" | "daily-survival";
  eloChange?: number | null;
  newElo?: number | null;
  scoreBreakdown?: Array<{
    correct: boolean;
    timeTaken: number;
    score: number;
  }>;
}

export default function DailyResultScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation("screens");
  const state = location.state as DailyResultState | null;
  const [copied, setCopied] = useState(false);

  if (!state) {
    navigate("/home", { replace: true });
    return null;
  }

  const isQuiz = state.mode === "daily-quiz";
  const dateStr = getTodayUTC();
  // Same window predicate the backend uses to theme the daily's question pool,
  // so the badge/share copy and the served questions flip together.
  const isWorldCup = isWorldCupEditionActive(state.sport, dateStr);

  const sportLabel = state.sport.charAt(0).toUpperCase() + state.sport.slice(1);
  // `ref=` feeds cold-entry attribution (coldEntryMetrics.bySource), so shared
  // results are measurable against direct traffic. The link targets the static
  // daily landing page (public/games/daily-football-quiz/) so the share
  // unfurls with daily-specific OG copy instead of the generic home card; the
  // page's app CTA forwards the incoming ?ref= so attribution survives the hop.
  const shareUrl = `${window.location.origin}/games/daily-football-quiz/?ref=daily_share`;
  const shareText = isQuiz
    ? t(
        isWorldCup ? "dailyResult.shareQuizWorldCup" : "dailyResult.shareQuiz",
        {
          sport: sportLabel,
          date: dateStr,
          score: state.score,
          correct: state.correctCount,
          total: state.total,
          emoji: state.shareString || "",
          url: shareUrl,
        },
      )
    : t("dailyResult.shareSurvival", {
        sport: sportLabel,
        date: dateStr,
        score: state.score,
        rounds: state.total,
        url: shareUrl,
      });

  const copyShareText = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success(t("dailyResult.copiedToClipboard"));
    setTimeout(() => setCopied(false), 2000);
  };

  // One-tap share: the native sheet where it exists (mobile — WhatsApp et al.),
  // clipboard everywhere else. A dismissed sheet (AbortError) is not an error.
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
    try {
      await copyShareText();
    } catch {
      toast.error(t("dailyResult.copyFailed"));
    }
  };

  const handleCopy = async () => {
    try {
      await copyShareText();
    } catch {
      toast.error(t("dailyResult.copyFailed"));
    }
  };

  const stats = isQuiz
    ? [
        { label: t("dailyResult.statCorrect"), value: `${state.correctCount}/${state.total}`, color: "success" as const },
        { label: t("dailyResult.statScore"), value: `${state.score}`, color: "primary" as const },
        { label: t("dailyResult.statTopic"), value: state.sport, color: "blue" as const },
        { label: t("dailyResult.statMode"), value: t("dailyResult.modeDailyQuiz"), color: "pink" as const },
      ]
    : [
        { label: t("dailyResult.statScore"), value: `${state.score}`, color: "primary" as const },
        { label: t("dailyResult.statRounds"), value: `${state.total}`, color: "success" as const },
        { label: t("dailyResult.statTopic"), value: state.sport, color: "blue" as const },
        { label: t("dailyResult.statMode"), value: t("dailyResult.modeDailySurvival"), color: "pink" as const },
      ];

  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center">
      <NeoCard shadow="lg" className="w-full text-center py-8 mb-6">
        <Calendar size={36} strokeWidth={2.5} className="mx-auto mb-3 text-hot-pink" />
        <p className="font-mono font-bold text-5xl">
          {isQuiz ? `${state.correctCount}/${state.total}` : state.score}
        </p>
        <p className="font-heading text-sm text-muted-foreground mt-2">
          {t("dailyResult.complete")}
        </p>
      </NeoCard>

      <div className="mb-4 flex items-center justify-center gap-2 flex-wrap">
        {isWorldCup && (
          <NeoBadge color="success" rotated size="md" className="text-sm px-4 py-1.5">
            {t("dailyResult.worldCupEdition")}
          </NeoBadge>
        )}
        <NeoBadge color="pink" rotated size="md" className="text-lg px-5 py-1.5">
          {dateStr}
        </NeoBadge>
      </div>

      {state.shareString && (
        <NeoCard className="w-full text-center py-4 mb-4">
          <p className="text-2xl tracking-widest mb-3">{state.shareString}</p>
          <div className="flex items-center justify-center gap-2">
            <NeoButton variant="primary" size="sm" onClick={handleShare}>
              <Share2 size={14} className="mr-1" /> {t("dailyResult.challengeAMate")}
            </NeoButton>
            <NeoButton
              variant="secondary"
              size="sm"
              onClick={handleCopy}
              aria-label={t("dailyResult.shareResult")}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </NeoButton>
          </div>
        </NeoCard>
      )}

      <div className="grid grid-cols-2 gap-2.5 w-full mb-8">
        {stats.map((s) => (
          <NeoCard key={s.label} color={s.color} className="text-center py-3">
            <p className="font-mono font-bold text-lg capitalize">{s.value}</p>
            <p className="text-[10px] font-heading uppercase opacity-80">
              {s.label}
            </p>
          </NeoCard>
        ))}
      </div>

      {isQuiz && state.scoreBreakdown && state.scoreBreakdown.length > 0 && (
        <NeoCard className="w-full mb-8 py-4">
          <p className="font-heading font-bold text-sm text-center mb-3">
            {t("dailyResult.scoreBreakdown")}
          </p>
          <div className="grid grid-cols-5 gap-2">
            {state.scoreBreakdown.map((item, index) => (
              <div
                key={index}
                className={`neo-border rounded-md px-2 py-2 text-center ${
                  item.correct ? "bg-success text-success-foreground" : "bg-muted"
                }`}
              >
                <p className="font-mono font-bold text-xs">{t("dailyResult.questionShort", { num: index + 1 })}</p>
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
        <NeoButton
          variant="primary"
          size="full"
          onClick={() => navigate("/home")}
        >
          {t("dailyResult.backToHome")}
        </NeoButton>
      </div>
    </div>
  );
}
