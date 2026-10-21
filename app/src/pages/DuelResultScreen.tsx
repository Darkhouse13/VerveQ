/**
 * Duel result (`/duel/result/:duelId`) — shell-native since VerveQ ONE P3.3:
 * StageFrame + the shared ResultScreen, the head-to-head hero on the Duels
 * accent and ONE lime action (rematch once decided, share while still open).
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { Swords, Share2, Copy } from "lucide-react";
import { notify } from "@/lib/notify";
import { friendlyError } from "@/lib/errors";

import { ResultScreen } from "@/components/shell/play/result/ResultScreen";
import { ResultActions, type ResultAction } from "@/components/shell/play/result/ResultActions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DuelFrame, DuelHero, LoadingLine } from "@/components/shell/duels/DuelParts";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import { buildShareUrl, formatModeLabel, formatCategoryLabel } from "@/lib/duel";

type DuelView = {
  duelId: Id<"duels">;
  role: "challenger" | "opponent";
  status: "awaiting_opponent" | "resolved" | "expired" | "declined";
  type: "sports" | "knowledge";
  category: string | null;
  sport: string | null;
  difficulty: string;
  mode: string;
  challenger: { id: Id<"users">; username: string; displayName: string };
  opponent: { id: Id<"users"> | null; username: string; displayName: string };
  myResult: { score: number; completedAt: number | null; perQuestion: Array<{ correct: boolean; score: number }> };
  opponentResult: { score: number; completedAt: number | null; answeredCount: number };
  winnerId: Id<"users"> | null;
  linkCode: string | null;
};

type DuelStatus = {
  duelId: Id<"duels">;
  role: "challenger" | "opponent";
  status: "awaiting_opponent" | "resolved" | "expired" | "declined";
  resolvedAt: number | null;
  questionCount: number;
  myScore: number;
  myAnsweredCount: number;
  myCompleted: boolean;
  opponentScore: number;
  opponentAnsweredCount: number;
  opponentCompleted: boolean;
  winnerId: Id<"users"> | null;
  openRematch: { duelId: Id<"duels">; byMe: boolean } | null;
  bucket: "your_turn" | "awaiting_opponent" | "resolved";
};

function topicLabel(view: DuelView, t: (key: string) => string): string {
  if (view.mode === "came_first") return t("duelResult.whichCameFirst");
  if (view.type === "knowledge") {
    return view.category ? formatCategoryLabel(view.category) : t("duelResult.knowledge");
  }
  const sport = view.sport ?? t("duelResult.trivia");
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

export default function DuelResultScreen() {
  const { duelId } = useParams<{ duelId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation("screens");
  const { user, isAuthenticated } = useAuth();
  const getMyDuel = useMutation(api.duels.getMyDuel);
  const rematchMut = useMutation(api.duels.rematch);
  const declineMut = useMutation(api.duels.decline);
  const markSharedMut = useMutation(api.duels.markShared);
  const [view, setView] = useState<DuelView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rematching, setRematching] = useState(false);
  const [declining, setDeclining] = useState(false);
  const liveStatus = useQuery(
    api.duels.getDuelStatus,
    view ? { duelId: view.duelId } : "skip",
  ) as DuelStatus | undefined;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/?from=duel", { replace: true });
      return;
    }
    if (!duelId) return;
    (async () => {
      try {
        const v = (await getMyDuel({ duelId: duelId as Id<"duels"> })) as DuelView;
        setView(v);
      } catch (e) {
        setError(friendlyError(e, t("duelResult.errorLoadDuel")));
      }
    })();
  }, [duelId, getMyDuel, isAuthenticated, navigate, t]);

  const backToDuels = () => navigate(SHELL_ROUTES.duels);

  if (error) {
    return (
      <DuelFrame title={t("duelResult.title")} onExit={backToDuels}>
        <Card elevation="lifted" padding="lg" className="mt-6 text-center">
          <p className="mb-2 font-heading text-title-sm font-bold">{t("duelResult.couldNotLoadResult")}</p>
          <p className="mb-5 break-words text-body-sm text-muted-foreground">{error}</p>
          <Button variant="primary" size="lg" block onClick={backToDuels}>
            {t("duelResult.backToDuels")}
          </Button>
        </Card>
      </DuelFrame>
    );
  }

  if (!view) {
    return (
      <DuelFrame title={t("duelResult.title")} onExit={backToDuels}>
        <LoadingLine>{t("duelResult.loading")}</LoadingLine>
      </DuelFrame>
    );
  }

  const myId = user?._id;
  const status = liveStatus?.status ?? view.status;
  const winnerId = liveStatus?.winnerId ?? view.winnerId;
  const myScore = liveStatus?.myScore ?? view.myResult.score;
  const opponentScore = liveStatus?.opponentScore ?? view.opponentResult.score;
  const myWon = !!winnerId && myId === winnerId;
  const myLost = !!winnerId && myId !== winnerId;
  const isDraw = status === "resolved" && !winnerId;
  const stillOpen = status === "awaiting_opponent";
  const justResolved = view.status === "awaiting_opponent" && status !== "awaiting_opponent";
  const opponentName =
    view.role === "challenger" ? view.opponent.displayName : view.challenger.displayName;
  const totalQ = view.myResult.perQuestion.length;
  const correctQ = view.myResult.perQuestion.filter((q) => q.correct).length;

  const headlineText = stillOpen
    ? view.opponent.id === null
      ? t("duelResult.inviteAnOpponent")
      : t("duelResult.waitingForOpponent")
    : myWon
      ? t("duelResult.youWon")
      : myLost
        ? t("duelResult.youLost")
        : isDraw
          ? t("duelResult.draw")
          : status === "expired"
            ? t("duelResult.expired")
            : t("duelResult.declined");

  const shareCardText =
    myWon || stillOpen
      ? t("duelResult.shareScore", { score: myScore, max: totalQ * 100 })
      : t("duelResult.shareFinal", { myScore, opponentScore });

  const shareUrl = view.linkCode ? buildShareUrl(view.linkCode) : null;
  // The challenger sharing a link duel is the real "challenge issued" moment —
  // record it (once, server-side) whenever they share or copy.
  const canInvite = view.role === "challenger" && !!shareUrl;
  const awaitingInvite = stillOpen && canInvite && view.opponent.id === null;
  const markShared = () => {
    if (canInvite) markSharedMut({ duelId: view.duelId }).catch(() => {});
  };

  const handleShare = async () => {
    markShared();
    const payload = { title: t("duelResult.shareTitle"), text: shareCardText, url: shareUrl ?? window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(`${shareCardText} ${payload.url}`);
        notify.success(t("duelResult.resultCopied"));
      }
    } catch {
      /* user cancelled */
    }
  };

  const handleCopy = async () => {
    markShared();
    try {
      await navigator.clipboard.writeText(`${shareCardText} ${shareUrl ?? ""}`);
      notify.success(t("duelResult.copied"));
    } catch {
      notify.error(t("duelResult.couldNotCopy"));
    }
  };

  const openRematch = liveStatus?.openRematch ?? null;

  const handleRematch = async () => {
    // An open rematch already exists (sent by either side) — just enter it.
    if (openRematch) {
      navigate(`/duel/play/${openRematch.duelId}`);
      return;
    }
    setRematching(true);
    try {
      const result = await rematchMut({ duelId: view.duelId });
      if (result.existing) {
        notify.success(t("duelResult.rematchAlreadyOpen"));
      } else if (result.linkCode) {
        // It's now a link rematch (e.g. former guest); send to play screen.
        notify.success(t("duelResult.rematchReadyShareLink"));
      } else {
        notify.success(t("duelResult.rematchSent"));
      }
      navigate(`/duel/play/${result.duelId}`);
    } catch (e) {
      notify.error(friendlyError(e, t("duelResult.errorRematchFailed")));
    } finally {
      setRematching(false);
    }
  };

  const handleDeclineRematch = async () => {
    if (!openRematch || openRematch.byMe) return;
    setDeclining(true);
    try {
      await declineMut({ duelId: openRematch.duelId });
      notify.success(t("duelResult.rematchDeclined"));
    } catch (e) {
      notify.error(friendlyError(e, t("duelResult.errorCouldNotDecline")));
    } finally {
      setDeclining(false);
    }
  };

  // A link duel nobody has opened yet: the opponent is a server placeholder.
  const noOpponentYet = stillOpen && view.opponent.id === null;
  const rematchLabel = openRematch
    ? openRematch.byMe
      ? t("duelResult.openYourRematch")
      : t("duelResult.acceptTheRematch")
    : myLost
      ? t("duelResult.getRevenge")
      : myWon
        ? t("duelResult.defendYourWin")
        : t("duelResult.runItBack");
  const shareAction: ResultAction = {
    label: awaitingInvite ? t("duelResult.inviteFriendToBeatScore") : t("duelResult.shareResult"),
    icon: <Share2 size={18} aria-hidden="true" />,
    onClick: () => void handleShare(),
    testId: "duel-result-share",
  };
  // One lime action: the rematch once the duel is decided, the share while
  // it is still open (inviting is then the only way forward).
  const primary: ResultAction = stillOpen
    ? shareAction
    : {
        label: rematchLabel,
        icon: <Swords size={18} aria-hidden="true" />,
        onClick: () => void handleRematch(),
        loading: rematching,
        testId: "duel-result-rematch",
      };
  const secondary: ResultAction[] = [
    ...(stillOpen ? [] : [shareAction]),
    ...(shareUrl
      ? [
          {
            label: t("duelResult.copyLink"),
            icon: <Copy size={18} aria-hidden="true" />,
            onClick: () => void handleCopy(),
            testId: "duel-result-copy",
          },
        ]
      : []),
  ];

  return (
    <DuelFrame title={t("duelResult.title")} onExit={backToDuels}>
      <ResultScreen
        testId="duel-result"
        top={
          openRematch && !openRematch.byMe ? (
            // Live rematch state — appears in place the moment the other
            // player sends one. Accepting is the primary action below.
            <Card elevation="flat" padding="sm" className="flex items-center justify-between gap-3 border-mode-accent" data-testid="duel-result-rematch-incoming">
              <p className="inline-flex min-w-0 items-center gap-1.5 font-heading text-body-sm font-bold">
                <Swords size={16} strokeWidth={3} className="shrink-0 text-mode-accent" aria-hidden="true" />
                {t("duelResult.opponentWantsRematch", { name: opponentName })}
              </p>
              <Button variant="ghost" size="sm" loading={declining} onClick={handleDeclineRematch}>
                {t("duelResult.decline")}
              </Button>
            </Card>
          ) : openRematch?.byMe ? (
            <Card elevation="flat" padding="sm">
              <p className="font-heading text-body-sm font-bold">{t("duelResult.rematchSentTitle")}</p>
              <p className="truncate text-meta text-muted-foreground">
                {t("duelResult.waitingForOpponentToPlay", { name: opponentName })}
              </p>
            </Card>
          ) : undefined
        }
        hero={
          <DuelHero
            eyebrow={`${topicLabel(view, t)} · ${formatModeLabel(view.mode, t)} · ${view.difficulty}`}
            headline={headlineText}
            myScore={myScore}
            opponentScore={noOpponentYet ? undefined : opponentScore}
            youLabel={noOpponentYet ? t("duelPlay.yourScore") : t("duelHistory.scoreYou")}
            opponentLabel={noOpponentYet ? undefined : `@${opponentName}`}
            testId="duel-result-hero"
          >
            {justResolved && (
              <p className="mt-3 inline-block rounded-full bg-ink px-3 py-1 text-body-sm font-bold text-cream">
                {t("duelResult.opponentJustFinished", { name: opponentName })}
              </p>
            )}
          </DuelHero>
        }
        status={
          <p className="text-center font-mono text-body-sm text-muted-foreground" data-testid="duel-result-accuracy">
            {t("duelResult.correctOfTotal", { correct: correctQ, total: totalQ })} ·{" "}
            {totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0}%
          </p>
        }
        actions={<ResultActions primary={primary} secondary={secondary} />}
        footer={
          <Button variant="ghost" size="sm" onClick={backToDuels} data-testid="duel-result-back">
            {t("duelResult.backToDuels")}
          </Button>
        }
      />
    </DuelFrame>
  );
}
