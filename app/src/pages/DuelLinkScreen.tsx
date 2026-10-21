/**
 * Duel link landing (`/duel/:linkCode`) — the cold entry for a friend's duel.
 * Shell-native since VerveQ ONE P3.3: every phase (intro, play, the guest's
 * claim prompt) renders in StageFrame on the Duels accent, one lime action each.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { Swords, ArrowRight, Sparkles, Copy } from "lucide-react";
import { notify } from "@/lib/notify";
import { friendlyError } from "@/lib/errors";

import { ResultScreen } from "@/components/shell/play/result/ResultScreen";
import { ResultActions } from "@/components/shell/play/result/ResultActions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DuelFrame, DuelHero, LoadingLine } from "@/components/shell/duels/DuelParts";
import { SHELL_ROUTES } from "@/lib/shellRoutes";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildShareUrl,
  clearGuestDuelToken,
  formatCategoryLabel,
  formatModeLabel,
  getOrCreateGuestDuelToken,
  peekPendingDuelAttach,
  rememberPendingDuelAttach,
  takePendingDuelAttach,
} from "@/lib/duel";
import { DuelPlay } from "./DuelPlayScreen";

type DuelView = {
  duelId: Id<"duels">;
  role: "challenger" | "opponent";
  status: "awaiting_opponent" | "resolved" | "expired" | "declined";
  type: "sports" | "knowledge";
  category: string | null;
  sport: string | null;
  difficulty: "easy" | "intermediate" | "hard";
  mode: string;
  expiresAt: number;
  questionCount: number;
  challenger: { id: Id<"users">; username: string; displayName: string };
  opponent: { id: Id<"users"> | null; username: string; displayName: string };
  myResult: {
    score: number;
    completedAt: number | null;
    perQuestion: Array<{
      questionIndex: number;
      checksum: string;
      answer: string;
      correct: boolean;
      score: number;
    }>;
  };
  opponentResult: {
    score: number;
    completedAt: number | null;
    answeredCount: number;
  };
  winnerId: Id<"users"> | null;
  currentQuestion: {
    checksum: string;
    question: string;
    options: string[];
    optionValues: string[];
    category: string;
    difficulty: string;
    imageUrl: string | null;
  } | null;
  linkCode: string | null;
};

type LandingPhase =
  | "loading"
  | "intro"
  | "playing"
  | "completed_guest"
  | "completed_account"
  | "error";

function topicLabel(view: DuelView, t: (key: string) => string) {
  if (view.mode === "came_first") return t("duelLink.topicCameFirst");
  if (view.type === "knowledge") {
    return view.category
      ? formatCategoryLabel(view.category)
      : t("duelLink.topicKnowledge");
  }
  const sport = view.sport ?? t("duelLink.topicSports");
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

export default function DuelLinkScreen() {
  const { linkCode } = useParams<{ linkCode: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("screens");
  const { user, isAuthenticated, isGuest, isLoading } = useAuth();
  const getByLinkCode = useMutation(api.duels.getByLinkCode);
  const attachGuestResult = useMutation(api.duels.attachGuestResult);

  const [phase, setPhase] = useState<LandingPhase>("loading");
  const [view, setView] = useState<DuelView | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);

  // Wait for auth to stabilise before claiming — otherwise a refreshing user
  // could be mistakenly treated as a guest mid-load.
  useEffect(() => {
    if (!linkCode) return;
    if (isLoading) return;
    let cancelled = false;
    (async () => {
      // 1. If we have a pending attach from a prior guest session, try it.
      const pending = peekPendingDuelAttach();
      if (
        pending &&
        pending.linkCode === linkCode &&
        isAuthenticated &&
        !isGuest &&
        user
      ) {
        try {
          const taken = takePendingDuelAttach();
          if (taken) {
            await attachGuestResult({
              duelId: taken.duelId as Id<"duels">,
              guestToken: taken.guestToken,
            });
            clearGuestDuelToken(linkCode);
            notify.success(t("duelLink.toastResultAttached"));
            navigate(`/duel/result/${taken.duelId}`, { replace: true });
            return;
          }
        } catch (e) {
          notify.error(friendlyError(e, t("duelLink.errorAttachFailed")));
        }
      }

      // 2. Prepare guest token. The server's getByLinkCode supports both
      // authed and unauthed callers — the token only matters for unauthed
      // guests, which are detected by getAuthUserId(ctx) returning null.
      const token = getOrCreateGuestDuelToken(linkCode);
      if (!cancelled) setGuestToken(token);

      // 4. Claim the duel / fetch view.
      try {
        const fresh = (await getByLinkCode({
          linkCode,
          guestToken: token,
          locale: i18n.resolvedLanguage ?? i18n.language,
        })) as DuelView;
        if (cancelled) return;
        setView(fresh);
        if (
          fresh.status === "resolved" ||
          fresh.status === "expired" ||
          fresh.status === "declined"
        ) {
          if (isAuthenticated && !isGuest && user) {
            setPhase("completed_account");
          } else {
            setPhase("completed_guest");
          }
        } else {
          setPhase("intro");
        }
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(friendlyError(e, t("duelLink.errorLoadFailed")));
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode, isLoading]);

  if (!linkCode) return null;

  const goHome = () => navigate("/home");

  if (phase === "loading") {
    return (
      <DuelFrame onExit={goHome}>
        <LoadingLine>{t("duelLink.loading")}</LoadingLine>
      </DuelFrame>
    );
  }

  if (phase === "error") {
    return (
      <DuelFrame onExit={goHome}>
        <Card elevation="lifted" padding="lg" className="mt-6 text-center" data-testid="duel-link-error">
          <p className="mb-2 font-heading text-title-sm font-bold">{t("duelLink.linkUnavailableTitle")}</p>
          <p className="mb-5 break-words text-body-sm text-muted-foreground">{errorMsg}</p>
          <Button variant="primary" size="lg" block onClick={goHome}>
            {t("duelLink.goHome")}
          </Button>
        </Card>
      </DuelFrame>
    );
  }

  if (!view) return null;

  // The challenger opening their own link.
  if (view.role === "challenger") {
    return (
      <DuelFrame onExit={() => navigate(SHELL_ROUTES.duels)}>
        <div className="flex flex-col gap-4 py-2" data-testid="duel-link-own">
          <Card elevation="lifted" padding="lg" className="text-center">
            <p className="font-heading text-title-sm font-bold">{t("duelLink.yourDuelTitle")}</p>
            <p className="mt-1 text-body-sm text-muted-foreground">{t("duelLink.yourDuelSubtitle")}</p>
          </Card>
          <Button variant="primary" size="lg" block onClick={() => navigate(`/duel/play/${view.duelId}`)}>
            {t("duelLink.seeProgress")}
          </Button>
          <Button
            variant="secondary"
            size="md"
            block
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(buildShareUrl(linkCode));
                notify.success(t("duelLink.toastLinkCopied"));
              } catch {
                notify.error(t("duelLink.toastCopyFailed"));
              }
            }}
          >
            <Copy size={18} aria-hidden="true" />
            {t("duelLink.copyLink")}
          </Button>
        </div>
      </DuelFrame>
    );
  }

  if (phase === "intro") {
    return <IntroScreen view={view} onStart={() => setPhase("playing")} onExit={goHome} />;
  }

  if (phase === "playing") {
    return (
      <DuelPlay
        duelId={view.duelId}
        guestToken={!isGuest && isAuthenticated ? undefined : guestToken ?? undefined}
        initialView={view}
      />
    );
  }

  // completed_guest / completed_account
  if (phase === "completed_guest") {
    return (
      <ConvertPrompt
        view={view}
        guestToken={guestToken ?? ""}
        linkCode={linkCode}
        onSignUp={() => {
          if (guestToken) {
            rememberPendingDuelAttach({
              duelId: view.duelId,
              linkCode,
              guestToken,
              savedAt: Date.now(),
            });
          }
          navigate(`/?mode=signup&from=duel`);
        }}
        onSkip={goHome}
      />
    );
  }

  // completed_account: redirect to the standard result screen.
  if (phase === "completed_account") {
    navigate(`/duel/result/${view.duelId}`, { replace: true });
    return null;
  }

  return null;
}

function IntroScreen({
  view,
  onStart,
  onExit,
}: {
  view: DuelView;
  onStart: () => void;
  onExit: () => void;
}) {
  const { t } = useTranslation("screens");
  const challenger = view.challenger.displayName;
  const { isAuthenticated, isGuest } = useAuth();
  const signedIn = isAuthenticated && !isGuest;
  return (
    <DuelFrame onExit={onExit}>
      <div className="flex flex-col gap-4 py-2" data-testid="duel-link-intro">
        <Card tone="mode" elevation="lifted" padding="lg" className="text-center">
          <Swords size={32} strokeWidth={2.5} className="mx-auto mb-3" aria-hidden="true" />
          <p className="font-mono text-eyebrow font-bold uppercase">{t("duelLink.duelIncoming")}</p>
          <h1 className="mt-2 font-heading text-title-lg font-bold">{t("duelLink.challengedYou", { challenger })}</h1>
          <p className="mt-3 text-body-sm font-bold">
            {topicLabel(view, t)} · {formatModeLabel(view.mode, t)} ·{" "}
            {view.difficulty[0].toUpperCase() + view.difficulty.slice(1)}
          </p>
          <p className="mt-1 text-body-sm">{t("duelLink.questionCount", { count: view.questionCount })}</p>
        </Card>

        <Button variant="primary" size="lg" block onClick={onStart} data-testid="duel-link-play">
          <ArrowRight size={20} strokeWidth={3} aria-hidden="true" />
          {t("duelLink.playNow")}
        </Button>
        {!signedIn && <p className="text-center text-meta text-muted-foreground">{t("duelLink.guestHint")}</p>}
      </div>
    </DuelFrame>
  );
}

function ConvertPrompt({
  view,
  onSignUp,
  onSkip,
}: {
  view: DuelView;
  guestToken: string;
  linkCode: string;
  onSignUp: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation("screens");
  const opponent = view.role === "challenger" ? view.opponent.displayName : view.challenger.displayName;
  return (
    <DuelFrame onExit={onSkip}>
      <ResultScreen
        testId="duel-link-claim"
        hero={
          <DuelHero
            eyebrow={t("duelLink.niceRound")}
            headline={t("duelLink.claimScoreTitle")}
            myScore={view.myResult.score}
            opponentScore={view.opponentResult.score}
            youLabel={t("duelLink.yourScore")}
            opponentLabel={`@${opponent}`}
          />
        }
        status={<p className="text-center text-body-sm text-muted-foreground">{t("duelLink.claimScoreSubtitle")}</p>}
        actions={
          <ResultActions
            primary={{
              label: t("duelLink.createAccount"),
              icon: <Sparkles size={18} aria-hidden="true" />,
              onClick: onSignUp,
              testId: "duel-link-signup",
            }}
            secondary={[{ label: t("duelLink.maybeLater"), onClick: onSkip, testId: "duel-link-skip" }]}
          />
        }
      />
    </DuelFrame>
  );
}
