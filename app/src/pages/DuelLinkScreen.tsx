import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { Swords, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { NeoCard } from "@/components/neo/NeoCard";
import { NeoButton } from "@/components/neo/NeoButton";
import { NeoBadge } from "@/components/neo/NeoBadge";
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

function topicLabel(view: DuelView) {
  if (view.mode === "came_first") return "Which Came First";
  if (view.type === "knowledge") {
    return view.category ? formatCategoryLabel(view.category) : "Knowledge";
  }
  const sport = view.sport ?? "Sports";
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

export default function DuelLinkScreen() {
  const { linkCode } = useParams<{ linkCode: string }>();
  const navigate = useNavigate();
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
            toast.success("Result attached to your account");
            navigate(`/duel/result/${taken.duelId}`, { replace: true });
            return;
          }
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not attach result");
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
        setErrorMsg(e instanceof Error ? e.message : "Could not load duel");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkCode, isLoading]);

  if (!linkCode) return null;

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-heading font-bold animate-pulse">Loading duel…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center justify-center">
        <NeoCard shadow="lg" className="w-full max-w-md text-center py-8">
          <p className="font-heading font-bold text-lg mb-2">
            Link not available
          </p>
          <p className="text-xs text-muted-foreground mb-4 break-words">
            {errorMsg}
          </p>
          <NeoButton variant="primary" size="full" onClick={() => navigate("/home")}>
            Go home
          </NeoButton>
        </NeoCard>
      </div>
    );
  }

  if (!view) return null;

  // The challenger opening their own link.
  if (view.role === "challenger") {
    return (
      <div className="min-h-screen bg-background px-5 py-6 pb-24">
        <NeoCard shadow="lg" className="text-center py-6">
          <p className="font-heading font-bold text-lg">This is your duel</p>
          <p className="text-sm text-muted-foreground mt-1">
            Share the link with someone — they&apos;ll play first.
          </p>
        </NeoCard>
        <div className="mt-5 space-y-3">
          <NeoButton
            variant="primary"
            size="full"
            onClick={() => navigate(`/duel/play/${view.duelId}`)}
          >
            See progress
          </NeoButton>
          <NeoButton
            variant="secondary"
            size="full"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(buildShareUrl(linkCode));
                toast.success("Link copied");
              } catch {
                toast.error("Could not copy");
              }
            }}
          >
            Copy link
          </NeoButton>
          <NeoButton variant="ghost" size="full" onClick={() => navigate("/challenge")}>
            Back
          </NeoButton>
        </div>
      </div>
    );
  }

  if (phase === "intro") {
    return (
      <IntroScreen
        view={view}
        onStart={() => setPhase("playing")}
      />
    );
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
        onSkip={() => navigate("/home")}
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
}: {
  view: DuelView;
  onStart: () => void;
}) {
  const challenger = view.challenger.displayName;
  const { isAuthenticated, isGuest } = useAuth();
  const signedIn = isAuthenticated && !isGuest;
  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center pb-20">
      <NeoCard shadow="lg" className="w-full max-w-md text-center py-8">
        <Swords size={32} strokeWidth={2.5} className="mx-auto mb-3" />
        <NeoBadge color="primary" rotated size="md" className="text-base px-4">
          Duel incoming
        </NeoBadge>
        <h1 className="font-heading font-bold text-2xl mt-4">
          @{challenger} challenged you
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {topicLabel(view)} · {formatModeLabel(view.mode)} · {view.difficulty[0].toUpperCase() + view.difficulty.slice(1)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {view.questionCount} questions · async, no time pressure
        </p>
      </NeoCard>

      <div className="w-full max-w-md mt-6 space-y-3">
        <NeoButton variant="primary" size="full" onClick={onStart}>
          <ArrowRight size={18} strokeWidth={3} />
          Play now
        </NeoButton>
        {!signedIn && (
          <p className="text-[11px] text-center text-muted-foreground">
            You can play as a guest. Sign up after to keep your score.
          </p>
        )}
      </div>
    </div>
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
  const opponent = view.role === "challenger" ? view.opponent.displayName : view.challenger.displayName;
  return (
    <div className="min-h-screen bg-background px-5 py-8 flex flex-col items-center pb-20">
      <NeoCard shadow="lg" className="w-full max-w-md text-center py-8">
        <Sparkles size={28} strokeWidth={2.5} className="mx-auto mb-3" />
        <NeoBadge color="success" rotated size="md" className="text-base px-4">
          Nice round
        </NeoBadge>
        <p className="font-mono font-bold text-4xl mt-4">
          {view.myResult.score}
        </p>
        <p className="text-xs text-muted-foreground mt-1">your score</p>
        <p className="text-xs mt-3">
          vs @{opponent}: <span className="font-mono font-bold">{view.opponentResult.score}</span>
        </p>
        <p className="font-heading font-bold text-lg mt-5">
          Claim this score
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Create a username so this counts towards your rivalry — and so you can
          send a rematch.
        </p>
      </NeoCard>

      <div className="w-full max-w-md mt-6 space-y-3">
        <NeoButton variant="primary" size="full" onClick={onSignUp}>
          Create an account
        </NeoButton>
        <NeoButton variant="ghost" size="full" onClick={onSkip}>
          Maybe later
        </NeoButton>
      </div>
    </div>
  );
}
